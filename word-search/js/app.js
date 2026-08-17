/* ============================================================
   Word Search tool page UI.
   Renders up to 2 puzzles per page (print-friendly utility).
   On-screen solving: click a start cell then an end cell — if the
   straight line between them spells a listed word (either
   direction), the word is marked found.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var catSel = $("category");
    Object.keys(WORD_DATA).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";

    var sizeSel = $("size");
    Object.keys(SearchGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = SearchGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "10x10";

    var diffSel = $("difficulty");
    Object.keys(SearchGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = SearchGen.DIFFICULTY[d].label;
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

  // Walk from (r1,c1) to (r2,c2) if they're in a straight line in
  // one of the 8 directions; returns the letters collected, or null.
  function collectLine(grid, size, r1, c1, r2, c2) {
    var dr = r2 - r1;
    var dc = c2 - c1;
    var steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return null;
    if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    if (dr !== 0 && dr % steps !== 0) return null;
    if (dc !== 0 && dc % steps !== 0) return null;
    var sr = dr / steps;
    var sc = dc / steps;
    var letters = "";
    for (var i = 0; i <= steps; i++) {
      letters += grid[r1 + sr * i][c1 + sc * i];
    }
    return letters;
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

  function renderWordList(puzzle, listEl) {
    listEl.innerHTML = "";

    var groups = {};
    puzzle.words.forEach(function (w) {
      (groups[w.word.length] = groups[w.word.length] || []).push(w.word);
    });

    var lengths = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    lengths.forEach(function (len) {
      var group = document.createElement("div");
      group.className = "word-group";

      var label = document.createElement("div");
      label.className = "len-label";
      label.textContent = len + " letters";
      group.appendChild(label);

      var wordsEl = document.createElement("div");
      wordsEl.className = "words";
      groups[len].forEach(function (w) {
        var chip = document.createElement("span");
        chip.className = "word-chip find-chip";
        chip.dataset.word = w;
        chip.textContent = w.toLowerCase();
        wordsEl.appendChild(chip);
      });
      group.appendChild(wordsEl);
      listEl.appendChild(group);
    });
  }

  function renderMeta(puzzle, titleEl, metaEl) {
    titleEl.textContent = puzzle.title;
    metaEl.textContent =
      puzzle.size + " × " + puzzle.size + " grid · " + puzzle.words.length + " words to find · " +
      (SearchGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
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
      renderWordList(puzzle, list);
      renderMeta(puzzle, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — click a letter, then another, to mark words you find.";
  }

  /* ---------- click-to-find solving ---------- */

  function findWord(puzzle, word) {
    for (var i = 0; i < puzzle.words.length; i++) {
      if (puzzle.words[i].word === word) return puzzle.words[i];
    }
    return null;
  }

  // returns true if the letters between two cells spell `word`
  function matchesWord(grid, size, r1, c1, r2, c2, word) {
    var letters = collectLine(grid, size, r1, c1, r2, c2);
    if (!letters || letters.length !== word.length) return false;
    return letters === word || letters.split("").reverse().join("") === word;
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

    // try every word: does the line spell it?
    for (var i = 0; i < puzzle.words.length; i++) {
      var w = puzzle.words[i];
      if (w.found) continue;
      if (matchesWord(puzzle.grid, puzzle.size, start.r, start.c, r, c, w.word)) {
        markFound(puzzle, gridEl, w);
        break;
      }
    }
  }

  function markFound(puzzle, gridEl, w) {
    w.found = true;
    // highlight the cells of the word
    var cells = gridEl.children;
    var dirs = {
      "e": [0, 1], "s": [1, 0], "w": [0, -1], "n": [-1, 0],
      "se": [1, 1], "sw": [1, -1], "ne": [-1, 1], "nw": [-1, -1]
    };
    var d = dirs[w.dir];
    for (var i = 0; i < w.word.length; i++) {
      var idx = (w.r + d[0] * i) * puzzle.size + (w.c + d[1] * i);
      var cell = cells[idx];
      if (cell) cell.classList.add("found");
    }
    // strike the word in the list
    var chips = gridEl.parentNode.querySelectorAll(".find-chip");
    for (var j = 0; j < chips.length; j++) {
      if (chips[j].dataset.word === w.word) chips[j].classList.add("found");
    }
    // status
    var found = puzzle.words.filter(function (x) { return x.found; }).length;
    $("status").textContent =
      found + " of " + puzzle.words.length + " words found." +
      (found === puzzle.words.length ? " All found — great job! 🎉" : "");
  }

  /* ---------- answers + print ---------- */

  function revealAll() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var g = 0; g < grids.length; g++) {
      var puzzle = current[g];
      puzzle.words.forEach(function (w) {
        if (!w.found) markFound(puzzle, grids[g], w);
      });
    }
    $("answers-btn").textContent = "Hide Answers";
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
        // reveal every word cell
        var puzzle = current[j];
        puzzle.words.forEach(function (w) {
          if (!w.found) markFound(puzzle, g, w);
        });
        g.classList.add("show-answers");
      } else {
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
        puzzle.words.forEach(function (w) {
          if (!w.found) markFound(puzzle, g, w);
        });
        g.classList.add("show-answers");
      } else {
        g.classList.remove("show-answers");
      }
    }
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    setTimeout(function () {
      window.print();
    }, 30);
  }

  /* ---------- actions ---------- */

  function newSearch() {
    var cat = $("category").value;
    var size = $("size").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(SearchGen.makeBatch(count, cat, size, diff));
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
