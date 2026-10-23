/* ===========================================================================
   NOTEBOOK
   Loaded after assets/swiss.js on all nine pages. Three things live here and
   none of them knows about the others: the footer clock, the sketch pile on
   the case studies, and Ask Rish.

   No library. Nothing here is frame-driven, so there is no rAF loop to be
   starved in headless and no GSAP to pay for.
   =========================================================================== */

(function () {
  "use strict";


  /* -------------------------------------------------------------------------
     1. THE FOOTER CLOCK  (spec 7.7)

     The markup ships hidden and this unhides it, so a visitor with no JS
     never sees "Bengaluru (BLR), India  IST" with a hole in the middle.

     aria-live="off" is on the <time> in the markup. Without it a screen
     reader in some configurations reads the whole footer line once a second.
     ------------------------------------------------------------------------- */

  function clock() {
    var host = document.querySelector("[data-clock]");
    if (!host) return;
    var out = host.querySelector("time");
    if (!out) return;

    var fmt;
    try {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false
      });
      // Prove the time zone resolved before unhiding. An ICU build without
      // Asia/Kolkata throws here, and a clock labelled IST showing the
      // visitor's own local time is worse than no clock.
      fmt.format(new Date());
    } catch (e) {
      return;
    }

    var timer = null;

    function tick() {
      var now = new Date();
      out.textContent = fmt.format(now);
      out.setAttribute("datetime", now.toISOString());
    }

    function start() {
      if (timer) return;
      tick();
      timer = setInterval(tick, 1000);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    tick();
    host.hidden = false;
    start();

    // A clock nobody is looking at does not need to tick.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }


  /* -------------------------------------------------------------------------
     2. THE SKETCH PILE

     The scanned wireframe sheets on supaca.html and vistlabs.html. Depth is
     one number per sheet, --i, 0 being the sheet on top. Going forward adds 1
     to every sheet and wraps, which takes the top sheet to the back.

     The DOM order never changes. That is the whole point of doing it with a
     custom property: a screen reader walks the sheets in the order they were
     drawn, every sheet stays reachable whatever is on top, and nothing moves
     out from under a focused element.

     The controls ship hidden in the markup and are unhidden here, the same
     way the clock is, so a visitor with no JS gets a static pile rather than
     a counter and two arrows that do nothing.
     ------------------------------------------------------------------------- */

  function pile(fig) {
    var stack = fig.querySelector("[data-pile-stack]");
    var sheets = stack ? stack.querySelectorAll(".nb-pile__sheet") : [];
    var n = sheets.length;
    if (n < 2) return;

    var bar = fig.querySelector("[data-pile-bar]");
    var at = fig.querySelector("[data-pile-at]");
    var top = 0;

    function paint() {
      for (var k = 0; k < n; k++) {
        // How far sheet k now sits below the one on top, wrapped.
        sheets[k].style.setProperty("--nbp-i", (k - top + n) % n);
      }
      if (at) at.textContent = top + 1;
    }

    function go(step) {
      top = (top + step + n) % n;
      paint();
    }

    paint();

    if (bar) {
      bar.hidden = false;
      var prev = bar.querySelector("[data-pile-prev]");
      var next = bar.querySelector("[data-pile-next]");
      if (prev) prev.addEventListener("click", function () { go(-1); });
      if (next) next.addEventListener("click", function () { go(1); });
    }

    // A tap anywhere on the pile takes the top sheet to the back. The
    // attribute is what puts the pointer cursor on, so the affordance can
    // never be shown on a page where this listener did not attach.
    stack.setAttribute("data-pile-tap", "");
    stack.addEventListener("click", function () { go(1); });

    // Left and right while the focus is anywhere in the figure. Only claimed
    // when the pile actually handles the key, so Home, End and tabbing are
    // left to the browser.
    fig.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
      else if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
    });
  }

  function piles() {
    var figs = document.querySelectorAll("[data-pile]");
    for (var i = 0; i < figs.length; i++) pile(figs[i]);
  }

  function boot() {
    clock();
    piles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}());
