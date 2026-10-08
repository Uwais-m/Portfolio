/**
 * uwaism.com — visit + click tracker and admin API
 * Deploy this as a Cloudflare Worker, bind D1 as `uwaism_analytics`,
 * and set a secret `ADMIN_TOKEN` (Workers & Pages → your worker → Settings → Variables).
 *
 * Routes:
 *   POST /track   — logs a page view (called from the site itself)
 *   POST /click   — logs a link click (called from the site itself)
 *   GET  /stats   — returns aggregated analytics (requires Authorization: Bearer <ADMIN_TOKEN>)
 *                   optional ?source=all|linkedin|message|resume|direct
 */

const ALLOWED_ORIGINS = ["https://uwaism.com", "https://www.uwaism.com"];
const SOURCES = ["linkedin", "message", "resume", "direct"];

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    // sendBeacon sends with credentials, so browsers require this on the response.
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// Brings older databases up to date the first time each Worker instance runs,
// so no manual migration is needed after deploying.
let schemaReady = false;
async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      visitor_id TEXT,
      source TEXT NOT NULL DEFAULT 'direct',
      path TEXT,
      href TEXT,
      label TEXT,
      user_agent TEXT,
      country TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_clicks_ip ON clicks(ip)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_clicks_created ON clicks(created_at)`),
  ]);
  try {
    await db.prepare(`ALTER TABLE visits ADD COLUMN visitor_id TEXT`).run();
  } catch (err) {
    if (!/duplicate column/i.test(String(err))) throw err;
  }
  schemaReady = true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      await ensureSchema(env.uwaism_analytics);

      if (url.pathname === "/track" && request.method === "POST") {
        return await handleTrack(request, env, origin);
      }
      if (url.pathname === "/click" && request.method === "POST") {
        return await handleClick(request, env, origin);
      }
      if (url.pathname === "/stats" && request.method === "GET") {
        return await handleStats(request, env, origin, url);
      }
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500, origin);
    }

    return new Response("Not found", { status: 404, headers: corsHeaders(origin) });
  },
};

// The tracker posts text/plain (to avoid a CORS preflight), so parse the body ourselves.
async function readBody(request) {
  try {
    return JSON.parse(await request.text());
  } catch {
    return {};
  }
}

function common(request, body) {
  return {
    ip: request.headers.get("CF-Connecting-IP") || "unknown",
    country: request.cf && request.cf.country ? request.cf.country : null,
    userAgent: (request.headers.get("User-Agent") || "").slice(0, 300),
    visitor: typeof body.visitor === "string" ? body.visitor.slice(0, 64) : null,
    source: SOURCES.includes(body.source) ? body.source : "direct",
    path: typeof body.path === "string" ? body.path.slice(0, 200) : "/",
  };
}

async function handleTrack(request, env, origin) {
  const body = await readBody(request);
  const c = common(request, body);
  const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 300) : "";

  await env.uwaism_analytics.prepare(
    `INSERT INTO visits (ip, visitor_id, path, referrer, source, user_agent, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(c.ip, c.visitor, c.path, referrer, c.source, c.userAgent, c.country).run();

  return json({ ok: true }, 200, origin);
}

async function handleClick(request, env, origin) {
  const body = await readBody(request);
  const c = common(request, body);
  const href = typeof body.href === "string" ? body.href.slice(0, 300) : "";
  const label = typeof body.label === "string" ? body.label.slice(0, 80) : "";
  if (!href) return json({ ok: false, error: "missing href" }, 400, origin);

  await env.uwaism_analytics.prepare(
    `INSERT INTO clicks (ip, visitor_id, source, path, href, label, user_agent, country, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(c.ip, c.visitor, c.source, c.path, href, label, c.userAgent, c.country).run();

  return json({ ok: true }, 200, origin);
}

async function handleStats(request, env, origin, url) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "Unauthorized" }, 401, origin);
  }

  const db = env.uwaism_analytics;
  const requested = url.searchParams.get("source") || "all";
  const source = SOURCES.includes(requested) ? requested : "all";
  // Every query filters the same way; `?1` is the source or 'all'.
  const F = `(?1 = 'all' OR source = ?1)`;
  // One visitor = one browser (visitor_id); older rows without it fall back to IP.
  const VKEY = `COALESCE(NULLIF(visitor_id, ''), ip)`;
  const q = (sql) => db.prepare(sql).bind(source);

  const [totals, repeat, clickTotals, daily, dailyClicks, bySource, links, ips, recent] = await Promise.all([
    q(`SELECT COUNT(*) AS visits, COUNT(DISTINCT ${VKEY}) AS visitors, COUNT(DISTINCT ip) AS ips
       FROM visits WHERE ${F}`).first(),
    q(`SELECT COUNT(*) AS n FROM (
         SELECT ${VKEY} AS k FROM visits WHERE ${F} GROUP BY k
         HAVING COUNT(DISTINCT date(created_at)) > 1)`).first(),
    q(`SELECT COUNT(*) AS clicks, COUNT(DISTINCT ${VKEY}) AS clickers FROM clicks WHERE ${F}`).first(),
    q(`SELECT date(created_at) AS day, COUNT(*) AS n FROM visits
       WHERE ${F} AND created_at >= datetime('now', '-30 days')
       GROUP BY day ORDER BY day ASC`).all(),
    q(`SELECT date(created_at) AS day, COUNT(*) AS n FROM clicks
       WHERE ${F} AND created_at >= datetime('now', '-30 days')
       GROUP BY day ORDER BY day ASC`).all(),
    db.prepare(`SELECT s.source,
                  (SELECT COUNT(*) FROM visits v WHERE v.source = s.source) AS visits,
                  (SELECT COUNT(*) FROM clicks c WHERE c.source = s.source) AS clicks
                FROM (SELECT 'linkedin' AS source UNION ALL SELECT 'message'
                      UNION ALL SELECT 'resume' UNION ALL SELECT 'direct') s`).all(),
    q(`SELECT label, href, COUNT(*) AS clicks, COUNT(DISTINCT ${VKEY}) AS people
       FROM clicks WHERE ${F}
       GROUP BY href ORDER BY clicks DESC LIMIT 25`).all(),
    q(`SELECT v.ip, v.visits, v.devices, v.days, v.country, v.ua, v.first_seen, v.last_seen,
              COALESCE(c.clicks, 0) AS clicks
       FROM (SELECT ip, COUNT(*) AS visits, COUNT(DISTINCT ${VKEY}) AS devices,
                    COUNT(DISTINCT date(created_at)) AS days,
                    MAX(country) AS country, MAX(user_agent) AS ua,
                    MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
             FROM visits WHERE ${F} GROUP BY ip) v
       LEFT JOIN (SELECT ip, COUNT(*) AS clicks FROM clicks WHERE ${F} GROUP BY ip) c
         ON c.ip = v.ip
       ORDER BY v.last_seen DESC
       LIMIT 100`).all(),
    q(`SELECT * FROM (
         SELECT 'view' AS kind, ip, source, path AS what, country, user_agent AS ua, created_at
         FROM visits WHERE ${F}
         UNION ALL
         SELECT 'click' AS kind, ip, source, COALESCE(NULLIF(label, ''), href) AS what, country,
                user_agent AS ua, created_at
         FROM clicks WHERE ${F})
       ORDER BY created_at DESC LIMIT 60`).all(),
  ]);

  return json({
    ok: true,
    source,
    total_visits: totals?.visits || 0,
    unique_visitors: totals?.visitors || 0,
    unique_ips: totals?.ips || 0,
    repeat_visitors: repeat?.n || 0,
    total_clicks: clickTotals?.clicks || 0,
    clickers: clickTotals?.clickers || 0,
    daily: daily?.results || [],
    daily_clicks: dailyClicks?.results || [],
    by_source: bySource?.results || [],
    top_links: links?.results || [],
    ips: ips?.results || [],
    recent: recent?.results || [],
  }, 200, origin);
}
