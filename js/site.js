/* ============================================================
   Site-wide utilities (loaded on every page, after /js/ads.js).
   - Mobile: lets the Puzzles ▾ dropdown open on tap (touch
     devices have no hover, so the 15-tool menu was unreachable).
   - Responsive: scales wide puzzle grids down to fit their card
     on small screens (they otherwise scroll sideways). Print is
     unaffected — @media print resets the transform.
   Must never throw in any environment.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 1. Puzzles dropdown on touch devices ---------- */

  var group = document.querySelector(".nav-group");
  if (group) {
    var parent = group.querySelector(".nav-parent");
    if (parent) {
      var isTouch = false;
      if (window.matchMedia) {
        isTouch = window.matchMedia("(hover: none)").matches;
      } else if ("ontouchstart" in window) {
        isTouch = true;
      }
      var menuOpen = false;
      function closeMenu() {
        group.classList.remove("nav-open");
        menuOpen = false;
      }
      if (isTouch) {
        parent.addEventListener("click", function (e) {
          e.preventDefault();
          if (menuOpen) {
            closeMenu();
          } else {
            group.classList.add("nav-open");
            menuOpen = true;
          }
        });
        if (document.addEventListener) {
          document.addEventListener("click", function (e) {
            if (menuOpen && !group.contains(e.target)) closeMenu();
          });
          document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && menuOpen) closeMenu();
          });
        }
      }
    }
  }

  /* ---------- 2. Fit wide puzzle grids to their card ---------- */

  var FIT_SELECTOR =
    ".puzzle-grid, .wheel-wrap, .match-grid, .maze-wrap, " +
    ".ladder-grid, .cipher-grid, .kakuro-grid, .search-grid, .bingo-card";

  function fitGrids() {
    var wraps = document.querySelectorAll(".puzzle-wrap");
    for (var i = 0; i < wraps.length; i++) {
      var wrap = wraps[i];
      if (!wrap.clientWidth || wrap.clientWidth <= 0) continue;
      var els = wrap.querySelectorAll(FIT_SELECTOR);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        var natW = el.offsetWidth;
        if (!natW || natW <= 0) continue;
        // fit against the element's own containing box (its sheet), using the
        // content width — clientWidth includes padding, which would leave the
        // scaled grid clipped on the right
        var parent = el.parentElement || wrap;
        var cs = getComputedStyle(parent);
        var padL = parseFloat(cs.paddingLeft) || 0;
        var padR = parseFloat(cs.paddingRight) || 0;
        var avail = parent.clientWidth - padL - padR;
        if (!avail || avail <= 0) avail = wrap.clientWidth;
        if (natW <= avail) {
          // fits now (e.g. after a resize) — undo any previous scaling
          el.style.transform = "";
          el.style.marginBottom = "";
          continue;
        }
        var s = avail / natW;
        el.style.transformOrigin = "top center";
        el.style.transform = "scale(" + s + ")";
        // the transform does not change layout size; reclaim the blank
        // space it leaves below so sheets stay tightly packed
        el.style.marginBottom = Math.round(-el.offsetHeight * (1 - s)) + "px";
        // the untransformed box is still wide enough to scroll —
        // hide the card's internal scrollbar (the scaled content fits)
        wrap.style.overflowX = "hidden";
      }
    }
  }

  function scheduleFit() {
    // Run after the tool scripts (their generators render on
    // DOMContentLoaded), with a delayed safety pass for fonts/layout.
    setTimeout(fitGrids, 0);
    setTimeout(fitGrids, 400);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleFit);
  } else {
    scheduleFit();
  }

  if (window.addEventListener) {
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fitGrids, 150);
    });
  }
})();
