/**
 * uwaism.com — visit tracker + admin API
 * Deploy this as a Cloudflare Worker, bind D1 as `uwaism_analytics`,
 * and set a secret `ADMIN_TOKEN` (Workers & Pages → your worker → Settings → Variables).
 *
 * Routes:
 *   POST /track   — logs a page view (called from the site itself)
 *   GET  /stats   — returns aggregated analytics (requires Authorization: Bearer <ADMIN_TOKEN>)
 */

const ALLOWED_ORIGIN = "https://uwaism.com";

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (url.pathname === "/track" && request.method === "POST") {
      return handleTrack(request, env, origin);
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return handleStats(request, env, origin);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};

async function handleTrack(request, env, origin) {
  try {
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const country = request.cf && request.cf.country ? request.cf.country : null;
    const path = typeof body.path === "string" ? body.path.slice(0, 200) : "/";
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 300) : "";
    const source = ["linkedin", "message", "resume", "direct"].includes(body.source)
      ? body.source
      : "direct";
    const userAgent = (request.headers.get("User-Agent") || "").slice(0, 300);

    await env.uwaism_analytics.prepare(
      `INSERT INTO visits (ip, path, referrer, source, user_agent, country, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(ip, path, referrer, source, userAgent, country).run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
}

async function handleStats(request, env, origin) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");

  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const [totalRow, uniqueRow, dailyRows, topIpRows, recentRows] = await Promise.all([
    env.uwaism_analytics.prepare(`SELECT COUNT(*) AS n FROM visits`).first(),
    env.uwaism_analytics.prepare(`SELECT COUNT(DISTINCT ip) AS n FROM visits`).first(),
    env.uwaism_analytics.prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n
       FROM visits
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY day ORDER BY day ASC`
    ).all(),
    env.uwaism_analytics.prepare(
      `SELECT ip, COUNT(*) AS visits, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen,
              MAX(country) AS country
       FROM visits
       GROUP BY ip
       ORDER BY visits DESC
       LIMIT 50`
    ).all(),
    env.uwaism_analytics.prepare(
      `SELECT ip, path, referrer, country, created_at
       FROM visits
       ORDER BY created_at DESC
       LIMIT 50`
    ).all(),
  ]);

  const payload = {
    ok: true,
    total_visits: totalRow?.n || 0,
    unique_visitors: uniqueRow?.n || 0,
    daily: dailyRows?.results || [],
    top_ips: topIpRows?.results || [],
    recent: recentRows?.results || [],
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
