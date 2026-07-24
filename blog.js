/* Reveal-on-scroll for blog + article pages (replaces framer whileInView). */
(function () {
  "use strict";
  function reveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { rootMargin: "-40px" });
    els.forEach(function (e) { io.observe(e); });
  }
  document.addEventListener("DOMContentLoaded", reveal);
})();
