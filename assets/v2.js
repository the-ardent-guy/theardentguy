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
  }

  /* --- 4. The tagline clusters ------------------------------------------
     The tagline is one line of plain text in the markup, so the phrases are
     wrapped here rather than hand-split in HTML. That keeps the copy a
     single readable sentence in the source and for anything that does not
     run JS. */

  var CLUSTERS = {
    "Product Designer.": [
      { logo: "figma.svg", label: "Figma" },
      { slot: "tools TBC" }
    ],
    "Builder.": [
      { logo: "cursor.svg", label: "Cursor" },
      { logo: "claude.svg", label: "Claude" },
      { logo: "shopify.svg", label: "Shopify" },
      { logo: "n8n.svg", label: "n8n" },
      { logo: "make.svg", label: "Make" }
    ],
    /* Rishabh's own drawings. Slots until the SVGs exist. */
    "Illustrator.": [{ slot: "pen" }, { slot: "brush" }, { slot: "character" }],
    "Maladaptive Daydreamer.": [{ slot: "cloud" }, { slot: "cloud" }, { slot: "cloud" }]
  };

  function tagline() {
    var line = document.querySelector(".intro__roles") || document.querySelector(".intro__lead");
    if (!line) return;

    var phrases = Object.keys(CLUSTERS);
    var text = line.textContent.trim();
    /* Only rebuild if the copy is still exactly the four phrases. If it
       changed, leave it alone rather than mangle it. */
    if (text !== phrases.join(" ")) return;

    line.textContent = "";
    phrases.forEach(function (p, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w";
      btn.appendChild(document.createTextNode(p));

      var cl = document.createElement("span");
      cl.className = "v2-cluster";
      cl.setAttribute("aria-hidden", "true");

      CLUSTERS[p].forEach(function (item) {
        var b = document.createElement("b");
        if (item.logo) {
          var img = document.createElement("img");
          img.src = "/assets/logos/" + item.logo;
          img.alt = "";
          img.width = 28; img.height = 28;
          b.appendChild(img);
        } else {
          b.className = "v2-slot";
          b.textContent = item.slot;
        }
        cl.appendChild(b);
      });

      btn.appendChild(cl);
      line.appendChild(btn);
      if (idx < phrases.length - 1) line.appendChild(document.createTextNode(" "));
    });

    var words = Array.prototype.slice.call(line.querySelectorAll(".w"));
    var SPREAD_DEG = 150, STAGGER = 40;

    words.forEach(function (w) {
      var items = Array.prototype.slice.call(w.querySelectorAll(".v2-cluster b"));
      var radius = 48 + Math.min(items.length, 6) * 4;   /* 48 to 72px */

      items.forEach(function (el, i) {
        var t = items.length === 1 ? 0.5 : i / (items.length - 1);
        var rad = (-90 - SPREAD_DEG / 2 + SPREAD_DEG * t) * Math.PI / 180;
        el.style.setProperty("--dx", Math.round(Math.cos(rad) * radius) + "px");
        el.style.setProperty("--dy", Math.round(Math.sin(rad) * radius) + "px");
      });

      function open() {
        words.forEach(function (o) { if (o !== w) o.classList.remove("is-on"); });
        w.classList.add("is-on");
        line.classList.add("is-focused");
        if (!reduce) items.forEach(function (el, i) { el.style.transitionDelay = (i * STAGGER) + "ms"; });
      }

      function close() {
        w.classList.remove("is-on");
        line.classList.remove("is-focused");
        items.forEach(function (el) { el.style.transitionDelay = "0ms"; });
      }

      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        w.addEventListener("mouseenter", open);
        w.addEventListener("mouseleave", close);
      }
      w.addEventListener("focus", open);
      w.addEventListener("blur", close);
      w.addEventListener("click", function (e) {
        e.preventDefault();
        if (w.classList.contains("is-on")) close(); else open();
      });
    });

    document.addEventListener("click", function (e) {
      if (!line.contains(e.target)) {
        words.forEach(function (w) { w.classList.remove("is-on"); });
        line.classList.remove("is-focused");
      }
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

    function paint() {
      order.forEach(function (c, i) {
        c.classList.remove("is-front", "is-mid", "is-back");
        c.classList.add(i === 0 ? "is-front" : i === order.length - 1 ? "is-back" : "is-mid");
        c.setAttribute("aria-hidden", i === 0 ? "false" : "true");
        c.tabIndex = i === 0 ? 0 : -1;
      });
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
