/* uwaism.com — lightweight visit + link-click tracker. */
(function () {
  var WORKER = "https://uwaism-tracker.uwaismm05.workers.dev";
  var SOURCES = ["linkedin", "message", "resume"];

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  var local = store("localStorage");
  var session = store("sessionStorage");

  // Set from admin.html ("Don't track this browser") so your own visits stay out.
  try { if (local && local.getItem("uw_ignore") === "1") return; } catch (e) {}

  // Anonymous random ID per browser, so two phones on the same Wi-Fi
  // (same public IP) still count as two visitors.
  var visitor = "";
  try {
    visitor = local && local.getItem("uw_vid");
    if (!visitor) {
      visitor = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
      local && local.setItem("uw_vid", visitor);
    }
  } catch (e) {}

  // The ?source= tag only exists on the landing page, so remember it for the
  // rest of the visit — later pages and clicks keep the same source.
  var source = "direct";
  try {
    var tagged = new URL(location.href).searchParams.get("source");
    if (SOURCES.indexOf(tagged) >= 0) {
      source = tagged;
      session && session.setItem("uw_source", tagged);
    } else if (session && SOURCES.indexOf(session.getItem("uw_source")) >= 0) {
      source = session.getItem("uw_source");
    }
  } catch (e) {}

  // text/plain keeps this a "simple" request: no CORS preflight, which is
  // what was silently dropping beacons on some phones and browsers.
  function send(route, data) {
    data.visitor = visitor;
    data.source = source;
    data.path = location.pathname;
    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon &&
          navigator.sendBeacon(WORKER + route, new Blob([body], { type: "text/plain;charset=UTF-8" }))) {
        return;
      }
    } catch (e) {}
    try {
      fetch(WORKER + route, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: body,
        keepalive: true,
        mode: "no-cors"
      }).catch(function () {});
    } catch (e) {}
  }

  send("/track", { referrer: document.referrer || "" });

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href === "#" || href === "") return;
    var label = (a.getAttribute("aria-label") || a.textContent || "")
      .replace(/\s+/g, " ").trim().slice(0, 80);
    if (!label) {
      var img = a.querySelector("img[alt]");
      label = img ? img.getAttribute("alt").slice(0, 80) : href;
    }
    // Same-site links: drop ?source= etc. so one link is one row in the dashboard.
    var full = a.href || href;
    try {
      var u = new URL(full, location.href);
      if (u.origin === location.origin) full = u.pathname + u.hash;
    } catch (err) {}
    send("/click", { href: full, label: label });
  }, true);
})();
