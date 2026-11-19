/* ===========================================================================
   MOBILE GAME MODE — "The Stack" (pinball with the tool logos)
   Desktop has the draggable ball pit (redo.js, pointer:fine). The phone had
   nothing, so this is its toy: tilt the phone to roll the nine logos, tap the
   bottom-left / bottom-right to work the flippers, grab a ball in the upper
   half to fling it, hit the bumpers to score. Everything is built lazily and
   only on a coarse pointer, so a desktop visit loads none of it.
   Self-contained; no inline script (CSP-safe); no other file depends on it.
   =========================================================================== */
(function () {
  "use strict";
  var coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)") : null;
  if (!coarse || !coarse.matches) return;            // phones/tablets only
  if (!document.querySelector(".stage")) return;      // homepage only

  var TOOLS = ["figma", "cursor", "claude", "make", "n8n", "shopify", "linear", "posthog", "grok"];

  /* ---- the invite button ------------------------------------------------- */
  var fab = document.createElement("button");
  fab.type = "button";
  fab.className = "playfab";
  fab.setAttribute("aria-label", "Play with the stack");
  fab.innerHTML = '<span class="playfab__dot" aria-hidden="true"></span>Play the stack';
  document.body.appendChild(fab);
  requestAnimationFrame(function () { fab.classList.add("is-ready"); });
  fab.addEventListener("click", openGame);

  // hide the fab once the DESSERTS reveal is in view
  var endmark = document.querySelector(".endmark");
  if (endmark && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      fab.classList.toggle("is-hidden", es[0].isIntersecting);
    }, { rootMargin: "-40% 0px 0px 0px" }).observe(endmark);
  }

  var game = null;

  function openGame() {
    if (game) return;
    game = new Table();
  }

  /* ---- the table --------------------------------------------------------- */
  function Table() {
    var self = this;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var root = document.createElement("div");
    root.className = "pin";
    root.innerHTML =
      '<div class="pin__felt"></div>' +
      '<div class="pin__bar">' +
        '<span class="pin__score">Score<b>0</b></span>' +
        '<span class="pin__hint">Tilt &middot; tap to flip</span>' +
        '<button class="pin__close" type="button" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="pin__drain"></div>';
    document.body.appendChild(root);
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { root.classList.add("is-on"); });

    var scoreEl = root.querySelector(".pin__score b");
    var W = window.innerWidth, H = window.innerHeight;

    // geometry
    var R = Math.max(17, Math.min(24, Math.round(W / 17)));   // ball radius
    var G = 2300;                                             // gravity px/s^2
    var grav = { x: 0, y: G };
    var score = 0;

    // flippers
    var fy = H - Math.max(84, H * 0.11);
    var flen = Math.min(92, W * 0.30);
    var fthick = 9;
    var gap = Math.min(96, W * 0.26);
    var cx = W / 2;
    var FL = { pivot: { x: cx - gap / 2 - flen * 0.86, y: fy }, len: flen, rest: 28, up: -26, ang: 28, prev: 28, dir: 1 };
    var FR = { pivot: { x: cx + gap / 2 + flen * 0.86, y: fy }, len: flen, rest: 152, up: 206, ang: 152, prev: 152, dir: -1 };
    // (angles in degrees, measured from +x axis; left sweeps up toward 0, right toward 180)

    var flEl = mkFlip(false), frEl = mkFlip(true);
    function mkFlip(right) {
      var e = document.createElement("div");
      e.className = "pin__flip" + (right ? " pin__flip--r" : "");
      e.style.width = flen + "px";
      e.style.height = fthick * 2 + "px";
      root.appendChild(e);
      return e;
    }

    // bumpers
    var bumpers = [
      { x: cx, y: H * 0.34, r: Math.max(26, W * 0.085) },
      { x: W * 0.26, y: H * 0.50, r: Math.max(22, W * 0.07) },
      { x: W * 0.74, y: H * 0.50, r: Math.max(22, W * 0.07) }
    ].map(function (b) {
      var e = document.createElement("div");
      e.className = "pin__bumper";
      e.style.width = e.style.height = b.r * 2 + "px";
      e.style.transform = "translate(" + (b.x - b.r) + "px," + (b.y - b.r) + "px)";
      root.appendChild(e);
      b.el = e; b.flash = 0;
      return b;
    });

    // balls
    var balls = TOOLS.map(function (name, i) {
      var e = document.createElement("div");
      e.className = "ball";
      e.style.width = e.style.height = R * 2 + "px";
      var img = new Image(); img.src = "/assets/logos/" + name + ".svg"; img.alt = ""; e.appendChild(img);
      root.appendChild(e);
      return {
        el: e, r: R,
        x: W * (0.2 + 0.6 * Math.random()),
        y: -R * 2 - i * (R * 2.2),           // dropped in, staggered
        vx: (Math.random() - 0.5) * 60, vy: 0, held: false
      };
    });

    // ---- input -----------------------------------------------------------
    var pointers = {};   // id -> {kind:'flip'|'grab', side, ball, lx, ly, vx, vy, t}
    function localXY(ev) {
      return { x: ev.clientX, y: ev.clientY };
    }
    root.addEventListener("pointerdown", function (ev) {
      if (ev.target.closest(".pin__close")) return;
      ev.preventDefault();
      var p = localXY(ev);
      if (p.y > H * 0.60) {
        // flipper zone (lower sixth-ish)
        var side = p.x < cx ? "L" : "R";
        pointers[ev.pointerId] = { kind: "flip", side: side };
        (side === "L" ? FL : FR).target = (side === "L" ? FL : FR).up;
      } else {
        // try to grab a ball
        var best = null, bd = (R + 26) * (R + 26);
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i], dx = b.x - p.x, dy = b.y - p.y, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = b; }
        }
        if (best) {
          best.held = true;
          pointers[ev.pointerId] = { kind: "grab", ball: best, lx: p.x, ly: p.y, vx: 0, vy: 0, t: performance.now() };
        } else {
          pointers[ev.pointerId] = { kind: "none" };
        }
      }
      try { root.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    root.addEventListener("pointermove", function (ev) {
      var pt = pointers[ev.pointerId]; if (!pt || pt.kind !== "grab") return;
      var p = localXY(ev), now = performance.now(), dt = Math.max(1, now - pt.t) / 1000;
      pt.vx = (p.x - pt.lx) / dt; pt.vy = (p.y - pt.ly) / dt;
      pt.ball.x = p.x; pt.ball.y = p.y; pt.ball.vx = 0; pt.ball.vy = 0;
      pt.lx = p.x; pt.ly = p.y; pt.t = now;
    });
    function release(ev) {
      var pt = pointers[ev.pointerId]; if (!pt) return;
      if (pt.kind === "flip") (pt.side === "L" ? FL : FR).target = (pt.side === "L" ? FL : FR).rest;
      if (pt.kind === "grab" && pt.ball) {
        pt.ball.held = false;
        pt.ball.vx = Math.max(-1800, Math.min(1800, pt.vx || 0));
        pt.ball.vy = Math.max(-1800, Math.min(1800, pt.vy || 0));
      }
      delete pointers[ev.pointerId];
    }
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);

    // ---- tilt ------------------------------------------------------------
    function onTilt(e) {
      var g = e.gamma;                 // left/right [-90,90]
      if (g == null) return;
      grav.x = Math.max(-1, Math.min(1, g / 40)) * G * 0.85;
      grav.y = G * 0.92;
    }
    function enableTilt() {
      var DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        DOE.requestPermission().then(function (s) {
          if (s === "granted") window.addEventListener("deviceorientation", onTilt);
        }).catch(function () {});
      } else if (DOE) {
        window.addEventListener("deviceorientation", onTilt);
      }
    }
    enableTilt();   // the opening tap is the user gesture iOS needs

    // ---- close -----------------------------------------------------------
    function close() {
      running = false;
      window.removeEventListener("deviceorientation", onTilt);
      root.classList.remove("is-on");
      document.documentElement.style.overflow = "";
      setTimeout(function () { root.remove(); }, 300);
      game = null;
    }
    root.querySelector(".pin__close").addEventListener("click", close);

    // ---- physics ---------------------------------------------------------
    function flipSegment(F) {
      var a = F.ang * Math.PI / 180;
      return { x: F.pivot.x + Math.cos(a) * F.len, y: F.pivot.y + Math.sin(a) * F.len, omega: (F.ang - F.prev) * Math.PI / 180 };
    }
    function collideSeg(b, P, Tp, fr, omega) {
      var dx = Tp.x - P.x, dy = Tp.y - P.y, L2 = dx * dx + dy * dy || 1;
      var t = ((b.x - P.x) * dx + (b.y - P.y) * dy) / L2; t = Math.max(0, Math.min(1, t));
      var cxp = P.x + dx * t, cyp = P.y + dy * t;
      var nx = b.x - cxp, ny = b.y - cyp, d = Math.hypot(nx, ny);
      var min = b.r + fr;
      if (d < min && d > 0.0001) {
        nx /= d; ny /= d;
        b.x = cxp + nx * min; b.y = cyp + ny * min;
        // flipper surface velocity at contact: omega x r
        var rx = cxp - P.x, ry = cyp - P.y;
        var svx = -omega * ry, svy = omega * rx;   // per frame -> approx
        var relvn = (b.vx - svx * 60) * nx + (b.vy - svy * 60) * ny;
        if (relvn < 0) {
          var j = -(1 + 0.4) * relvn;
          b.vx += j * nx; b.vy += j * ny;
        }
        // kick from an upswinging flipper
        var kick = Math.abs(omega) * 60 * 10;
        if (kick > 40) { b.vx += nx * kick * 0.5; b.vy += ny * kick * 0.5; }
      }
    }

    var running = true, last = performance.now();
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.032, (now - last) / 1000); last = now;
      var steps = 2, h = dt / steps;

      // flippers ease to target
      [FL, FR].forEach(function (F) {
        F.prev = F.ang;
        var tgt = F.target != null ? F.target : F.rest;
        F.ang += (tgt - F.ang) * Math.min(1, h * 22 * steps);
      });

      for (var s = 0; s < steps; s++) {
        var segL = flipSegment(FL), segR = flipSegment(FR);
        for (var i = 0; i < balls.length; i++) {
          var b = balls[i];
          if (b.held) continue;
          b.vx += grav.x * h; b.vy += grav.y * h;
          b.vx *= 0.999; b.vy *= 0.999;
          b.x += b.vx * h; b.y += b.vy * h;

          // walls
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.62; }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * 0.62; }
          if (b.y < b.r) { b.y = b.r; b.vy = -b.vy * 0.5; }
          // bottom: drain gap in the centre, walls either side
          if (b.y > H - b.r) {
            if (b.x > cx - gap / 2 && b.x < cx + gap / 2) {
              if (b.y > H + b.r * 2) { // drained -> re-drop
                b.x = W * (0.25 + 0.5 * Math.random()); b.y = -b.r * 2;
                b.vx = (Math.random() - 0.5) * 80; b.vy = 0;
              }
            } else { b.y = H - b.r; b.vy = -b.vy * 0.55; b.vx *= 0.9; }
          }

          // bumpers
          for (var k = 0; k < bumpers.length; k++) {
            var bm = bumpers[k], ddx = b.x - bm.x, ddy = b.y - bm.y, dd = Math.hypot(ddx, ddy), mn = b.r + bm.r;
            if (dd < mn && dd > 0.001) {
              var n2x = ddx / dd, n2y = ddy / dd;
              b.x = bm.x + n2x * mn; b.y = bm.y + n2y * mn;
              var vn = b.vx * n2x + b.vy * n2y;
              if (vn < 0) { b.vx -= (1 + 0.9) * vn * n2x; b.vy -= (1 + 0.9) * vn * n2y; }
              b.vx += n2x * 240; b.vy += n2y * 240;   // bumper kick
              bm.flash = 1; addScore(50);
            }
          }

          // flippers
          collideSeg(b, FL.pivot, segL, fthick, segL.omega);
          collideSeg(b, FR.pivot, segR, fthick, segR.omega);
        }

        // ball-ball
        for (var a = 0; a < balls.length; a++) {
          for (var c = a + 1; c < balls.length; c++) {
            var b1 = balls[a], b2 = balls[c];
            if (b1.held && b2.held) continue;
            var dx2 = b2.x - b1.x, dy2 = b2.y - b1.y, dist = Math.hypot(dx2, dy2), mind = b1.r + b2.r;
            if (dist < mind && dist > 0.001) {
              var ux = dx2 / dist, uy = dy2 / dist, overlap = (mind - dist);
              if (!b1.held) { b1.x -= ux * overlap / 2; b1.y -= uy * overlap / 2; }
              if (!b2.held) { b2.x += ux * overlap / 2; b2.y += uy * overlap / 2; }
              var rvx = b2.vx - b1.vx, rvy = b2.vy - b1.vy, vn2 = rvx * ux + rvy * uy;
              if (vn2 < 0) {
                var imp = -(1 + 0.45) * vn2 / 2;
                if (!b1.held) { b1.vx -= imp * ux; b1.vy -= imp * uy; }
                if (!b2.held) { b2.vx += imp * ux; b2.vy += imp * uy; }
              }
            }
          }
        }
      }

      // render
      for (var r = 0; r < balls.length; r++) {
        var bb = balls[r];
        bb.el.style.transform = "translate(" + (bb.x - bb.r) + "px," + (bb.y - bb.r) + "px)";
      }
      flEl.style.transform = "translate(" + (FL.pivot.x - 12) + "px," + (FL.pivot.y - fthick) + "px) rotate(" + FL.ang + "deg)";
      frEl.style.transform = "translate(" + (FR.pivot.x - flen + 12) + "px," + (FR.pivot.y - fthick) + "px) rotate(" + (FR.ang - 180) + "deg)";
      for (var m = 0; m < bumpers.length; m++) {
        if (bumpers[m].flash > 0) { bumpers[m].flash -= dt * 4; bumpers[m].el.classList.add("is-hit"); }
        else bumpers[m].el.classList.remove("is-hit");
      }
      requestAnimationFrame(frame);
    }
    function addScore(n) { score += n; scoreEl.textContent = score; }
    requestAnimationFrame(frame);

    // keep geometry sane on rotate/resize: simplest is to close
    window.addEventListener("resize", function onR() {
      if (Math.abs(window.innerWidth - W) > 60 || Math.abs(window.innerHeight - H) > 120) {
        window.removeEventListener("resize", onR); close();
      }
    });
  }
})();
