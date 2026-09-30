/* uwaism.com — lightweight visit tracker. Fires once per page load. */
(function () {
  var WORKER_URL = "https://YOUR-WORKER-SUBDOMAIN.workers.dev/track";
  try {
    var payload = JSON.stringify({
      path: location.pathname,
      referrer: document.referrer || ""
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
