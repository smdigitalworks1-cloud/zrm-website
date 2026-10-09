/*
  ZRM motion layer – smooth scroll, parallax & scroll storytelling
  (Lenis + GSAP + ScrollTrigger, all loaded from CDNs in index.html).

  Breakpoints:  desktop ≥1024  ·  tablet 768–1023  ·  mobile <768
  - Lenis smooth scroll, mouse depth and magnetic CTAs: desktop + fine pointer
  - 3-day "stage" (pinned presentation): desktop only, stacked cards elsewhere
  - parallax intensity (k) shrinks on smaller screens
  - prefers-reduced-motion: no smooth scroll, no parallax, content shown as-is
  gsap.matchMedia() reverts every tween / trigger / listener on breakpoint change.
*/
(function () {
  var root = document.documentElement;

  function showHero() {
    root.classList.remove("motion-ready");
  }

  if (!window.gsap || !window.ScrollTrigger) {
    showHero();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var EASE = "power3.out";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lenis = null;

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // one-shot reveal when an element scrolls into view
  function reveal(targets, vars, trigger, start) {
    var list = typeof targets === "string" ? all(targets) : targets;
    if (!list.length) return;
    vars.opacity = 0;
    vars.ease = vars.ease || EASE;
    vars.duration = vars.duration || 0.8;
    vars.clearProps = vars.clearProps || "opacity,transform";
    vars.scrollTrigger = { trigger: trigger || list[0], start: start || "top 85%", once: true };
    gsap.from(list, vars);
  }

  // masked image reveal; dir = "left" | "right" | "bottom"
  function clipReveal(box, dir, img, start) {
    if (!box) return;
    var from = {
      left: "inset(0% 100% 0% 0%)",
      right: "inset(0% 0% 0% 100%)",
      bottom: "inset(100% 0% 0% 0%)"
    }[dir];
    var tl = gsap.timeline({ scrollTrigger: { trigger: box, start: start || "top 80%", once: true } });
    tl.fromTo(box, { clipPath: from }, {
      clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power4.inOut", clearProps: "clipPath"
    });
    if (img) tl.from(img, { scale: 1.08, duration: 1.4, ease: EASE }, 0);
  }

  // wrap every word in a mask (keeps inner spans such as .yellow)
  function splitWords(el) {
    if (!el) return [];
    if (!el.dataset.split) {
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            var parts = child.textContent.split(/(\s+)/);
            var frag = document.createDocumentFragment();
            parts.forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement("span");
              var wi = document.createElement("span");
              w.className = "w";
              wi.className = "wi";
              wi.textContent = part;
              w.appendChild(wi);
              frag.appendChild(w);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === 1 && child.tagName !== "BR") {
            walk(child);
          }
        });
      })(el);
      el.dataset.split = "1";
    }
    return all(".wi", el);
  }

  /* ================= HERO – cinematic entrance (once) ================= */
  function heroEntrance() {
    var titleWords = splitWords(document.querySelector(".hero-title"));
    var tl = gsap.timeline({ defaults: { ease: EASE } });

    tl.set(".hero-title", { opacity: 1 })
      // 1 · atmosphere
      .fromTo(".hero-atmos", { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out" }, 0)
      // 2 · main visual unmasks left → right
      .fromTo(".hero .video-box", { opacity: 1, clipPath: "inset(0% 100% 0% 0% round 14px)" },
        { clipPath: "inset(0% 0% 0% 0% round 14px)", duration: 1.0, ease: "power4.inOut", clearProps: "clipPath" }, 0.1)
      .fromTo(".hero .video-box img", { scale: 1.08 }, { scale: 1.03, duration: 1.3 }, 0.1)
      // 3 · heading, word by word inside masks
      .fromTo(".hero .top-label", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.15)
      .fromTo(titleWords, { yPercent: 110 }, { yPercent: 0, duration: 0.75, stagger: 0.045 }, 0.2)
      // 4 · supporting text
      .fromTo(".hero-subtitle", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.7 }, 0.5);

    // 5 · the ₹499 card emerges like a floating card, CTA last.
    //     Below the fold (phones) it waits until it scrolls into view.
    var card = document.querySelector(".hero .event-details");
    if (card) {
      var cardTl = gsap.timeline({ defaults: { ease: EASE } });
      cardTl.fromTo(card, { opacity: 0, y: 30, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 })
        .fromTo(".hero .detail-icon", { scale: 0.7, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, stagger: 0.06, ease: "back.out(2)", clearProps: "opacity,transform" }, 0.15)
        .fromTo(".hero .cta", { opacity: 0, y: 20, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.55, clearProps: "opacity,transform" }, 0.3);

      if (card.getBoundingClientRect().top < window.innerHeight * 0.9) {
        tl.add(cardTl, 0.6);
      } else {
        cardTl.pause(); // start values already applied
        ScrollTrigger.create({ trigger: card, start: "top 88%", once: true, onEnter: function () { cardTl.play(); } });
      }
    }

    showHero(); // starting values are applied, the CSS hide can go
  }

  /* ================= HERO – 4-layer scroll depth + hand-off ================= */
  function heroScroll(k) {
    var tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    tl.to(".hero-atmos", { yPercent: -6 * k, scale: 1 + 0.08 * k }, 0)          // background – slowest, zooms
      .to(".hero .top-label", { y: -24 * k }, 0)                                 // decoration
      .to(".hero .video-box", { yPercent: -15 * k }, 0)                          // main image – faster
      .to(".hero-head", { yPercent: -8 * k, scale: 0.94, opacity: 0 }, 0)        // text – its own pace, fades
      .to(".hero .event-details", { yPercent: -8 * k }, 0)
      .to(".hero .event-details", { opacity: 0, duration: 0.5 }, 0.5);           // fades in the 2nd half
  }

  /* ================= HERO – mouse depth (desktop) ================= */
  function heroMouse() {
    var hero = document.querySelector(".hero");
    if (!hero) return null;

    var layers = [
      { el: ".hero-atmos-band", x: 4, y: 3 },        // background 1×
      { el: ".hero .video-box img", x: 8, y: 6 },    // image 2×
      { el: ".hero-title", x: 2, y: 1.5 }            // foreground 0.5×
    ].map(function (l) {
      var node = document.querySelector(l.el);
      return node && {
        x: gsap.quickTo(node, "x", { duration: 0.9, ease: EASE }),
        y: gsap.quickTo(node, "y", { duration: 0.9, ease: EASE }),
        ax: l.x, ay: l.y
      };
    }).filter(Boolean);

    // ambient light that lazily drifts toward the cursor (background only)
    var glow = hero.querySelector(".amb-mouse");
    var glowX = glow && gsap.quickTo(glow, "x", { duration: 1.6, ease: "power2.out" });
    var glowY = glow && gsap.quickTo(glow, "y", { duration: 1.6, ease: "power2.out" });

    function move(e) {
      var nx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 … 1
      var ny = (e.clientY / window.innerHeight - 0.5) * 2;
      layers.forEach(function (l) { l.x(nx * l.ax); l.y(ny * l.ay); });
      if (glow) {
        var r = hero.getBoundingClientRect();
        glowX(e.clientX - r.left);
        glowY(e.clientY - r.top);
        gsap.to(glow, { opacity: 1, duration: 0.8, overwrite: "auto" });
      }
    }

    function leave() {
      layers.forEach(function (l) { l.x(0); l.y(0); });
      if (glow) gsap.to(glow, { opacity: 0, duration: 1.2, overwrite: "auto" });
    }

    hero.addEventListener("mousemove", move);
    hero.addEventListener("mouseleave", leave);
    return function () {
      hero.removeEventListener("mousemove", move);
      hero.removeEventListener("mouseleave", leave);
      if (glow) gsap.set(glow, { clearProps: "all" });
    };
  }

  /* ================= AMBIENT BACKGROUND – scroll drift ================= */
  // every .amb-layer drifts at its own speed while its section passes,
  // so the background slowly moves behind the (still) content
  function ambientScroll(k) {
    all(".amb-layer[data-speed]").forEach(function (layer) {
      var host = layer.closest(".amb").parentNode;
      var y = parseFloat(layer.dataset.speed) * k;
      var x = parseFloat(layer.dataset.xspeed || 0) * k;
      gsap.fromTo(layer, { yPercent: -y, xPercent: -x }, {
        yPercent: y, xPercent: x, ease: "none",
        scrollTrigger: { trigger: host, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  // 3-day moods: fade to one day's background
  function moods() {
    return all(".amb-mood");
  }

  function setMood(index) {
    var m = moods();
    if (m.length) gsap.to(m, { opacity: function (i) { return i === index ? 1 : 0; }, duration: 1.2, ease: "power2.inOut", overwrite: true });
  }

  /* ================= MAGNETIC CTAs (desktop) ================= */
  function magnetic() {
    var buttons = all(".cta, .btn");
    var handlers = buttons.map(function (btn) {
      function move(e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);   // -1 … 1
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        gsap.to(btn, { "--mx": dx * 6 + "px", "--my": dy * 6 + "px", "--ix": dx * 3 + "px",
          duration: 0.4, ease: EASE, overwrite: "auto" });
      }
      function leave() {
        gsap.to(btn, { "--mx": "0px", "--my": "0px", "--ix": "0px",
          duration: 0.6, ease: "elastic.out(1, 0.5)", overwrite: "auto" });
      }
      btn.addEventListener("pointermove", move);
      btn.addEventListener("pointerleave", leave);
      return { btn: btn, move: move, leave: leave };
    });

    return function () {
      handlers.forEach(function (h) {
        h.btn.removeEventListener("pointermove", h.move);
        h.btn.removeEventListener("pointerleave", h.leave);
        gsap.set(h.btn, { "--mx": "0px", "--my": "0px", "--ix": "0px" });
      });
    };
  }

  /* ================= PROOF WALL – success stories in staggered depth ================= */
  function successStories(k) {
    var depth = Math.max(k, 0.5);
    var offsets = [60, 100, 40, 80];

    reveal(".success-title", { y: 40 * depth, duration: 0.9 });

    // cards rise from different depths, one after another
    reveal(".testimonial-grid .testimonial", {
      y: function (i) { return offsets[i % offsets.length] * depth; },
      scale: 0.96,
      duration: 1,
      stagger: { amount: 0.6 }
    }, ".testimonial-grid");

    // inside each card: photo settles, text fades in after it
    reveal(".testimonial-grid .t-photo", { scale: 1.05, opacity: 1, duration: 1.1, stagger: { amount: 0.6 } }, ".testimonial-grid");
    reveal(".testimonial-grid .t-name, .testimonial-grid .t-company", { duration: 0.7, delay: 0.3, stagger: { amount: 0.6 } }, ".testimonial-grid");

    // revenue figures: scale + rise, then count up to the exact original value
    var figures = all(".t-result strong:first-child");
    reveal(figures, { scale: 0.9, y: 10, duration: 0.8, delay: 0.35, stagger: { amount: 0.6 } }, ".testimonial-grid");

    ScrollTrigger.create({
      trigger: ".testimonial-grid",
      start: "top 85%",
      once: true,
      onEnter: function () {
        figures.forEach(function (el) {
          var original = el.textContent;
          var m = original.match(/^(\D*)(\d+)(.*)$/);   // "₹25 Lakhs" → "₹", 25, " Lakhs"
          if (!m) return;
          var counter = { v: 1 };
          gsap.to(counter, {
            v: parseInt(m[2], 10), duration: 1.2, delay: 0.3, ease: "power2.out",
            onUpdate: function () { el.textContent = m[1] + Math.round(counter.v) + m[3]; },
            onComplete: function () { el.textContent = original; }
          });
        });
      }
    });

    // "50,000+ ENTREPRENEURS" – the scale-of-the-movement moment
    var pill = document.querySelector(".success .bottom-pill");
    if (pill) {
      gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: pill, start: "top 95%", end: "top 55%", scrub: 0.6 }
      })
        .fromTo(pill, { scale: 0.75, opacity: 0 }, { scale: 1, opacity: 1, duration: 1 }, 0)
        .fromTo(pill, { backgroundColor: "rgba(232, 255, 0, 0)", borderColor: "rgba(255, 255, 255, 0.12)" },
          { backgroundColor: "rgba(232, 255, 0, 0.07)", borderColor: "rgba(232, 255, 0, 0.35)", duration: 1 }, 0)
        .fromTo(".success", { "--proof-glow": 0 }, { "--proof-glow": 1, duration: 1 }, 0)
        // expanding light behind it
        .fromTo(".amb-pulse", { scale: 0.55, opacity: 0 }, { scale: 1.25, opacity: 1, duration: 1 }, 0);
    }
  }

  /* ================= STORY MOMENT – "3 Days. 3 Skills." ================= */
  function storyMoment(k) {
    var title = document.querySelector(".skills-head .section-title");
    if (!title) return;
    var words = splitWords(title);

    var tl = gsap.timeline({
      scrollTrigger: { trigger: title, start: "top 88%", end: "top 40%", scrub: 0.6 }
    });
    tl.fromTo(title, { scale: 0.92 }, { scale: 1, ease: "none", duration: 1 }, 0)
      .fromTo(words, { opacity: 0.12, yPercent: 30 * k },
        { opacity: 1, yPercent: 0, ease: "none", duration: 0.35, stagger: 0.1 }, 0);

    reveal(".skills-head .section-subtitle", { y: 20, duration: 0.7 }, ".skills-head", "top 70%");
    reveal(".skill-box", { y: 30 * Math.max(k, 0.5), stagger: 0.1 }, ".skill-row");
    reveal(".skills .join-wrap .btn", { y: 20 });
  }

  /* ================= 3-DAY PROGRAM – signature stage ================= */
  function dayStage() {
    var list = document.querySelector(".day-list");
    var cards = all(".day-card", list);
    if (!list || cards.length < 2) return null;

    // indicator built from each card's own "Day N" label
    var nav = document.createElement("div");
    nav.className = "day-stage-nav";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Program days");
    var bar = document.createElement("span");
    bar.className = "day-stage-bar";
    bar.setAttribute("aria-hidden", "true");
    nav.appendChild(bar);

    var tabs = cards.map(function (card, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      var label = card.querySelector(".day-title .yellow");
      b.textContent = label ? label.textContent.trim() : "Day " + (i + 1);
      nav.appendChild(b);
      return b;
    });

    list.insertBefore(nav, list.firstChild);
    list.classList.add("is-stage");
    gsap.set(cards.slice(1), { autoAlpha: 0 });

    // Day 1 enters as the stage arrives: content from the right, image settles
    gsap.timeline({ defaults: { ease: EASE }, scrollTrigger: { trigger: list, start: "top 75%", once: true } })
      .from(cards[0].querySelector(".day-content"), { x: 40, opacity: 0, duration: 0.9, clearProps: "opacity,transform" })
      .from(cards[0].querySelector(".day-image img"), { scale: 1.08, duration: 1.2, clearProps: "transform" }, 0);

    var moodLayers = moods();
    gsap.set(moodLayers, { opacity: function (i) { return i === 0 ? 1 : 0; } });

    var steps = cards.length - 1;
    var tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });
    tl.to({}, { duration: 0.4 }); // let Day 1 sit first

    for (var i = 1; i < cards.length; i++) {
      var prev = cards[i - 1], next = cards[i];
      var at = tl.duration();
      var dir = i % 2 ? -1 : 1;                // Day 2 from the left, Day 3 from the right
      var last = i === cards.length - 1;       // Day 3 – "now scale": stronger entrance
      var mask = dir < 0 ? "inset(0% 100% 0% 0%)" : "inset(0% 0% 0% 100%)";

      tl.to(prev, { autoAlpha: 0, scale: 0.96, x: 30 * -dir, duration: 1 }, at)
        .fromTo(next, { autoAlpha: 0, scale: last ? 0.9 : 0.98, x: 0 },
          { autoAlpha: 1, scale: 1, duration: 1 }, at + 0.15)
        .fromTo(next.querySelector(".day-content"), { x: 40 * dir, opacity: 0 },
          { x: 0, opacity: 1, duration: 1 }, at + 0.2)
        // image changes through an editorial mask, alternating direction
        .fromTo(next.querySelector(".day-image"), { clipPath: mask },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power3.inOut" }, at + 0.15)
        .fromTo(next.querySelector(".day-image img"), { scale: last ? 1.15 : 1.08 },
          { scale: 1, duration: 1.4, ease: EASE }, at + 0.15)
        .to(bar, { x: i * 120, duration: 1 }, at)
        .to(".skills", { "--glow-x": (30 + i * 20) + "%", duration: 1 }, at)
        // background mood cross-fades Day i → Day i+1 (no sudden change)
        .to(moodLayers[i - 1] || {}, { opacity: 0, duration: 1.2 }, at)
        .to(moodLayers[i] || {}, { opacity: 1, duration: 1.2 }, at)
        .to({}, { duration: 0.4 }); // hold
    }

    function setActive(index) {
      tabs.forEach(function (t, i) {
        t.setAttribute("aria-selected", i === index ? "true" : "false");
        t.tabIndex = i === index ? 0 : -1;
      });
      cards.forEach(function (c, i) { c.setAttribute("aria-hidden", i === index ? "false" : "true"); });
    }
    setActive(0);

    var st = ScrollTrigger.create({
      trigger: list,
      start: "top top+=90",
      end: function () { return "+=" + window.innerHeight * 0.8 * steps; },
      pin: true,
      scrub: 0.8,
      animation: tl,
      onUpdate: function (self) {
        setActive(Math.min(steps, Math.round(self.progress * steps)));
      }
    });

    // clicking a day scrolls to its point in the timeline
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () {
        scrollToY(st.start + (st.end - st.start) * (i / steps));
      });
    });

    return function () {
      list.classList.remove("is-stage");
      if (nav.parentNode) nav.parentNode.removeChild(nav);
      cards.forEach(function (c) { c.removeAttribute("aria-hidden"); });
      gsap.set(cards, { clearProps: "all" });
      gsap.set(".skills", { "--glow-x": "50%" });
      gsap.set(moods(), { clearProps: "opacity" });
    };
  }

  // tablet / mobile: normal stacked cards with masked image reveals
  function dayCardsSimple(k) {
    all(".day-card").forEach(function (card, i) {
      reveal([card], { y: 50 * Math.max(k, 0.5), duration: 0.9 });
      var box = card.querySelector(".day-image");
      clipReveal(box, i % 2 ? "right" : "left", box && box.querySelector("img"));
      // the background mood follows the day card in the middle of the screen
      ScrollTrigger.create({
        trigger: card, start: "top 60%", end: "bottom 60%",
        onToggle: function (self) { if (self.isActive) setMood(i); }
      });
    });
  }

  /* ================= TOOLS – scale reveal + horizontal drift ================= */
  function tools(isDesktop, k) {
    reveal(".tools > .container > .section-title", { y: 40 * Math.max(k, 0.5), duration: 0.9 });

    var grid = document.querySelector(".tools-grid");
    var cards = all(".tool-card");
    reveal(cards, {
      scale: 0.88, y: 20 * k, duration: 0.7,
      stagger: { amount: 0.5, from: "center" }
    }, grid);

    // "tool orbit": every card drifts vertically at its own pace (via --orbit)
    var orbit = [20, -15, 10];
    cards.forEach(function (card, i) {
      var v = orbit[i % orbit.length] * Math.max(k, 0.5);
      gsap.fromTo(card, { "--orbit": -v + "px" }, {
        "--orbit": v + "px", ease: "none",
        scrollTrigger: { trigger: grid, start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    // desktop horizontal story: while the page scrolls down, the two rows
    // travel sideways (limited to the free space beside the grid)
    if (isDesktop && getComputedStyle(grid).gridTemplateColumns.split(" ").length === 6) {
      var travel = function () {
        var free = (window.innerWidth - grid.getBoundingClientRect().width) / 2 - 12;
        return Math.max(32, Math.min(110, free));
      };
      var trigger = function () {
        return { trigger: grid, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true };
      };
      gsap.fromTo(cards.slice(0, 6), { "--drift": function () { return travel() + "px"; } },
        { "--drift": function () { return -travel() + "px"; }, ease: "none", scrollTrigger: trigger() });
      gsap.fromTo(cards.slice(6), { "--drift": function () { return -travel() + "px"; } },
        { "--drift": function () { return travel() + "px"; }, ease: "none", scrollTrigger: trigger() });
    }

    reveal(".tools .join-wrap .btn", { y: 20 });

    // REAL PEOPLE / REAL RESULTS – screenshot unmasks, settles from a slight
    // zoom and drifts sideways; the labels arrive separately
    var pv = document.querySelector(".participants-video");
    var pImg = pv && pv.querySelector("img");
    clipReveal(pv, "right");
    if (pImg) {
      gsap.fromTo(pImg, { scale: 1.08 }, {
        scale: 1.04, duration: 1.4, ease: EASE,
        scrollTrigger: { trigger: pv, start: "top 80%", once: true }
      });
      gsap.fromTo(pImg, { xPercent: -1.5 * k }, {
        xPercent: 1.5 * k, ease: "none",
        scrollTrigger: { trigger: pv, start: "top bottom", end: "bottom top", scrub: true }
      });
    }
    reveal(".reaction-pill", { y: 20, duration: 0.6 }, ".reaction-pill", "top 92%");
    reveal(all(".reaction-pill span:not(.dot)"), { y: 12, duration: 0.6, delay: 0.25, stagger: 0.15 }, ".reaction-pill", "top 92%");

    // WHY ATTEND – split reveal: heading from the left, content from the right
    var why = document.querySelector(".why-card");
    if (why) {
      var shift = 40 * Math.max(k, 0.5);
      reveal([why], { scale: 0.97, duration: 0.8 }, why, "top 80%");
      reveal(all(".section-title", why), { x: -shift, duration: 1, delay: 0.2 }, why, "top 80%");
      reveal(all(".why-lead, .why-text", why), { x: shift, duration: 1, delay: 0.3, stagger: 0.1 }, why, "top 80%");
      reveal(all(".btn", why), { y: 20, duration: 0.7, delay: 0.6 }, why, "top 80%");
    }
  }

  /* ================= VIDEO TESTIMONIALS – editorial motion ================= */
  function videoTestimonials(k) {
    var cards = all(".impact-card");
    var offsets = [40, 70, 50];

    reveal(cards, {
      y: function (i) { return offsets[i % offsets.length] * Math.max(k, 0.5); },
      scale: 0.96,
      duration: 0.9,
      stagger: 0.08
    }, ".impact-grid");

    // posters unmask bottom → top
    cards.forEach(function (card, i) {
      var media = card.querySelector(".impact-media");
      gsap.fromTo(media, { clipPath: "inset(100% 0% 0% 0%)" }, {
        clipPath: "inset(0% 0% 0% 0%)", duration: 1, delay: i * 0.08, ease: "power4.inOut",
        clearProps: "clipPath",
        scrollTrigger: { trigger: ".impact-grid", start: "top 85%", once: true }
      });
    });

    if (k < 0.5) return; // no floating on phones

    cards.forEach(function (card, i) {
      var amount = (10 + (i % 3) * 8) * k;
      gsap.fromTo(card, { "--float": amount + "px" }, {
        "--float": -amount + "px", ease: "none",
        scrollTrigger: { trigger: ".impact-grid", start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  }

  /* ================= FAQ ================= */
  function faqReveal() {
    reveal(".impact .join-wrap .btn", { y: 20 });
    reveal(".faq > .section-title", { y: 30, duration: 0.8 });
    reveal(".faq-item", { y: 20, duration: 0.6, stagger: 0.06 }, ".faq-list");
  }

  function faqAccordion() {
    all(".faq-item").forEach(function (item) {
      var summary = item.querySelector("summary");
      var running = null;

      summary.addEventListener("click", function (e) {
        if (reduceMotion) return; // native behaviour
        e.preventDefault();

        var startHeight = item.offsetHeight;
        if (running) running.kill();

        var opening = !item.open || item.classList.contains("is-closing");
        item.classList.remove("is-closing");
        item.style.height = "";
        var borders = item.offsetHeight - item.clientHeight;
        var endHeight;

        if (opening) {
          item.open = true;
          endHeight = item.scrollHeight + borders;
        } else {
          item.classList.add("is-closing");
          endHeight = summary.offsetHeight + borders;
        }

        running = gsap.fromTo(item, { height: startHeight }, {
          height: endHeight,
          duration: 0.32,
          ease: EASE,
          onComplete: function () {
            if (!opening) item.open = false;
            item.classList.remove("is-closing");
            gsap.set(item, { clearProps: "height" });
            running = null;
          }
        });
      });
    });
  }

  /* ================= FINAL CTA – cinematic ending ================= */
  function finalCta(k) {
    var box = document.querySelector(".final-cta");
    if (!box) return;
    var title = box.querySelector(".section-title");
    var words = splitWords(title);

    var tl = gsap.timeline({ defaults: { ease: EASE }, scrollTrigger: { trigger: box, start: "top 72%", once: true } });
    tl.from(title, { scale: 0.88, opacity: 0, duration: 1.2, clearProps: "opacity,transform" })
      .from(words, { yPercent: 110, duration: 0.8, stagger: 0.06 }, 0)
      .from(box.querySelector(".why-lead"), { y: 20, opacity: 0, duration: 0.7, clearProps: "opacity,transform" }, 0.45)
      .from(box.querySelector(".btn"), { y: 30, opacity: 0, duration: 0.7, clearProps: "opacity,transform" }, 0.6)
      .from(box.querySelector(".cta-note"), { opacity: 0, duration: 0.6, clearProps: "opacity" }, 0.8);

    // background slowly settles while the section passes
    gsap.fromTo(".final-cta-bg", { scale: 1.15, yPercent: -6 * k }, {
      scale: 1, yPercent: 6 * k, ease: "none",
      scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: true }
    });
  }

  /* ================= SMOOTH SCROLL (desktop) ================= */
  function smoothScroll() {
    if (!window.Lenis) return null;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    var tick = function (time) { lenis.raf(time * 1000); };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return function () {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      lenis = null;
    };
  }

  /* ================= WIRING ================= */
  faqAccordion();

  if (reduceMotion) {
    showHero();
    window.__zrmMotion = true;
    return;
  }

  heroEntrance();
  window.__zrmMotion = true;

  var mm = gsap.matchMedia();
  mm.add({
    desktop: "(min-width: 1024px)",
    tablet: "(min-width: 768px) and (max-width: 1023px)",
    mobile: "(max-width: 767px)",
    finePointer: "(hover: hover) and (pointer: fine)"
  }, function (ctx) {
    var c = ctx.conditions;
    var k = c.desktop ? 1 : c.tablet ? 0.6 : 0.35; // parallax intensity
    var premiumPointer = c.desktop && c.finePointer;
    var cleanups = [];

    if (premiumPointer) cleanups.push(smoothScroll());

    heroScroll(k);
    if (premiumPointer) {
      cleanups.push(heroMouse());
      cleanups.push(magnetic());
    }
    successStories(k);
    storyMoment(k);
    if (c.desktop) cleanups.push(dayStage());
    else dayCardsSimple(k);
    tools(c.desktop, k);
    videoTestimonials(k);
    faqReveal();
    finalCta(k);
    // background drift last: its triggers sit below the pinned 3-day stage,
    // so they must be created after it to get correct positions
    ambientScroll(k);
    // re-measure + evaluate every trigger once the whole setup exists
    requestAnimationFrame(function () { ScrollTrigger.refresh(); });

    return function () {
      cleanups.forEach(function (fn) { if (fn) fn(); });
    };
  });

  // images/fonts change the page height – re-measure once everything is in
  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
