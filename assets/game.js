/* ===========================================================================
   "THE STACK" — in-page pinball (mobile only)
   One ball (a tool logo) at a time, five balls total. Flip it UP through your
   real case-study cards to score; hit the metal side bumpers and the jackpot
   lanes for bonus; don't let it drain past the flippers. The page dims into a
   game-mode wash; your cards stay visible as the targets. Everything is built
   lazily and only on a coarse pointer, so a desktop visit loads none of it.
   Self-contained, CSP-safe (no inline script).
   =========================================================================== */
(function () {
  "use strict";
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)");
  if (!coarse || !coarse.matches) return;
  if (!document.querySelector(".stage")) return;

  var TOOLS = ["figma", "cursor", "claude", "make", "n8n", "shopify", "linear", "posthog", "grok"];
  var TRIGGERS = ".feat__shot, .dz, .feat-sm";      // real cards: score, don't block
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  var fab = document.createElement("button");
  fab.type = "button"; fab.className = "playfab";
  fab.setAttribute("aria-label", "Play pinball");
  fab.innerHTML = '<span class="playfab__dot" aria-hidden="true"></span><span class="playfab__t">Pinball</span>';
  document.body.appendChild(fab);
  requestAnimationFrame(function () { fab.classList.add("is-ready"); });
  function setVis() { if (game) return; var nb = (window.scrollY + window.innerHeight) > (document.documentElement.scrollHeight - 220); fab.classList.toggle("is-hidden", nb); }
  window.addEventListener("scroll", setVis, { passive: true });
  window.addEventListener("resize", setVis); setVis();
  var game = null;
  fab.addEventListener("click", function () { if (game) game.stop(); else game = new Pinball(); });

  function Pinball() {
    var self = this;

    // ---- park the page at the work section and freeze it --------------------
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
    var G = 1250;
    var grav = { x: 0, y: G };

    // ---- backdrop + layers --------------------------------------------------
    var dim = document.createElement("div"); dim.className = "pin-dim"; document.body.appendChild(dim);
    var layer = document.createElement("div"); layer.className = "pin-layer"; document.body.appendChild(layer);
    requestAnimationFrame(function () { dim.classList.add("is-on"); });

    // card colliders (triggers)
    var tris = [];
    document.querySelectorAll(TRIGGERS).forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 40 || r.top > H - 10) return;
      tris.push({ x: r.left, y: r.top, w: r.width, h: r.height, el: el, cool: 0 });
    });

    // ---- geometry: flippers, funnel, bumpers, lanes -------------------------
    var cx = W / 2;
    var flen = Math.min(96, W * 0.30), fthick = 8;
    var fy = H - 108;
    var Lx = cx - 92, Rx = cx + 92;
    var FL = { px: Lx, py: fy, rest: 24, up: -24, ang: 24, prev: 24, tgt: 24 };
    var FR = { px: Rx, py: fy, rest: 156, up: 204, ang: 156, prev: 156, tgt: 156 };
    var walls = [
      { x1: 4, y1: fy - 96, x2: Lx - 6, y2: fy + 4 },     // left funnel rail
      { x1: W - 4, y1: fy - 96, x2: Rx + 6, y2: fy + 4 }  // right funnel rail
    ];
    var bumpR = Math.max(26, W * 0.078);
    var bumpers = [
      { x: W * 0.19, y: H * 0.45, r: bumpR },
      { x: W * 0.81, y: H * 0.45, r: bumpR }
    ];
    var laneW = Math.max(42, W * 0.13), laneH = 30;
    var lanes = [
      { x: 6, y: fy - 122, w: laneW, h: laneH, cool: 0 },
      { x: W - 6 - laneW, y: fy - 122, w: laneW, h: laneH, cool: 0 }
    ];

    // metal funnel as SVG
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "pin-chrome"); svg.setAttribute("width", W); svg.setAttribute("height", H);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML =
      '<defs><linearGradient id="pinSteel" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#eef0f4"/><stop offset="0.42" stop-color="#b4b9c4"/>' +
      '<stop offset="0.56" stop-color="#7f8591"/><stop offset="1" stop-color="#c2c6ce"/></linearGradient></defs>' +
      walls.map(function (w) {
        return '<line x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '" stroke="url(#pinSteel)" stroke-width="16" stroke-linecap="round"/>' +
               '<line x1="' + w.x1 + '" y1="' + (w.y1 - 5) + '" x2="' + w.x2 + '" y2="' + (w.y2 - 5) + '" stroke="rgba(255,255,255,.55)" stroke-width="2.2" stroke-linecap="round"/>';
      }).join("");
    layer.appendChild(svg);

    function mkFlip(r) { var e = document.createElement("div"); e.className = "pin-flip" + (r ? " pin-flip--r" : ""); e.style.width = flen + "px"; e.style.height = fthick * 2 + "px"; layer.appendChild(e); return e; }
    var flEl = mkFlip(false), frEl = mkFlip(true);
    var bumpEls = bumpers.map(function (b) { var e = document.createElement("div"); e.className = "pin-bumper"; e.style.width = e.style.height = b.r * 2 + "px"; e.style.transform = "translate(" + (b.x - b.r) + "px," + (b.y - b.r) + "px)"; layer.appendChild(e); b.el = e; return e; });
    var laneEls = lanes.map(function (l) { var e = document.createElement("div"); e.className = "pin-lane"; e.style.width = l.w + "px"; e.style.height = l.h + "px"; e.style.transform = "translate(" + l.x + "px," + l.y + "px)"; e.textContent = "300"; layer.appendChild(e); l.el = e; return e; });

    // HUD
    var hud = document.createElement("div"); hud.className = "pin-hud";
    hud.innerHTML = '<div><div class="pin-hud__k">Score</div><div class="pin-hud__v" data-score>0</div></div>' +
      '<div><div class="pin-hud__k">Balls</div><div class="pin-hud__balls" data-balls></div></div>';
    document.body.appendChild(hud);
    requestAnimationFrame(function () { hud.classList.add("is-on"); });
    var scoreEl = hud.querySelector("[data-score]"), ballsEl = hud.querySelector("[data-balls]");

    // ---- game state ---------------------------------------------------------
    var START = 5, ballsLeft = START, score = 0, served = 0, running = true, over = false;
    var ball = null, litThisBall = {}, litCount = 0, stackAwarded = false, cardsEver = {};
    function renderBalls() { var s = ""; for (var i = 0; i < START; i++) s += '<i class="' + (i < ballsLeft ? "" : "spent") + '"></i>'; ballsEl.innerHTML = s; }
    renderBalls();

    function pop(x, y, text, big) {
      var e = document.createElement("div"); e.className = "pin-pop" + (big ? " pin-pop--big" : "");
      e.style.left = x + "px"; e.style.top = y + "px"; e.textContent = text; layer.appendChild(e);
      setTimeout(function () { e.remove(); }, 740);
    }
    function addScore(n, x, y, text, big) { score += n; scoreEl.textContent = score; if (text) pop(x, y, text, big); }

    function serve() {
      litThisBall = {}; litCount = 0; stackAwarded = false;
      var name = TOOLS[served % TOOLS.length]; served++;
      var e = document.createElement("div"); e.className = "pin-ball"; e.style.width = e.style.height = R * 2 + "px";
      var img = new Image(); img.src = "/assets/logos/" + name + ".svg"; img.alt = ""; e.appendChild(img);
      layer.appendChild(e);
      ball = { el: e, r: R, x: cx + (Math.random() - 0.5) * 40, y: -R * 2, vx: (Math.random() - 0.5) * 30, vy: 0, still: 0 };
    }
    function drain() {
      if (ball) { ball.el.remove(); ball = null; }
      ballsLeft--; renderBalls(); buzz(40);
      if (ballsLeft <= 0) gameOver(); else setTimeout(function () { if (running && !over) serve(); }, 450);
    }
    serve();

    // ---- input: tap a side to work that flipper -----------------------------
    var ptr = {};
    function onDown(ev) {
      if (ev.target.closest && (ev.target.closest(".playfab") || ev.target.closest(".pin-over"))) return;
      ev.preventDefault();
      var side = ev.clientX < cx ? FL : FR; side.tgt = side.up; ptr[ev.pointerId] = side;
    }
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
      var dx = tx - px, dy = ty - py, L2 = dx * dx + dy * dy || 1;
      var t = ((b.x - px) * dx + (b.y - py) * dy) / L2; t = Math.max(0, Math.min(1, t));
      var cxp = px + dx * t, cyp = py + dy * t, nx = b.x - cxp, ny = b.y - cyp, d = Math.hypot(nx, ny), mn = b.r + fthick;
      if (d < mn && d > 0.0001) {
        nx /= d; ny /= d; b.x = cxp + nx * mn; b.y = cyp + ny * mn;
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + bounce) * vn * nx; b.vy -= (1 + bounce) * vn * ny; }
        if (om) { var sv = Math.abs(om) * 60 * flen * (t * 0.7 + 0.3); if (sv > 40) { b.vx += nx * sv * 0.62; b.vy += ny * sv * 0.62; } }
      }
    }
    function flipSeg(F, bounce) { var a = F.ang * Math.PI / 180; segHit(ball, F.px, F.py, F.px + Math.cos(a) * flen, F.py + Math.sin(a) * flen, (F.ang - F.prev) * Math.PI / 180, bounce); }
    function overlapRect(b, r) {
      var cxp = Math.max(r.x, Math.min(b.x, r.x + r.w)), cyp = Math.max(r.y, Math.min(b.y, r.y + r.h));
      var dx = b.x - cxp, dy = b.y - cyp;
      return (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) || (dx * dx + dy * dy < b.r * b.r);
    }

    var last = performance.now();
    function frame(now) {
      if (!running) return;
      var dt = Math.min(0.032, (now - last) / 1000); last = now;
      var steps = 2, h = dt / steps;
      [FL, FR].forEach(function (F) { F.prev = F.ang; F.ang += (F.tgt - F.ang) * Math.min(1, h * 24 * steps); });
      for (var i = 0; i < tris.length; i++) if (tris[i].cool > 0) tris[i].cool -= dt;
      for (var j = 0; j < lanes.length; j++) if (lanes[j].cool > 0) lanes[j].cool -= dt;

      if (ball) {
        var b = ball;
        for (var s = 0; s < steps; s++) {
          b.vx += grav.x * h; b.vy += grav.y * h; b.vx *= 0.998; b.vy *= 0.998;
          var sp = Math.hypot(b.vx, b.vy); if (sp > 1600) { b.vx *= 1600 / sp; b.vy *= 1600 / sp; }
          b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = -b.vx * 0.62; }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -b.vx * 0.62; }
          // funnel rails
          for (var w = 0; w < walls.length; w++) segHit(b, walls[w].x1, walls[w].y1, walls[w].x2, walls[w].y2, 0, 0.45);
          // flippers
          flipSeg(FL, 0.4); flipSeg(FR, 0.4);
          // side bumpers
          for (var k = 0; k < bumpers.length; k++) {
            var bm = bumpers[k], ddx = b.x - bm.x, ddy = b.y - bm.y, dd = Math.hypot(ddx, ddy), mn = b.r + bm.r;
            if (dd < mn && dd > 0.001) {
              var nx = ddx / dd, ny = ddy / dd; b.x = bm.x + nx * mn; b.y = bm.y + ny * mn;
              var vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.9 * vn * nx; b.vy -= 1.9 * vn * ny; }
              b.vx += nx * 170; b.vy += ny * 170;
              bm.el.classList.remove("is-hit"); void bm.el.offsetWidth; bm.el.classList.add("is-hit");
              setTimeout((function (el) { return function () { el.classList.remove("is-hit"); }; })(bm.el), 140);
              addScore(150, bm.x, bm.y - bm.r, "+150"); buzz(18);
            }
          }
        }
        // jackpot lanes (pass-through)
        for (var l = 0; l < lanes.length; l++) {
          var la = lanes[l];
          if (la.cool <= 0 && overlapRect(b, la)) {
            la.cool = 0.5; la.el.classList.add("is-hit"); setTimeout((function (el) { return function () { el.classList.remove("is-hit"); }; })(la.el), 220);
            addScore(300, la.x + la.w / 2, la.y, "+300"); buzz(22);
          }
        }
        // card triggers (pass-through, once per ball per card)
        for (var c = 0; c < tris.length; c++) {
          var tr = tris[c];
          if (overlapRect(b, tr)) {
            if (!litThisBall[c]) {
              litThisBall[c] = 1; litCount++; cardsEver[c] = 1;
              tr.el.classList.remove("pin-hit"); void tr.el.offsetWidth; tr.el.classList.add("pin-hit");
              addScore(50, b.x, Math.max(30, tr.y + 14), "+50"); buzz(10);
              if (!stackAwarded && tris.length >= 2 && litCount >= tris.length) { stackAwarded = true; addScore(500, cx, H * 0.4, "STACK LIT +500", true); buzz([20, 40, 20]); }
            }
          }
        }
        // drained?
        if (b.y > fy + 48) drain();
        else if (b) { var spd = Math.hypot(b.vx, b.vy); if (spd < 14) { b.still++; if (b.still > 80) { b.vx += (Math.random() - 0.5) * 200; b.vy -= 120; b.still = 0; } } else b.still = 0; }
      }

      // render
      if (ball) ball.el.style.transform = "translate(" + (ball.x - ball.r) + "px," + (ball.y - ball.r) + "px)";
      flEl.style.transform = "translate(" + (FL.px - 13) + "px," + (FL.py - fthick) + "px) rotate(" + FL.ang + "deg)";
      frEl.style.transform = "translate(" + (FR.px - flen + 13) + "px," + (FR.py - fthick) + "px) rotate(" + (FR.ang - 180) + "deg)";
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ---- game over ----------------------------------------------------------
    function gameOver() {
      over = true; if (ball) { ball.el.remove(); ball = null; }
      var lit = Object.keys(cardsEver).length;
      var ov = document.createElement("div"); ov.className = "pin-over";
      ov.innerHTML = '<div class="pin-over__card"><div class="pin-over__k">Game over</div>' +
        '<div class="pin-over__score">' + score + '</div>' +
        '<div class="pin-over__sub">' + lit + ' card' + (lit === 1 ? "" : "s") + ' lit &middot; the stack is spent</div>' +
        '<div class="pin-over__btns"><button class="pin-over__btn pin-over__btn--go" type="button" data-again>Play again</button>' +
        '<button class="pin-over__btn pin-over__btn--exit" type="button" data-exit>Exit</button></div></div>';
      document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("is-on"); });
      ov.querySelector("[data-again]").addEventListener("click", function () { ov.remove(); ballsLeft = START; score = 0; scoreEl.textContent = 0; cardsEver = {}; over = false; renderBalls(); serve(); });
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
      fab.classList.remove("is-live"); fab.querySelector(".playfab__t").textContent = "Pinball";
      game = null;
    };
    window.addEventListener("resize", function onR() {
      if (!running) { window.removeEventListener("resize", onR); return; }
      if (Math.abs(window.innerWidth - W) > 60 || Math.abs(window.innerHeight - H) > 140) { window.removeEventListener("resize", onR); self.stop(); }
    });
  }
})();
