/* ===========================================================================
   REDO — the quiet custom cursor
   2026-10-23. Loaded last. A solid dot that lags a little, grows on anything
   interactive, and flips to white over the black work panel. It adds nothing
   to the page on touch devices or under reduced motion, and it never traps a
   real cursor: if anything here fails, the native pointer is still there.
   =========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;

  var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduce) return;   // touch / coarse / reduced-motion: native cursor

  var dot = document.createElement("div");
  dot.className = "cursor";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);
  root.classList.add("has-cursor");

  var x = window.innerWidth / 2, y = window.innerHeight / 2;
  var tx = x, ty = y, raf = null;

  function render() {
    raf = null;
    // light lerp so the dot trails the pointer instead of snapping
    x += (tx - x) * 0.28;
    y += (ty - y) * 0.28;
    dot.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)";
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) {
      raf = window.requestAnimationFrame(render);
    }
  }
  function kick() { if (!raf) raf = window.requestAnimationFrame(render); }

  window.addEventListener("mousemove", function (e) {
    tx = e.clientX; ty = e.clientY;
    if (!dot.classList.contains("is-on")) dot.classList.add("is-on");
    kick();
  }, { passive: true });

  // Leave the window: hide it, so it is never parked in a corner.
  document.addEventListener("mouseleave", function () { dot.classList.remove("is-on"); });
  document.addEventListener("mouseenter", function () { dot.classList.add("is-on"); });

  var HOT = "a, button, [role='button'], .mcard, input, textarea, select, summary, label[for]";

  // Grow over interactive targets; flip white while the pointer is inside the
  // black work panel. One delegated listener, no per-element binding.
  document.addEventListener("mouseover", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(HOT)) dot.classList.add("is-hot");
    if (t && t.closest && t.closest(".work--black, .endmark")) {
      // endmark is white ground -> dark dot; black panel -> white dot
      dot.classList.toggle("on-dark", !!t.closest(".work--black"));
    }
  });
  document.addEventListener("mouseout", function (e) {
    var t = e.target;
    if (t && t.closest && t.closest(HOT) && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(HOT))) {
      dot.classList.remove("is-hot");
    }
    if (t && t.closest && t.closest(".work--black") &&
        !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(".work--black"))) {
      dot.classList.remove("on-dark");
    }
  });
}());
