/* ===========================================================================
   DESSERTS — CLICK TO ZOOM
   2026-10-28. There is no hover behaviour on this page. You click a work
   and it zooms; that is the whole interaction.

   The zoom is a FLIP: the opened artwork is laid out at its final size
   first, then transformed back onto the exact rectangle of the card you
   clicked, and released. So the thing that grows is the artwork itself
   travelling from where it sat to where it is going, not a dialog fading
   in over it. Closing runs the same move in reverse.

   THE SIZE IS COMPUTED HERE, NOT IN CSS, and that is the important part.
   CSS cannot fit a replaced element into a box without distorting it
   once a width has been stated: max-width clamps the width, max-height
   clamps the height, and with a stated width the two do not cooperate —
   the height gets cut and the width stays, so a tall drawing comes out
   squashed. Measured before this was fixed: the valley drawing was 79%
   too wide. So the artwork sits in a shell whose width AND height are
   both derived from the work's true ratio, and the image fills that
   shell exactly. It cannot be out of shape.

   Two further details that are deliberate:

   - The zoomed image starts on whichever file the grid already has in
     cache, so it has something to show immediately, and the
     full-resolution file is fetched in the background and swapped in
     once decoded. Pointing it straight at the full file would mean a
     zoom that animates from an empty box.

   - The page scroll is locked while the zoom is open and unlocked BEFORE
     the closing measurement is taken, so the card can be brought back
     into view and the artwork lands on it instead of flying off to a
     position that is no longer there.
   =========================================================================== */
(function () {
  "use strict";

  var wall = document.querySelector("[data-dwall]");
  if (!wall) return;

  var cards = Array.prototype.slice.call(wall.querySelectorAll(".bt"));
  if (!cards.length) return;

  var OPEN = 340;
  var SHUT = 260;

  /* How far a work may be enlarged past its own pixels. Most of these
     files are 1700px and never reach it; four of them are small enough
     that showing them at 1:1 would barely be a zoom at all. Past about
     1.8 they start to look soft. */
  var MAXUP = 1.75;

  function still() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  }

  /* ---- the zoom layer, built once ------------------------------------ */
  var lb = document.createElement("div");
  lb.className = "lb";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Artwork");
  lb.innerHTML =
    '<div class="lb__veil" data-close></div>' +
    '<figure class="lb__fig">' +
      '<span class="lb__shell"><img class="lb__art" alt=""></span>' +
      '<figcaption class="lb__say"></figcaption>' +
    '</figure>' +
    '<button class="lb__x" type="button" data-close>' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3 L13 13 M13 3 L3 13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
      '<span class="u-sr">Close</span></button>' +
    '<button class="lb__nav lb__nav--prev" type="button" data-step="-1">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2 L4 8 L10 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span class="u-sr">Previous work</span></button>' +
    '<button class="lb__nav lb__nav--next" type="button" data-step="1">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2 L12 8 L6 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span class="u-sr">Next work</span></button>';
  document.body.appendChild(lb);

  var fig = lb.querySelector(".lb__fig");
  var shell = lb.querySelector(".lb__shell");
  var art = lb.querySelector(".lb__art");
  var say = lb.querySelector(".lb__say");
  var shutBtn = lb.querySelector(".lb__x");

  var idx = -1;
  var lastFocus = null;
  var shutTimer = null;
  var pending = null;
  var natural = [0, 0];

  function root() { return document.documentElement; }
  function lock(on) { root().classList.toggle("lb-on", !!on); }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  /* The frame available to the artwork: this layer, less its own padding,
     less whatever the caption is taking. Everything is read off the live
     computed style, so the numbers stay in the stylesheet where they can
     be changed. */
  function fit() {
    if (!natural[0] || !natural[1]) return;
    var cs = window.getComputedStyle(lb);
    var fs = window.getComputedStyle(fig);
    var row = fs.flexDirection !== "column";
    var gap = num(row ? fs.columnGap : fs.rowGap);
    var box = say.getBoundingClientRect();

    var w = lb.clientWidth - num(cs.paddingLeft) - num(cs.paddingRight);
    var h = lb.clientHeight - num(cs.paddingTop) - num(cs.paddingBottom);
    if (row) w -= box.width + gap; else h -= box.height + gap;

    w = Math.max(80, w);
    h = Math.max(80, h);

    var s = Math.min(w / natural[0], h / natural[1], MAXUP);
    shell.style.width = Math.round(natural[0] * s) + "px";
    shell.style.height = Math.round(natural[1] * s) + "px";
  }

  /* Fill the layer from a card, without animating anything. */
  function load(i) {
    var card = cards[i];
    var im = card.querySelector(".bt__art");
    idx = i;

    natural = [num(im.getAttribute("width")), num(im.getAttribute("height"))];
    art.alt = im.alt;
    art.src = im.currentSrc || im.src;
    say.innerHTML = card.querySelector(".bt__say").innerHTML;

    /* Twice: in the stacked layout the caption's height depends on the
       width it ends up with, which depends on the first pass. */
    fit();
    fit();

    var full = im.getAttribute("data-full");
    if (!full) return;
    var pre = new Image();
    pending = pre;
    pre.onload = function () {
      if (pending === pre && idx === i) art.src = full;
    };
    pre.src = full;
  }

  function flipFrom(rect) {
    shell.style.transition = "none";
    shell.style.transform = "none";
    var to = shell.getBoundingClientRect();
    if (!to.width || !rect.width) return;
    shell.style.transformOrigin = "0 0";
    shell.style.transform =
      "translate(" + (rect.left - to.left) + "px," + (rect.top - to.top) + "px)" +
      " scale(" + (rect.width / to.width) + ")";
    shell.getBoundingClientRect();          /* force the start frame */
    shell.style.transition = "transform " + OPEN + "ms cubic-bezier(.2,.8,.2,1)";
    shell.style.transform = "none";
  }

  function open(i) {
    if (shutTimer) { clearTimeout(shutTimer); shutTimer = null; }
    var from = cards[i].querySelector(".bt__art").getBoundingClientRect();
    lastFocus = cards[i].querySelector(".bt__hit") || document.activeElement;
    lb.hidden = false;
    lock(true);
    load(i);
    if (!still()) flipFrom(from);
    lb.classList.add("is-on");
    shutBtn.focus();
  }

  function finish() {
    lb.hidden = true;
    lb.classList.remove("is-on");
    shell.style.transition = "";
    shell.style.transform = "";
    shell.style.width = "";
    shell.style.height = "";
    art.removeAttribute("src");
    pending = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    idx = -1;
  }

  function close() {
    if (idx < 0) return;
    var card = cards[idx];

    /* Unlock first: the card may have been scrolled away from, and it
       cannot be brought back while the page is frozen. */
    lock(false);
    var box = card.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) {
      card.scrollIntoView({ block: "center" });
      box = card.getBoundingClientRect();
    }

    lb.classList.remove("is-on");
    if (still()) { finish(); return; }

    var from = shell.getBoundingClientRect();
    if (!from.width) { finish(); return; }
    shell.style.transformOrigin = "0 0";
    shell.style.transition = "transform " + SHUT + "ms cubic-bezier(.4,0,.2,1)";
    shell.style.transform =
      "translate(" + (box.left - from.left) + "px," + (box.top - from.top) + "px)" +
      " scale(" + (box.width / from.width) + ")";
    shutTimer = setTimeout(finish, SHUT + 20);
  }

  /* Stepping does not fly anywhere — it is a swap inside a view that is
     already open, so it cross-fades instead. */
  function step(d) {
    if (idx < 0) return;
    var next = (idx + d + cards.length) % cards.length;
    lb.classList.add("is-swapping");
    window.setTimeout(function () {
      shell.style.transition = "";
      shell.style.transform = "";
      load(next);
      lb.classList.remove("is-swapping");
    }, still() ? 0 : 110);
  }

  /* ---- wiring --------------------------------------------------------- */
  cards.forEach(function (card, i) {
    var hit = card.querySelector(".bt__hit");
    if (!hit) return;
    hit.addEventListener("click", function (e) {
      e.preventDefault();
      open(i);
    });
  });

  lb.addEventListener("click", function (e) {
    var t = e.target;
    while (t && t !== lb) {
      if (t.hasAttribute && t.hasAttribute("data-close")) { close(); return; }
      if (t.hasAttribute && t.hasAttribute("data-step")) {
        step(parseInt(t.getAttribute("data-step"), 10));
        return;
      }
      t = t.parentNode;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (idx < 0) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); return; }
    if (e.key !== "Tab") return;

    /* Keep Tab inside the dialog. Three controls, so this is cheap. */
    var able = Array.prototype.filter.call(
      lb.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
    if (!able.length) return;
    var first = able[0], last = able[able.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  window.addEventListener("resize", function () {
    if (idx < 0) return;
    shell.style.transition = "";
    shell.style.transform = "";
    fit();
  });
})();


/* ===========================================================================
   BACK, AND HOME
   Two controls that used to be one. HOME is a tab in the nav and always
   goes to the index. BACK sits top left, where the name used to, and goes
   back one step.

   It ships as <a href="/">, so with no JS it is still a way out. The
   upgrade only fires when there is somewhere to go back TO and we were
   sent here from this same site: landing on this page from a search
   result and pressing Back would otherwise throw the reader off the site
   entirely, which is the one thing a back control must not do.
   =========================================================================== */
(function () {
  "use strict";

  var back = document.querySelector("[data-back]");
  if (!back) return;

  back.addEventListener("click", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var ref = document.referrer;
    if (!ref || ref.indexOf(window.location.origin) !== 0) return;
    if (window.history.length <= 1) return;
    e.preventDefault();
    window.history.back();
  });
})();
