/* Ardent Crazy Mode. Vanilla, no deps. State: localStorage "ardent-crazy" = "1" | "0".
   The head script sets data-crazy before paint; this file builds and tears down the extras.

   Three things live here that the CSS cannot do on its own:
     spores()    generates the drifting ink organisms
     tick()      one rAF driving the zero-g drift and the pointer repel
     dissolve()  the erosion on click

   Everything else is CSS. The rAF runs continuously while Crazy is on and
   stops dead on a hidden tab, on reduced motion, and on touch. */
(function () {
  "use strict";

  var KEY = "ardent-crazy";
  var root = document.documentElement;
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqFine = window.matchMedia("(hover: hover) and (pointer: fine)");

  /* ---- Config. COPY-TBC: scribbles and alt words need Rish's sign-off ---- */
  var NOTES = [
    { sel: ".a-produsa",  text: "this one almost killed me", pos: "tr", rot: -4 },
    { sel: ".a-desserts", text: "desserts > pixels",         pos: "bl", rot: 3 },
    { sel: ".a-lurch",    text: "yes, this is real",         pos: "tl", rot: -3 },
    { sel: ".a-cat",      text: "he's fine. he moved out.",  pos: "br", rot: 4 },
    { sel: ".a-contact",  text: "say hi, I don't bite",      pos: "tr", rot: -2 }
  ];
  var STRIKES = [
    { sel: ".a-supaca .tile__eyebrow",   alt: "the car people" },
    { sel: ".a-bizotico .tile__eyebrow", alt: "watches!!" }
  ];
  var DOODLES = [
    { sel: ".a-intro",   shape: "squiggle",  x: "62%",   y: "-26px", w: 120, rot: -6 },
    { sel: ".a-produsa", shape: "ring",      x: "58%",   y: "70%",   w: 150, rot: 8, stroke: "#7A2E35" },
    { sel: ".a-supaca",  shape: "arrow",     x: "-36px", y: "40%",   w: 80,  rot: 12 },
    { sel: ".a-sintero", shape: "star",      x: "86%",   y: "-20px", w: 56,  rot: -10 },
    { sel: ".a-moments", shape: "spiral",    x: "92%",   y: "8%",    w: 70,  rot: 0 },
    { sel: ".a-blog",    shape: "tick",      x: "-18px", y: "-18px", w: 54,  rot: -8 },
    { sel: ".a-contact", shape: "underline", x: "4%",    y: "62%",   w: 220, rot: -1, stroke: "#7A2E35" }
  ];
  var PATHS = {
    squiggle:  "M5 50 C15 20 25 80 35 50 S55 20 65 50 S85 80 95 50",
    ring:      "M22 52 C18 26 78 18 86 46 C93 74 34 86 18 60 C10 46 28 30 54 28",
    arrow:     "M8 78 C28 44 56 30 88 22 M70 12 L88 22 L78 40",
    star:      "M50 8 L58 40 L92 42 L64 60 L74 92 L50 72 L26 92 L36 60 L8 42 L42 40 Z",
    spiral:    "M50 50 C54 47 58 53 54 57 C47 62 39 55 42 47 C46 36 62 35 67 46 C73 59 62 72 48 72 C31 72 22 56 27 40 C33 22 58 16 72 28",
    tick:      "M14 56 L40 80 L88 18",
    underline: "M4 60 C30 52 60 66 96 54 M10 72 C40 64 70 76 92 68"
  };

  /* Controls that float and repel. The crazy switch is deliberately absent:
     it is the way out and it never moves. Card arrows are absent too,
     because the whole card is the click target and a fleeing arrow would
     be lying about where to aim. */
  var FLOAT_SEL = ".bar__in > a, .dock__btn, .contact__list a";
  /* Everything that dissolves, which includes the switch. */
  var BURST_SEL = ".bar__in > a, .dock__btn, .contact__list a, .btn, .crazy-switch, .navsheet__list a";
  /* Each spore gets a three-hue gradient rather than one colour fading to
     nothing. Three hues in one body is what makes the long hue-rotate read
     as oil on water instead of as a light going up and down. */
  var SPORE_FILL = ["#D98FA0", "#C2414F", "#E8B04B", "#7FB6D9", "#9CCB8A", "#B07FD9"];
  var SPORE_TRIOS = [
    ["#D98FA0", "#7FB6D9", "#E8B04B"],
    ["#B07FD9", "#9CCB8A", "#D98FA0"],
    ["#7FB6D9", "#E8B04B", "#C2414F"],
    ["#9CCB8A", "#B07FD9", "#7FB6D9"],
    ["#E8B04B", "#C2414F", "#B07FD9"]
  ];
  var MAX_SPORES = 7;

  /* ---- State ---- */
  var built = false, made = [], floaters = [], raf = 0, io = null, heroIO = null, listening = false;
  var px = -1e4, py = -1e4, pointerDown = false, uid = 0;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function track(el) { made.push(el); return el; }
  function reduce() { return mqReduce.matches; }

  /* ---- Pieces ---------------------------------------------------------- */

  function tilts() {
    $$(".bento--home > .tile").forEach(function (t) {
      var big = t.classList.contains("a-produsa") || t.classList.contains("a-intro");
      var mag = big ? rand(0.6, 1.2) : rand(2, 4);
      t.style.setProperty("--tilt-r", (Math.random() < 0.5 ? -mag : mag).toFixed(2) + "deg");
    });
  }

  function notes() {
    NOTES.forEach(function (n, i) {
      var host = $(n.sel); if (!host) return;
      var el = track(document.createElement("span"));
      el.className = "crazy-note"; el.setAttribute("aria-hidden", "true");
      el.dataset.pos = n.pos; el.textContent = n.text;
      el.style.setProperty("--rot", n.rot + "deg");
      el.style.setProperty("--delay", (200 + i * 140) + "ms");
      host.appendChild(el);
    });
  }

  function strikes() {
    STRIKES.forEach(function (s) {
      var eb = $(s.sel); if (!eb) return;
      eb.classList.add("crazy-strike");
      var alt = track(document.createElement("span"));
      alt.className = "crazy-alt"; alt.setAttribute("aria-hidden", "true"); alt.textContent = s.alt;
      eb.insertAdjacentElement("afterend", alt);
    });
  }

  function doodles() {
    var ns = "http://www.w3.org/2000/svg";
    var canObserve = !reduce() && ("IntersectionObserver" in window);
    if (canObserve) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-drawn"); io.unobserve(e.target); } });
      }, { threshold: 0.4 });
    }
    DOODLES.forEach(function (d, i) {
      var host = $(d.sel); if (!host) return;
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
      svg.setAttribute("class", "crazy-doodle");
      svg.style.cssText = "left:" + d.x + ";top:" + d.y + ";--w:" + d.w + "px;--rot:" + d.rot + "deg;" +
        (d.stroke ? "--stroke:" + d.stroke + ";" : "") + "--dur:" + (0.9 + i * 0.08).toFixed(2) + "s";
      var p = document.createElementNS(ns, "path");
      p.setAttribute("d", PATHS[d.shape]); p.setAttribute("pathLength", "1");
      svg.appendChild(p); host.appendChild(track(svg));
      if (canObserve) io.observe(svg); else svg.classList.add("is-drawn");
    });
  }

  /* ---- Spores ----------------------------------------------------------
     A radially symmetric organism in three nested parts. The membrane is a
     lobed ring built from quadratic segments through alternating radii,
     which is what gives it the diatom silhouette; the spokes and the core
     turn against it. Everything is generated, so there is no art to ship
     and no two spores on a page are the same. */

  function lobedPath(lobes, rOut, rIn) {
    var pts = [], i, a, r, d;
    for (i = 0; i < lobes * 2; i++) {
      a = (Math.PI * i) / lobes - Math.PI / 2;
      r = i % 2 ? rIn : rOut;
      pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    d = "M" + ((pts[0][0] + pts[1][0]) / 2).toFixed(1) + " " + ((pts[0][1] + pts[1][1]) / 2).toFixed(1);
    for (i = 1; i <= pts.length; i++) {
      var p = pts[i % pts.length], q = pts[(i + 1) % pts.length];
      d += "Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " " +
           ((p[0] + q[0]) / 2).toFixed(1) + " " + ((p[1] + q[1]) / 2).toFixed(1);
    }
    return d + "Z";
  }

  function spokes(n, r1, r2) {
    var d = "", i, a;
    for (i = 0; i < n; i++) {
      a = (Math.PI * 2 * i) / n - Math.PI / 2;
      d += "M" + (50 + Math.cos(a) * r1).toFixed(1) + " " + (50 + Math.sin(a) * r1).toFixed(1) +
           "L" + (50 + Math.cos(a) * r2).toFixed(1) + " " + (50 + Math.sin(a) * r2).toFixed(1);
    }
    return d;
  }

  function sporeSVG(i) {
    var id = "sg" + (uid++), hid = "sh" + (uid++);
    var lobes = 5 + (i % 5);                       /* 5 to 9 */
    var trio = SPORE_TRIOS[i % SPORE_TRIOS.length];
    var membrane = lobedPath(lobes, 44, 44 - rand(7, 15));
    var inner = lobedPath(lobes, 25, 25 - rand(4, 9));
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<radialGradient id="' + id + '" cx="36%" cy="32%" r="78%">' +
      '<stop offset="0%" stop-color="' + trio[0] + '" stop-opacity=".92"/>' +
      '<stop offset="46%" stop-color="' + trio[1] + '" stop-opacity=".66"/>' +
      '<stop offset="100%" stop-color="' + trio[2] + '" stop-opacity=".34"/>' +
      '</radialGradient>' +
      '<radialGradient id="' + hid + '" cx="50%" cy="50%" r="50%">' +
      '<stop offset="55%" stop-color="' + trio[1] + '" stop-opacity="0"/>' +
      '<stop offset="100%" stop-color="' + trio[0] + '" stop-opacity=".4"/>' +
      '</radialGradient>' +
      '</defs>' +
      /* a soft halo behind everything, so the organism glows on the flood */
      '<circle cx="50" cy="50" r="49" fill="url(#' + hid + ')"/>' +
      '<g class="sp-m"><path d="' + membrane + '" fill="url(#' + id + ')" stroke="#000" stroke-width="2.2" stroke-linejoin="round"/></g>' +
      '<g class="sp-s"><path d="' + spokes(lobes * 2, 13, 42) + '" fill="none" stroke="#000" stroke-width="1.1" stroke-linecap="round" opacity=".55"/></g>' +
      '<g class="sp-c"><path d="' + inner + '" fill="url(#' + hid + ')" stroke="#000" stroke-width="1.8"/>' +
      '<circle cx="50" cy="50" r="6" fill="none" stroke="#000" stroke-width="1.8"/></g>' +
      '</svg>';
  }

  /* An x position in the side gutters if there is room, else hugging the
     screen edge. On a phone there are no gutters, so they ride the edges. */
  function gutterX(w) {
    var win = $(".window");
    var r = win ? win.getBoundingClientRect() : { left: 0, right: w };
    if (r.left < 90) return Math.random() < 0.5 ? rand(-18, 16) : rand(w - 76, w - 42);
    return Math.random() < 0.5 ? rand(4, r.left - 80) : rand(r.right + 10, w - 80);
  }

  function spores() {
    if (reduce()) return;                            /* static mode: no stage at all */
    var st = track(document.createElement("div"));
    st.className = "crazy-stage"; st.setAttribute("aria-hidden", "true");
    var w = window.innerWidth, small = w < 700;
    var n = small ? 3 : MAX_SPORES, i;
    for (i = 0; i < n; i++) {
      var s = document.createElement("div");
      s.className = "crazy-spore";
      var big = !small && i < 3;
      s.style.setProperty("--size", (big ? rand(150, 240) : rand(small ? 60 : 78, small ? 104 : 134)).toFixed(0) + "px");
      s.style.setProperty("--x", gutterX(w).toFixed(0) + "px");
      s.style.setProperty("--y", rand(6, 82).toFixed(0) + "vh");
      s.style.setProperty("--dx", rand(-70, 70).toFixed(0) + "px");
      s.style.setProperty("--dy", rand(-120, 120).toFixed(0) + "px");
      s.style.setProperty("--spin", rand(-40, 40).toFixed(0) + "deg");
      s.style.setProperty("--scl", rand(0.86, 1.26).toFixed(2));
      s.style.setProperty("--dur", rand(22, 44).toFixed(0) + "s");
      s.style.setProperty("--delay", (-rand(0, 20)).toFixed(1) + "s");
      s.style.setProperty("--hue", rand(16, 34).toFixed(0) + "s");
      s.style.setProperty("--hue-delay", (-rand(0, 30)).toFixed(1) + "s");
      s.style.setProperty("--m", rand(26, 48).toFixed(0) + "s");
      s.style.setProperty("--s", rand(16, 30).toFixed(0) + "s");
      s.style.setProperty("--c", rand(5, 11).toFixed(1) + "s");
      s.innerHTML = sporeSVG(i);
      st.appendChild(s);
    }
    document.body.appendChild(st);
  }

  function heroWatch() {
    var c = document.getElementById("curtain");
    if (!c || !("IntersectionObserver" in window)) { root.classList.add("crazy-past-hero"); return; }
    heroIO = new IntersectionObserver(function (es) {
      root.classList.toggle("crazy-past-hero", es[0].intersectionRatio < 0.35);
    }, { threshold: [0, 0.35, 1] });
    heroIO.observe(c);
  }

  /* ---- Zero-g controls -------------------------------------------------
     Each control carries its own drift phase, a spring, and a tiredness
     counter. One rAF writes `translate` on all of them; `transform` is left
     alone so the nav pill's scale and rotate still compose.

     Rects are cached and only refreshed on scroll and resize, so the loop
     reads no layout at all in a normal frame. */

  var R_DODGE = 150, MAX_PUSH = 34, STIFF = 0.14, DAMP = 0.78;
  var lastT = 0;

  function setupFloaters() {
    if (reduce() || !mqFine.matches) return;         /* never on touch or reduced motion */
    $$(FLOAT_SEL).forEach(function (el) {
      el.classList.add("crazy-float");
      floaters.push({
        el: el,
        ax: rand(5, 10), ay: rand(4, 9),
        sx: rand(0.42, 0.9), sy: rand(0.35, 0.78),
        phx: rand(0, 6.28), phy: rand(0, 6.28),
        x: 0, y: 0, vx: 0, vy: 0,
        L: 0, T: 0, W: 0, H: 0,
        inside: false, hits: [], tiredUntil: 0
      });
    });
    measure();
  }

  function measure() {
    for (var i = 0; i < floaters.length; i++) {
      var f = floaters[i], r = f.el.getBoundingClientRect();
      f.L = r.left - f.x; f.T = r.top - f.y; f.W = r.width; f.H = r.height;
    }
  }

  function schedule() { if (!raf && !document.hidden && floaters.length) raf = requestAnimationFrame(tick); }
  function onMove(e) { px = e.clientX; py = e.clientY; }
  function onDown() { pointerDown = true; }
  function onUp() { pointerDown = false; }
  function onLayout() { measure(); }

  function tick(now) {
    raf = 0;
    /* The spring is integrated per frame, so on a 120Hz display it would
       converge twice as fast and feel like a different control. dt is the
       frame length in 60fps units, capped so a long stall (a background
       tab, a slow paint) cannot fling anything across the screen. */
    var dt = lastT ? Math.min((now - lastT) / 16.667, 3) : 1;
    lastT = now;
    var damp = Math.pow(DAMP, dt);
    var t = now / 1000, i, f, dx, dy, nx, ny, ex, ey, edge, cx, cy, vx, vy, len, push, tx, ty;
    for (i = 0; i < floaters.length; i++) {
      f = floaters[i];

      /* the idle drift: never quite still */
      tx = f.ax * Math.sin(t * f.sx + f.phx);
      ty = f.ay * Math.sin(t * f.sy + f.phy);

      if (f.tiredUntil && now >= f.tiredUntil) { f.tiredUntil = 0; f.el.classList.remove("is-tired"); }

      var frozen = f.tiredUntil || pointerDown || f.el.matches(":focus-within");
      if (!frozen) {
        nx = Math.max(f.L, Math.min(px, f.L + f.W));
        ny = Math.max(f.T, Math.min(py, f.T + f.H));
        ex = nx - px; ey = ny - py; edge = Math.sqrt(ex * ex + ey * ey);
        if (edge < R_DODGE) {
          if (!f.inside) {                             /* a new approach */
            f.inside = true; f.hits.push(now);
            f.hits = f.hits.filter(function (h) { return now - h < 4000; });
            if (f.hits.length >= 3) {                  /* tired: holds still 6s so it can be clicked */
              f.tiredUntil = now + 6000; f.hits = [];
              f.el.classList.add("is-tired");
            }
          }
          if (!f.tiredUntil) {
            cx = f.L + f.W / 2; cy = f.T + f.H / 2;
            vx = cx - px; vy = cy - py; len = Math.sqrt(vx * vx + vy * vy) || 1;
            push = (1 - edge / R_DODGE) * MAX_PUSH;
            tx += (vx / len) * push; ty += (vy / len) * push;
          }
        } else if (f.inside) { f.inside = false; }
      }

      /* a spring with mass, so it overshoots the target and settles rather
         than snapping to it. This is the whole difference between reading
         as "in space" and reading as "a dodge". */
      f.vx = (f.vx + (tx - f.x) * STIFF * dt) * damp;
      f.vy = (f.vy + (ty - f.y) * STIFF * dt) * damp;
      f.x += f.vx * dt; f.y += f.vy * dt;

      dx = Math.round(f.x * 10) / 10; dy = Math.round(f.y * 10) / 10;
      f.el.style.translate = dx + "px " + dy + "px";
    }
    schedule();
  }

  /* ---- Dissolve --------------------------------------------------------
     Visual only. The click is never intercepted: no preventDefault, no
     delay, no waiting before a link navigates. The keyframes end back at a
     solid mask, so anything still on the page reforms by itself. */

  function dissolve(el) {
    if (reduce()) return;
    el.classList.remove("is-dissolving");
    void el.offsetWidth;                              /* restart the animation on a repeat click */
    el.classList.add("is-dissolving");
    window.setTimeout(function () { el.classList.remove("is-dissolving"); }, 700);

    var r = el.getBoundingClientRect(), stage = document.body, i, n = 7;
    for (i = 0; i < n; i++) {
      var b = document.createElement("i");
      b.className = "crazy-burst"; b.setAttribute("aria-hidden", "true");
      var d = rand(5, 10);
      b.style.left = (r.left + rand(0.1, 0.9) * r.width) + "px";
      b.style.top = (r.top + rand(0.1, 0.9) * r.height) + "px";
      b.style.setProperty("--d", d.toFixed(0) + "px");
      b.style.setProperty("--fill", SPORE_FILL[(Math.random() * SPORE_FILL.length) | 0]);
      b.style.setProperty("--bx", rand(-46, 46).toFixed(0) + "px");
      b.style.setProperty("--by", rand(-54, -14).toFixed(0) + "px");
      b.style.setProperty("--br", rand(-180, 180).toFixed(0) + "deg");
      stage.appendChild(b);
      (function (node) {
        window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 680);
      })(b);
    }
  }

  function onClick(e) {
    if (root.getAttribute("data-crazy") !== "on") return;
    var t = e.target.closest ? e.target.closest(BURST_SEL) : null;
    if (t) dissolve(t);
  }

  function onVis() {
    root.classList.toggle("crazy-paused", document.hidden);
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    else { lastT = 0; schedule(); }
  }

  /* ---- Lifecycle ---- */
  function build() {
    if (built) return; built = true;
    tilts(); notes(); strikes(); doodles(); spores(); heroWatch(); setupFloaters();
    document.addEventListener("click", onClick, true);
    if (floaters.length) {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });
      window.addEventListener("scroll", onLayout, { passive: true });
      window.addEventListener("resize", onLayout, { passive: true });
      listening = true;
      schedule();
    }
    document.addEventListener("visibilitychange", onVis);
  }

  function teardown() {
    if (!built) return; built = false;
    made.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); made = [];
    $$(".crazy-burst").forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    $$(".crazy-strike").forEach(function (e) { e.classList.remove("crazy-strike"); });
    $$(".is-dissolving").forEach(function (e) { e.classList.remove("is-dissolving"); });
    $$(".bento--home > .tile").forEach(function (t) { t.style.removeProperty("--tilt-r"); });
    floaters.forEach(function (f) {
      f.el.style.translate = "";
      f.el.classList.remove("crazy-float", "is-tired");
    });
    floaters = [];
    if (io) { io.disconnect(); io = null; }
    if (heroIO) { heroIO.disconnect(); heroIO = null; }
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.removeEventListener("click", onClick, true);
    if (listening) {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("scroll", onLayout);
      window.removeEventListener("resize", onLayout);
      listening = false;
    }
    document.removeEventListener("visibilitychange", onVis);
    root.classList.remove("crazy-past-hero", "crazy-paused");
  }

  function set(on, sw) {
    if (on) root.setAttribute("data-crazy", "on"); else root.removeAttribute("data-crazy");
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
    if (sw) sw.setAttribute("aria-checked", on ? "true" : "false");
    if (on) build(); else teardown();
  }

  function init() {
    var sw = document.getElementById("crazySwitch");
    var on = root.getAttribute("data-crazy") === "on";
    if (sw) {
      sw.setAttribute("aria-checked", on ? "true" : "false");
      sw.addEventListener("click", function () { set(root.getAttribute("data-crazy") !== "on", sw); });
    }
    if (on) build();
    var rebuild = function () { if (root.getAttribute("data-crazy") === "on") { teardown(); build(); } };
    if (mqReduce.addEventListener) { mqReduce.addEventListener("change", rebuild); mqFine.addEventListener("change", rebuild); }
    window.addEventListener("storage", function (e) { if (e.key === KEY) set(e.newValue === "1", sw); });  /* sync tabs */
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
