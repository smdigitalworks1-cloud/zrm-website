/*
  ZRM shared values for every page (index.html, payment.html, thank-you.html).

  Any element with data-cv="key"      gets its text replaced with the value.
  Any link    with data-cv-href="key" gets its href replaced with the value.

  1. The fallback values below are applied straight away.
  2. Then the live GoHighLevel custom values are loaded from /api/zrm-values
     (Vercel function, see api/zrm-values.js) and replace them. Change the
     values in GHL → Settings → Custom Values; no code edit needed.
  If the API is unavailable, the fallback values stay on the page.
*/
(function () {
  var FALLBACK = {
    zrm_online_date: "OCT 16 2026 – OCT 18 2026",
    "02_zrm_online_time": "07:00 AM to 08:30 AM",
    zrm_replay: "07:00 PM to 08:30 PM",
    zrm_group_link: "https://chat.whatsapp.com/Infyusibnlv2fQCTiLHs7p"
  };

  function apply(values) {
    function has(key) {
      return Object.prototype.hasOwnProperty.call(values, key) && values[key];
    }

    document.querySelectorAll("[data-cv]").forEach(function (el) {
      var key = el.getAttribute("data-cv");
      if (has(key)) el.textContent = values[key];
    });

    document.querySelectorAll("[data-cv-href]").forEach(function (el) {
      var key = el.getAttribute("data-cv-href");
      // only accept real https links for hrefs
      if (has(key) && /^https:\/\//.test(values[key])) el.setAttribute("href", values[key]);
    });
  }

  apply(FALLBACK);

  if (!window.fetch) return;
  fetch("/api/zrm-values")
    .then(function (res) { return res.ok ? res.json() : {}; })
    .then(apply)
    .catch(function () {});
})();
