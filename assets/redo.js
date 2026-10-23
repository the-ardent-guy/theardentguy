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
        var label = host.getAttribute("data-cursor-label");
        if (label) { pill.textContent = label; wrap.classList.remove("no-label"); }
        else { wrap.classList.add("no-label"); }      // case-study rows: no text
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
      if (left(".mcard, .feat, .dz")) { wrap.classList.remove("is-card"); wrap.classList.remove("no-label"); }
      if (left("a, button, [role='button']") && !(rel && rel.closest && rel.closest(".mcard, .feat, .dz"))) wrap.classList.remove("is-link");
      if (left(".stage")) wrap.classList.remove("on-dark");
    });
  }


  /* 4. THE BALL PIT  — the behavioural map
     The six tools are little balls, resting on the RIGHT of the rule under
     "Selected work" so the heading on the left balances them. Pick one up from
     wherever it sits and it lifts to the pointer; let go and it keeps the speed
     of the throw. From there it is a ball:
       GRAVITY pulls it down, AIR bleeds a little speed.
       FLOORS — the rule, every case-study card, the two dessert tiles, the
         contact block, and a full-width floor at the foot — catch it. A fast
         landing BOUNCES (keeps ~3/4 of its speed, loses a little sideways); a
         slow one comes to REST and ROLLS with friction until it stops or rolls
         off the edge and falls on.
       WALLS — the sides of the column — bounce it back.
       BALL-TO-BALL: they push apart and trade the speed along the line between
         them, so a thrown ball scatters the pile and a dropped one knocks its
         neighbours awake.
       BONK: a real landing or knock gives the thing it hit a quick nudge, so
         the page reacts to being played with.
       ROLL: a ball spins at the speed it travels, so it reads as rolling.
     Leave them in the footer or the Desserts and the note asks for them back;
     "put them back" sends the lot home. Desktop pointers only, off under
     reduced motion. One coordinate space: pixels from the top-left of
     .stage__in, which scrolls with the pit. */
  function toys() {
    if (!fine || reduce) return;

    var stageIn = document.querySelector(".stage__in");
    var head = document.querySelector(".stage .idx__head");
    if (!stageIn || !head || !document.querySelector(".feat")) return;

    var TOOLS = ["figma", "cursor", "claude", "make", "n8n", "shopify"];

    /* tuning — 60fps-frame units */
    var G = 0.9, AIR = 0.995, REST = 0.74, WALL = 0.6, ROLL = 0.9;
    var REST_V = 1.5, STOP_V = 0.3, LAND_SLACK = 16, THROW_CAP = 40, BONK_V = 6, PAIR_REST = 0.55;
    var R = 15;

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
    var balls = [], topZ = 10, raf = 0, lastT = 0, held = null;

    function rel(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height };
    }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function layout() {
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      R = W < 760 ? 13 : 15;
      var hr = rel(head);
      lineTop = hr.y + hr.h; lineX0 = hr.x; lineX1 = hr.x + hr.w;

      surfaces = [{ top: lineTop, x0: lineX0, x1: lineX1, el: null }];
      Array.prototype.forEach.call(document.querySelectorAll(".feat, .feat-sm, .dz__cat2, .dz__stage"), function (el) {
        var r = rel(el);
        surfaces.push({ top: r.y, x0: r.x, x1: r.x + r.w, el: el.querySelector(".feat__shot") || el });
      });
      var end = document.querySelector(".stage__end");
      if (end) {
        var er = rel(end);
        surfaces.push({ top: er.y, x0: er.x, x1: er.x + er.w, el: null });
        surfaces.push({ top: er.y + er.h, x0: -1e4, x1: 1e4, el: null });
        footZ = { x0: -1e4, y0: er.y, x1: 1e4, y1: er.y + er.h + R * 2 + 28 };
      }
      var dess = document.querySelector(".dess2");
      if (dess) { var dr = rel(dess); dessZ = { x0: dr.x, y0: dr.y, x1: dr.x + dr.w, y1: dr.y + dr.h }; }
      surfaces.sort(function (a, b) { return a.top - b.top; });
    }

    function homeSlot(i) {
      var n = TOOLS.length, step = R * 2 + 3;
      var cx0 = lineX0 + (lineX1 - lineX0) * 0.76 - ((n - 1) * step) / 2;
      return { cx: clamp(cx0 + i * step, R, W - R), cy: lineTop - R };
    }

    function place(b) {
      b.el.style.transform = "translate(" + (b.cx - R).toFixed(1) + "px," + (b.cy - R).toFixed(1) +
        "px) rotate(" + (b.ang % 360).toFixed(1) + "deg)";
    }

    function build() {
      layout();
      TOOLS.forEach(function (f, i) {
        var el = document.createElement("span");
        el.className = "ball"; el.setAttribute("aria-hidden", "true");
        el.style.setProperty("--d", (R * 2) + "px");
        var img = new Image(); img.src = "/assets/logos/" + f + ".svg"; img.alt = ""; el.appendChild(img);
        layer.appendChild(el);
        var s = homeSlot(i);
        var b = { el: el, i: i, cx: s.cx, cy: s.cy, vx: 0, vy: 0, ang: 0,
                  restOn: null, settled: true, home: true, held: false,
                  gdx: 0, gdy: 0, _lx: s.cx, _ly: s.cy, _lt: 0 };
        place(b);
        el.style.zIndex = (topZ++);
        el.addEventListener("pointerdown", function (e) { grab(b, e); });
        balls.push(b);
      });
    }

    /* ---- drag: grab from anywhere, throw with the release speed ---- */
    function ptr(e) { return { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top }; }

    function grab(b, e) {
      e.preventDefault();
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      try { b.el.setPointerCapture(e.pointerId); } catch (err) {}
      var p = ptr(e);
      b.held = true; b.settled = false; b.restOn = null; b.home = false;
      b.el.classList.remove("is-homing"); b.el.classList.add("is-held");
      b.gdx = p.x - b.cx; b.gdy = p.y - b.cy;
      b._lx = b.cx; b._ly = b.cy; b._lt = performance.now();
      b.vx = b.vy = 0;
      b.el.style.zIndex = (topZ++);
      held = b; kick();
    }

    function onMove(e) {
      if (!held) return;
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      var p = ptr(e), b = held;
      var ncx = clamp(p.x - b.gdx, R, W - R);
      var ncy = p.y - b.gdy;
      var now = performance.now(), dtf = (now - b._lt) / 16.667 || 1;
      b.vx = 0.5 * b.vx + 0.5 * (ncx - b._lx) / dtf;
      b.vy = 0.5 * b.vy + 0.5 * (ncy - b._ly) / dtf;
      b._lx = ncx; b._ly = ncy; b._lt = now;
      b.cx = ncx; b.cy = ncy; b.ang += (b.vx / R) * 10; place(b);
    }

    function onUp(e) {
      if (!held) return;
      var b = held; held = null;
      try { b.el.releasePointerCapture(e.pointerId); } catch (err) {}
      b.held = false; b.el.classList.remove("is-held");
      b.vx = clamp(b.vx, -THROW_CAP, THROW_CAP);
      b.vy = clamp(b.vy, -THROW_CAP, THROW_CAP);
      b.restOn = null; b.settled = false;
      kick();
    }

    function goHome(b) {
      var s = homeSlot(b.i);
      b.el.classList.add("is-homing");
      b.cx = s.cx; b.cy = s.cy; b.ang = 0; place(b);
      b.vx = b.vy = 0; b.restOn = null;
      var done = function () {
        b.el.removeEventListener("transitionend", done);
        b.el.classList.remove("is-homing");
        b.settled = true; b.home = true;
      };
      b.el.addEventListener("transitionend", done);
      checkNote();
    }
    function returnAll() { balls.forEach(function (b) { if (!b.home) goHome(b); }); }

    /* ---- physics ---- */
    function landFor(b, prevBottom, ncx, ncy) {
      var newBottom = ncy + R, best = null;
      for (var i = 0; i < surfaces.length; i++) {
        var s = surfaces[i];
        if (ncx < s.x0 - R * 0.5 || ncx > s.x1 + R * 0.5) continue;
        if (s.top >= prevBottom - LAND_SLACK && s.top <= newBottom) {
          if (!best || s.top < best.top) best = s;
        }
      }
      return best;
    }

    function bonk(s) {
      if (!s || !s.el) return;
      var now = performance.now();
      if (s._bonk && now - s._bonk < 450) return;
      s._bonk = now;
      s.el.classList.add("ball-bonk");
      setTimeout(function () { s.el.classList.remove("ball-bonk"); }, 360);
    }

    function wake(b) { b.settled = false; b.restOn = null; b.home = false; }

    function pairs() {
      for (var i = 0; i < balls.length; i++) {
        for (var j = i + 1; j < balls.length; j++) {
          var a = balls[i], b = balls[j];
          if (a.settled && b.settled && !a.held && !b.held) continue;
          var dx = b.cx - a.cx, dy = b.cy - a.cy;
          var d = Math.sqrt(dx * dx + dy * dy); if (d < 0.01) { dx = 0.1; dy = 0; d = 0.1; }
          var min = R * 2;
          if (d >= min) continue;
          var nx = dx / d, ny = dy / d, overlap = min - d;
          if (a.held) { b.cx += nx * overlap; b.cy += ny * overlap; }
          else if (b.held) { a.cx -= nx * overlap; a.cy -= ny * overlap; }
          else { a.cx -= nx * overlap / 2; a.cy -= ny * overlap / 2; b.cx += nx * overlap / 2; b.cy += ny * overlap / 2; }
          var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) {
            var imp = -(1 + PAIR_REST) * vn / 2;
            if (!a.held) { a.vx -= imp * nx; a.vy -= imp * ny; wake(a); }
            if (!b.held) { b.vx += imp * nx; b.vy += imp * ny; wake(b); }
          } else {
            if (!a.held && a.settled) wake(a);
            if (!b.held && b.settled) wake(b);
          }
        }
      }
    }

    function moveBall(b, dt) {
      if (b.restOn) {
        b.vx *= Math.pow(ROLL, dt);
        var ncx = clamp(b.cx + b.vx * dt, R, W - R);
        if (ncx <= R || ncx >= W - R) b.vx = -b.vx * WALL;
        if (ncx < b.restOn.x0 || ncx > b.restOn.x1) { b.restOn = null; b.vy = 0.5; }   /* rolled off the edge */
        else {
          b.cx = ncx; b.cy = b.restOn.top - R; b.ang += (b.vx / R) * 10 * dt;
          if (Math.abs(b.vx) < STOP_V) { b.vx = 0; settle(b); }
        }
        return;
      }
      b.vy += G * dt; b.vx *= Math.pow(AIR, dt);
      var prevBottom = b.cy + R;
      var ncx2 = b.cx + b.vx * dt, ncy2 = b.cy + b.vy * dt;
      if (ncx2 < R) { ncx2 = R; b.vx = -b.vx * WALL; }
      else if (ncx2 > W - R) { ncx2 = W - R; b.vx = -b.vx * WALL; }
      var hit = landFor(b, prevBottom, ncx2, ncy2);
      if (hit) {
        ncy2 = hit.top - R;
        if (Math.abs(b.vy) > BONK_V) bonk(hit);
        if (Math.abs(b.vy) > REST_V) { b.vy = -b.vy * REST; b.vx *= 0.85; }
        else { b.vy = 0; b.restOn = hit; }
      }
      b.ang += (b.vx / R) * 10 * dt;
      b.cx = ncx2; b.cy = ncy2;
    }

    function step(dt) {
      var i;
      for (i = 0; i < balls.length; i++) {
        if (balls[i].held || balls[i].settled) continue;
        moveBall(balls[i], dt);
      }
      pairs();
      var moving = false;
      for (i = 0; i < balls.length; i++) {
        place(balls[i]);
        if (balls[i].held || !balls[i].settled) moving = true;
      }
      return moving;
    }

    function settle(b) {
      if (b.settled) return;
      b.settled = true;
      place(b);
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
    function inZone(b, z) {
      if (!z) return false;
      return b.cx >= z.x0 && b.cx <= z.x1 && b.cy >= z.y0 && b.cy <= z.y1;
    }
    function checkNote() {
      var stray = balls.filter(function (b) { return b.settled && !b.home && (inZone(b, footZ) || inZone(b, dessZ)); });
      if (stray.length) {
        var top = stray.reduce(function (a, c) { return c.cy < a.cy ? c : a; });
        var nx = clamp(top.cx - 24, 8, W - 276);
        var ny = Math.max(top.cy - R - note.offsetHeight - 14, 8);
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
        balls.forEach(function (b) {
          b.el.style.setProperty("--d", (R * 2) + "px");
          if (b.home) { var s = homeSlot(b.i); b.cx = s.cx; b.cy = s.cy; place(b); }
          else { b.settled = false; b.restOn = null; if (b.vy === 0) b.vy = 0.5; }
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


  /* 6. EZRA'S EYES — two pupils that follow the cursor while she is on screen,
     and now and then look away and ignore it. Off under reduced motion. The
     eye centres come from the markup as a percent of the image. ------------ */
  function eyes() {
    if (reduce) return;
    var host = document.querySelector("[data-eyes]");
    if (!host) return;
    var pupils = host.querySelectorAll(".dz__eye");
    if (!pupils.length) return;

    Array.prototype.forEach.call(pupils, function (p) {
      p.style.left = (parseFloat(p.getAttribute("data-cx")) || 50) + "%";
      p.style.top = (parseFloat(p.getAttribute("data-cy")) || 50) + "%";
    });

    var inView = true, ignoring = false;
    if ("IntersectionObserver" in window) {
      inView = false;
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.25 }).observe(host);
    }

    function maxOff() { return Math.max(3, (host.clientWidth || 300) * 0.016); }

    function aim(px, py) {                         // each pupil from its own socket
      var r = host.getBoundingClientRect(), max = maxOff();
      Array.prototype.forEach.call(pupils, function (p) {
        var ex = r.left + r.width * (parseFloat(p.getAttribute("data-cx")) / 100);
        var ey = r.top + r.height * (parseFloat(p.getAttribute("data-cy")) / 100);
        var dx = px - ex, dy = py - ey, len = Math.sqrt(dx * dx + dy * dy) || 1;
        p.style.setProperty("--ox", ((dx / len) * max).toFixed(1) + "px");
        p.style.setProperty("--oy", ((dy / len) * max).toFixed(1) + "px");
      });
    }
    function glance(dx, dy) {                       // both pupils the same way
      var max = maxOff(), len = Math.sqrt(dx * dx + dy * dy) || 1;
      Array.prototype.forEach.call(pupils, function (p) {
        p.style.setProperty("--ox", ((dx / len) * max).toFixed(1) + "px");
        p.style.setProperty("--oy", ((dy / len) * max).toFixed(1) + "px");
      });
    }

    window.addEventListener("pointermove", function (e) {
      if (!inView || ignoring) return;
      aim(e.clientX, e.clientY);
    }, { passive: true });

    setInterval(function () {                        // now and then, ignore the cursor
      if (!inView || ignoring) return;
      if (Math.random() < 0.3) {
        ignoring = true;
        var a = Math.random() * Math.PI * 2;
        glance(Math.cos(a), Math.sin(a));
        setTimeout(function () { ignoring = false; }, 800 + Math.random() * 1400);
      }
    }, 3200);
  }


  function boot() { nav(); fit(); cursor(); toys(); disc(); eyes(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
