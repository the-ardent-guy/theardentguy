/* Design pass v2. Additive only: the grain layer, the ink blot transition
   and the tagline clusters. Vanilla, because the site has no build step and
   nothing here needs a library. The one thing a library would buy is a real
   spring, and a single overshoot curve gets close enough to be worth not
   shipping 40KB for it. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- 1. The grain layer, and the blot's rough edge -------------------- */

  function scaffold() {
    if (!document.querySelector(".v2-grain")) {
      var g = document.createElement("div");
      g.className = "v2-grain";
      g.setAttribute("aria-hidden", "true");
      document.body.appendChild(g);
    }

    if (!document.getElementById("v2-blotedge")) {
      var ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("class", "v2-blot__defs");
      svg.setAttribute("aria-hidden", "true");
      svg.innerHTML =
        '<filter id="v2-blotedge">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>' +
        "</filter>";
      document.body.appendChild(svg);
    }
  }

  /* --- 3. The ink blot --------------------------------------------------
     Spread from the click point, a short hold, then the page loads and the
     ink clears. Navigation is never blocked: if the next page is slow the
     ink clears anyway and the browser carries on. */

  var SPREAD = 500, HOLD = 100, CLEAR = 400, GIVE_UP = 1500;

  function blotEl() {
    var b = document.querySelector(".v2-blot");
    if (!b) {
      b = document.createElement("div");
      b.className = "v2-blot";
      b.setAttribute("aria-hidden", "true");
      document.body.appendChild(b);
    }
    return b;
  }

  function sameOrigin(a) {
    return a && a.href && a.origin === location.origin &&
           !a.hasAttribute("download") && a.target !== "_blank";
  }

  function inkTo(href, x, y) {
    var b = blotEl();
    b.style.setProperty("--bx", x + "px");
    b.style.setProperty("--by", y + "px");
    b.classList.remove("is-clearing");
    /* reflow so the animation restarts cleanly */
    void b.offsetWidth;
    b.classList.add("is-spreading");

    var went = false;
    function go() { if (!went) { went = true; location.href = href; } }

    setTimeout(go, (reduce ? 200 : SPREAD) + HOLD);
    /* Hard stop. Never leave someone looking at a black screen. */
    setTimeout(function () {
      if (!went) { b.classList.remove("is-spreading"); go(); }
    }, GIVE_UP);
  }

  function transitions() {
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a") : null;
      if (!sameOrigin(a)) return;

      var url = new URL(a.href);
      if (url.pathname === location.pathname) return;   /* in-page anchor */
      /* Only into a case study, which is what the brief asks for. */
      if (!/\.html$/.test(url.pathname) && url.pathname !== "/") return;

      e.preventDefault();
      inkTo(a.href, e.clientX, e.clientY);
    });

    /* Arriving: clear the ink to reveal the page. Back navigation plays
       this half only, which is what a bfcache restore gives us for free. */
    window.addEventListener("pageshow", function () {
      var b = document.querySelector(".v2-blot");
      if (!b) return;
      b.classList.remove("is-spreading");
      b.classList.add("is-clearing");
      setTimeout(function () { b.remove(); }, (reduce ? 200 : CLEAR) + 60);
    });
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
    var line = document.querySelector(".intro__lead");
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
    transitions();
    tagline();
  });
})();
