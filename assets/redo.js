/* ===========================================================================
   REDO — homepage behaviour
   2026-10-23 (r2). Three jobs, each a no-op where its hooks are absent:
     1  the floating pill nav arrives once the black stage covers the banner
     2  the DESSERTS wordmark is fitted to the viewport width
     3  the custom cursor (desktop pointers only)
   The scroll overlay and the end-reveal are pure CSS (sticky banner + fixed
   wordmark + stage bottom-margin); nothing here drives them.
   =========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;


  /* 1. NAV — show once ~85% of a screen has scrolled (banner is pinned, so an
     intersection test on it would never fire). ----------------------------- */
  function nav() {
    var bar = document.querySelector("[data-fnav]");
    if (!bar) return;
    var ticking = false;
    function pass() {
      ticking = false;
      var vh = window.innerHeight || root.clientHeight;
      bar.classList.toggle("is-up", window.scrollY > vh * 0.82);
    }
    window.addEventListener("scroll", function () {
      if (ticking) return; ticking = true; window.requestAnimationFrame(pass);
    }, { passive: true });
    pass();
  }


  /* 2. FIT the end wordmark to the band width. --------------------------------- */
  function fit() {
    var band = document.querySelector(".endmark");
    var word = band && band.querySelector(".endmark__word");
    if (!word) return;
    function run() {
      word.style.fontSize = "100px";
      var target = band.clientWidth * 0.94;
      var cur = word.scrollWidth || 1;
      word.style.fontSize = (100 * target / cur).toFixed(1) + "px";
    }
    run();
    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t); t = setTimeout(run, 120);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  }


  /* 3. CURSOR — desktop pointers only, off for touch and reduced motion. ------ */
  function cursor() {
    if (!fine || reduce) return;

    var wrap = document.createElement("div");
    wrap.className = "cursor";
    wrap.setAttribute("aria-hidden", "true");
    var dot = document.createElement("span"); dot.className = "cursor__dot";
    var pill = document.createElement("span"); pill.className = "cursor__pill";
    wrap.appendChild(dot); wrap.appendChild(pill);
    document.body.appendChild(wrap);
    root.classList.add("has-cursor");

    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, raf = null;
    function render() {
      raf = null;
      x += (tx - x) * 0.3; y += (ty - y) * 0.3;
      wrap.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)";
      if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(render);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(render); }

    window.addEventListener("mousemove", function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!wrap.classList.contains("is-on")) wrap.classList.add("is-on");
      kick();
    }, { passive: true });
    document.addEventListener("mouseleave", function () { wrap.classList.remove("is-on"); });
    document.addEventListener("mouseenter", function () { wrap.classList.add("is-on"); });

    // dark ground -> white dot; readable pill ink from the accent's luminance
    function inkFor(hex) {
      var h = hex.replace("#", "");
      if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
      var r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.62 ? "#111" : "#fff";
    }

    document.addEventListener("mouseover", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var onDark = !!t.closest(".stage, .mcard");
      wrap.classList.toggle("on-dark", onDark);

      var card = t.closest(".mcard");
      if (card) {
        var acc = card.getAttribute("data-accent") || "#fff";
        wrap.style.setProperty("--cur-accent", acc);
        wrap.style.setProperty("--cur-ink", inkFor(acc));
        pill.textContent = card.getAttribute("data-cursor-label") || "View";
        wrap.classList.add("is-card"); wrap.classList.remove("is-link");
        return;
      }
      if (t.closest("a, button, [role='button']")) {
        wrap.classList.add("is-link"); wrap.classList.remove("is-card");
      }
    });
    document.addEventListener("mouseout", function (e) {
      var t = e.target, rel = e.relatedTarget;
      function left(sel) { return t.closest && t.closest(sel) && !(rel && rel.closest && rel.closest(sel)); }
      if (left(".mcard")) wrap.classList.remove("is-card");
      if (left("a, button, [role='button']") && !(rel && rel.closest && rel.closest(".mcard"))) wrap.classList.remove("is-link");
      if (left(".stage, .mcard")) wrap.classList.remove("on-dark");
    });
  }


  function boot() { nav(); fit(); cursor(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
