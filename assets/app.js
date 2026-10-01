(function () {
  "use strict";
  var root = document.documentElement;

  var toggle = document.querySelector(".theme");
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (toggle) toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }
  if (toggle) {
    applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("eb-theme", next); } catch (e) {}
    });
  }

  var masthead = document.querySelector(".masthead");
  var menuBtn = document.querySelector(".menu");
  var nav = document.querySelector(".nav");
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
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    document.addEventListener("click", function (e) {
      if (masthead.classList.contains("is-open") && !masthead.contains(e.target)) closeMenu();
    });
  }

  var cycle = document.querySelector("[data-cycle]");
  var cycleDesc = document.querySelector("[data-cycle-desc]");
  if (cycle) {
    var steps = Array.prototype.slice.call(cycle.querySelectorAll(".cycle__step"));
    steps.forEach(function (btn) {
      btn.addEventListener("click", function () {
        steps.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        if (cycleDesc) cycleDesc.textContent = btn.getAttribute("data-desc") || "";
      });
    });
  }
})();
