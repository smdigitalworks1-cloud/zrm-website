// Fills [data-cv] text and [data-cv-href] links with the live GHL custom values.
// If the request fails, the text already in the HTML stays as-is.
(function () {
  fetch("zrm-values.php")
    .then(function (res) { return res.ok ? res.json() : {}; })
    .then(function (values) {
      document.querySelectorAll("[data-cv]").forEach(function (el) {
        var v = values[el.getAttribute("data-cv")];
        if (v) el.textContent = v;
      });
      document.querySelectorAll("[data-cv-href]").forEach(function (el) {
        var v = values[el.getAttribute("data-cv-href")];
        if (v && /^https:\/\//.test(v)) el.href = v;
      });
    })
    .catch(function () {});
})();
