/* ===========================================================================
   IN-PAGE PINBALL — "The site is the table" (mobile only, Build B)
   A toggle turns the real homepage into a pinball table. The nine tool logos
   drop onto the page and bounce off the ACTUAL elements: case-study cards and
   desserts tiles are bumpers (flash + score), headings and nav are walls, two
   flippers sit at the foot of the screen. Tilt the phone to roll, tap
   bottom-left / bottom-right for the flippers, grab a ball up top to fling it.
   No overlay, no new section — the balls float over the page you were on.
   Desktop is untouched (it keeps redo.js's ball pit); nothing here builds
   unless the pointer is coarse. Self-contained, CSP-safe (no inline script).
   =========================================================================== */
(function () {
  "use strict";
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)");
  if (!coarse || !coarse.matches) return;
  if (!document.querySelector(".stage")) return;

  var TOOLS = ["figma", "cursor", "claude", "make", "n8n", "shopify", "linear", "posthog", "grok"];
  var BUMPERS = ".feat__shot, .feat-sm, .dz";
  var WALLS = ".banner__h1, .stage__lead, .stage__about, .stage__dessert, .idx__head, .feat__name, .feat__go, .fnav__in, .stage__end h2, .stage__mail, .feat-sm__name";

  /* ---- toggle button ----------------------------------------------------- */
  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "playfab";
  fab.setAttribute("aria-label", "Play pinball with the stack");
  fab.innerHTML = '<span class="playfab__dot" aria-hidden="true"></span><span class="playfab__t">Pinball</span>';
  document.body.appendChild(fab);
  requestAnimationFrame(function () { fab.classList.add("is-ready"); });

  function setVis() {
    if (game) return;
    var nearBottom = (window.scrollY + window.innerHeight) > (document.documentElement.scrollHeight - 220);
    fab.classList.toggle("is-hidden", nearBottom);
  }
  window.addEventListener("scroll", setVis, { passive: true });
  window.addEventListener("resize", setVis);
  setVis();

  var game = null;
  fab.addEventListener("click", function () { if (game) game.stop(); else game = new Pinball(); });

  /* ---- the table --------------------------------------------------------- */
  function Pinball() {
    var self = this;

    // Park the page where the cards fill the screen, then freeze it so the
    // element rects stay put for the round.
    var savedY = window.scrollY;
    var feats = document.querySelector(".feats") || document.querySelector(".stage__in");
    if (feats) {
      var top = feats.getBoundingClientRect().top + window.scrollY - 70;
      // The page uses smooth scrolling; force an INSTANT jump so the element
      // rects below are read at the final position, not mid-animation.
      var prevSB = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, Math.max(0, top));
      document.documentElement.style.scrollBehavior = prevSB;
    }
    void document.documentElement.offsetHeight;   // force the scroll to apply before we read rects
    document.documentElement.classList.add("pin-live");
    // freeze scrolling without overflow:hidden (which would reset scrollY)
    function blockScroll(e) { e.preventDefault(); }
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("wheel", blockScroll, { passive: false });

    fab.classList.add("is-live");
    fab.querySelector(".playfab__t").textContent = "Exit";

    var W = window.innerWidth, H = window.innerHeight;
    var R = Math.max(16, Math.min(22, Math.round(W / 19)));
    var G = 2100;
    var grav = { x: 0, y: G };
    var score = 0;

    // colliders from the real page
    var rects = [];
    function addRects(sel, kind) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        if (r.bottom < 40 || r.top > H - 10 || r.right < 0 || r.left > W) return; // off-screen
        rects.push({ x: r.left, y: r.top, w: r.width, h: r.height, kind: kind, el: el, cool: 0 });
      });
    }
    addRects(BUMPERS, "bumper");
    addRects(WALLS, "wall");

    // layer + HUD
    var layer = document.createElement("div");
    layer.className = "pin-layer";
    document.body.appendChild(layer);
    var hud = document.createElement("div");
    hud.className = "pin-hud";
    hud.innerHTML = 'Score<b>0</b><span class="pin-hud__tip">Tilt &middot; tap to flip</span>';
    document.body.appendChild(hud);
    requestAnimationFrame(function () { hud.classList.add("is-on"); });
    var scoreEl = hud.querySelector("b");

    // flippers
    var fy = H - Math.max(78, H * 0.1);
    var flen = Math.min(92, W * 0.30), fthick = 9, gap = Math.min(96, W * 0.26), cx = W / 2;
    var FL = { px: cx - gap / 2 - flen * 0.84, py: fy, rest: 26, up: -26, ang: 26, prev: 26, tgt: 26 };
    var FR = { px: cx + gap / 2 + flen * 0.84, py: fy, rest: 154, up: 206, ang: 154, prev: 154, tgt: 154 };
    var flEl = mkFlip(false), frEl = mkFlip(true);
    function mkFlip(right) {
      var e = document.createElement("div");
      e.className = "pin-flip" + (right ? " pin-flip--r" : "");
      e.style.width = flen + "px"; e.style.height = fthick * 2 + "px";
      layer.appendChild(e); return e;
    }

    // balls
    var balls = TOOLS.map(function (name, i) {
      var e = document.createElement("div");
      e.className = "pin-ball"; e.style.width = e.style.height = R * 2 + "px";
      var img = new Image(); img.src = "/assets/logos/" + name + ".svg"; img.alt = ""; e.appendChild(img);
      layer.appendChild(e);
      return { el: e, r: R, x: W * (0.18 + 0.64 * Math.random()), y: -R * 2 - i * (R * 2.1),
               vx: (Math.random() - 0.5) * 70, vy: 0, held: false };
    });

    // ---- input ----
    var ptr = {};
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    function onDown(ev) {
      if (ev.target.closest && ev.target.closest(".playfab")) return;
      ev.preventDefault();
      var x = ev.clientX, y = ev.clientY;
      if (y > H * 0.58) {
        var side = x < cx ? FL : FR; side.tgt = side.up;
        ptr[ev.pointerId] = { kind: "flip", side: side };
      } else {
        var best = null, bd = (R + 24) * (R + 24);
        for (var i = 0; i < balls.length; i++) { var b = balls[i], dx = b.x - x, dy = b.y - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b; } }
        if (best) { best.held = true; ptr[ev.pointerId] = { kind: "grab", b: best, lx: x, ly: y, vx: 0, vy: 0, t: performance.now() }; }
        else ptr[ev.pointerId] = { kind: "none" };
      }
    }
    function onMove(ev) {
      var p = ptr[ev.pointerId]; if (!p || p.kind !== "grab") return;
      var now = performance.now(), dt = Math.max(1, now - p.t) / 1000;
      p.vx = (ev.clientX - p.lx) / dt; p.vy = (ev.clientY - p.ly) / dt;
      p.b.x = ev.clientX; p.b.y = ev.clientY; p.b.vx = 0; p.b.vy = 0;
      p.lx = ev.clientX; p.ly = ev.clientY; p.t = now;
    }
    function onUp(ev) {
      var p = ptr[ev.pointerId]; if (!p) return;
      if (p.kind === "flip") p.side.tgt = p.side.rest;
      if (p.kind === "grab" && p.b) { p.b.held = false; p.b.vx = clamp(p.vx, 1800); p.b.vy = clamp(p.vy, 1800); }
      delete ptr[ev.pointerId];
    }
    function clamp(v, m) { return Math.max(-m, Math.min(m, v || 0)); }

    // ---- tilt ----
    function onTilt(e) { if (e.gamma == null) return; grav.x = Math.max(-1, Math.min(1, e.gamma / 38)) * G * 0.85; grav.y = G * 0.9; }
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then(function (s) { if (s === "granted") window.addEventListener("deviceorientation", onTilt); }).catch(function () {});
    } else if (DOE) { window.addEventListener("deviceorientation", onTilt); }

    // ---- physics ----
    function flipSeg(F) { var a = F.ang * Math.PI / 180; return { tx: F.px + Math.cos(a) * flen, ty: F.py + Math.sin(a) * flen, om: (F.ang - F.prev) * Math.PI / 180 }; }
    function collideSeg(b, px, py, seg) {
      var dx = seg.tx - px, dy = seg.ty - py, L2 = dx * dx + dy * dy || 1;
      var t = ((b.x - px) * dx + (b.y - py) * dy) / L2; t = Math.max(0, Math.min(1, t));
      var cxp = px + dx * t, cyp = py + dy * t, nx = b.x - cxp, ny = b.y - cyp, d = Math.hypot(nx, ny), mn = b.r + fthick;
      if (d < mn && d > 0.0001) {
        nx /= d; ny /= d; b.x = cxp + nx * mn; b.y = cyp + ny * mn;
        var sv = Math.abs(seg.om) * 60 * flen * t;
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + 0.45) * vn * nx; b.vy -= (1 + 0.45) * vn * ny; }
        if (sv > 40) { b.vx += nx * sv * 0.6; b.vy += ny * sv * 0.6; }
      }
    }
    function collideRect(b, r) {
      var rx2 = r.x + r.w, ry2 = r.y + r.h;
      var cxp = Math.max(r.x, Math.min(b.x, rx2)), cyp = Math.max(r.y, Math.min(b.y, ry2));
      var dx = b.x - cxp, dy = b.y - cyp, d2 = dx * dx + dy * dy;
      var inside = (b.x > r.x && b.x < rx2 && b.y > r.y && b.y < ry2);
      if (!inside && d2 >= b.r * b.r) return;
      var nx, ny;
      if (inside) {
        var dl = b.x - r.x, dr = rx2 - b.x, dt = b.y - r.y, db = ry2 - b.y, m = Math.min(dl, dr, dt, db);
        nx = m === dl ? -1 : m === dr ? 1 : 0; ny = m === dt ? -1 : m === db ? 1 : 0;
        b.x += nx * (b.r + m); b.y += ny * (b.r + m);
      } else { var d = Math.sqrt(d2) || 0.001; nx = dx / d; ny = dy / d; b.x = cxp + nx * b.r; b.y = cyp + ny * b.r; }
      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        var rest = r.kind === "bumper" ? 0.92 : 0.5;
        b.vx -= (1 + rest) * vn * nx; b.vy -= (1 + rest) * vn * ny;
        if (r.kind === "bumper") { b.vx += nx * 115; b.vy += ny * 115; bump(r); }
      }
    }
    function bump(r) {
      if (r.cool > 0) return; r.cool = 0.25; score += 50; scoreEl.textContent = score;
      r.el.classList.remove("pin-hit"); void r.el.offsetWidth; r.el.classList.add("pin-hit");
    }

    var running = true, last = performance.now();
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.032, (now - last) / 1000); last = now;
      var steps = 2, h = dt / steps;
      [FL, FR].forEach(function (F) { F.prev = F.ang; F.ang += (F.tgt - F.ang) * Math.min(1, h * 22 * steps); });
      for (var i = 0; i < rects.length; i++) if (rects[i].cool > 0) rects[i].cool -= dt;
      for (var s = 0; s < steps; s++) {
        var segL = flipSeg(FL), segR = flipSeg(FR);
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i]; if (b.held) continue;
          b.vx += grav.x * h; b.vy += grav.y * h; b.vx *= 0.997; b.vy *= 0.997;
          var sp = Math.hypot(b.vx, b.vy); if (sp > 1500) { b.vx *= 1500 / sp; b.vy *= 1500 / sp; }
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.6; }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * 0.6; }
          if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * 0.5; }
          if (b.y > H - b.r) {
            if (b.x > cx - gap / 2 && b.x < cx + gap / 2) { if (b.y > H + b.r * 2) { b.x = W * (0.25 + 0.5 * Math.random()); b.y = -b.r * 2; b.vx = (Math.random() - 0.5) * 80; b.vy = 0; } }
            else { b.y = H - b.r; b.vy = -b.vy * 0.5; b.vx *= 0.9; }
          }
          for (var k = 0; k < rects.length; k++) collideRect(b, rects[k]);
          collideSeg(b, FL.px, FL.py, segL); collideSeg(b, FR.px, FR.py, segR);
        }
        for (var a = 0; a < balls.length; a++) for (var c = a + 1; c < balls.length; c++) {
          var b1 = balls[a], b2 = balls[c]; if (b1.held && b2.held) continue;
          var dx = b2.x - b1.x, dy = b2.y - b1.y, dist = Math.hypot(dx, dy), mind = b1.r + b2.r;
          if (dist < mind && dist > 0.001) {
            var ux = dx / dist, uy = dy / dist, ov = mind - dist;
            if (!b1.held) { b1.x -= ux * ov / 2; b1.y -= uy * ov / 2; }
            if (!b2.held) { b2.x += ux * ov / 2; b2.y += uy * ov / 2; }
            var vn = (b2.vx - b1.vx) * ux + (b2.vy - b1.vy) * uy;
            if (vn < 0) { var im = -(1 + 0.4) * vn / 2; if (!b1.held) { b1.vx -= im * ux; b1.vy -= im * uy; } if (!b2.held) { b2.vx += im * ux; b2.vy += im * uy; } }
          }
        }
      }
      for (var r = 0; r < balls.length; r++) { var bb = balls[r]; bb.el.style.transform = "translate(" + (bb.x - bb.r) + "px," + (bb.y - bb.r) + "px)"; }
      flEl.style.transform = "translate(" + (FL.px - 12) + "px," + (FL.py - fthick) + "px) rotate(" + FL.ang + "deg)";
      frEl.style.transform = "translate(" + (FR.px - flen + 12) + "px," + (FR.py - fthick) + "px) rotate(" + (FR.ang - 180) + "deg)";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---- stop ----
    this.stop = function () {
      running = false;
      window.removeEventListener("deviceorientation", onTilt);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("touchmove", blockScroll, { passive: false });
      window.removeEventListener("wheel", blockScroll, { passive: false });
      layer.remove(); hud.remove();
      document.documentElement.classList.remove("pin-live");
      window.scrollTo(0, savedY);
      fab.classList.remove("is-live"); fab.querySelector(".playfab__t").textContent = "Pinball";
      game = null;
    };
    window.addEventListener("resize", function onR() {
      if (!running) { window.removeEventListener("resize", onR); return; }
      if (Math.abs(window.innerWidth - W) > 60 || Math.abs(window.innerHeight - H) > 140) { window.removeEventListener("resize", onR); self.stop(); }
    });
  }
})();
