/*
  ZRM shared values – edit ONLY this file to update every page
  (index.html, payment.html, thank-you.html).

  Any element with data-cv="key"      gets its text replaced with the value.
  Any link    with data-cv-href="key" gets its href replaced with the value.
  The text already written in the HTML stays as a fallback if this file
  fails to load.
*/
(function () {
  var ZRM_VALUES = {
    zrm_online_date: "OCT 16 2026 – OCT 18 2026",
    "02_zrm_online_time": "07:00 AM to 08:30 AM",
    zrm_replay: "07:00 PM to 08:30 PM",
    zrm_group_link: "https://chat.whatsapp.com/Infyusibnlv2fQCTiLHs7p"
  };

  function has(key) {
    return Object.prototype.hasOwnProperty.call(ZRM_VALUES, key) && ZRM_VALUES[key];
  }

  document.querySelectorAll("[data-cv]").forEach(function (el) {
    var key = el.getAttribute("data-cv");
    if (has(key)) el.textContent = ZRM_VALUES[key];
  });

  document.querySelectorAll("[data-cv-href]").forEach(function (el) {
    var key = el.getAttribute("data-cv-href");
    if (has(key)) el.setAttribute("href", ZRM_VALUES[key]);
  });
})();
