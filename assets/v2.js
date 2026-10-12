/* Design pass v2. The grain layer, the photo pile and the bar reveal.
   Vanilla, because the site has no build step and nothing here needs a
   library. The one thing a library would buy is a real spring, and a
   single overshoot curve gets close enough to be worth not shipping 40KB
   for it. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- 1. The grain layer ------------------------------------------------ */

  function scaffold() {
    if (!document.querySelector(".v2-grain")) {
      var g = document.createElement("div");
      g.className = "v2-grain";
      g.setAttribute("aria-hidden", "true");
      document.body.appendChild(g);
    }
  }


  document.addEventListener("DOMContentLoaded", function () {
    scaffold();
  });
})();

/* The photo pile. Tap the front card and it goes to the back, so three
   photographs share one card's worth of space. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var pile = document.getElementById("pile");
    var cap = document.getElementById("pileCap");
    if (!pile) return;

    var cards = Array.prototype.slice.call(pile.querySelectorAll(".pile__card"));
    if (cards.length < 2) return;
    var order = cards.slice();

    /* On a pointer the stack announces itself by moving under the cursor.
       On a phone it did not announce itself at all, so two of these three
       photographs were unreachable and the card read as one dead
       placeholder. A counter and a row of dots, built here rather than in
       the markup so the no-JS page is not promising an interaction it
       cannot deliver. */
    var nav = document.createElement("div");
    nav.className = "pile__nav";
    var dots = document.createElement("span");
    dots.className = "pile__dots";
    dots.setAttribute("aria-hidden", "true");
    var marks = cards.map(function () {
      var d = document.createElement("span");
      d.className = "pile__dot";
      dots.appendChild(d);
      return d;
    });
    var hint = document.createElement("span");
    hint.className = "pile__hint";
    hint.textContent = "Tap to change";
    nav.appendChild(dots);
    nav.appendChild(hint);
    (cap || pile).insertAdjacentElement("afterend", nav);

    /* The caption is the only thing that changes on tap, so it is the part
       that has to be announced. */
    if (cap) cap.setAttribute("aria-live", "polite");

    cards.forEach(function (c, i) {
      c.setAttribute("aria-label", "Photograph " + (i + 1) + " of " + cards.length + ". Show the next one.");
    });

    function paint() {
      order.forEach(function (c, i) {
        c.classList.remove("is-front", "is-mid", "is-back");
        c.classList.add(i === 0 ? "is-front" : i === order.length - 1 ? "is-back" : "is-mid");
        c.setAttribute("aria-hidden", i === 0 ? "false" : "true");
        c.tabIndex = i === 0 ? 0 : -1;
      });
      var at = cards.indexOf(order[0]);
      marks.forEach(function (d, i) { d.classList.toggle("is-on", i === at); });
      if (cap) cap.textContent = order[0].getAttribute("data-cap") || "";
    }

    cards.forEach(function (c) {
      c.addEventListener("click", function () {
        order.push(order.shift());
        paint();
      });
    });

    paint();
  });
})();

/* The bar belongs to the grid, not to the photograph. It stays away while
   the curtain is on screen and comes down as the grid arrives. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.querySelector(".bar");
    var curtain = document.getElementById("curtain");
    if (!bar) return;

    /* No curtain on this page, or no observer: just show it. */
    if (!curtain || !("IntersectionObserver" in window)) {
      bar.classList.add("is-up");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      /* Down once the picture has left, away again when it returns. */
      bar.classList.toggle("is-up", !entries[0].isIntersecting);
    }, { threshold: 0, rootMargin: "-64px 0px 0px 0px" });

    io.observe(curtain);
  });
})();


/* ==========================================================================
   THE TOY BOX
   Five tools as objects, heaped in the bottom-right corner of the intro
   card. Grab them, shove them, throw them, tap them. The box is tipped
   toward that corner, so the heap puts itself back together after you
   wreck it and the card is never left looking broken. Nothing draws the
   box, so what you see is a heap of bright objects in the corner of a
   sheet of paper, and the walls that hold them are the card's own clip.

   THE 3D DECISION: CSS transforms, no engine.
   An engine buys real geometry, real lights and real shadows. Here it would
   buy none of those things visibly, because the objects are five flat-faced
   discs standing upright in a 135px tray, viewed nearly head on, at 48px
   across. There is no silhouette an engine could draw that ten stacked
   circles in Z cannot, and there is no lighting at 48px that a radial
   gradient and three brightness steps cannot fake past the point of anyone
   caring. What the page would pay is roughly 600KB of parse and execute, a
   WebGL context and a canvas, on the first card of a portfolio, to make
   five logos tumble. That is not a trade, it is a tax. The 3D read here
   comes from the perspective on the tray acting on the Z-stacked rim, which
   means position alone reveals thickness and it costs nothing per frame.
   If the brief ever becomes real materials, shadows cast between objects,
   or shapes you can see the back of, that is when an engine earns its
   download, and not before.

   THE PHYSICS: hand-written, circles only.
   Fixed timestep, two substeps, three relaxation iterations. Positional
   correction with slop for resting contacts, impulses with restitution for
   real ones, so a pile converges instead of humming. Circle-circle is the
   whole collision model, which is why the objects are round: a rotating
   rounded square needs SAT and still shows its corners inside its
   neighbours. A physics library would be a second dependency brought in to
   solve ten pairs of circles.

   IT SLEEPS. The loop stops when nothing is moving and when the card is off
   screen, and only a pointer or a resize starts it again. Hover is pure CSS
   so the pile can be stroked while the solver stays asleep.
   ========================================================================== */

(function () {
  "use strict";

  var BOX = document.getElementById("toybox");
  if (!BOX) return;

  /* Full colour, because these are meant to look like the real things. The
     rim is the brand colour taken down to a moulded-plastic edge, so each
     counter is still itself when its face is turned away. n8n is left out
     on purpose: a sixth logo is a sixth claim about what he works in, and
     that is a copy decision, not a craft one. */
  /* bx and by are each counter's permanent lie, a few degrees of it, so the
     heap shows five different edges while it is sitting perfectly still.
     Without them a settled counter is dead square to the camera and reads
     as a sticker; with them it reads as something that was dropped. They
     are fixed rather than random, because five chosen angles compose and
     five rolled ones are a different picture on every reload. */
  var TOOLS = [
    { k: "figma",   rim: "#A8381A", bx: -6, by:  10 },
    { k: "claude",  rim: "#A3543B", bx:  7, by:  -9 },
    { k: "cursor",  rim: "#2D2D31", bx: -9, by:  -6 },
    { k: "shopify", rim: "#4E7A38", bx:  5, by:  11 },
    { k: "make",    rim: "#4C0091", bx: -4, by: -12 }
  ];


  /* The box is tipped toward its bottom-right corner, which is what makes a
     thrown counter find its way home instead of sitting where it landed.
     The ratio is the whole trick and it is bounded on both sides. Too little
     and the floor row never compacts, so there are no valleys for anything
     to stack in. Too much and the pile climbs the right wall into a tower,
     which in a 133px box means the top one is outside the card: that is
     exactly what the first build did. A circle resting in the valley between
     two others escapes once gravity leans more than about 30 degrees off
     vertical, so 0.3 keeps the pile together and the tower from forming. */
  var GY = 1900;
  var GX = 570;
  var AIR = 1.2;    /* linear damping, per second */
  var REST = 0.68;  /* counter against counter: they repel */
  var WALL = 0.58;
  var CALM = 22;    /* below this an impact is a rest, not a bounce */

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var hoverable = window.matchMedia("(hover: hover)");

  var toys = [];
  var W = 0, H = 0, D = 0, R = 0;
  var rect = null;
  var raf = 0, running = false, still = 0, dead = 0, last = 0;
  var held = null, inview = false, dropped = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* --- Build ----------------------------------------------------------- */

  function build() {
    var frag = document.createDocumentFragment();
    toys = TOOLS.map(function (t) {
      var el = document.createElement("div");
      el.className = "toy";
      el.style.setProperty("--rim", t.rim);

      var face = document.createElement("span");
      face.className = "toy__f";
      var img = document.createElement("img");
      img.src = "/assets/logos/" + t.k + ".svg";
      img.alt = "";
      img.width = 32;
      img.height = 32;
      img.draggable = false;
      face.appendChild(img);
      el.appendChild(face);
      frag.appendChild(el);

      return { el: el, x: 0, y: 0, vx: 0, vy: 0, sp: 0, spv: 0, tx: 0, ty: 0,
               bx: t.bx, by: t.by,
               lift: 0, rx: 0, ry: 0, rn: 0, calm: false, was: "" };
    });
    BOX.appendChild(frag);
  }

  /* --- Geometry --------------------------------------------------------- */

  function measure() {
    rect = BOX.getBoundingClientRect();
    H = rect.height;
    if (!H) return false;

    /* Everything is derived from the one dimension nobody is allowed to
       change: the height of the card. Three counters across the floor and
       two in the valleys over them has to fit inside it with air to spare,
       which sets the diameter, and the floor has to be too short to take a
       fourth, which sets the width. Get the width wrong in the generous
       direction and all five lie down in a row. */
    D = Math.round(clamp(H * 0.345, 32, 50));
    R = D / 2;
    BOX.style.setProperty("--d", D + "px");
    BOX.style.setProperty("--step", (D * 0.036).toFixed(2) + "px");
    BOX.style.setProperty("--toys-w", Math.round(H * 1.3) + "px");

    /* Read back, because the line above is what decides it. */
    rect = BOX.getBoundingClientRect();
    W = rect.width;
    return !!W;
  }

  /* --- Solver ----------------------------------------------------------- */

  function pair(a, b, impulse) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var over = D - dist;
    if (over <= 0) return;

    var nx = dx / dist, ny = dy / dist;
    /* A held counter is infinitely heavy. Dragging one has to be able to
       bulldoze the pile, not get shoved out of your hand by it. */
    var am = a === held ? 0 : 1, bm = b === held ? 0 : 1;
    var tot = am + bm;
    if (!tot) return;

    var corr = Math.max(0, over - 0.4) * 0.65;
    a.x -= nx * corr * (am / tot); a.y -= ny * corr * (am / tot);
    b.x += nx * corr * (bm / tot); b.y += ny * corr * (bm / tot);
    if (!impulse) return;

    var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
    var sep = rvx * nx + rvy * ny;
    if (sep > 0) return;

    var e = Math.abs(sep) < CALM ? 0 : REST;
    var k = -(1 + e) * sep / tot;
    a.vx -= nx * k * am; a.vy -= ny * k * am;
    b.vx += nx * k * bm; b.vy += ny * k * bm;

    /* Friction between the faces. Without it the counters are ice: one
       resting in the notch between the wall and the heap slides down the
       curve of its neighbour, gets pushed back out by the overlap
       correction, and creeps like that for the rest of the afternoon, which
       is a pile that never settles and a loop that never sleeps. Friction
       is also just what plastic does. */
    var tvx = rvx - nx * sep, tvy = rvy - ny * sep;
    var fr = 0.4 / tot;
    a.vx += tvx * fr * am; a.vy += tvy * fr * am;
    b.vx -= tvx * fr * bm; b.vy -= tvy * fr * bm;

    /* Rubbing past each other sets them spinning, which is the cheapest
       honest cue that these are objects and not sprites. Only a real rub,
       though: a resting contact grinds by a fraction of a pixel per substep
       and feeding that into the spin is how a settled pile ends up turning
       at 900 degrees a second forever. */
    var tan = -tvx * ny + tvy * nx;
    if (Math.abs(tan) > CALM / 2) {
      a.spv -= tan * 0.7 * am;
      b.spv -= tan * 0.7 * bm;
    }
  }

  function bounceX(a, dir) {
    if (Math.abs(a.vx) < CALM) { a.vx = 0; return; }
    a.spv += dir * a.vy * 0.5;
    a.vx = -a.vx * WALL;
  }

  function walls(a, impulse, dt) {
    var maxX = W - R - 6, maxY = H - R - 6;
    if (a.x < R + 6) {
      a.x = R + 6;
      if (impulse && a.vx < 0) bounceX(a, -1);
    } else if (a.x > maxX) {
      a.x = maxX;
      if (impulse && a.vx > 0) bounceX(a, 1);
    }
    if (a.y > maxY) {
      a.y = maxY;
      if (impulse) {
        if (a.vy > 0) {
          if (Math.abs(a.vy) < CALM) {
            a.vy = 0;
          } else {
            /* A real landing: it skids and it starts turning. */
            a.spv += a.vx * 0.6;
            a.vx *= 0.8;
            a.vy = -a.vy * WALL;
          }
        }
        /* Floor friction as a rate, not as a kick per contact. Weak on
           purpose: it has to lose to the sideways tilt, because the tilt is
           what walks a thrown counter back to the corner. Too strong and a
           fling just stops dead in the middle of the card. */
        a.vx *= Math.max(0, 1 - 2.4 * dt);
        a.spv *= Math.max(0, 1 - 6 * dt);
      }
    } else if (a.y < R + 6) {
      /* A lid. The box is closed on all four sides, which is the only way
         the geometry is guaranteed: nothing can ever come to rest outside
         the card, however hard it is thrown, and a hard throw bounces off
         the top instead of vanishing behind the clip. */
      a.y = R + 6;
      if (impulse && a.vy < 0) {
        if (Math.abs(a.vy) < CALM) {
          a.vy = 0;
        } else {
          a.spv -= a.vx * 0.6;
          a.vy = -a.vy * WALL;
        }
      }
    }
  }

  function step(dt) {
    var i, j, a, d = Math.max(0, 1 - AIR * dt);

    for (i = 0; i < toys.length; i++) {
      a = toys[i];
      /* A calm body does not integrate. This is the part that actually lets
         the loop stop: a wedged counter whose contact cancels gravity every
         substep still jitters by a tenth of a pixel while it is being
         integrated, and a tenth of a pixel is a repaint. Freezing it is
         also what is physically true, since it is not going anywhere.
         Anything that could disturb the pile calls wake() first, so there
         is no way for one to stay frozen in mid air. */
      if (a === held || a.calm) continue;
      a.vx = (a.vx + GX * dt) * d;
      a.vy = (a.vy + GY * dt) * d;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    }

    for (var it = 0; it < 3; it++) {
      for (i = 0; i < toys.length; i++) {
        for (j = i + 1; j < toys.length; j++) pair(toys[i], toys[j], it === 0);
      }
      for (i = 0; i < toys.length; i++) walls(toys[i], it === 0, dt);
    }

    for (i = 0; i < toys.length; i++) {
      a = toys[i];

      /* Snap to rest, measured in position rather than in velocity. A
         wedged pile always has a few px/s of sideways push left in it that
         the contacts cancel out, and no velocity test can tell that apart
         from something genuinely creeping. Position can: if it did not go
         anywhere, it is not going anywhere, and the number saying otherwise
         would keep the loop awake for the rest of the visit.

         Over a window of ten substeps, not one. One substep cannot tell a
         blocked counter from a free one just starting to slide, because
         both move about four hundredths of a pixel, and treating that as
         rest is infinite static friction: a thrown counter then freezes
         where it lands instead of walking back to the corner. In a twelfth
         of a second a free one has covered 2px and a blocked one 0.004px,
         which is a margin of four hundred. */
      if (a === held) { a.calm = false; a.rn = 0; a.rx = a.x; a.ry = a.y; }
      else if (++a.rn >= 10) {
        a.calm = Math.abs(a.x - a.rx) + Math.abs(a.y - a.ry) < 0.9;
        if (a.calm) { a.vx = 0; a.vy = 0; a.spv = 0; }
        a.rx = a.x;
        a.ry = a.y;
        a.rn = 0;
      }

      a.sp += a.spv * dt;
      a.spv *= Math.max(0, 1 - 2.4 * dt);

      /* The tumble. A counter banks into the direction it is travelling and
         comes back flat as it stops, so the rim swings in and out of view.
         This is the whole 3D performance and it is two smoothed numbers.
         A counter that has been judged at rest banks at nothing: left to
         read its own velocity it would hold a third of a degree of lean
         forever, from the gravity its contact is busy cancelling, and that
         third of a degree is enough to keep the paint flickering in the
         last decimal place and the loop awake on its account. */
      var wantY = a.calm ? 0 : clamp(a.vx * 0.030, -27, 27);
      var wantX = a.calm ? 0 : clamp(-a.vy * 0.024, -24, 24);
      if (a === held) { wantY *= 1.3; wantX *= 1.3; }
      var k = Math.min(1, dt * 9);
      a.ty += (wantY - a.ty) * k;
      a.tx += (wantX - a.tx) * k;
      a.lift += ((a === held ? 30 : 0) - a.lift) * Math.min(1, dt * 12);
    }
  }

  /* Everything that can disturb the pile goes through here first. Five
     bodies, so waking all of them is cheaper than working out which ones
     were leaning on which. */
  function wake() {
    for (var i = 0; i < toys.length; i++) { toys[i].calm = false; toys[i].rn = 0; }
  }

  function settle(n) {
    var i;
    for (i = 0; i < n; i++) step(1 / 120);
    for (i = 0; i < toys.length; i++) { toys[i].tx = 0; toys[i].ty = 0; toys[i].lift = 0; }
  }

  /* Returns whether anything on screen actually changed, which is both the
     thing that decides when to sleep and the thing that stops five style
     writes a frame going out for objects that are not moving. */
  function paint() {
    var changed = false;
    for (var i = 0; i < toys.length; i++) {
      var t = toys[i];
      /* Flat. Position and spin, nothing in Z. */
      var s =
        "translate3d(" + (t.x - R).toFixed(2) + "px," + (t.y - R).toFixed(2) + "px,0)" +
        " rotateZ(" + t.sp.toFixed(1) + "deg)";
      if (s === t.was) continue;
      t.was = s;
      t.el.style.transform = s;
      changed = true;
    }
    return changed;
  }

  /* --- The loop, which sleeps -------------------------------------------- */

  /* When to sleep. Not on velocity: a counter wedged in the pile carries a
     permanent 31px/s of downhill push that its contact spends every substep
     cancelling, so by the numbers this thing never stops, and the first
     build of it duly held 60fps for as long as the tab was open. The only
     criterion that cannot lie is whether the picture changed. If no toy's
     transform differs from the one already on it, there is nothing to draw,
     and twenty of those in a row means it is over.

     The second counter is a backstop against the first one flickering in
     its last decimal place: a frame where nothing moved by more than a
     fiftieth of a pixel is at rest whatever the rounding says. */
  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(0.034, (now - last) / 1000) : 1 / 60;
    last = now;

    var i, t, far = 0;
    for (i = 0; i < toys.length; i++) { t = toys[i]; t.sx = t.x; t.sy = t.y; }

    step(dt / 2);
    step(dt / 2);
    var drew = paint();

    for (i = 0; i < toys.length; i++) {
      t = toys[i];
      far = Math.max(far, Math.abs(t.x - t.sx) + Math.abs(t.y - t.sy));
    }

    if (held || drew) still = 0; else still++;
    if (held || far > 0.02) dead = 0; else dead++;
    if (still > 20 || dead > 60) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    still = 0;
    dead = 0;
    if (running || !inview || reduce.matches) return;
    running = true;
    last = 0;
    BOX.classList.add("is-awake");
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    still = 0;
    dead = 0;
    last = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    BOX.classList.remove("is-awake");
  }

  /* --- Seeding ----------------------------------------------------------- */

  function seed(fromAbove) {
    for (var i = 0; i < toys.length; i++) {
      var t = toys[i];
      t.vx = 0; t.vy = 0; t.spv = 0; t.tx = 0; t.ty = 0; t.lift = 0;
      t.rn = 0; t.calm = false; t.rx = 0; t.ry = 0;
      t.sp = (i % 2 ? 1 : -1) * (5 + i * 4);
      if (fromAbove) {
        /* Strung along the lid and let go. The box is closed, so they fall
           from inside it: about 85px, which at this gravity is a third of a
           second, enough for a bounce and a spin and not enough to be a
           performance. They then funnel into the corner on their own. */
        t.x = clamp(W - R - 10 - i * (D * 1.4), R + 6, W - R - 6);
        t.y = R + 6 + (i % 2) * 5;
        t.vx = 240 + i * 50;
        t.spv = (i % 2 ? -1 : 1) * (380 + i * 110);
      } else {
        t.x = W - R - 6 - (i % 3) * (D * 0.94);
        t.y = H - R - 6 - ((i / 3) | 0) * (D * 0.88);
      }
    }
  }

  function reflow() {
    if (!measure()) return;
    for (var i = 0; i < toys.length; i++) {
      toys[i].x = clamp(toys[i].x, R + 6, Math.max(R + 6, W - R - 6));
      toys[i].y = Math.min(toys[i].y, H - R - 6);
    }
    /* A resize is not an animation. Resolve the new box without frames. */
    wake();
    settle(180);
    paint();
  }

  /* --- Pointer ----------------------------------------------------------- */

  function local(ev) {
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  function find(ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest(".toy") : null;
    if (!el) return null;
    for (var i = 0; i < toys.length; i++) if (toys[i].el === el) return toys[i];
    return null;
  }

  function onDown(ev) {
    var t = find(ev);
    if (!t) return;

    rect = BOX.getBoundingClientRect();
    var p = local(ev);
    held = t;
    t.gx = p.x - t.x;
    t.gy = p.y - t.y;
    t.at = ev.timeStamp;
    t.t0 = ev.timeStamp;
    t.moved = 0;
    t.vx = 0;
    t.vy = 0;
    wake();
    t.el.classList.add("is-held");
    /* Last in the pile paints last, so the one in your hand is on top. */
    BOX.appendChild(t.el);
    try { t.el.setPointerCapture(ev.pointerId); } catch (e) {}
    start();
    ev.preventDefault();
  }

  function onMove(ev) {
    if (!held) return;
    var t = held;
    var p = local(ev);
    var nx = clamp(p.x - t.gx, R, Math.max(R, W - R));
    /* You cannot drag one out of the box. The hand is inside the walls. */
    var ny = clamp(p.y - t.gy, R + 6, Math.max(R + 6, H - R - 6));
    var dt = Math.max(0.008, (ev.timeStamp - t.at) / 1000);
    /* Smoothed, because one frame of pointer delta is noise, and a throw
       built on noise flies off in a direction you did not choose. */
    t.vx = t.vx * 0.35 + ((nx - t.x) / dt) * 0.65;
    t.vy = t.vy * 0.35 + ((ny - t.y) / dt) * 0.65;
    t.moved += Math.abs(nx - t.x) + Math.abs(ny - t.y);
    t.x = nx;
    t.y = ny;
    t.at = ev.timeStamp;
    start();
    ev.preventDefault();
  }

  function onUp(ev) {
    if (!held) return;
    var t = held;
    held = null;
    wake();
    t.el.classList.remove("is-held");

    if (t.moved < 8 && ev.timeStamp - t.t0 < 330) {
      /* A tap, not a drag. Pop it out of the pile and let it fall back. */
      t.vy = -820 - Math.random() * 240;
      t.vx = (Math.random() - 0.5) * 540;
      t.spv = (Math.random() - 0.5) * 1000;
    } else {
      t.vx = clamp(t.vx, -2600, 2600);
      t.vy = clamp(t.vy, -2600, 2600);
      t.spv += t.vx * 1.3;
    }
    start();
  }

  function listen() {
    BOX.addEventListener("pointerdown", onDown);
    BOX.addEventListener("pointermove", onMove);
    BOX.addEventListener("pointerup", onUp);
    BOX.addEventListener("pointercancel", onUp);
    BOX.addEventListener("lostpointercapture", onUp);
    BOX.addEventListener("dragstart", function (ev) { ev.preventDefault(); });

    if (hoverable.matches) {
      BOX.addEventListener("pointerover", function (ev) {
        var t = find(ev);
        if (t) t.el.classList.add("is-hot");
      });
      BOX.addEventListener("pointerout", function (ev) {
        var t = find(ev);
        if (t) t.el.classList.remove("is-hot");
      });
    }

    /* The box moves under the pointer when the page scrolls, and a mouse
       drag can outlive a wheel scroll. Keep the frame of reference honest. */
    window.addEventListener("scroll", function () {
      if (held) rect = BOX.getBoundingClientRect();
    }, { passive: true });

    if ("ResizeObserver" in window) {
      var seen = 0;
      new ResizeObserver(function () {
        var now = Math.round(BOX.clientWidth) * 10000 + Math.round(BOX.clientHeight);
        if (now === seen) return;
        seen = now;
        reflow();
      }).observe(BOX);
    }
  }

  /* --- Boot -------------------------------------------------------------- */

  function boot() {
    build();
    if (measure()) { ready(); return; }
    /* The card has no size yet. One more frame, and if it still has none,
       take the counters back out: .toybox:empty is display:none, so the
       card returns to exactly what it is without this, rather than keeping
       five unplaced discs heaped in its top corner. */
    requestAnimationFrame(function () {
      if (measure()) ready();
      else { BOX.textContent = ""; toys = []; }
    });
  }

  function ready() {
    if (reduce.matches) {
      /* Still a real pile: the solver runs, it just runs once, with no
         frames, no listeners and nothing left that can move. */
      seed(false);
      settle(420);
      paint();
      BOX.classList.add("is-still");
      return;
    }

    seed(false);
    settle(300);
    paint();
    listen();

    var card = document.querySelector(".a-intro");
    if (!("IntersectionObserver" in window) || !card) {
      inview = true;
      dropped = true;
      return;
    }

    new IntersectionObserver(function (es) {
      inview = es[0].isIntersecting;
      if (!inview) {
        /* Off screen is no place to spend frames. Resolve where it was
           going and freeze it there, so coming back finds a settled pile.
           Anything still in hand is let go first: a wheel scroll can carry
           the card away mid-drag, and a held counter whose pointer keeps
           moving against a stopped loop would come back painted somewhere
           its own simulation had long since left. */
        if (held) { held.el.classList.remove("is-held"); held = null; wake(); }
        if (running) { settle(240); paint(); stop(); }
        return;
      }
      if (!dropped) {
        /* They arrive by falling in. That is the only announcement this
           interaction gets, and it is the right one: it says these things
           obey gravity, so your hand will work on them. */
        dropped = true;
        seed(true);
        start();
      }
    }, { threshold: 0.2 }).observe(card);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
