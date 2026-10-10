/* Homepage behaviour. Two things only: the tagline hover clusters, and a
   one-time entry reveal. No scroll hijacking, no smooth-scroll library,
   no parallax. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- The tagline clusters -------------------------------------------
     Items spring out of the word in an arc above it, staggered, and settle
     back when the pointer leaves. The arc is laid out here rather than in
     CSS because each word has a different number of items. */

  function clusters() {
    var line = document.querySelector(".tagline");
    if (!line) return;

    var words = Array.prototype.slice.call(line.querySelectorAll(".w"));
    if (!words.length) return;

    var SPREAD = 150;   /* degrees of arc */
    var STAGGER = 40;   /* ms between items on the way in */

    words.forEach(function (w) {
      var items = Array.prototype.slice.call(w.querySelectorAll(".cluster b"));
      if (!items.length) return;

      /* Radius grows a little with the count so a six-item cluster does
         not crowd itself. */
      var radius = 48 + Math.min(items.length, 6) * 4;

      items.forEach(function (el, i) {
        var t = items.length === 1 ? 0.5 : i / (items.length - 1);
        var deg = -90 - SPREAD / 2 + SPREAD * t;
        var rad = deg * Math.PI / 180;
        el.style.setProperty("--dx", Math.cos(rad) * radius + "px");
        el.style.setProperty("--dy", Math.sin(rad) * radius + "px");
      });

      function open() {
        words.forEach(function (o) { if (o !== w) o.classList.remove("is-on"); });
        w.classList.add("is-on");
        line.classList.add("is-focused");
        if (reduce) return;
        items.forEach(function (el, i) { el.style.transitionDelay = (i * STAGGER) + "ms"; });
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

      /* Keyboard reaches it, and on touch a tap toggles. */
      w.addEventListener("focus", open);
      w.addEventListener("blur", close);
      w.addEventListener("click", function (e) {
        e.preventDefault();
        if (w.classList.contains("is-on")) close(); else open();
      });
    });

    /* A tap anywhere else closes whatever is open. */
    document.addEventListener("click", function (e) {
      if (!line.contains(e.target)) {
        words.forEach(function (w) { w.classList.remove("is-on"); });
        line.classList.remove("is-focused");
      }
    });
  }

  /* --- Entry reveal, once ---------------------------------------------- */

  function rise() {
    var els = document.querySelectorAll(".rise");
    if (!els.length) return;

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        /* Stagger within a group, then stop observing: once, never again. */
        var i = Number(e.target.getAttribute("data-i") || 0);
        e.target.style.transitionDelay = (i * 60) + "ms";
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });

    els.forEach(function (el) { io.observe(el); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    clusters();
    rise();
  });
})();
