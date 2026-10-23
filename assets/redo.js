/* ===========================================================================
   REDO — homepage behaviour
   2026-10-23 (r4). Five jobs, each a no-op where its hooks are absent:
     1  the floating pill nav arrives once the black stage covers the banner
     2  the DESSERTS wordmark is fitted to the viewport width
     3  the custom cursor (desktop pointers only)
     4  the toy pile — draggable software logos with gravity (desktop only)
     5  the music disc — click to play/pause (all devices)
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
      // The word is absolutely positioned left:0/right:0, so it is stretched
      // to the band width — scrollWidth would just report the band, not the
      // glyphs. Un-stretch it to shrink-wrap, measure, then restore so it
      // re-centres at the new size.
      word.style.right = "auto";
      word.style.width = "max-content";
      word.style.fontSize = "100px";
      var pad = parseFloat(getComputedStyle(band).paddingLeft) || 0;
      var target = (band.clientWidth - pad * 2) * 0.98;   // fill the padded inner width
      var cur = word.scrollWidth || 1;
      var byWidth = 100 * target / cur;
      // Also cap against the band height, so on a wide-but-short viewport the
      // word doesn't grow so tall its tops get clipped more than the foot.
      var byHeight = band.clientHeight * 1.25;
      word.style.fontSize = Math.min(byWidth, byHeight).toFixed(1) + "px";
      word.style.width = "";
      word.style.right = "";
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
      var onDark = !!t.closest(".stage");
      wrap.classList.toggle("on-dark", onDark);

      var card = t.closest(".mcard, .feat, .dz");
      if (card) {
        var host = card.closest("[data-accent]") || card;
        var acc = host.getAttribute("data-accent") || "#fff";
        wrap.style.setProperty("--cur-accent", acc);
        wrap.style.setProperty("--cur-ink", inkFor(acc));
        pill.textContent = host.getAttribute("data-cursor-label") || "View";
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
      if (left(".mcard, .feat, .dz")) wrap.classList.remove("is-card");
      if (left("a, button, [role='button']") && !(rel && rel.closest && rel.closest(".mcard, .feat, .dz"))) wrap.classList.remove("is-link");
      if (left(".stage")) wrap.classList.remove("on-dark");
    });
  }


  /* 4. THE TOY PILE — draggable software logos with gravity. ----------------
     The six tools sit as white chips on the rule under "Selected work".
     Grab one and it lifts; throw it and gravity takes over — it falls, lands
     on whatever card is under it, bounces, and settles. Nudge one off the end
     of the line and it drops straight down. Leave the pile in the footer or
     the Desserts and a note asks, nicely, to put them back.

     Desktop pointers only, and never under reduced motion: dragging on touch
     would fight the scroll, and a page of falling objects is no gift to
     someone who asked the OS to hold still. Everything is one coordinate
     space — pixels from the top-left of .stage__in, which scrolls with the
     pile — so nothing here reads scroll position in a frame. ------------- */
  function toys() {
    if (!fine || reduce) return;

    var stageIn = document.querySelector(".stage__in");
    var head = document.querySelector(".stage .idx__head");           /* the "Selected work" rule */
    if (!stageIn || !head || !document.querySelector(".feat")) return;

    var TOOLS = [
      { f: "figma",   label: "Figma"   },
      { f: "cursor",  label: "Cursor"  },
      { f: "claude",  label: "Claude"  },
      { f: "make",    label: "Make"    },
      { f: "n8n",     label: "n8n"     },
      { f: "shopify", label: "Shopify" }
    ];

    /* tuning — all in 60fps-frame units */
    var G = 0.85, AIR = 0.994, REST = 0.52, WALL = 0.42;
    var BOUNCE_FRICTION = 0.7, SLIDE = 0.86, REST_V = 1.7, STOP_V = 0.25;
    var LAND_SLACK = 14, THROW_CAP = 42;

    var S = 56;
    var layer = document.createElement("div");
    layer.className = "toys"; layer.setAttribute("aria-hidden", "true");
    stageIn.appendChild(layer);

    var note = document.createElement("div");
    note.className = "toy-note"; note.setAttribute("role", "status");
    note.innerHTML = "It’s <strong>bad manners</strong> to not put things back where you found them." +
      "<br><button type=\"button\" class=\"toy-note__put\">↩ put them back</button>";
    layer.appendChild(note);
    var noteBtn = note.querySelector(".toy-note__put");
    var noteOn = false;

    var stageRect = null, W = 0;
    var surfaces = [], footZ = null, dessZ = null, lineTop = 0, lineX0 = 0, lineX1 = 0;
    var chips = [], topZ = 10, raf = 0, lastT = 0, held = null;

    function rel(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height };
    }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function layout() {
      stageRect = stageIn.getBoundingClientRect();
      W = stageRect.width;
      S = W < 760 ? 48 : 56;
      var hr = rel(head);
      lineTop = hr.y + hr.h; lineX0 = hr.x; lineX1 = hr.x + hr.w;      /* the rule line */

      surfaces = [{ top: lineTop, x0: lineX0, x1: lineX1 }];
      var sel = ".feat, .feat-sm, .dz__box, .dz__stage";
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        var r = rel(el);
        surfaces.push({ top: r.y, x0: r.x, x1: r.x + r.w });
      });

      var end = document.querySelector(".stage__end");
      if (end) {
        var er = rel(end);
        surfaces.push({ top: er.y, x0: er.x, x1: er.x + er.w });
        /* a full-width floor at the foot of the contact block, so nothing
           falls forever if it misses every card */
        surfaces.push({ top: er.y + er.h, x0: -1e4, x1: 1e4 });
        /* the footer zone covers the block and the floor just below it */
        footZ = { x0: -1e4, y0: er.y, x1: 1e4, y1: er.y + er.h + S + 28 };
      }
      var dess = document.querySelector(".dess2");
      if (dess) { var dr = rel(dess); dessZ = { x0: dr.x, y0: dr.y, x1: dr.x + dr.w, y1: dr.y + dr.h }; }

      surfaces.sort(function (a, b) { return a.top - b.top; });
    }

    function homeSlot(i) {
      var n = TOOLS.length, span = Math.min((n - 1) * S * 0.58, (lineX1 - lineX0) - S);
      var cx = (lineX0 + lineX1) / 2;
      return { x: clamp(cx - span / 2 + i * (span / (n - 1)) - S / 2, 0, W - S), y: lineTop - S + 2 };
    }

    function place(c) { c.el.style.left = c.x.toFixed(1) + "px"; c.el.style.top = c.y.toFixed(1) + "px"; }

    function build() {
      layout();
      TOOLS.forEach(function (t, i) {
        var el = document.createElement("span");
        el.className = "toy is-home"; el.setAttribute("aria-hidden", "true");
        el.style.setProperty("--toy", S + "px");
        el.style.setProperty("--sway", (-i * 0.6).toFixed(2) + "s");
        var baseR = (i % 2 ? 1 : -1) * (2 + (i % 3) * 2);
        el.style.setProperty("--r", baseR + "deg");
        var img = new Image(); img.src = "/assets/logos/" + t.f + ".svg"; img.alt = ""; el.appendChild(img);
        layer.appendChild(el);

        var slot = homeSlot(i);
        var c = { el: el, img: img, i: i, baseR: baseR, x: slot.x, y: slot.y,
                  vx: 0, vy: 0, r: baseR, restOn: null, settled: true, home: true,
                  _lx: slot.x, _ly: slot.y, _lt: 0 };
        place(c);
        el.style.zIndex = (topZ++);
        el.addEventListener("pointerdown", function (e) { grab(c, e); });
        chips.push(c);
      });
    }

    /* ---- drag ---- */
    function ptr(e) { return { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top }; }

    function grab(c, e) {
      e.preventDefault();
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      try { c.el.setPointerCapture(e.pointerId); } catch (err) {}
      var p = ptr(e);
      c.held = true; c.settled = false; c.restOn = null; c.home = false;
      c.el.classList.remove("is-home", "is-homing"); c.el.classList.add("is-held");
      c.el.style.transform = "rotate(" + c.r.toFixed(1) + "deg)";
      c.gdx = p.x - c.x; c.gdy = p.y - c.y;
      c._lx = c.x; c._ly = c.y; c._lt = performance.now();
      c.vx = c.vy = 0;
      c.el.style.zIndex = (topZ++);
      held = c;
    }

    function onMove(e) {
      if (!held) return;
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      var p = ptr(e), c = held;
      var nx = clamp(p.x - c.gdx, 0, W - S);
      var ny = clamp(p.y - c.gdy, -S - 40, (surfaces.length ? surfaces[surfaces.length - 1].top : 4000));
      var now = performance.now(), dtf = (now - c._lt) / 16.667 || 1;
      var svx = (nx - c._lx) / dtf, svy = (ny - c._ly) / dtf;
      c.vx = 0.55 * c.vx + 0.45 * svx; c.vy = 0.55 * c.vy + 0.45 * svy;
      c._lx = nx; c._ly = ny; c._lt = now;
      c.x = nx; c.y = ny; place(c);
    }

    function onUp(e) {
      if (!held) return;
      var c = held; held = null;
      try { c.el.releasePointerCapture(e.pointerId); } catch (err) {}
      c.held = false; c.el.classList.remove("is-held");

      /* dropped back on the line, gently → it goes home */
      var cx = c.x + S / 2, slow = Math.abs(c.vx) < 6 && Math.abs(c.vy) < 6;
      var overLine = cx >= lineX0 - 20 && cx <= lineX1 + 20 && c.y > lineTop - S - 52 && c.y < lineTop - S + 34;
      if (slow && overLine) { goHome(c); return; }

      c.vx = clamp(c.vx, -THROW_CAP, THROW_CAP);
      c.vy = clamp(c.vy, -THROW_CAP, THROW_CAP);
      c.restOn = null; c.settled = false;
      kick();
    }

    function goHome(c) {
      var slot = homeSlot(c.i);
      c.el.classList.add("is-homing");
      c.x = slot.x; c.y = slot.y; place(c);
      c.el.style.transform = "rotate(" + c.baseR + "deg)";
      c.vx = c.vy = 0; c.restOn = null;
      var done = function () {
        c.el.removeEventListener("transitionend", done);
        c.el.classList.remove("is-homing");
        c.el.style.transform = ""; c.el.style.setProperty("--r", c.baseR + "deg");
        c.el.classList.add("is-home");
        c.settled = true; c.home = true;
      };
      c.el.addEventListener("transitionend", done);
      checkNote();
    }

    function returnAll() {
      chips.forEach(function (c) { if (!c.home) goHome(c); });
    }

    /* ---- physics ---- */
    function landFor(c, prevBottom, nx, ny) {
      var newBottom = ny + S, cx = nx + S / 2, best = null;
      for (var i = 0; i < surfaces.length; i++) {
        var s = surfaces[i];
        if (cx < s.x0 - 6 || cx > s.x1 + 6) continue;
        if (s.top >= prevBottom - LAND_SLACK && s.top <= newBottom) {
          if (!best || s.top < best.top) best = s;
        }
      }
      return best;
    }

    function step(dt) {
      var moving = false;
      for (var i = 0; i < chips.length; i++) {
        var c = chips[i];
        if (c.held) { moving = true; continue; }
        if (c.settled) continue;

        if (c.restOn) {
          /* resting on a ledge: slide with friction, tip off an edge */
          c.vx *= Math.pow(SLIDE, dt);
          var nx = clamp(c.x + c.vx * dt, 0, W - S), cx = nx + S / 2;
          if (nx <= 0 || nx >= W - S) c.vx = -c.vx * WALL;
          if (cx < c.restOn.x0 || cx > c.restOn.x1) { c.restOn = null; c.vy = 0.4; }  /* off the edge */
          else {
            c.x = nx; c.y = c.restOn.top - S;
            if (Math.abs(c.vx) < STOP_V) { c.vx = 0; settle(c); place(c); continue; }
          }
          place(c); moving = true; continue;
        }

        /* airborne */
        c.vy += G * dt; c.vx *= Math.pow(AIR, dt);
        var prevBottom = c.y + S;
        var nx2 = c.x + c.vx * dt, ny2 = c.y + c.vy * dt;
        if (nx2 < 0) { nx2 = 0; c.vx = -c.vx * WALL; }
        else if (nx2 > W - S) { nx2 = W - S; c.vx = -c.vx * WALL; }

        var hit = landFor(c, prevBottom, nx2, ny2);
        if (hit) {
          ny2 = hit.top - S;
          if (Math.abs(c.vy) > REST_V) { c.vy = -c.vy * REST; c.vx *= BOUNCE_FRICTION; }
          else { c.vy = 0; c.restOn = hit; }
        } else {
          c.r += c.vx * 0.5 * dt;                         /* tumble in the air */
        }
        c.x = nx2; c.y = ny2;
        c.el.style.transform = "rotate(" + (c.r % 360).toFixed(1) + "deg)";
        place(c); moving = true;
      }
      return moving;
    }

    function settle(c) {
      if (c.settled) return;
      c.settled = true;
      c.el.style.transform = "rotate(" + (c.r % 360).toFixed(1) + "deg)";
      checkNote();
    }

    function tick(now) {
      raf = 0;
      var dt = lastT ? Math.min((now - lastT) / 16.667, 2.5) : 1;
      lastT = now;
      if (step(dt) || held) raf = requestAnimationFrame(tick);
      else lastT = 0;
    }
    function kick() { if (!raf) { lastT = 0; raf = requestAnimationFrame(tick); } }

    /* ---- the note ---- */
    function inZone(c, z) {
      if (!z) return false;
      var cx = c.x + S / 2, cy = c.y + S / 2;
      return cx >= z.x0 && cx <= z.x1 && cy >= z.y0 && cy <= z.y1;
    }
    function checkNote() {
      var stray = chips.filter(function (c) { return c.settled && !c.home && (inZone(c, footZ) || inZone(c, dessZ)); });
      if (stray.length) {
        /* anchor the note above the highest stray chip */
        var top = stray.reduce(function (a, b) { return b.y < a.y ? b : a; });
        var nx = clamp(top.x - 18, 8, W - 276);
        var ny = Math.max(top.y - note.offsetHeight - 16, 8);
        note.style.left = nx.toFixed(0) + "px"; note.style.top = ny.toFixed(0) + "px";
        if (!noteOn) { noteOn = true; requestAnimationFrame(function () { note.classList.add("is-on"); }); }
      } else if (noteOn) { noteOn = false; note.classList.remove("is-on"); }
    }

    /* ---- lifecycle ---- */
    var rt;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        layout();
        chips.forEach(function (c) {
          if (c.home) { var s = homeSlot(c.i); c.x = s.x; c.y = s.y; place(c); }
          else { c.settled = false; c.restOn = null; if (c.vy === 0) c.vy = 0.5; }
        });
        checkNote(); kick();
      }, 160);
    }

    build();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    window.addEventListener("resize", onResize);
    if (noteBtn) noteBtn.addEventListener("click", function (e) { e.preventDefault(); returnAll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);
    window.addEventListener("load", onResize);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
  }


  /* 5. MUSIC DISC — click the record to play/pause; hover swipes out the bar.
     Works on touch too (a tap plays), so it is not gated like the cursor or
     the toys. The audio element is the only thing that needs a real file. --- */
  function disc() {
    var el = document.querySelector("[data-disc]");
    if (!el) return;
    var btn = el.querySelector(".disc__rec");
    var audio = el.querySelector(".disc__audio");
    if (!btn || !audio) return;
    el.hidden = false;

    function sync() {
      var playing = !audio.paused && !audio.ended;
      el.classList.toggle("is-playing", playing);
      btn.setAttribute("aria-pressed", playing ? "true" : "false");
      btn.setAttribute("aria-label", playing ? "Pause music" : "Play music");
    }
    btn.addEventListener("click", function () {
      if (audio.paused) {
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});   // missing file or autoplay block: no-op
      } else {
        audio.pause();
      }
    });
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    sync();
  }


  function boot() { nav(); fit(); cursor(); toys(); disc(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
