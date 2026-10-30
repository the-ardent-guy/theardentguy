/* ===========================================================================
   REDO — homepage behaviour
   2026-10-23 (r4), music disc removed 2026-10-27. Five jobs, each a no-op
   where its hooks are absent:
     1  the floating pill nav arrives once the black stage covers the banner
     2  the DESSERTS wordmark is fitted to the viewport width
     3  the custom cursor (desktop pointers only)
     4  the toy pile — draggable software logos with gravity (desktop only)
     5  Ezra's pupils follow the cursor
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
     The nine tools are little balls, piled on the RIGHT of the rule under
     "Selected work" so the heading on the left balances them. They are not
     there when the page loads: they fall in and heap up the first time that
     rule comes anywhere near the screen. Pick one up from wherever it sits
     and it lifts to the pointer; let go and it keeps the speed of the throw.
     From there it is a ball:
       GRAVITY pulls it down, AIR bleeds a little speed.
       FLOORS — the rule, every case-study card, the two dessert tiles, the
         contact block, and a full-width floor at the foot — catch it. A fast
         landing BOUNCES (keeps ~3/4 of its speed, loses a little sideways); a
         slow one comes to REST and ROLLS with friction until it stops or rolls
         off the edge and falls on.
       WALLS — the sides of the WINDOW — bounce it back. The column's own
         edge is not a wall: a ball rolls off the end of the rule and falls
         down the gutter, which is what he asked for on 2026-10-27.
       BALL-TO-BALL: they push apart and trade the speed along the line between
         them, so a thrown ball scatters the pile and a dropped one knocks its
         neighbours awake.
       THE HEAP HOLDS ITSELF UP: a ball with nothing under it but two other
         balls is carried by them, and a ball that has gone to sleep is a
         fixture nothing can shove. Take one out of the bottom row and
         whatever was leaning on it wakes up and comes down.
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

    var TOOLS = ["figma", "cursor", "claude", "make", "n8n", "shopify", "linear", "posthog", "grok"];

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

    var stageRect = null, W = 0, wallL = 0, wallR = 0;
    var surfaces = [], footZ = null, dessZ = null, lineTop = 0, lineX0 = 0, lineX1 = 0;
    var balls = [], topZ = 10, raf = 0, lastT = 0, held = null;

    /* THE DROP, AND WHY IT IS A PILE.
       Nine balls in a line along the rule read as a nav bar, which is the one
       thing they are not. Stacked four, three and two, each row sitting in
       the notches of the row below, they read as objects that were dropped
       there and left, and a pile is a thing you want to put a hand in. The
       packing is the one a rack of balls falls into, because it is the only
       one circles have: a diameter of pitch along a row, and the row above
       half a diameter across and sqrt(3)/2 of one higher. Four wide and
       three high is 120 by 82 at this radius, which fits the clear space to
       the right of "Selected work" without reaching the lead above it.

       THEY FALL BOTTOM ROW FIRST, left to right, because a pile has to be
       built from the ground up, and watching it go up in that order is most
       of what sells the fall. Each one drops 40px onto its own place: far
       enough that the eye reads a fall and a settle rather than a pop-in,
       short enough to stay clear of the text above. At this gravity that is
       a quarter of a second, and SOFT_REST gives two decreasing bounces
       after it, which is the dribble. ROW_GAP is the wait between rows, long
       enough that a row has stopped bouncing before the next one lands in
       its notches. GAP is the much shorter wait inside a row, so four balls
       land as one run rather than four separate events. The lot takes 45
       frames, three quarters of a second, and that number is measured.

       EACH BALL LANDS ON A SHELF OF ITS OWN, not on the balls below it, and
       that is the whole reason the entrance is reliable. A ball carried by
       two others has no floor under it, so gravity goes back into it every
       frame and only the positional correction holds it up; build the pile
       that way and the arrival time of one ball decides where the next nine
       finish. Replayed in Node, that version put balls 40px out of place,
       and in four release timings out of 126 the pile never came to rest at
       all, which leaves requestAnimationFrame running for the rest of the
       visit. A shelf is one block in landFor and it hands every ball the
       code path the rule already gives the bottom row: fall, bounce,
       dribble, rest, sleep. Every timing then lands on its slot to within a
       thousandth of a pixel, at 60fps, at 30, and through stalled frames.
       The shelf exists only while `arriving` is true, so nothing can land on
       thin air once the pile is down.

       The four SOFT_ numbers are the entrance and only the entrance, and
       they are the difference between a ball dropped on felt and one thrown
       at a table. REST 0.74 and ROLL 0.9 are right for a ball you have
       flung: from 40px they give five bounces and a knock that shoves the
       ball it hit halfway down the line. Arriving, a ball keeps 0.42 of its
       bounce, loses its sideways speed four times faster, and trades none of
       it on contact. `arriving` is one flag for the whole entrance, not one
       per ball, because the ball being knocked has already landed: per-ball
       it would have been back on the thrown numbers by then. While it is up,
       the part of the pile that has already arrived is a fixture no landing
       can push out of place. It clears when the pile goes still, and the
       first hand on a ball clears it early. */
    var PILE = [4, 3, 2];          /* balls per row, from the rule upward */
    var NEST = Math.sqrt(3) / 2;   /* row height, as a fraction of a diameter */
    var DROP = 40;    /* how far each one falls onto its own place */
    var GAP = 2;      /* frames between two balls in the same row */
    var ROW_GAP = 12; /* frames between one row and the next */
    var SOFT_REST = 0.42, SOFT_V = 2.8, SOFT_ROLL = 0.72, SOFT_PAIR = 0;
    var dropped = false, arriving = false;

    /* WHAT KEEPS THE HEAP A HEAP once the entrance is over and a hand has
       been in it. Three things, and each is here because taking it out is
       measurable: 16,000 random throws and drags into a settled pile were
       replayed for every combination of them.
         PASSES. One relaxation pass per frame cannot push a ball out of two
       neighbours at once, and the leftover is up to 3.5px of logo inside
       logo. Three passes leave under half a pixel. Only the first pass
       trades speed; the other two are position alone, so nothing gains
       energy by being resolved twice.
         A SLEEPING BALL IS IMMOVABLE. With equal masses the top of the pile
       presses the bottom row out sideways a fraction of a pixel a frame, the
       roll carries that, and the heap slowly spreads back into the row he
       rejected. With sleepers fixed, the one still moving is the one that
       moves, and since a knock wakes what it hits before anything is
       resolved, a throw still scatters the lot as hard as it ever did. Left
       out: 16px of overlap in the worst case. In: half a pixel.
         IT HAS TO FALL ASLEEP ON POSITION. A ball held up by other balls
       never reports itself at rest, because its velocity is cancelled and
       re-applied every frame, so the loop would run until the tab was
       closed: 8 of 400 disturbances did exactly that before this went in.
       Six frames under half a pixel each is asleep, and both halves of that
       are measured. Half a pixel because a pair of balls leaning on each
       other can hum at four tenths of one, which is nothing to look at and
       still enough to keep asking for frames. Six frames because gravity
       puts on 0.9px of speed in one, so a ball in flight is under half a
       pixel for about one frame either side of the top of a bounce and can
       never fake six in a row. The test is per frame and scaled by dt, so
       both of those hold at 30fps and at 120 as well as at 60. */
    var PASSES = 3;   /* relaxation passes a frame */
    var STILL = 6;    /* frames under CREEP before a ball is asleep */
    var CREEP = 0.5;  /* px a frame that counts as not moving */

    /* The walls are the WINDOW, not the column. They used to sit on the edge
       of .stage__in, which is also where the rule ends, so a ball could never
       roll off the end of the line - it bounced back a pixel before it got
       there. Now it rolls off, falls down the gutter beside the text, and the
       full-width floor at the foot catches it. Clamped to the viewport, so
       nothing can push a horizontal scrollbar onto the page. */
    function walls() {
      wallL = -stageRect.left + R;
      wallR = (document.documentElement.clientWidth - stageRect.left) - R;
    }

    function rel(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height };
    }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function layout() {
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width;
      R = W < 760 ? 13 : 15;
      walls();
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

    /* The resting arrangement, and the same thing "put them back" aims at.
       Row and column come out of PILE, so the two can never disagree. The
       pile is centred on 0.76 of the rule, which is where the row used to
       sit and where the heading on the left wants it, and then held whole:
       its widest row plus a radius has to fit inside the line, or on a
       narrow window the clamp at the end would pack the overflow against the
       wall and the heap would stop being a heap. */
    function homeSlot(i) {
      /* The row stops at the top one even if the balls run out of pile,
         because a tenth tool added to TOOLS and not to PILE would otherwise
         walk off the end of it and every slot would come back NaN, which is
         nine balls gone from the page. A spare lands on the top row, finds
         nothing under it, and rolls down into the heap. */
      var row = 0, col = i;
      while (row < PILE.length - 1 && col >= PILE[row]) { col -= PILE[row]; row++; }
      var step = R * 2, half = (PILE[0] - 1) * step / 2;
      var cx = lineX0 + (lineX1 - lineX0) * 0.76;
      cx = Math.min(cx, lineX1 - R - half);
      cx = Math.max(cx, lineX0 + R + half);
      cx += (col - (PILE[row] - 1) / 2) * step;
      return { cx: clamp(cx, wallL, wallR), cy: lineTop - R - row * step * NEST,
               row: row, col: col };
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
                  restOn: null, settled: true, home: true, held: false, wait: 0,
                  shelf: null, still: 0, px: s.cx, py: s.cy,
                  gdx: 0, gdy: 0, _lx: s.cx, _ly: s.cy, _lt: 0 };
        el.classList.add("is-tucked");
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
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width; walls();
      try { b.el.setPointerCapture(e.pointerId); } catch (err) {}
      var p = ptr(e);
      b.held = true; b.settled = false; b.restOn = null; b.home = false; arriving = false;
      b.el.classList.remove("is-homing"); b.el.classList.add("is-held");
      b.gdx = p.x - b.cx; b.gdy = p.y - b.cy;
      b._lx = b.cx; b._ly = b.cy; b._lt = performance.now();
      b.vx = b.vy = 0;
      b.el.style.zIndex = (topZ++);
      held = b; kick();
    }

    function onMove(e) {
      if (!held) return;
      stageRect = stageIn.getBoundingClientRect(); W = stageRect.width; walls();
      var p = ptr(e), b = held;
      var ncx = clamp(p.x - b.gdx, wallL, wallR);
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
      /* Its own place in the pile, for the length of the entrance only, and
         only for the rows off the ground. The shelf object is kept on the
         ball and refilled rather than made fresh, so a ball resting on one
         reads its slot live and follows the rule if the page reflows under
         it. */
      if (arriving && b.home && !b.held) {
        var sl = homeSlot(b.i);
        if (sl.row) {
          if (!b.shelf) b.shelf = { top: 0, x0: 0, x1: 0, el: null };
          b.shelf.top = sl.cy + R; b.shelf.x0 = sl.cx - R; b.shelf.x1 = sl.cx + R;
          if (ncx >= b.shelf.x0 - R * 0.5 && ncx <= b.shelf.x1 + R * 0.5 &&
              b.shelf.top >= prevBottom - LAND_SLACK && b.shelf.top <= newBottom) best = b.shelf;
        }
      }
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

    /* Note what is NOT reset here. `still` counts frames in which the ball
       did not go anywhere, and that is a question about the ball, not about
       who has shouted at it. Two balls leaning on each other wake each other
       every single frame, so restarting the count on a wake means neither of
       them can ever prove it has stopped, and the pit asks for frames until
       the tab is closed. One disturbance in sixteen thousand found that. */
    function wake(b) { b.settled = false; b.restOn = null; b.home = false; }

    /* Is this ball being carried? Two shoulders on opposite sides of its
       centre carry it; one does not, it rolls off that one and comes down.
       This is what stops a ball hanging in the air after the ball under it
       has been picked up and walked off with, which no contact can report,
       because by then there is no contact to report it. */
    function propped(b) {
      var left = false, right = false;
      for (var i = 0; i < balls.length; i++) {
        var o = balls[i];
        if (o === b || o.wait > 0) continue;   /* not let go yet, so not holding anything up */
        var dx = o.cx - b.cx, dy = o.cy - b.cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > R * 2 + 1 || d < 0.01 || dy / d < 0.35) continue;
        if (dx < -1) left = true; else if (dx > 1) right = true; else return true;
      }
      return left && right;
    }

    function pairs(trade) {
      for (var i = 0; i < balls.length; i++) {
        for (var j = i + 1; j < balls.length; j++) {
          var a = balls[i], b = balls[j];
          if (a.wait > 0 || b.wait > 0) continue;   /* not let go yet, so not in the world */
          var dx = b.cx - a.cx, dy = b.cy - a.cy;
          var d = Math.sqrt(dx * dx + dy * dy); if (d < 0.01) { dx = 0.1; dy = 0; d = 0.1; }
          var min = R * 2;
          if (d >= min) continue;
          var nx = dx / d, ny = dy / d, overlap = min - d;
          /* Two sleeping balls are left to it, which is what lets the pile
             sleep at all: a resting contact is an overlap of nothing and
             correcting it every frame would keep the loop awake. Unless one
             is deep inside the other, which a hard throw can do in a single
             frame and which would otherwise be frozen there the moment the
             two of them slept. Three times in sixteen thousand throws, and
             every one a logo sitting on top of a logo. */
          if (a.settled && b.settled && !a.held && !b.held) {
            if (overlap < R) continue;
            wake(a); wake(b);
          }
          var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (trade) {
            /* Any contact that is closing wakes both of them, which is
               what makes a thrown ball scatter the heap. It also means a
               ball leaning on a sleeper wakes it every frame, which is
               harmless because the sleep test asks only whether the thing
               moved, and a leaned-on ball does not move. Letting only a
               real knock wake instead was tried and is much worse: with
               nothing to keep nudging them, balls settle a shoulder short
               of where they belong and the support test wakes them again
               for it, 103 disturbances in 4,800 going round that loop
               forever against none this way. Nothing wakes during the
               entrance: the part that has landed is a fixture, so an
               arriving ball cannot shove it out of place. A hand wakes
               whatever it touches either way, or the pointer would carry a
               ball straight through a sleeping one. */
            if ((vn < 0 && !arriving) || a.held || b.held) {
              if (!a.held) wake(a);
              if (!b.held) wake(b);
            }
          }
          var am = (a.held || a.settled) ? 0 : 1, bm = (b.held || b.settled) ? 0 : 1;
          var tot = am + bm;
          if (!tot) continue;
          a.cx -= nx * overlap * (am / tot); a.cy -= ny * overlap * (am / tot);
          b.cx += nx * overlap * (bm / tot); b.cy += ny * overlap * (bm / tot);
          if (!trade || vn >= 0) continue;
          var imp = -(1 + (arriving ? SOFT_PAIR : PAIR_REST)) * vn / tot;
          a.vx -= imp * nx * am; a.vy -= imp * ny * am;
          b.vx += imp * nx * bm; b.vy += imp * ny * bm;
        }
      }
    }

    function moveBall(b, dt) {
      if (b.restOn) {
        b.vx *= Math.pow(arriving ? SOFT_ROLL : ROLL, dt);
        var ncx = clamp(b.cx + b.vx * dt, wallL, wallR);
        if (ncx <= wallL || ncx >= wallR) b.vx = -b.vx * WALL;
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
      if (ncx2 < wallL) { ncx2 = wallL; b.vx = -b.vx * WALL; }
      else if (ncx2 > wallR) { ncx2 = wallR; b.vx = -b.vx * WALL; }
      var hit = landFor(b, prevBottom, ncx2, ncy2);
      if (hit) {
        ncy2 = hit.top - R;
        if (Math.abs(b.vy) > BONK_V) bonk(hit);
        /* Still arriving: a dead landing, not a thrown one. */
        var rst = arriving ? SOFT_REST : REST, rv = arriving ? SOFT_V : REST_V;
        if (Math.abs(b.vy) > rv) { b.vy = -b.vy * rst; b.vx *= 0.85; }
        else { b.vy = 0; b.restOn = hit; }
      }
      b.ang += (b.vx / R) * 10 * dt;
      b.cx = ncx2; b.cy = ncy2;
    }

    function step(dt) {
      var i, b;
      for (i = 0; i < balls.length; i++) { balls[i].px = balls[i].cx; balls[i].py = balls[i].cy; }
      for (i = 0; i < balls.length; i++) {
        if (balls[i].held || balls[i].settled) continue;
        /* Still waiting its turn to be let go. It counts as moving, so the
           loop keeps running, and it shows itself on the frame it falls. */
        if (balls[i].wait > 0) {
          balls[i].wait -= dt;
          if (balls[i].wait <= 0) release(balls[i]);
          continue;
        }
        moveBall(balls[i], dt);
      }
      for (i = 0; i < PASSES; i++) pairs(i === 0);
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (b.held || b.wait > 0) continue;
        /* THE ENTRANCE BACKSTOP. During the drop a ball is going to exactly
           one place and nowhere else, and landFor only catches a surface the
           ball crosses downward inside one frame: it never looks backwards.
           So if the page reflows while a ball is in the air, and fonts
           landing under a three line headline is the usual way, the rule
           moves out from under something already past it and the ball falls
           straight through the line onto the first case study. It is the
           bottom row that shows this, because the rows above it land on
           shelves of their own and the bottom four are the only ones that
           need the real rule to be where it was.

           Caught a radius past its slot and put where it was going. Entrance
           only, and home balls only, so nothing a hand has touched is ever
           teleported out from under it. */
        if (arriving && b.home && !b.settled) {
          var sl2 = homeSlot(b.i);
          if (b.cy > sl2.cy + R) {
            b.cx = sl2.cx; b.cy = sl2.cy;
            b.vx = 0; b.vy = 0; b.restOn = null; b.still = STILL;
            settle(b);
            continue;
          }
        }
        if (b.settled) {
          /* Asleep with no floor under it and no two shoulders holding it:
             the heap has moved out from under this one and it has to fall. */
          if ((!b.restOn || b.restOn === b.shelf) && !propped(b)) wake(b);
          continue;
        }
        /* Asleep once it has stopped going anywhere. Position, not velocity:
           a ball wedged in the heap has gravity put back into it every frame
           and no velocity test can tell that from something creeping. */
        if (Math.abs(b.cx - b.px) + Math.abs(b.cy - b.py) < CREEP * dt) {
          b.still += dt;
          if (b.still >= STILL) { b.vx = 0; b.vy = 0; settle(b); }
        } else b.still = 0;
      }
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
      else { lastT = 0; arriving = false; }   /* the line is still: entrance over */
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

    /* ---- the drop ---- */
    function drop() {
      if (dropped) return;
      dropped = true;
      arriving = true;
      layout();                         /* the line has moved since build() */
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i], s = homeSlot(b.i);
        /* Parked at its own place with one drop of air under it, which is
           the finished pile lifted 40px and therefore nothing resting inside
           anything else. Invisible until its turn comes, so nothing is seen
           hanging in the air waiting, and skipped by pairs() while it waits,
           so a ball already falling cannot shove the queue about. */
        b.cx = s.cx; b.cy = s.cy - DROP;
        b.vx = 0; b.vy = 0;
        b.restOn = null; b.settled = false; b.home = true; b.still = 0;
        b.px = b.cx; b.py = b.cy;
        b.wait = s.row * ROW_GAP + s.col * GAP;
        place(b);
      }
      release(balls[0]);
      kick();
    }

    /* Let one go, straight down onto its own place in the pile. */
    function release(b) {
      var s = homeSlot(b.i);
      b.cx = s.cx; b.cy = s.cy - DROP;
      b.vx = 0; b.vy = 0;
      b.wait = 0; b.still = 0;
      b.px = b.cx; b.py = b.cy;
      b.el.classList.remove("is-tucked");
      place(b);
    }

    /* ---- lifecycle ---- */
    var rt;
    function onResize() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        layout();
        balls.forEach(function (b) {
          b.el.style.setProperty("--d", (R * 2) + "px");
          /* A ball that is home AND stopped belongs in its slot. One that is
             home but still in the air is mid-drop: snapping it there would
             eat the fall, so it is handed to the loop like any other. Fonts
             landing can fire this in the middle of the entrance. */
          if (b.home && b.settled) { var s = homeSlot(b.i); b.cx = s.cx; b.cy = s.cy; place(b); }
          else if (arriving && b.home && !b.settled) {
            /* Mid-entrance, and the ground just moved under it. Put it back
               at the top of its own fall rather than hand it to the loop in
               free fall against geometry it was never aimed at, which is the
               other half of how a ball ends up under the rule. It re-falls
               its 40px, and at this point in a page load nobody sees that. */
            var s2 = homeSlot(b.i);
            b.cx = s2.cx; b.cy = s2.cy - DROP;
            b.vx = 0; b.vy = 0; b.restOn = null; b.still = 0;
            b.px = b.cx; b.py = b.cy;
            place(b);
          }
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

    /* EARLY, so the fall is ending as he arrives rather than starting. His
       words on 2026-10-31: "it doesnt need to drop after i scroll down, right
       when i scroll, it needs to end dropping". The old trigger waited for
       the rule to clear the top of the window by 180px, which is a third of
       a second after he is already looking straight at it, and then took
       1.8s to finish. So the root is grown 600px past the BOTTOM of the
       window instead, and the entrance is down to three quarters of a
       second.

       320, and the number is doing one job: he asked to see the last 30%
       of the fall, and no more. 600 was too generous. The rule sits about
       390 to 430px below the fold when the page opens (340 to 382 before
       the spacing below was opened up), so a margin over about 430 fires as
       the page loads and the fall is finished before he has gone anywhere.
       At 320 it waits until he has started down, and then there is 320px
       left to travel before the heap is in the frame. At an ordinary scroll
       that is a little over half a second against a 0.75s fall, so what he
       catches is the last quarter to third of it.

       This is the honest limit of the approach: the fall runs on a clock and
       the scroll does not, so how much he sees depends on how fast he moves.
       A flick past it will show less, a slow read more. The only way to pin
       it exactly would be to drive the fall from scroll position rather than
       from time, which would stop it being a fall.

       threshold 0 and no negative margin, where it used to be threshold 1
       and -180px. With those, a rule that loads already above the window, or
       a flick of the wheel that skips the frames the observer samples,
       leaves nine invisible balls that never arrive at all. Any part of it
       inside the grown root will do, and the observer stays on until that
       happens, so coming back up the page still sets them off. */
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es, o) {
        if (!es[0].isIntersecting) return;
        o.disconnect();
        drop();
      }, { threshold: 0, rootMargin: "0px 0px 320px 0px" }).observe(head);
    } else {
      dropped = true;
      balls.forEach(function (b) { b.el.classList.remove("is-tucked"); });
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
  }


  /* 6. EZRA'S EYES - two pupils that slide sideways in their sockets as the
     cursor moves, and now and then look away and ignore it.

     They move a little along the eye and a very little across it. The socket
     is an almond, and the first version of this aimed each pupil freely in
     2D with one distance for both, which walked them out of the cat.

     Six numbers per pupil, all in the markup and all measured off the artwork
     he supplied on 2026-10-27 (a sheet of just the pupils over the pupil-less
     cat): --ex / --ey are where he drew that pupil, and data-l / data-r /
     data-u / data-d are how far it may go left, right, up and down, as a
     percent of the picture. Each was found by walking the pupil's own disc
     out of its socket half a pixel at a time until it left; the four are the
     semi-axes of an ellipse, which was then checked at 72 angles. They are
     asymmetric because he drew neither pupil in the middle of its eye, and
     both of them high, which is why up is the smallest of the four.

     The rest position is CSS, so JS off or reduced motion on still leaves the
     cat with its eyes in the right place. ---------------------------------- */
  function eyes() {
    var host = document.querySelector("[data-eyes]");
    if (!host) return;
    var pupils = Array.prototype.slice.call(host.querySelectorAll(".dz__eye"));
    if (!pupils.length || reduce) return;

    var specs = pupils.map(function (p) {
      var cs = getComputedStyle(p);
      return {
        el: p,
        ex: parseFloat(cs.getPropertyValue("--ex")) || 50,
        ey: parseFloat(cs.getPropertyValue("--ey")) || 50,
        l: parseFloat(p.getAttribute("data-l")) || 0,
        r: parseFloat(p.getAttribute("data-r")) || 0,
        u: parseFloat(p.getAttribute("data-u")) || 0,
        d: parseFloat(p.getAttribute("data-d")) || 0
      };
    });

    var inView = true, ignoring = false;
    if ("IntersectionObserver" in window) {
      inView = false;
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; }, { threshold: 0.25 }).observe(host);
    }

    /* tx, ty is a unit direction. Each pupil takes its own room in that
       direction, so the offsets trace the ellipse its socket allows rather
       than a circle. */
    function put(s, tx, ty, w, h) {
      s.el.style.setProperty("--ox", (tx * (tx < 0 ? s.l : s.r) / 100 * w).toFixed(2) + "px");
      s.el.style.setProperty("--oy", (ty * (ty < 0 ? s.u : s.d) / 100 * h).toFixed(2) + "px");
    }

    function slide(tx, ty) {
      var r = host.getBoundingClientRect();
      specs.forEach(function (s) { put(s, tx, ty, r.width, r.height); });
    }

    function aim(px, py) {                       // each pupil from its own socket
      var r = host.getBoundingClientRect();
      specs.forEach(function (s) {
        var dx = px - (r.left + r.width * s.ex / 100);
        var dy = py - (r.top + r.height * s.ey / 100);
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        put(s, dx / len, dy / len, r.width, r.height);
      });
    }

    window.addEventListener("pointermove", function (e) {
      if (!inView || ignoring) return;
      aim(e.clientX, e.clientY);
    }, { passive: true });

    setInterval(function () {                    // now and then, ignore the cursor
      if (!inView || ignoring) return;
      if (Math.random() < 0.3) {
        ignoring = true;
        var a = Math.random() * Math.PI * 2;
        slide(Math.cos(a), Math.sin(a));
        setTimeout(function () { ignoring = false; }, 800 + Math.random() * 1400);
      }
    }, 3200);
  }


  function boot() { nav(); fit(); cursor(); toys(); eyes(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
}());
