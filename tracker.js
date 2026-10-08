/* uwaism.com — lightweight visit tracker. Fires once per page load. */
(function () {
  var WORKER_URL = "https://uwaism-tracker.uwaismm05.workers.dev/track";
  try {
    var url = new URL(location.href);
    var source = ["linkedin", "message", "resume"].indexOf(url.searchParams.get("source")) >= 0
      ? url.searchParams.get("source")
      : "direct";
    var payload = JSON.stringify({
      path: location.pathname,
      referrer: document.referrer || "",
      source: source
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(WORKER_URL, new Blob([payload], { type: "application/json" }));
    } else {
      fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(function () {});
    }
  } catch (e) {}
})();
