/* Shared behaviour for every page. Vanilla, no dependencies. */

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Hero headline: stagger the lines in on load
     ---------------------------------------------------------------------- */
  function heroIntro() {
    var groups = document.querySelectorAll(".hero__group");
    var sub = document.querySelector(".hero__sub");
    if (!groups.length) return;

    var show = function (el) { el.style.opacity = 1; el.style.transform = "none"; };

    if (reduce) {
      groups.forEach(show);
      if (sub) show(sub);
      return;
    }

    groups.forEach(function (g, i) {
      g.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      g.style.transitionDelay = (i * 0.12) + "s";
    });
    if (sub) {
      sub.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      sub.style.transitionDelay = (groups.length * 0.12 + 0.05) + "s";
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        groups.forEach(function (g) { g.style.opacity = 1; g.style.transform = "translateY(0)"; });
        if (sub) { sub.style.opacity = 1; sub.style.transform = "translateY(0)"; }
      });
    });
  }

  /* ----------------------------------------------------------------------
     Hero image: reveal the labelled fallback only if the photo 404s.
     Never touches background-image, so the CSS gradient stack survives.
     ---------------------------------------------------------------------- */
  function heroImageCheck() {
    var media = document.querySelector(".hero__media");
    var fallback = document.querySelector(".hero__media-fallback");
    if (!media || !fallback) return;

    var src = (media.getAttribute("data-src") || "/assets/hero.jpg");
    var probe = new Image();
    probe.onload = function () { fallback.hidden = true; };
    probe.onerror = function () { fallback.hidden = false; };
    probe.src = src;
  }

  /* ----------------------------------------------------------------------
     Scroll progress bar. Goal gradient: visible progress pulls a long
     scrolling story forward.
     ---------------------------------------------------------------------- */
  function scrollProgress() {
    var bar = document.querySelector(".scroll-progress");
    if (!bar) return;

    function update() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      bar.style.width = pct + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ----------------------------------------------------------------------
     Mobile hamburger menu
     ---------------------------------------------------------------------- */
  function burgerMenu() {
    var bar = document.querySelector(".sidebar");
    var burger = document.querySelector(".sidebar__burger");
    if (!bar || !burger) return;

    function setOpen(open) {
      bar.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    }

    burger.addEventListener("click", function () {
      setOpen(!bar.classList.contains("is-open"));
    });

    /* click on the scrim (routed to .sidebar via its ::before) closes it */
    bar.addEventListener("click", function (e) {
      if (e.target === bar) setOpen(false);
    });

    bar.querySelectorAll(".sidebar__nav a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ----------------------------------------------------------------------
     Dark mode toggle. The head script already set data-theme before paint;
     this just wires the button and persists the choice.
     ---------------------------------------------------------------------- */
  function themeToggle() {
    var btn = document.querySelector(".theme-toggle");
    if (!btn) return;

    btn.innerHTML =
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.2 6.2 0 0 0 10.5 10.5z"/></svg>';

    function current() {
      return document.documentElement.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }

    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      btn.setAttribute("aria-label", next === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  /* ----------------------------------------------------------------------
     Statements: a criss-cross photo stack. Click a card to bring it to the
     front and show its descriptor.
     ---------------------------------------------------------------------- */
  function photoStack() {
    var stack = document.querySelector(".stack");
    var desc = document.querySelector(".stack__desc");
    if (!stack || !desc) return;

    var cards = Array.prototype.slice.call(stack.querySelectorAll(".stack__card"));
    if (!cards.length) return;

    /* Criss-cross spread so every card keeps a clickable edge */
    var spread = [[-26, -18], [16, -24], [-32, 10], [28, 4], [-14, 28], [22, 22]];
    cards.forEach(function (card, i) {
      var o = spread[i % spread.length];
      card.style.setProperty("--x", o[0] + "px");
      card.style.setProperty("--y", o[1] + "px");
    });

    /* order[] is the visual pile, last entry on top */
    var order = cards.slice();
    var baseZ = 1;

    function paint() {
      order.forEach(function (card, i) { card.style.zIndex = String(baseZ + i); });
    }

    function setFront(card) {
      cards.forEach(function (c) { c.classList.remove("is-front"); });
      card.classList.add("is-front");
      order = order.filter(function (c) { return c !== card; });
      order.push(card);
      paint();
      desc.textContent = card.getAttribute("data-desc") || "";
      desc.classList.add("is-shown");
    }

    function sendBack(card) {
      card.classList.remove("is-front");
      order = order.filter(function (c) { return c !== card; });
      order.unshift(card);
      paint();
      var next = order[order.length - 1];
      next.classList.add("is-front");
      desc.textContent = next.getAttribute("data-desc") || "";
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        if (card.classList.contains("is-front")) sendBack(card);
        else setFront(card);
      });
    });

    paint();

    if (reduce) {
      cards.forEach(function (c) { c.classList.add("is-set"); });
    } else {
      cards.forEach(function (card, i) {
        setTimeout(function () { card.classList.add("is-set"); }, 80 * i + 120);
      });
    }
  }

  /* ----------------------------------------------------------------------
     Tool logo hover cluster on select hero headline words. Reads
     data-tools off each .tool-headline and builds its icon cluster once;
     CSS (:hover / :focus-within) drives the actual reveal and animation.
     One reusable system for every headline that carries data-tools.
     ---------------------------------------------------------------------- */
  function toolHeadlineHover() {
    var heads = document.querySelectorAll(".tool-headline[data-tools]");
    if (!heads.length) return;

    /* Build the markup on every device, touch included: :hover only fires
       on hover-capable pointers, but the on-load hint (toolHeadlineHint,
       below) needs the same clusters to exist so touch devices get a turn
       too. */
    var ICONS = {
      figma: "/assets/logos/figma.svg",
      shopify: "/assets/logos/shopify.svg",
      make: "/assets/logos/make.svg",
      claude: "/assets/logos/claude.svg",
      cursor: "/assets/logos/cursor.svg",
      n8n: "/assets/logos/n8n.svg"
    };

    /* Kept modest on purpose: the hero's four role lines stack with no gap
       between them (line-height *is* the spacing), so a line below another
       (e.g. "Builder.") has only its own leading to float into before
       overlapping the line above. These offsets clear that at every
       breakpoint; the stagger comes from x-spread + the spring timing,
       not from height alone. */
    var OFFSETS = [
      { x: "0px", y: "-6px" },
      { x: "35px", y: "-11px" },
      { x: "67px", y: "-2px" }
    ];

    heads.forEach(function (head) {
      var names = head.getAttribute("data-tools").split(",").map(function (s) { return s.trim(); });
      var cluster = document.createElement("span");
      cluster.className = "tool-cluster";
      cluster.setAttribute("aria-hidden", "true");

      names.forEach(function (name, i) {
        var src = ICONS[name];
        if (!src) return;
        var off = OFFSETS[i] || OFFSETS[OFFSETS.length - 1];

        var icon = document.createElement("span");
        icon.className = "tool-icon";
        icon.style.setProperty("--tx", off.x);
        icon.style.setProperty("--ty", off.y);
        icon.style.setProperty("--delay", (i * 60) + "ms");

        var img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.loading = "eager";
        icon.appendChild(img);
        cluster.appendChild(icon);
      });

      head.appendChild(cluster);
    });
  }

  /* ----------------------------------------------------------------------
     On-load hint: shortly after the page settles, each tool-headline gets
     a turn showing its own cluster automatically, one after another, then
     hides again. A quick "something's here" nudge, mainly for touch
     devices, which can never trigger :hover for themselves.
     ---------------------------------------------------------------------- */
  function toolHeadlineHint() {
    if (reduce) return;
    var heads = document.querySelectorAll(".tool-headline[data-tools]");
    if (!heads.length) return;

    var startDelay = 900;
    var holdEach = 1400;

    heads.forEach(function (head, i) {
      var start = startDelay + i * holdEach;
      setTimeout(function () { head.classList.add("is-hint"); }, start);
      setTimeout(function () { head.classList.remove("is-hint"); }, start + holdEach - 200);
    });
  }

  /* ----------------------------------------------------------------------
     Scroll reveal for sections
     ---------------------------------------------------------------------- */
  function scrollReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    function showIfNear(el) {
      var r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 0) + 80) el.classList.add("is-in");
    }

    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });

    items.forEach(function (el) { io.observe(el); showIfNear(el); });

    /* Safety net: never leave content stuck invisible */
    setTimeout(function () {
      items.forEach(function (el) {
        if (!el.classList.contains("is-in")) showIfNear(el);
      });
    }, 2500);
  }

  /* ----------------------------------------------------------------------
     Desktop only: nudge the sidebar nav down so it lines up with the hero's
     "Product Designer." line. That line floats to vertical-centre, so its
     position depends on viewport height - a fixed CSS value drifts and can
     land the nav far from the heading on a shorter or taller window. This
     measures the real rendered positions instead, so it holds at any
     height, and re-checks on resize.
     ---------------------------------------------------------------------- */
  function alignNavToHero() {
    var nav = document.querySelector(".sidebar__nav");
    var target = document.querySelector('.tool-headline[data-tools="figma,shopify,make"]');
    if (!nav || !target) return;

    function apply() {
      if (window.matchMedia && window.matchMedia("(max-width: 768px)").matches) {
        nav.style.marginTop = "";
        return;
      }
      nav.style.marginTop = "";
      var navTop = nav.getBoundingClientRect().top;
      var targetTop = target.getBoundingClientRect().top;
      var delta = targetTop - navTop;
      if (delta > 0) nav.style.marginTop = delta + "px";
    }

    apply();
    /* Re-run once more shortly after load: web fonts can swap in and
       reflow text metrics a beat after the first paint. */
    setTimeout(apply, 300);

    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(apply, 120);
    });
  }

  /* ----------------------------------------------------------------------
     The period after "Product Designer" drops out of the hero, falls
     straight down, bounces, and settles exactly on the "j" of "Selected
     Projects", the whole thing scrubbed to scroll position: the further
     down the visitor scrolls, the further the dot has fallen: progress runs
     from the very top of the page (0) to wherever "Selected Projects"
     settles into a natural reading position (1), so the fall is already
     visibly underway early in the scroll through the hero rather than only
     showing up once the heading is nearly in view.

     Phases within that 0-1 progress (art-directed):
       0.00-0.08  shake + resolve the horizontal offset, then lock it
       0.08-0.12  a held beat before the fall (gravity needs a wind-up)
       0.12-0.75  the fall itself, eased in (cubic) so it accelerates
       0.75-0.96  bounce: a couple of decaying up-bounces, squash on each
       0.96-1.00  settled, holding still

     Once progress first reaches 1 the dot latches there for good: this is
     a one-time discovery, not a toy to scrub back and forth.
     ---------------------------------------------------------------------- */
  function heroStopDrop() {
    var origin = document.getElementById("heroStopOrigin");
    var target = document.getElementById("dropTarget");
    if (!origin || !target) return;

    var dot = document.createElement("span");
    dot.className = "stop-falling";
    dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(dot);

    var originX = 0, originY = 0, dx = 0, dy = 0;
    var landed = false;
    var ticking = false;

    function measure() {
      var oRect = origin.getBoundingClientRect();
      var tRect = target.getBoundingClientRect();
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var scrollX = window.pageXOffset || document.documentElement.scrollLeft;

      originX = oRect.left + oRect.width / 2 + scrollX;
      originY = oRect.top + oRect.height / 2 + scrollY;
      var targetX = tRect.left + tRect.width / 2 + scrollX;
      var targetY = tRect.top + tRect.height * 0.14 + scrollY;

      dx = targetX - originX;
      dy = targetY - originY;

      dot.style.left = (originX - 4.5) + "px";
      dot.style.top = (originY - 4.5) + "px";
    }

    /* A couple of decaying up-bounces that always land exactly at dy: the
       sine term is 0 at b=0 (continuous with where the fall phase ends)
       and the (1-b) decay guarantees it is back to 0, and only 0, at b=1. */
    function bounceOffset(b) {
      return (1 - b) * Math.abs(Math.sin(b * Math.PI * 2.2));
    }

    function render(p) {
      var x, y, squash = 0;

      if (p < 0.08) {
        var s = p / 0.08;
        var wig = Math.sin(s * Math.PI * 3) * 6 * (1 - s);
        x = dx * s + wig;
        y = 0;
      } else if (p < 0.12) {
        x = dx;
        y = 0;
      } else if (p < 0.75) {
        var f = (p - 0.12) / (0.75 - 0.12);
        var eased = f * f * f;
        x = dx;
        y = dy * eased;
      } else {
        var b = (p - 0.75) / (0.96 - 0.75);
        b = Math.min(b, 1);
        var bo = bounceOffset(b);
        x = dx;
        y = dy - Math.abs(dy) * 0.055 * bo;
        squash = bo;
      }

      var scaleY = 1 - 0.35 * squash;
      var scaleX = 1 + 0.18 * squash;

      dot.style.opacity = String(Math.min(1, p / 0.08));
      origin.style.opacity = String(1 - Math.min(1, p / 0.08));
      dot.style.transform =
        "translate(" + x + "px," + y + "px) scale(" + scaleX + "," + scaleY + ")";
    }

    function update() {
      ticking = false;
      if (landed) return;

      measure();

      /* Progress is scrollY itself, not how close the heading is to the
         viewport: that way the dot is already visibly falling early in the
         scroll through the hero, not just in the last stretch before the
         heading arrives. Window: page top (0) to wherever the heading
         settles into a natural reading position (45% down the viewport),
         so it still lands right as that heading comes into view. */
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var tRect = target.getBoundingClientRect();
      var targetDocY = tRect.top + scrollY;
      var endScrollY = targetDocY - vh * 0.45;
      var raw = endScrollY > 0 ? scrollY / endScrollY : 1;
      var p = Math.max(0, Math.min(1, raw));

      render(p);

      if (p >= 1) {
        landed = true;
        window.removeEventListener("scroll", onScroll);
      }
    }

    function onScroll() {
      if (landed || ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    if (reduce) {
      measure();
      dot.style.opacity = "1";
      origin.style.opacity = "0";
      dot.style.transform = "translate(" + dx + "px," + dy + "px)";
      return;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      if (!landed) update();
    });
    update();
  }

  /* ----------------------------------------------------------------------
     Active nav item on scroll
     ---------------------------------------------------------------------- */
  function navSpy() {
    var links = document.querySelectorAll(".sidebar__nav a[data-section]");
    if (!links.length) return;

    var map = {};
    links.forEach(function (link) {
      var id = link.getAttribute("data-section");
      var target = document.getElementById(id);
      if (target) map[id] = link;
    });

    var ids = Object.keys(map);
    if (!ids.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          ids.forEach(function (id) { map[id].classList.remove("is-active"); });
          var active = map[entry.target.id];
          if (active) active.classList.add("is-active");
        }
      });
    }, { threshold: 0.5, rootMargin: "-20% 0px -40% 0px" });

    ids.forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  /* ----------------------------------------------------------------------
     Pen drawing lines on the desserts bento grid.
     Measure each path so the dash animation is exact.
     ---------------------------------------------------------------------- */
  function penLines() {
    var paths = document.querySelectorAll(".bento__pen path");
    paths.forEach(function (path) {
      try {
        var len = Math.ceil(path.getTotalLength());
        /* Only set the custom property. The dasharray and the resting
           dashoffset come from CSS via var(--len) so the :hover rule can
           still override the offset. An inline style could not be beaten. */
        path.style.setProperty("--len", len);
      } catch (e) {
        /* getTotalLength can throw on hidden SVG in old engines, ignore */
      }
    });
  }


  /* Decision index. A document of numbered trade-offs is inherently
     navigable, so the rail marks which decision you are reading. Mirrors
     navSpy's approach rather than inventing a second one. */
  function decisionSpy() {
    var links = document.querySelectorAll(".cs-rail__index a");
    if (!links.length || !("IntersectionObserver" in window)) return;

    var byId = {};
    var targets = [];
    links.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (!el) return;
      byId[id] = link;
      targets.push(el);
    });
    if (!targets.length) return;

    function clear() {
      links.forEach(function (l) { l.classList.remove("is-active"); });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        /* Pick the entry nearest the top of the band rather than the last
           one to fire, so fast scrolls do not leave a stale mark. */
        var best = null;
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (!best || entry.boundingClientRect.top < best.boundingClientRect.top) {
            best = entry;
          }
        });
        if (!best) return;
        clear();
        var link = byId[best.target.id];
        if (link) link.classList.add("is-active");
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    targets.forEach(function (el) { observer.observe(el); });
  }


  /* One nav for every width. The sidebar is gone, so the grid navigates
     itself and this is the only route to the pages the grid does not hold.
     Same component at every breakpoint, which removes the old desktop
     sidebar / mobile drawer split entirely. */
  function navSheet() {
    var open = document.getElementById("navOpen");
    var close = document.getElementById("navClose");
    var sheet = document.getElementById("navsheet");
    if (!open || !sheet) return;

    var lastFocus = null;

    function show() {
      lastFocus = document.activeElement;
      sheet.classList.add("is-open");
      open.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      if (close) close.focus();
    }

    function hide() {
      sheet.classList.remove("is-open");
      open.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    open.addEventListener("click", show);
    if (close) close.addEventListener("click", hide);

    /* Clicking the ground closes it. The links sit in a list, so a click
       that lands on the sheet itself was aimed at nothing. */
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet) hide();
    });

    sheet.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", hide);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && sheet.classList.contains("is-open")) hide();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    scrollProgress();
    scrollReveal();
    navSpy();
    penLines();
    themeToggle();
    toolHeadlineHover();
    toolHeadlineHint();
    decisionSpy();
    navSheet();
  });
})();
