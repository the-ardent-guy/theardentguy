/* ===========================================================================
   HOME, 2026-10-23
   Loaded only by index.html, after swiss.js and notebook.js. Three jobs,
   three closures, and each one leaves the page alone if the thing it looks
   for is not there.

     1  the floating nav arrives when the banner leaves
     2  the project details drift up as their row crosses the screen
     3  the whole screen takes on the colour of whichever project is being
        read

   Jobs 2 and 3 share one rAF-throttled scroll pass, because they both need
   the same measurement. Geometry is read once per frame into a cache and
   the writes happen after every read, so there is no read-write-read inside
   the loop.
   =========================================================================== */

(function () {
  "use strict";

  var root = document.documentElement;

  function reduced() {
    return window.matchMedia &&
           window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }


  /* -------------------------------------------------------------------------
     1. THE NAV

     It belongs to the work, not to the photograph. The banner is the
     observed element: while any part of it is on screen the nav stays away,
     and the moment it has gone the nav drops in.

     No IntersectionObserver, or no banner, means it is simply shown. The
     CSS hides it only under :root.js, so a page with no script at all never
     reaches this state either way.
     ------------------------------------------------------------------------- */

  function nav() {
    var bar = document.querySelector("[data-fnav]");
    if (!bar) return;

    var banner = document.querySelector(".banner");
    if (!banner || !("IntersectionObserver" in window)) {
      bar.classList.add("is-up");
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      bar.classList.toggle("is-up", !entries[0].isIntersecting);
    }, { threshold: 0, rootMargin: "-56px 0px 0px 0px" });

    io.observe(banner);
  }


  /* -------------------------------------------------------------------------
     2 AND 3. THE SCROLL PASS

     RISE. For each row, p is where its centre sits relative to the centre of
     the screen, as a fraction of the screen height: +1 means a full screen
     below the middle, -1 a full screen above. The words are moved by
     p * RISE pixels, clamped to the row itself so a very tall row never
     throws its words out of it. Positive p puts the words low, so as the
     row rises through the screen p falls and the words travel upward and
     land level with their picture at the centre. That is the whole effect.

     SHADE. The row whose centre is nearest the middle of the screen wins,
     but only while it is actually near it: past LIVE_BAND the page goes
     back to no tint rather than holding the last project's colour over the
     footer. The winner's colour is read off the row's own --dot, which is
     already set per project in the markup and already flips with the theme,
     so dark mode needs no second table here.
     ------------------------------------------------------------------------- */

  var RISE = 44;        /* pixels, each way */
  var LIVE_BAND = 0.62; /* how far from centre a row can be and still own the page */

  function motion() {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".prow[data-tint]"));
    if (!rows.length) return;

    var shade = document.querySelector(".shade");
    var still = reduced();
    var ticking = false;
    var liveRow = null;
    var liveTint = "";

    function pass() {
      ticking = false;

      var vh = window.innerHeight || root.clientHeight;
      var mid = vh / 2;

      /* --- read --- */
      var reads = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        reads.push({
          row: rows[i],
          p: (r.top + r.height / 2 - mid) / vh,
          h: r.height,
          on: r.bottom > 0 && r.top < vh
        });
      }

      /* --- decide --- */
      var best = null;
      for (var j = 0; j < reads.length; j++) {
        var d = Math.abs(reads[j].p);
        if (d <= LIVE_BAND && (!best || d < Math.abs(best.p))) best = reads[j];
      }

      /* --- write --- */
      for (var k = 0; k < reads.length; k++) {
        var it = reads[k];
        if (still) {
          it.row.style.removeProperty("--rise");
        } else if (it.on) {
          /* Clamped twice: to RISE, and to a quarter of the row, so the
             words can never drift past the picture they belong to. */
          var cap = Math.min(RISE, it.h / 4);
          var rise = Math.max(-cap, Math.min(cap, it.p * RISE));
          it.row.style.setProperty("--rise", rise.toFixed(1));
        } else {
          it.row.style.setProperty("--rise", "0");
        }
      }

      var nextRow = best ? best.row : null;
      if (nextRow !== liveRow) {
        if (liveRow) liveRow.classList.remove("is-live");
        if (nextRow) nextRow.classList.add("is-live");
        liveRow = nextRow;

        var tint = nextRow ? nextRow.getAttribute("data-tint") : "";
        if (tint !== liveTint) {
          liveTint = tint;
          if (shade) {
            shade.style.backgroundColor = tint
              ? "color-mix(in srgb, var(--dot-" + tint + ") var(--shade-strength), transparent)"
              : "transparent";
          }
        }
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(pass);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    /* If the setting is changed mid-session the words stop where they are
       on the next frame rather than at the next scroll. */
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      var onPref = function () { still = reduced(); onScroll(); };
      if (mq.addEventListener) mq.addEventListener("change", onPref);
      else if (mq.addListener) mq.addListener(onPref);
    }

    pass();
  }


  /* -------------------------------------------------------------------------
     Guard. color-mix is what the shade is built out of; a browser without it
     gets the page with no tint rather than a literal "color-mix(...)" string
     sitting in a style attribute and being ignored. Everything else still
     runs.
     ------------------------------------------------------------------------- */

  function start() {
    nav();
    if (window.CSS && CSS.supports && CSS.supports("color", "color-mix(in srgb, #000 7%, transparent)")) {
      motion();
    } else {
      var rows = document.querySelectorAll(".prow[data-tint]");
      if (rows.length && !reduced()) motion0(rows);
    }
  }

  /* The same pass with the shade left out. Kept separate rather than
     branched inside the loop, so the common path has no test in it. */
  function motion0(rows) {
    var ticking = false;
    function pass() {
      ticking = false;
      var vh = window.innerHeight || root.clientHeight;
      var reads = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        reads.push({ row: rows[i], p: (r.top + r.height / 2 - vh / 2) / vh, h: r.height, on: r.bottom > 0 && r.top < vh });
      }
      for (var k = 0; k < reads.length; k++) {
        var it = reads[k];
        var cap = Math.min(RISE, it.h / 4);
        it.row.style.setProperty("--rise", it.on ? Math.max(-cap, Math.min(cap, it.p * RISE)).toFixed(1) : "0");
      }
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(pass);
    }, { passive: true });
    pass();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
