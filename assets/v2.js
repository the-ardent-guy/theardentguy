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

