/* ===========================================================================
   "STACK" — in-page pinball (mobile only)
   Start with one tool logo. Flip it UP through your real case-study cards to
   score; hit the metal side bumpers and the jackpot lanes for bonus. Every
   score milestone RELEASES another logo into play, up to all nine = your whole
   stack unlocked, so it gets fast and messy. A ball that drains between the
   flippers is gone; game over when the whole stack has drained. The page dims
   into a game-mode wash with your cards as the targets. Mobile only
   (pointer:coarse); desktop keeps redo.js's ball pit. CSP-safe, no inline.
   =========================================================================== */
(function () {
  "use strict";
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)");
  if (!coarse || !coarse.matches) return;
  if (!document.querySelector(".stage")) return;

  var TOOLS = ["figma", "cursor", "claude", "linear", "make", "n8n", "shopify", "posthog", "grok"];
  var TRIGGERS = ".feat__shot, .dz, .feat-sm";
  var UNLOCKS = [500, 1200, 2200, 3600, 5500, 8000, 11000, 15000];   // score -> release next logo (balls 2..9)
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function ballSvg(name) { return '<span class="pin-chip"><img src="/assets/logos/' + name + '.svg" alt=""></span>'; }

  var fab = document.createElement("button");
  fab.type = "button"; fab.className = "playfab";
  fab.setAttribute("aria-label", "Play Stack");
  fab.innerHTML = ballSvg("figma") + ballSvg("cursor") + '<span class="playfab__t">Stack</span>';
  document.body.appendChild(fab);
  requestAnimationFrame(function () { fab.classList.add("is-ready"); });
  function setVis() { if (game) return; var nb = (window.scrollY + window.innerHeight) > (document.documentElement.scrollHeight - 220); fab.classList.toggle("is-hidden", nb); }
  window.addEventListener("scroll", setVis, { passive: true });
  window.addEventListener("resize", setVis); setVis();
  var game = null;
  fab.addEventListener("click", function () { if (game) game.stop(); else game = new Stack(); });

  function Stack() {
    var self = this;

    // ---- park at the work section and freeze ---------------------------------
    var savedY = window.scrollY;
    var feats = document.querySelector(".feats") || document.querySelector(".stage__in");
    if (feats) {
      var ftop = feats.getBoundingClientRect().top + window.scrollY - 70;
      var prevSB = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, Math.max(0, ftop));
      document.documentElement.style.scrollBehavior = prevSB;
    }
    void document.documentElement.offsetHeight;
    document.documentElement.classList.add("pin-live");
    function blockScroll(e) { e.preventDefault(); }
    function blockClick(e) { if (e.target.closest && (e.target.closest(".playfab") || e.target.closest(".pin-over"))) return; e.preventDefault(); e.stopPropagation(); }
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("wheel", blockScroll, { passive: false });
    document.addEventListener("click", blockClick, true);
    fab.classList.add("is-live"); fab.querySelector(".playfab__t").textContent = "Exit";

    var W = window.innerWidth, H = window.innerHeight;
    var R = Math.max(15, Math.min(20, Math.round(W / 21)));
    var G = 1250, grav = { x: 0, y: G };

    var dim = document.createElement("div"); dim.className = "pin-dim"; document.body.appendChild(dim);
    var layer = document.createElement("div"); layer.className = "pin-layer"; document.body.appendChild(layer);
    requestAnimationFrame(function () { dim.classList.add("is-on"); });

    // card colliders
    var tris = [];
    document.querySelectorAll(TRIGGERS).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 40 || r.top > H - 10) return;
      tris.push({ x: r.left, y: r.top, w: r.width, h: r.height, el: el });
    });

    // ---- geometry: one straight metal line each side, rail continuing into the
    //      flipper, with a real drain gap between the two flipper tips ----------
    var cx = W / 2, theta = 30 * Math.PI / 180, ct = Math.cos(theta), st = Math.sin(theta);
    var gapHalf = Math.max(26, R * 1.55);           // half the drain gap (ball can fall through)
    var flen = Math.min(100, W * 0.33), fthick = 8;
    var tipY = H - 60;
    var FL = { px: (cx - gapHalf) - flen * ct, py: tipY - flen * st, rest: 30, up: -15, ang: 30, prev: 30, tgt: 30 };
    var FR = { px: (cx + gapHalf) + flen * ct, py: tipY - flen * st, rest: 150, up: 195, ang: 150, prev: 150, tgt: 150 };
    var railL = (FL.px - 5) / ct, railR = (W - 5 - FR.px) / ct;
    var walls = [
      { x1: FL.px - railL * ct, y1: FL.py - railL * st, x2: FL.px, y2: FL.py },
      { x1: FR.px + railR * ct, y1: FR.py - railR * st, x2: FR.px, y2: FR.py }
    ];
    var bumpR = Math.max(26, W * 0.078);
    var bumpers = [{ x: W * 0.22, y: H * 0.44, r: bumpR }, { x: W * 0.78, y: H * 0.44, r: bumpR }];
    var laneW = Math.max(40, W * 0.12), laneH = 28, laneY = Math.min(H * 0.6, walls[0].y1 + 8);
    var lanes = [{ x: W * 0.17, y: laneY, w: laneW, h: laneH, cool: 0 }, { x: W * 0.83 - laneW, y: laneY, w: laneW, h: laneH, cool: 0 }];

    // metal funnel (SVG)
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "pin-chrome"); svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = '<defs><linearGradient id="pinSteel" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#eef0f4"/><stop offset="0.42" stop-color="#b4b9c4"/>' +
      '<stop offset="0.56" stop-color="#7f8591"/><stop offset="1" stop-color="#c2c6ce"/></linearGradient></defs>' +
      walls.map(function (w) {
        return '<line x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="url(#pinSteel)" stroke-width="16" stroke-linecap="round"/>' +
          '<line x1="' + w.x1 + '" y1="' + (w.y1 - 5) + '" x2="' + w.x2 + '" y2="' + (w.y2 - 5) + '" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/>';
      }).join("");
    layer.appendChild(svg);

    function mkFlip(r) { var e = document.createElement("div"); e.className = "pin-flip" + (r ? " pin-flip--r" : ""); e.style.width = flen + "px"; e.style.height = fthick * 2 + "px"; layer.appendChild(e); return e; }
    var flEl = mkFlip(false), frEl = mkFlip(true);
    bumpers.forEach(function (b) { var e = document.createElement("div"); e.className = "pin-bumper"; e.style.width = e.style.height = b.r * 2 + "px"; e.style.transform = "translate(" + (b.x - b.r) + "px," + (b.y - b.r) + "px)"; layer.appendChild(e); b.el = e; });
    lanes.forEach(function (l) { var e = document.createElement("div"); e.className = "pin-lane"; e.style.width = l.w + "px"; e.style.height = l.h + "px"; e.style.transform = "translate(" + l.x + "px," + l.y + "px)"; e.textContent = "300"; layer.appendChild(e); l.el = e; });

    // HUD: score + the stack (9 pips light as logos come into play)
    var hud = document.createElement("div"); hud.className = "pin-hud";
    var pips = ""; for (var i = 0; i < 9; i++) pips += '<i></i>';
    hud.innerHTML = '<div><div class="pin-hud__k">Score</div><div class="pin-hud__v" data-score>0</div></div>' +
      '<div><div class="pin-hud__k">Stack</div><div class="pin-hud__balls" data-pips>' + pips + '</div></div>';
    document.body.appendChild(hud); requestAnimationFrame(function () { hud.classList.add("is-on"); });
    var scoreEl = hud.querySelector("[data-score]"), pipEls = hud.querySelectorAll("[data-pips] i");

    // ---- game state ---------------------------------------------------------
    var balls = [], score = 0, served = 0, nextUnlock = 0, running = true, over = false, cardsEver = {};
    function renderPips() { for (var i = 0; i < 9; i++) pipEls[i].className = ""; balls.forEach(function (b) { pipEls[b.pip].className = "lit"; }); }
    function pop(x, y, text, big) { var e = document.createElement("div"); e.className = "pin-pop" + (big ? " pin-pop--big" : ""); e.style.left = x + "px"; e.style.top = y + "px"; e.textContent = text; layer.appendChild(e); setTimeout(function () { e.remove(); }, 740); }
    function addScore(n, x, y, text, big) {
      score += n; scoreEl.textContent = score; if (text) pop(x, y, text, big);
      while (nextUnlock < UNLOCKS.length && score >= UNLOCKS[nextUnlock]) { nextUnlock++; serve(true); }
    }
    function serve(unlock) {
      if (served >= 9) return;
      var name = TOOLS[served];
      var e = document.createElement("div"); e.className = "pin-ball"; e.style.width = e.style.height = R * 2 + "px";
      var img = new Image(); img.src = "/assets/logos/" + name + ".svg"; img.alt = ""; e.appendChild(img);
      layer.appendChild(e);
      balls.push({ el: e, r: R, pip: served, x: cx + (Math.random() - 0.5) * 50, y: -R * 2, vx: (Math.random() - 0.5) * 40, vy: 0, still: 0, lit: {}, litN: 0, stack: false });
      served++; renderPips();
      if (unlock) { pop(cx, H * 0.3, "+1 " + name, true); buzz([12, 30]); }
    }
    function drain(b) {
      var i = balls.indexOf(b); if (i < 0) return;
      balls.splice(i, 1); b.el.remove(); renderPips(); buzz(35);
      if (balls.length === 0 && !over) gameOver();
    }
    serve(false);   // the first logo

    // ---- input: tap a side for that flipper ---------------------------------
    var ptr = {};
    function onDown(ev) { if (ev.target.closest && (ev.target.closest(".playfab") || ev.target.closest(".pin-over"))) return; ev.preventDefault(); var s = ev.clientX < cx ? FL : FR; s.tgt = s.up; ptr[ev.pointerId] = s; }
    function onUp(ev) { var s = ptr[ev.pointerId]; if (s) { s.tgt = s.rest; delete ptr[ev.pointerId]; } }
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    function onTilt(e) { if (e.gamma == null) return; grav.x = Math.max(-1, Math.min(1, e.gamma / 36)) * G * 0.9; grav.y = G * 0.88; }
    var DOE = window.DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === "function") { DOE.requestPermission().then(function (s) { if (s === "granted") window.addEventListener("deviceorientation", onTilt); }).catch(function () {}); }
    else if (DOE) { window.addEventListener("deviceorientation", onTilt); }

    // ---- collisions ---------------------------------------------------------
    function segHit(b, px, py, tx, ty, om, bounce) {
      var dx = tx - px, dy = ty - py, L2 = dx * dx + dy * dy || 1, t = ((b.x - px) * dx + (b.y - py) * dy) / L2; t = Math.max(0, Math.min(1, t));
      var cxp = px + dx * t, cyp = py + dy * t, nx = b.x - cxp, ny = b.y - cyp, d = Math.hypot(nx, ny), mn = b.r + fthick;
      if (d < mn && d > 0.0001) {
        nx /= d; ny /= d; b.x = cxp + nx * mn; b.y = cyp + ny * mn;
        var vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= (1 + bounce) * vn * nx; b.vy -= (1 + bounce) * vn * ny; }
        if (om) { var sv = Math.abs(om) * 60 * flen * (t * 0.7 + 0.3); if (sv > 40) { b.vx += nx * sv * 0.62; b.vy += ny * sv * 0.62; } }
      }
    }
    function overlapRect(b, r) { var cxp = Math.max(r.x, Math.min(b.x, r.x + r.w)), cyp = Math.max(r.y, Math.min(b.y, r.y + r.h)), dx = b.x - cxp, dy = b.y - cyp; return (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) || (dx * dx + dy * dy < b.r * b.r); }
    function flash(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); if (ms) setTimeout(function () { el.classList.remove(cls); }, ms); }

    var last = performance.now();
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.032, (now - last) / 1000); last = now;
      var steps = 2, h = dt / steps;
      [FL, FR].forEach(function (F) { F.prev = F.ang; F.ang += (F.tgt - F.ang) * Math.min(1, h * 24 * steps); });
      for (var j = 0; j < lanes.length; j++) if (lanes[j].cool > 0) lanes[j].cool -= dt;
      var aL = FL.ang * Math.PI / 180, aR = FR.ang * Math.PI / 180;
      var FLt = { x: FL.px + Math.cos(aL) * flen, y: FL.py + Math.sin(aL) * flen }, FRt = { x: FR.px + Math.cos(aR) * flen, y: FR.py + Math.sin(aR) * flen };
      var omL = (FL.ang - FL.prev) * Math.PI / 180, omR = (FR.ang - FR.prev) * Math.PI / 180;

      for (var s = 0; s < steps; s++) {
        for (var bi = 0; bi < balls.length; bi++) {
          var b = balls[bi];
          b.vx += grav.x * h; b.vy += grav.y * h; b.vx *= 0.998; b.vy *= 0.998;
          var sp = Math.hypot(b.vx, b.vy); if (sp > 1650) { b.vx *= 1650 / sp; b.vy *= 1650 / sp; }
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.62; }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * 0.62; }
          for (var w = 0; w < walls.length; w++) segHit(b, walls[w].x1, walls[w].y1, walls[w].x2, walls[w].y2, 0, 0.45);
          segHit(b, FL.px, FL.py, FLt.x, FLt.y, omL, 0.4);
          segHit(b, FR.px, FR.py, FRt.x, FRt.y, omR, 0.4);
          for (var k = 0; k < bumpers.length; k++) {
            var bm = bumpers[k], ddx = b.x - bm.x, ddy = b.y - bm.y, dd = Math.hypot(ddx, ddy), mn2 = b.r + bm.r;
            if (dd < mn2 && dd > 0.001) {
              var nx = ddx / dd, ny = ddy / dd; b.x = bm.x + nx * mn2; b.y = bm.y + ny * mn2;
              var vn2 = b.vx * nx + b.vy * ny; if (vn2 < 0) { b.vx -= 1.9 * vn2 * nx; b.vy -= 1.9 * vn2 * ny; }
              b.vx += nx * 175; b.vy += ny * 175; flash(bm.el, "is-hit", 140); addScore(150, bm.x, bm.y - bm.r, "+150"); buzz(16);
            }
          }
        }
        // ball-ball (the stack gets messy)
        for (var a = 0; a < balls.length; a++) for (var c = a + 1; c < balls.length; c++) {
          var b1 = balls[a], b2 = balls[c], dx = b2.x - b1.x, dy = b2.y - b1.y, dist = Math.hypot(dx, dy), md = b1.r + b2.r;
          if (dist < md && dist > 0.001) {
            var ux = dx / dist, uy = dy / dist, ov = (md - dist) / 2;
            b1.x -= ux * ov; b1.y -= uy * ov; b2.x += ux * ov; b2.y += uy * ov;
            var vn = (b2.vx - b1.vx) * ux + (b2.vy - b1.vy) * uy;
            if (vn < 0) { var im = -(1 + 0.4) * vn / 2; b1.vx -= im * ux; b1.vy -= im * uy; b2.vx += im * ux; b2.vy += im * uy; }
          }
        }
      }

      // per-ball events (lanes, cards, drain) after the physics substeps
      for (var bi2 = balls.length - 1; bi2 >= 0; bi2--) {
        var b = balls[bi2];
        for (var l = 0; l < lanes.length; l++) { var la = lanes[l]; if (la.cool <= 0 && overlapRect(b, la)) { la.cool = 0.5; flash(la.el, "is-hit", 220); addScore(300, la.x + la.w / 2, la.y, "+300"); buzz(20); } }
        for (var cI = 0; cI < tris.length; cI++) {
          var tr = tris[cI];
          if (overlapRect(b, tr) && !b.lit[cI]) {
            b.lit[cI] = 1; b.litN++; cardsEver[cI] = 1; flash(tr.el, "pin-hit", 0);
            addScore(50, b.x, Math.max(30, tr.y + 14), "+50"); buzz(9);
            if (!b.stack && tris.length >= 2 && b.litN >= tris.length) { b.stack = true; addScore(500, cx, H * 0.4, "STACK LIT +500", true); buzz([18, 36, 18]); }
          }
        }
        if (b.y > tipY + R * 1.4) drain(b);
        else { var spd = Math.hypot(b.vx, b.vy); if (spd < 14) { b.still++; if (b.still > 80) { b.vx += (Math.random() - 0.5) * 200; b.vy -= 120; b.still = 0; } } else b.still = 0; }
      }

      for (var r = 0; r < balls.length; r++) { var bb = balls[r]; bb.el.style.transform = "translate(" + (bb.x - bb.r) + "px," + (bb.y - bb.r) + "px)"; }
      flEl.style.transform = "translate(" + (FL.px - 13) + "px," + (FL.py - fthick) + "px) rotate(" + FL.ang + "deg)";
      frEl.style.transform = "translate(" + (FR.px - flen + 13) + "px," + (FR.py - fthick) + "px) rotate(" + (FR.ang - 180) + "deg)";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---- game over ----------------------------------------------------------
    function gameOver() {
      over = true; balls.forEach(function (b) { b.el.remove(); }); balls = [];
      var lit = Object.keys(cardsEver).length;
      var ov = document.createElement("div"); ov.className = "pin-over";
      ov.innerHTML = '<div class="pin-over__card"><div class="pin-over__k">The stack drained</div>' +
        '<div class="pin-over__score">' + score + '</div>' +
        '<div class="pin-over__sub">' + served + '/9 unlocked &middot; ' + lit + ' card' + (lit === 1 ? "" : "s") + ' lit</div>' +
        '<div class="pin-over__btns"><button class="pin-over__btn pin-over__btn--go" type="button" data-again>Play again</button>' +
        '<button class="pin-over__btn pin-over__btn--exit" type="button" data-exit>Exit</button></div></div>';
      document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("is-on"); });
      ov.querySelector("[data-again]").addEventListener("click", function () { ov.remove(); score = 0; served = 0; nextUnlock = 0; over = false; cardsEver = {}; scoreEl.textContent = 0; renderPips(); serve(false); });
      ov.querySelector("[data-exit]").addEventListener("click", function () { ov.remove(); self.stop(); });
    }

    // ---- stop ---------------------------------------------------------------
    this.stop = function () {
      running = false;
      window.removeEventListener("deviceorientation", onTilt);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("touchmove", blockScroll, { passive: false });
      window.removeEventListener("wheel", blockScroll, { passive: false });
      document.removeEventListener("click", blockClick, true);
      var ov = document.querySelector(".pin-over"); if (ov) ov.remove();
      dim.classList.remove("is-on"); setTimeout(function () { dim.remove(); }, 400);
      layer.remove(); hud.remove();
      document.documentElement.classList.remove("pin-live");
      window.scrollTo(0, savedY);
      fab.classList.remove("is-live"); fab.querySelector(".playfab__t").textContent = "Stack";
      game = null;
    };
    window.addEventListener("resize", function onR() {
      if (!running) { window.removeEventListener("resize", onR); return; }
      if (Math.abs(window.innerWidth - W) > 60 || Math.abs(window.innerHeight - H) > 140) { window.removeEventListener("resize", onR); self.stop(); }
    });
  }
})();
