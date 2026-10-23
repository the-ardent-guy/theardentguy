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

  /* -------------------------------------------------------------------------
     3. ASK RISH  (spec 11.6)

     Mounts into [data-ask-rish] and builds its own markup, because without
     JS none of it can work and an inert pill that opens an empty panel is
     worse than no pill at all.

     The whole widget is built with createElement and textContent. Nothing the
     server streams back is ever assigned to innerHTML: the one piece of
     formatting the model is allowed is a [text](url) link, and that is parsed
     into a real anchor with its href checked, in link() below.
     ------------------------------------------------------------------------- */

  var API = "/api/chat";
  var MAX_LEN = 500;        // spec 11.4, matched server side
  var COUNT_FROM = 400;     // spec 11.6, show the counter late
  var MAX_TURNS = 6;        // spec 11.4, what gets sent back up
  var MAIL = "theardentguy@gmail.com";

  var STARTERS = [
    "What's your best case study?",
    "How do you work?",
    "Are you available for a project?"
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function sessionId() {
    var k = "ar:sid", v = null;
    try { v = sessionStorage.getItem(k); } catch (e) { return "anon"; }
    if (!v) {
      v = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }

  /* Only http(s) and mailto reach an href. A model that has been talked into
     emitting [click me](javascript:...) gets its link rendered as plain text
     instead. */
  function safeHref(url) {
    var u = String(url).trim();
    return /^(https?:\/\/|mailto:|\/)/i.test(u) && !/^javascript:/i.test(u) ? u : null;
  }

  /* Turns "see [Read the case](/work/produsa) for more" into text, anchor,
     text. Everything else stays text. */
  function link(parent, raw) {
    var re = /\[([^\]\n]{1,120})\]\(([^)\s]{1,300})\)/g;
    var at = 0, m;
    while ((m = re.exec(raw))) {
      if (m.index > at) parent.appendChild(document.createTextNode(raw.slice(at, m.index)));
      var href = safeHref(m[2]);
      if (href) {
        var a = el("a", null, m[1]);
        a.href = href;
        if (/^https?:/i.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
        parent.appendChild(a);
      } else {
        parent.appendChild(document.createTextNode(m[1]));
      }
      at = m.index + m[0].length;
    }
    if (at < raw.length) parent.appendChild(document.createTextNode(raw.slice(at)));
  }

  function askRish() {
    var mount = document.querySelector("[data-ask-rish]");
    if (!mount) return;

    var turns = [];          // the last MAX_TURNS, client side only
    var busy = false;
    var sid = sessionId();

    /* 2.1 Markup --------------------------------------------------------- */

    var root = el("div", "ar");
    root.setAttribute("data-open", "false");

    var pill = el("button", "ar__pill");
    pill.type = "button";
    pill.setAttribute("aria-expanded", "false");
    pill.setAttribute("aria-controls", "ar-panel");
    pill.appendChild(document.createTextNode("ask rish "));
    var nib = el("span", null, "✎");
    nib.setAttribute("aria-hidden", "true");
    pill.appendChild(nib);

    var panel = el("div", "ar__panel");
    panel.id = "ar-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "Ask Rish");

    var head = el("div", "ar__head");
    head.appendChild(el("p", "ar__title", "Ask Rish"));
    var close = el("button", "ar__close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close Ask Rish");
    head.appendChild(close);

    var log = el("div", "ar__log");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    log.setAttribute("aria-label", "Conversation");

    var starts = el("div", "ar__starts");
    STARTERS.forEach(function (q) {
      var b = el("button", "ar__start", q);
      b.type = "button";
      b.addEventListener("click", function () { send(q); });
      starts.appendChild(b);
    });

    var form = el("form", "ar__form");
    var input = el("textarea", "ar__input");
    input.rows = 1;
    input.maxLength = MAX_LEN;
    input.placeholder = "Ask me something…";
    input.setAttribute("aria-label", "Your question for Rish");

    var count = el("span", "ar__count");
    count.hidden = true;
    count.setAttribute("aria-hidden", "true");

    var send$ = el("button", "ar__send");
    send$.type = "submit";
    send$.setAttribute("aria-label", "Send");
    send$.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20.5v-6l9-2.5-9-2.5v-6L22 12z"/></svg>';

    form.appendChild(input);
    form.appendChild(count);
    form.appendChild(send$);

    var note = el("p", "ar__note");
    note.appendChild(document.createTextNode(
      "Ask Rish is an AI and can get things wrong. Conversations are saved so I can improve it, so don’t share anything sensitive."
    ));

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(starts);
    panel.appendChild(form);
    panel.appendChild(note);
    root.appendChild(panel);
    root.appendChild(pill);
    mount.appendChild(root);

    /* 2.2 Open and close -------------------------------------------------- */

    function open(on) {
      root.setAttribute("data-open", on ? "true" : "false");
      pill.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) input.focus();
      else pill.focus();
    }

    pill.addEventListener("click", function () {
      open(root.getAttribute("data-open") !== "true");
    });
    close.addEventListener("click", function () { open(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || root.getAttribute("data-open") !== "true") return;
      e.preventDefault();
      open(false);
    });

    /* Tab stays inside the panel and the pill while it is open. aria-modal is
       false, per the spec, because the page behind stays readable; the trap is
       so keyboard focus does not wander off behind an open panel. */
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || root.getAttribute("data-open") !== "true") return;
      var stops = root.querySelectorAll("button, textarea, a[href]");
      var live = [];
      for (var i = 0; i < stops.length; i++) {
        if (!stops[i].disabled && stops[i].offsetParent !== null) live.push(stops[i]);
      }
      if (!live.length) return;
      var first = live[0], last = live[live.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* 2.3 The input ------------------------------------------------------- */

    input.addEventListener("input", function () {
      var n = input.value.length;
      count.hidden = n < COUNT_FROM;
      count.textContent = n + "/" + MAX_LEN;
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : send(input.value);
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send(input.value);
    });

    /* 2.4 Sending --------------------------------------------------------- */

    function bubble(cls, text) {
      var p = el("p", "ar__msg " + cls);
      if (text != null) p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return p;
    }

    function send(raw) {
      var q = String(raw || "").trim().slice(0, MAX_LEN);
      if (!q || busy) return;

      busy = true;
      send$.disabled = true;
      input.value = "";
      count.hidden = true;
      if (starts.parentNode) starts.remove();

      bubble("ar__msg--me", q);
      turns.push({ role: "user", text: q });

      var thinking = bubble("ar__think", "scribbling");

      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid,
          page: location.pathname,
          messages: turns.slice(-MAX_TURNS)
        })
      }).then(function (res) {
        if (res.status === 429) {
          return res.text().then(function (t) {
            throw new Error(t || "You’ve hit today’s limit. Email me at " + MAIL);
          });
        }
        if (!res.ok || !res.body) throw new Error("");

        thinking.remove();
        var out = bubble("ar__msg--bot", "");
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var full = "";

        return (function pump() {
          return reader.read().then(function (r) {
            if (r.done) {
              // Re-render once at the end so a [text](url) split across two
              // chunks still becomes one anchor.
              out.textContent = "";
              link(out, full);
              turns.push({ role: "assistant", text: full });
              if (turns.length > MAX_TURNS) turns = turns.slice(-MAX_TURNS);
              return;
            }
            full += dec.decode(r.value, { stream: true });
            out.textContent = full;
            log.scrollTop = log.scrollHeight;
            return pump();
          });
        })();
      }).catch(function (err) {
        if (thinking.parentNode) thinking.remove();
        var p = bubble("ar__msg--err", null);
        p.appendChild(document.createTextNode(
          (err && err.message) ? err.message : "That didn’t go through. Email me at "
        ));
        if (!err || !err.message) {
          var a = el("a", null, MAIL);
          a.href = "mailto:" + MAIL;
          p.appendChild(a);
        }
      }).then(function () {
        busy = false;
        send$.disabled = false;
      });
    }
  }


  function boot() {
    clock();
    piles();
    askRish();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}());
