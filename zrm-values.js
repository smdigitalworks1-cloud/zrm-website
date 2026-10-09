/*
  ZRM shared values for every page (index.html, payment.html, thank-you.html).

  Any element with data-cv="key"      gets its text replaced with the value.
  Any link    with data-cv-href="key" gets its href replaced with the value.

  1. The fallback values below are applied straight away (text only – the
     WhatsApp group link has no fallback, it must come from GHL).
  2. Then the live GoHighLevel custom values are loaded from /api/zrm-values
     (Vercel function, see api/zrm-values.js) and replace them. Change the
     values in GHL → Settings → Custom Values; no code edit needed.
  If the API is unavailable, the fallback values stay on the page.

  When loading has finished (or failed) a "zrm-values" event is fired on
  document with the loaded values in event.detail.
*/
(function () {
  var FALLBACK = {
    zrm_online_date: "OCT 16 2026 – OCT 18 2026",
    "02_zrm_online_time": "07:00 AM to 08:30 AM",
    zrm_replay: "07:00 PM to 08:30 PM"
  };

  // a link value is used only if it parses as a real https:// URL
  function isHttpsUrl(value) {
    try {
      var raw = String(value).trim();
      if (/\s/.test(raw)) return false;
      var url = new URL(raw);
      return url.protocol === "https:" && /\./.test(url.hostname);
    } catch (e) {
      return false;
    }
  }

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
      if (has(key) && isHttpsUrl(values[key])) el.setAttribute("href", values[key]);
    });
  }

  apply(FALLBACK);

  function done(values) {
    var ev;
    try {
      ev = new CustomEvent("zrm-values", { detail: values });
    } catch (e) {
      ev = document.createEvent("CustomEvent");
      ev.initCustomEvent("zrm-values", false, false, values);
    }
    document.dispatchEvent(ev);
  }

  if (!window.fetch) { done({}); return; }
  fetch("/api/zrm-values")
    .then(function (res) { return res.ok ? res.json() : {}; })
    .then(function (values) { apply(values); done(values); })
    .catch(function () { done({}); });
})();
