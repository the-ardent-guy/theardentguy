/* Marks which decision you are reading. Nothing else on the page is scripted. */
(function () {
  var links = document.querySelectorAll(".rail a");
  if (!links.length || !("IntersectionObserver" in window)) return;

  var byId = {}, targets = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) { byId[el.id] = a; targets.push(el); }
  });
  if (!targets.length) return;

  var io = new IntersectionObserver(function (entries) {
    /* Nearest the top of the band wins, so a fast scroll cannot leave a
       stale mark behind. */
    var best = null;
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      if (!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e;
    });
    if (!best) return;
    links.forEach(function (a) { a.classList.remove("is-active"); });
    byId[best.target.id].classList.add("is-active");
  }, { rootMargin: "-15% 0px -65% 0px" });

  targets.forEach(function (t) { io.observe(t); });
})();
