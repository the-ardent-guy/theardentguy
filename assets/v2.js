/* Design pass v2. Additive only: the grain layer and the tagline clusters.
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

    if (!document.querySelector(".shaft")) {
      var sh = document.createElement("div");
      sh.className = "shaft";
      sh.setAttribute("aria-hidden", "true");
      sh.innerHTML =
        '<svg viewBox="0 0 56 16" fill="none" stroke="currentColor" stroke-linecap="round">' +
        '<path d="M2 8 H54" stroke-width="2"/>' +
        '<path d="M46 2 L54 8 L46 14" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M2 8 L9 3" stroke-width="1.5"/><path d="M2 8 L9 13" stroke-width="1.5"/>' +
        "</svg>";
      document.body.appendChild(sh);
    }
  }

  /* --- 4. The tagline clusters ------------------------------------------
     The tagline is one line of plain text in the markup, so the phrases are
     wrapped here rather than hand-split in HTML. That keeps the copy a
     single readable sentence in the source and for anything that does not
     run JS. */

  /* --- The phrases, the marks and the arrow ---------------------------
     The three phrases become buttons. Hovering one lights its own marks
     and dims the others. Illustrator has no marks, so it gets the arrow
     instead: see the comment on .shaft in v2.css for why an arrow and not
     a logo. */

  var PHRASES = ["Product Designer.", "Builder.", "Illustrator."];
  var ARROW_ROW = 2;          /* Illustrator */
  var FULL_FLIGHTS = 2;       /* then a short drop, so it stops demanding attention */
  var RATE_MS = 400;          /* ignore re-entry inside this, for a jittering cursor */

  var flights = 0, lastAngle = null, lastFire = 0;

  function pickAngle() {
    var a, d;
    do {
      a = Math.random() * 360;
      d = Math.abs(a - lastAngle);
      if (d > 180) d = 360 - d;
    } while (lastAngle !== null && d < 60);
    lastAngle = a;
    return a;
  }

  function strike(x, y) {
    var el = document.querySelector(".shaft");
    if (!el) return;

    var now = Date.now();
    if (now - lastFire < RATE_MS) return;
    lastFire = now;

    var deg = pickAngle();
    var rad = deg * Math.PI / 180;
    var full = flights < FULL_FLIGHTS;
    var dist = full ? 1.15 * Math.max(innerWidth, innerHeight) : 64;
    flights++;

    var sx = x + Math.cos(rad) * dist;
    var sy = y + Math.sin(rad) * dist;
    var spin = "rotate(" + (deg + 180) + "deg)";

    if (reduce) {
      /* No projectile. It is simply already landed. */
      el.style.transition = "none";
      el.style.transform = "translate(" + x + "px," + y + "px) " + spin;
      el.style.opacity = "1";
      return;
    }

    el.style.transition = "none";
    el.style.transform = "translate(" + sx + "px," + sy + "px) " + spin +
                         " scaleX(" + (full ? 1.5 : 1.2) + ")";
    el.style.opacity = "0";
    void el.offsetWidth;   /* commit the start state before animating off it */

    el.style.transition = "transform " + (full ? 340 : 220) +
                          "ms cubic-bezier(.34,1.56,.64,1), opacity " +
                          (full ? 80 : 100) + "ms linear";
    el.style.transform = "translate(" + x + "px," + y + "px) " + spin + " scaleX(1)";
    el.style.opacity = "1";
  }

  function unstrike() {
    var el = document.querySelector(".shaft");
    if (!el) return;
    el.style.transition = "opacity 160ms linear";
    el.style.opacity = "0";
  }

  function tagline() {
    var line = document.querySelector(".intro__roles");
    var marks = document.getElementById("marks");
    if (!line) return;

    var text = line.textContent.trim();
    /* Keyed to the phrase list, so editing the sentence disables this
       rather than mangling it. */
    if (text !== PHRASES.join(" ")) return;

    line.textContent = "";
    PHRASES.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "w";
      b.setAttribute("data-row", i);
      b.textContent = p;
      line.appendChild(b);
      if (i < PHRASES.length - 1) line.appendChild(document.createTextNode(" "));
    });

    var words = Array.prototype.slice.call(line.querySelectorAll(".w"));
    var fine = window.matchMedia("(min-width: 1100px) and (hover: hover) and (pointer: fine)");

    function open(w, x, y) {
      words.forEach(function (o) { o.classList.toggle("is-on", o === w); });
      line.classList.add("is-focused");
      var row = Number(w.getAttribute("data-row"));
      if (marks) marks.setAttribute("data-on", row);
      if (row === ARROW_ROW && fine.matches) {
        if (typeof x !== "number") {
          var r = w.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        }
        strike(x, y);
      }
    }

    function close() {
      words.forEach(function (o) { o.classList.remove("is-on"); });
      line.classList.remove("is-focused");
      if (marks) marks.removeAttribute("data-on");
      unstrike();
    }

    words.forEach(function (w) {
      if (fine.matches) {
        w.addEventListener("mouseenter", function (e) { open(w, e.clientX, e.clientY); });
        w.addEventListener("mouseleave", close);
      }
      w.addEventListener("focus", function () { open(w); });
      w.addEventListener("blur", close);
      w.addEventListener("click", function (e) {
        e.preventDefault();
        if (w.classList.contains("is-on")) close(); else open(w, e.clientX, e.clientY);
      });
    });

    document.addEventListener("click", function (e) {
      if (!line.contains(e.target)) close();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    scaffold();
    tagline();
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

/* The clock on the photograph. His time, not the reader's, so someone in
   another timezone sees what time it is where he is. */
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var el = document.getElementById("localTime");
    if (!el) return;

    function tick() {
      var t;
      try {
        t = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(new Date());
      } catch (e) {
        /* No timezone data: drop the clock rather than show the wrong hour. */
        var row = el.closest(".now__time");
        if (row) row.remove();
        return;
      }
      el.textContent = t;
      el.setAttribute("datetime", t);
    }

    tick();
    /* Line up with the next minute, then once a minute after that. */
    setTimeout(function () {
      tick();
      setInterval(tick, 60000);
    }, (60 - new Date().getSeconds()) * 1000);
  });
})();
