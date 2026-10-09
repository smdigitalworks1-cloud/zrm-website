/*
  ZRM ambient background – builds the decorative background layers for each
  section (styles in ambient.css). Background only: nothing here touches the
  page content. Scroll / mouse movement is added by motion.js.
  Runs before motion.js (script order) and works without GSAP.
*/
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var width = window.innerWidth;
  var tier = width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "mobile";

  var RED = function (a) { return "rgba(255, 23, 56, " + a + ")"; };
  var CRIMSON = function (a) { return "rgba(150, 14, 40, " + a + ")"; };
  var YELLOW = function (a) { return "rgba(232, 255, 0, " + a + ")"; };

  function el(cls, style) {
    var d = document.createElement("div");
    d.className = cls;
    if (style) d.setAttribute("style", style);
    return d;
  }

  // o: { c: colour, s: size, x: left, y: top, anim: "amb-x"|"amb-y"|"amb-breath", t: duration }
  function orb(o) {
    return el("amb-orb " + (o.anim || ""),
      "--c:" + o.c + ";--s:" + o.s + ";" + (o.w ? "--w:" + o.w + ";--h:" + o.h + ";" : "") +
      "left:" + o.x + ";top:" + o.y + ";" + (o.t ? "--t:" + o.t + ";" : ""));
  }

  // parallax layer: data-speed = vertical % travel, data-xspeed = horizontal
  function layer(speed, children, xspeed) {
    var l = el("amb-layer");
    l.dataset.speed = speed;
    if (xspeed) l.dataset.xspeed = xspeed;
    children.forEach(function (c) { l.appendChild(c); });
    return l;
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  function dots(perTier, warmEvery) {
    var n = reduce ? 0 : perTier[tier];
    if (!n) return null;
    var c = el("amb-dots");
    for (var i = 0; i < n; i++) {
      var d = document.createElement("span");
      d.className = "amb-dot" + (warmEvery && i % warmEvery === 0 ? " is-warm" : "");
      d.setAttribute("style",
        "--x:" + rand(4, 96).toFixed(1) + "%;--y:" + rand(15, 95).toFixed(1) + "%;" +
        "--sz:" + rand(2, 3.2).toFixed(1) + "px;--d:" + rand(14, 26).toFixed(1) + "s;" +
        "--delay:-" + rand(0, 20).toFixed(1) + "s");
      c.appendChild(d);
    }
    return c;
  }

  function mount(host, cls, parts, afterNode) {
    if (!host) return null;
    var a = el("amb " + cls);
    a.setAttribute("aria-hidden", "true");
    parts.forEach(function (p) { if (p) a.appendChild(p); });
    host.insertBefore(a, afterNode ? afterNode.nextSibling : host.firstChild);
    return a;
  }

  var mounted = [];
  function add(a) { if (a) mounted.push(a); }

  /* HERO – cinematic gradient + soft glowing blobs */
  add(mount(document.querySelector(".hero"), "amb-hero", [
    layer(4, [orb({ c: CRIMSON(.42), s: "min(900px, 130vw)", x: "8%", y: "18%", anim: "amb-x", t: "60s" })], 2),
    layer(10, [orb({ c: RED(.15), s: "min(620px, 100vw)", x: "92%", y: "48%", anim: "amb-y", t: "45s" })]),
    layer(6, [orb({ c: YELLOW(.05), s: "min(520px, 90vw)", x: "62%", y: "80%", anim: "amb-x", t: "70s" })], -3),
    el("amb-mouse"),
    dots({ desktop: 12, tablet: 7, mobile: 4 }, 4),
    el("amb-grain")
  ]));

  /* SUCCESS – glow behind the cards + the 50,000+ expanding light */
  add(mount(document.querySelector(".success"), "amb-success", [
    layer(6, [orb({ c: RED(.12), w: "min(1100px, 150vw)", h: "520px", s: "0", x: "50%", y: "42%", anim: "amb-breath", t: "26s" })]),
    layer(12, [orb({ c: YELLOW(.045), s: "min(520px, 90vw)", x: "14%", y: "22%", anim: "amb-y", t: "50s" })]),
    el("amb-pulse"),
    dots({ desktop: 8, tablet: 5, mobile: 3 }, 3)
  ]));

  /* 3 DAYS – one mood per day, cross-faded on scroll */
  add(mount(document.querySelector(".skills"), "amb-skills", [
    el("amb-mood amb-mood-1"),
    el("amb-mood amb-mood-2"),
    el("amb-mood amb-mood-3"),
    dots({ desktop: 8, tablet: 5, mobile: 3 }, 3)
  ]));

  /* TOOLS – slow floating shapes behind the tool cards */
  var shapes = [
    { x: "4%", y: "8%", w: "220px", h: "150px", r: "-8deg", t: "70s" },
    { x: "78%", y: "4%", w: "260px", h: "170px", r: "10deg", t: "85s" },
    { x: "86%", y: "26%", w: "160px", h: "120px", r: "-14deg", t: "60s" },
    { x: "10%", y: "30%", w: "180px", h: "130px", r: "16deg", t: "95s" },
    { x: "45%", y: "2%", w: "140px", h: "100px", r: "4deg", t: "75s" }
  ].slice(0, tier === "desktop" ? 5 : tier === "tablet" ? 3 : 2).map(function (s) {
    return el("amb-shape",
      "--x:" + s.x + ";--y:" + s.y + ";--w:" + s.w + ";--h:" + s.h + ";--r:" + s.r + ";--t:" + s.t);
  });
  add(mount(document.querySelector(".tools"), "amb-tools", [
    layer(8, [orb({ c: CRIMSON(.16), s: "min(760px, 120vw)", x: "6%", y: "10%", anim: "amb-x", t: "55s" })]),
    layer(4, shapes),
    dots({ desktop: 6, tablet: 4, mobile: 2 })
  ]));

  /* PARTICIPANTS – glow + travelling light around the screenshot */
  var pv = document.querySelector(".participants-video");
  if (pv && !pv.parentNode.classList.contains("pv-wrap")) {
    var wrap = el("pv-wrap");
    pv.parentNode.insertBefore(wrap, pv);
    wrap.appendChild(pv);
    add(wrap);
  }

  /* WHY ATTEND – clean, slow gradient movement */
  add(mount(document.querySelector(".why-card"), "amb-why", [
    orb({ c: RED(.22), s: "min(700px, 120vw)", x: "15%", y: "40%", anim: "amb-x", t: "34s" }),
    orb({ c: YELLOW(.05), s: "min(520px, 90vw)", x: "88%", y: "70%", anim: "amb-y", t: "42s" })
  ]));

  /* PROOF MARQUEE – glow behind the revenue figures */
  add(mount(document.querySelector(".ticker-wrap"), "amb-ticker", [
    orb({ c: YELLOW(.08), w: "min(700px, 120vw)", h: "220%", s: "0", x: "50%", y: "50%", anim: "amb-x", t: "28s" }),
    orb({ c: RED(.10), w: "min(500px, 90vw)", h: "200%", s: "0", x: "20%", y: "50%", anim: "amb-x", t: "36s" })
  ]));

  /* FAQ – calm, barely moving */
  add(mount(document.querySelector(".faq"), "amb-faq", [
    orb({ c: RED(.05), w: "120%", h: "60%", s: "0", x: "50%", y: "45%", anim: "amb-breath", t: "40s" })
  ]));

  /* FINAL CTA – the strongest atmosphere (above the curtain image layer) */
  var finalCta = document.querySelector(".final-cta");
  add(mount(finalCta, "amb-final", [
    layer(8, [orb({ c: RED(.32), s: "min(900px, 140vw)", x: "50%", y: "50%", anim: "amb-breath", t: "18s" })]),
    layer(14, [orb({ c: CRIMSON(.30), s: "min(620px, 110vw)", x: "10%", y: "35%", anim: "amb-x", t: "40s" })], 3),
    layer(10, [orb({ c: YELLOW(.06), s: "min(480px, 90vw)", x: "90%", y: "70%", anim: "amb-y", t: "46s" })]),
    dots({ desktop: 14, tablet: 8, mobile: 5 }, 3),
    el("amb-sweep"),
    el("amb-grain")
  ], finalCta && finalCta.querySelector(".final-cta-bg")));

  /* pause animations of sections that are off-screen */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle("amb-paused", !e.isIntersecting); });
    }, { rootMargin: "200px 0px" });
    mounted.forEach(function (a) { io.observe(a.classList.contains("amb") ? a.parentNode : a); });
  }
})();
