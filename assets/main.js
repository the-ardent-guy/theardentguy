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

  document.addEventListener("DOMContentLoaded", function () {
    heroImageCheck();
    heroIntro();
    scrollReveal();
    navSpy();
    penLines();
    burgerMenu();
    themeToggle();
    photoStack();
  });
})();
