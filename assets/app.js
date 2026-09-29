(function () {
  "use strict";
  var root = document.documentElement;

  /* --- переключение темы --- */
  var toggle = document.querySelector(".theme-toggle");
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (!toggle) return;
    var dark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(dark));
    toggle.setAttribute("aria-label", dark ? "Включить светлую тему" : "Включить тёмную тему");
  }
  if (toggle) {
    applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("eb-theme", next); } catch (e) { /* приватный режим */ }
    });
  }

  /* --- мобильное меню --- */
  var masthead = document.querySelector(".masthead");
  var menuBtn = document.querySelector(".menu-btn");
  var nav = document.querySelector(".primary-nav");
  function closeMenu() {
    if (!masthead || !menuBtn || !nav) return;
    masthead.classList.remove("is-open");
    nav.classList.remove("is-panel");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  if (masthead && menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = masthead.classList.toggle("is-open");
      nav.classList.toggle("is-panel", open);
      menuBtn.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
    document.addEventListener("click", function (e) {
      if (masthead.classList.contains("is-open") && !masthead.contains(e.target)) closeMenu();
    });
  }

  /* --- появление блоков при скролле --- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "120px 0px 0px 0px", threshold: 0 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* --- подсветка активного раздела --- */
  var links = Array.prototype.slice.call(document.querySelectorAll(".primary-nav a[href^='#']"));
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute("href")); })
    .filter(Boolean);
  if ("IntersectionObserver" in window && targets.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute("href") === "#" + en.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach(function (t) { spy.observe(t); });
  }

  /* --- год в подвале --- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
