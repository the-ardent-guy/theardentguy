/* ===========================================================================
   SWISS INDEX
   The only script the restyled pages load. main.js, v2.js, case.js and
   crazy.js are all still in the repo and all still work; none of them is
   linked from a page any more, because every one of them was written for
   markup this restyle removed (the curtain parallax, the toy box physics,
   the window chrome, the nav sheet, the decision rail). Relinking one is
   the way back, not an edit here.

   Everything below is one of eight things:
     1  the scrolled hairline under the nav
     2  the theme switch
     3  the fun switch
     4  reveal
     5  the cursor thumbnail
     6  the chapter rail
     7  the phone menu sheet
     8  video autoplay, wide screens only
   =========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function fine() {
    try { return window.matchMedia("(hover: hover) and (pointer: fine)").matches; }
    catch (e) { return false; }
  }

  /* ---- 0. The scrollbar's width -----------------------------------------
     100vw includes the scrollbar, which is how a full-bleed picture
     quietly hands a page 15px of horizontal scroll on Windows. The real
     number is published once and the CSS subtracts it. */
  function scrollbar() {
    function set() {
      var w = window.innerWidth - root.clientWidth;
      root.style.setProperty("--sbw", (w > 0 ? w : 0) + "px");
    }
    set();
    window.addEventListener("resize", set, { passive: true });
  }

  /* ---- 1. The hairline under the nav ------------------------------------
     Nothing sits behind the nav, so the only thing that can mark it off
     from the page is a rule, and it earns its place only once there is
     something above it to separate. 8px, as specified. */
  function scrolledRule() {
    var on = false;
    function check() {
      var y = window.pageYOffset || root.scrollTop || 0;
      var next = y > 8;
      if (next !== on) { on = next; root.classList.toggle("is-scrolled", on); }
    }
    window.addEventListener("scroll", check, { passive: true });
    check();
  }

  /* ---- 2. The theme switch ---------------------------------------------
     A text toggle. The brackets are drawn by CSS; the word inside is
     swapped here, and the pressed state is what the mono ink hangs off.
     The pre-paint script in each page head has already written data-theme,
     so this never causes a flash. */
  function themeSwitch() {
    var btn = document.querySelector("[data-theme-switch]");
    if (!btn) return;

    function now() {
      return root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    }

    function paint() {
      var dark = now() === "dark";
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
      /* The word names the mode you are in, not the one you would get:
         a switch that reads "light" while the page is light is a label,
         and a switch that reads "light" while the page is dark is a lie
         for the half second before you work out which it meant. */
      btn.textContent = dark ? "dark" : "light";
    }

    btn.addEventListener("click", function () {
      var next = now() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      paint();
    });

    paint();
  }

  /* ---- 3. The fun switch ------------------------------------------------
     data-fun on <html>, and the CSS does the rest. sessionStorage rather
     than localStorage: a fresh visit opens on the work, but clicking out
     to Lurch and back does not reset it. #fun in the URL opens it.

     There is more than one switch on the homepage: a bracketed one in the
     nav and the full "Enter fun mode" action in the Desserts section. They
     are the same control in two places, so every one of them is repainted
     on every change and none of them can show a state the page is not in. */
  function funSwitch() {
    var btns = document.querySelectorAll("[data-fun-switch]");
    if (!btns.length) return;

    function paint(on) {
      Array.prototype.forEach.call(btns, function (b) {
        b.setAttribute("aria-checked", on ? "true" : "false");
        var w = on ? b.getAttribute("data-on") : b.getAttribute("data-off");
        if (w) b.textContent = w;
      });
    }

    function set(on) {
      if (on) root.setAttribute("data-fun", "on");
      else root.removeAttribute("data-fun");
      paint(on);
      try { sessionStorage.setItem("fun", on ? "on" : "off"); } catch (e) {}
    }

    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener("click", function () {
        set(!root.hasAttribute("data-fun"));
      });
    });

    var start = false;
    try { start = sessionStorage.getItem("fun") === "on"; } catch (e) {}
    if (window.location.hash === "#fun") start = true;
    if (start) root.setAttribute("data-fun", "on");
    paint(start);
  }

  /* ---- 4. Reveal -------------------------------------------------------
     The page's only entrance. Once per element, 15% visibility, and index
     rows inside one list stagger 40ms up to five so a long list arrives
     as a list rather than as one block. */
  function reveal() {
    /* .reveal-img is the picture wipe (swiss.css 16.5). It rides the same
       observer, the same once-only unobserve and the same stagger. */
    var els = document.querySelectorAll(".reveal, .reveal-img");
    if (!els.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add("is-in"); });
      return;
    }

    /* Stagger is set per group, not per page: the fifth row of the work
       index and the first row of the desserts index both start at 0. */
    var groups = document.querySelectorAll("[data-stagger]");
    Array.prototype.forEach.call(groups, function (g) {
      var kids = g.querySelectorAll(".reveal, .reveal-img");
      Array.prototype.forEach.call(kids, function (el, i) {
        el.style.setProperty("--d", Math.min(i, 4) * 40 + "ms");
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });

    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---- 5. The cursor thumbnail -----------------------------------------
     The page's one piece of continuous motion. Only on a fine pointer,
     only for a row that carries a real picture, and never a placeholder
     box for a row that does not: an unarmed row simply has no thumbnail,
     which is why Sintero's row stays quiet.

     The figure is translated, nothing else, and the position is lerped at
     0.18 a frame so it trails the cursor instead of being nailed to it.
     The rAF loop runs only while a thumbnail is up. */
  function thumbs() {
    if (reduced || !fine()) return;

    var rows = document.querySelectorAll(".idx-row[data-thumb]");
    if (!rows.length) return;

    var fig = document.createElement("figure");
    fig.className = "idx-thumb";
    fig.setAttribute("aria-hidden", "true");
    var img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    fig.appendChild(img);
    document.body.appendChild(fig);

    var mx = 0, my = 0, x = 0, y = 0, running = false, live = false;

    function frame() {
      if (!running) return;
      x += (mx - x) * 0.18;
      y += (my - y) * 0.18;
      fig.style.transform = "translate3d(" + Math.round(x) + "px," + Math.round(y) + "px,0)";
      requestAnimationFrame(frame);
    }

    document.addEventListener("mousemove", function (e) {
      mx = e.clientX + 24;
      my = e.clientY + 16;
      if (!live) { x = mx; y = my; }
    }, { passive: true });

    Array.prototype.forEach.call(rows, function (row) {
      /* Warm the file so the first hover is not a blank frame. */
      var pre = new Image();
      pre.src = row.getAttribute("data-thumb");

      row.addEventListener("mouseenter", function () {
        img.src = row.getAttribute("data-thumb");
        live = true;
        fig.classList.add("is-on");
        if (!running) { running = true; requestAnimationFrame(frame); }
      });

      row.addEventListener("mouseleave", function () {
        live = false;
        fig.classList.remove("is-on");
        /* Let the fade finish before the loop stops, or the figure freezes
           mid-screen while it is still visible. */
        setTimeout(function () {
          if (!live) running = false;
        }, 220);
      });
    });
  }

  /* ---- 6. The chapter rail ---------------------------------------------
     Built from the page's own H2s rather than written out per page, so a
     new section cannot fall out of the index. A section is skipped if its
     heading is screen-reader-only or if it is marked data-nochapter.

     The active mark uses aria-current on a real <nav>, so the state is in
     the accessibility tree and not only in the ink. */
  function chapters() {
    var rail = document.querySelector(".chapters");
    var col = document.querySelector(".col");
    if (!rail || !col) return;

    var secs = [], links = [];
    Array.prototype.forEach.call(col.querySelectorAll("section"), function (s) {
      if (s.hasAttribute("data-nochapter") || !s.id) return;
      var h = s.querySelector(":scope > h2");
      if (!h || h.classList.contains("u-sr")) return;
      secs.push({ el: s, text: h.textContent.trim() });
    });

    if (secs.length < 2) return;

    secs.forEach(function (s, i) {
      var a = document.createElement("a");
      a.href = "#" + s.el.id;
      a.innerHTML = '<span class="n">' + (i < 9 ? "0" : "") + (i + 1) + "</span><span></span>";
      a.lastChild.textContent = s.text;
      rail.appendChild(a);
      links.push(a);
    });

    if (!("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      /* Nearest the top of the band wins, so a fast scroll cannot leave a
         stale mark behind. */
      var best = null;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e;
      });
      if (!best) return;
      links.forEach(function (a) { a.removeAttribute("aria-current"); });
      var i = secs.findIndex(function (s) { return s.el === best.target; });
      if (i > -1) links[i].setAttribute("aria-current", "true");
    }, { rootMargin: "-15% 0px -65% 0px" });

    secs.forEach(function (s) { io.observe(s.el); });
  }

  /* ---- 7. The phone menu sheet -----------------------------------------
     Full screen, links set left on the page's own ground, no card. Only
     reachable under 640px, where the nav's link row is display:none. */
  function sheet() {
    var btn = document.querySelector("[data-menu]");
    var box = document.getElementById("sheet");
    if (!btn || !box) return;

    var close = box.querySelector("[data-menu-close]");

    function open(on) {
      box.classList.toggle("is-open", on);
      btn.setAttribute("aria-expanded", on ? "true" : "false");
      document.body.style.overflow = on ? "hidden" : "";
      if (on && close) close.focus();
      else if (!on) btn.focus();
    }

    btn.addEventListener("click", function () { open(!box.classList.contains("is-open")); });
    if (close) close.addEventListener("click", function () { open(false); });

    box.addEventListener("click", function (e) {
      if (e.target.tagName === "A") open(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open")) open(false);
    });
  }

  /* ---- 8. Video autoplay -----------------------------------------------
     Ported from case.js unchanged in spirit: no autoplay attribute in the
     markup, so a phone neither burns data on a 2MB file nor plays
     something nobody asked for. Everywhere else the poster stands and the
     viewer gets controls. */
  function videos() {
    var vids = document.querySelectorAll("video[data-autoplay]");
    if (!vids.length) return;

    var ok = false;
    try {
      ok = window.matchMedia("(min-width: 900px)").matches && !reduced;
    } catch (e) {}

    Array.prototype.forEach.call(vids, function (v) {
      if (!ok) { v.controls = true; return; }
      v.autoplay = true;
      var p = v.play();
      if (p && p.catch) p.catch(function () { v.controls = true; });
    });
  }

  function boot() {
    scrollbar();
    scrolledRule();
    themeSwitch();
    funSwitch();
    chapters();
    reveal();
    thumbs();
    sheet();
    videos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
