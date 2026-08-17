/* ============================================================
   Number search tool page UI.
   Renders up to 2 puzzles per page (print-friendly utility).
   On-screen solving: click a digit then another — if the straight
   line between them spells a listed number, it's marked found.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var sizeSel = $("size");
    Object.keys(NSearchGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = NSearchGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "10x10";

    var diffSel = $("difficulty");
    Object.keys(NSearchGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = NSearchGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";

    var countSel = $("count");
    [1, 2].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n + " per page";
      countSel.appendChild(opt);
    });
    countSel.value = "1";
  }

  /* ---------- rendering ---------- */

  function collectLine(grid, size, r1, c1, r2, c2) {
    var dr = r2 - r1;
    var dc = c2 - c1;
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return null;
    if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    var sr = dr / steps;
    var sc = dc / steps;
    var digits = "";
    for (var i = 0; i <= steps; i++) {
      digits += grid[r1 + sr * i][c1 + sc * i];
    }
    return digits;
  }

  function renderGrid(puzzle, gridEl, sel) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + puzzle.size + ", max-content)";
    gridEl.classList.add("search");

    for (var r = 0; r < puzzle.size; r++) {
      for (var c = 0; c < puzzle.size; c++) {
        var div = document.createElement("div");
        div.className = "cell letter-cell";
        div.textContent = puzzle.grid[r][c];
        div.dataset.r = r;
        div.dataset.c = c;
        div.addEventListener("click", function () {
          handleCellClick(puzzle, gridEl, sel, this, +this.dataset.r, +this.dataset.c);
        });
        gridEl.appendChild(div);
      }
    }
  }

  function renderNumList(puzzle, listEl) {
    listEl.innerHTML = "";
    var groups = {};
    puzzle.nums.forEach(function (n) {
      (groups[n.value.length] = groups[n.value.length] || []).push(n.value);
    });
    var lengths = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    lengths.forEach(function (len) {
      var group = document.createElement("div");
      group.className = "word-group";
      var label = document.createElement("div");
      label.className = "len-label";
      label.textContent = len + " digits";
      group.appendChild(label);
      var numsEl = document.createElement("div");
      numsEl.className = "words";
      groups[len].forEach(function (v) {
        var chip = document.createElement("span");
        chip.className = "word-chip find-chip";
        chip.dataset.word = v;
        chip.textContent = v;
        numsEl.appendChild(chip);
      });
      group.appendChild(numsEl);
      listEl.appendChild(group);
    });
  }

  function renderMeta(puzzle, titleEl, metaEl) {
    titleEl.textContent = puzzle.title;
    metaEl.textContent =
      puzzle.size + " × " + puzzle.size + " grid · " + puzzle.nums.length +
      " numbers to find · " + (NSearchGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = puzzles.length;
    sheetsEl.className = "sheets search-sheets sheets-" + n;

    puzzles.forEach(function (puzzle, i) {
      var sheet = document.createElement("div");
      sheet.className = "puzzle-sheet";

      var head = document.createElement("div");
      head.className = "print-heading";
      var title = document.createElement("h1");
      title.className = "print-title";
      var meta = document.createElement("p");
      meta.className = "print-meta";
      head.appendChild(title);
      head.appendChild(meta);

      var grid = document.createElement("div");
      grid.className = "puzzle-grid";
      grid.id = "puzzle-grid-" + i;

      var list = document.createElement("div");
      list.className = "wordlist search-wordlist";

      sheet.appendChild(head);
      sheet.appendChild(grid);
      sheet.appendChild(list);
      sheetsEl.appendChild(sheet);

      var sel = { start: null };
      renderGrid(puzzle, grid, sel);
      renderNumList(puzzle, list);
      renderMeta(puzzle, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — click a digit, then another, to mark numbers you find.";
  }

  /* ---------- click-to-find solving ---------- */

  function findNum(puzzle, value) {
    for (var i = 0; i < puzzle.nums.length; i++) {
      if (puzzle.nums[i].value === value) return puzzle.nums[i];
    }
    return null;
  }

  function matchesNum(grid, size, r1, c1, r2, c2, value) {
    var digits = collectLine(grid, size, r1, c1, r2, c2);
    if (!digits || digits.length !== value.length) return false;
    return digits === value || digits.split("").reverse().join("") === value;
  }

  function handleCellClick(puzzle, gridEl, sel, cellEl, r, c) {
    if (!sel.start) {
      sel.start = { el: cellEl, r: r, c: c };
      cellEl.classList.add("pending");
      return;
    }
    var start = sel.start;
    sel.start = null;
    start.el.classList.remove("pending");

    for (var i = 0; i < puzzle.nums.length; i++) {
      var n = puzzle.nums[i];
      if (n.found) continue;
      if (matchesNum(puzzle.grid, puzzle.size, start.r, start.c, r, c, n.value)) {
        markFound(puzzle, gridEl, n);
        break;
      }
    }
  }

  function markFound(puzzle, gridEl, n) {
    n.found = true;
    var cells = gridEl.children;
    var dirs = {
      "e": [0, 1], "s": [1, 0], "w": [0, -1], "n": [-1, 0],
      "se": [1, 1], "sw": [1, -1], "ne": [-1, 1], "nw": [-1, -1]
    };
    var d = dirs[n.dir];
    for (var i = 0; i < n.value.length; i++) {
      var idx = (n.r + d[0] * i) * puzzle.size + (n.c + d[1] * i);
      var cell = cells[idx];
      if (cell) cell.classList.add("found");
    }
    var chips = gridEl.parentNode.querySelectorAll(".find-chip");
    for (var j = 0; j < chips.length; j++) {
      if (chips[j].dataset.word === n.value) chips[j].classList.add("found");
    }
    var found = puzzle.nums.filter(function (x) { return x.found; }).length;
    $("status").textContent =
      found + " of " + puzzle.nums.length + " numbers found." +
      (found === puzzle.nums.length ? " All found — great job! 🎉" : "");
  }

  /* ---------- answers + print ---------- */

  function revealAll() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var g = 0; g < grids.length; g++) {
      var puzzle = current[g];
      puzzle.nums.forEach(function (n) {
        if (!n.found) markFound(puzzle, grids[g], n);
      });
    }
    $("answers-btn").textContent = "Hide Answers";
  }

  function clearFound(puzzle, gridEl) {
    puzzle.nums.forEach(function (n) { n.found = false; });
    var cells = gridEl.children;
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove("found");
    var chips = gridEl.parentNode.querySelectorAll(".find-chip");
    for (var j = 0; j < chips.length; j++) chips[j].classList.remove("found");
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var anyShowing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) anyShowing = true;
    }
    var showing = !anyShowing;
    for (var j = 0; j < grids.length; j++) {
      var g = grids[j];
      if (showing) {
        var puzzle = current[j];
        puzzle.nums.forEach(function (n) {
          if (!n.found) markFound(puzzle, g, n);
        });
        g.classList.add("show-answers");
      } else {
        clearFound(current[j], g);
        g.classList.remove("show-answers");
      }
    }
    $("answers-btn").textContent = showing ? "Hide Answers" : "Show Answers";
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      var g = grids[i];
      if (withAnswers) {
        var puzzle = current[i];
        puzzle.nums.forEach(function (n) {
          if (!n.found) markFound(puzzle, g, n);
        });
        g.classList.add("show-answers");
      } else {
        clearFound(current[i], g);
        g.classList.remove("show-answers");
      }
    }
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    setTimeout(function () { window.print(); }, 30);
  }

  /* ---------- actions ---------- */

  function newSearch() {
    var size = $("size").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(NSearchGen.makeBatch(count, size, diff));
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    $("new-btn").addEventListener("click", newSearch);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newSearch();
  });
})();
