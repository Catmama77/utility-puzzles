/* ============================================================
   Word Fill-In tool page UI.
   Renders up to 2 puzzles per page (print-friendly utility).
   ============================================================ */

(function () {
  "use strict";

  var currentPuzzles = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(PuzzleGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = PuzzleGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";

    var catSel = $("category");
    Object.keys(WORD_BANK).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = globalThis.CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";

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

  /* Arrow keys move focus between adjacent cells, skipping black
     cells. Cell coordinates come from each input's data-pos
     ("r,c" for this tool). */
  function addArrowNav(gridEl, inputs, rows, cols) {
    var map = {};
    inputs.forEach(function (inp) {
      var p = (inp.dataset.nav || inp.dataset.pos).split(",");
      map[p[0] + "," + p[1]] = inp;
    });
    function move(from, dr, dc) {
      var p = (from.dataset.nav || from.dataset.pos).split(",");
      var r = +p[0] + dr;
      var c = +p[1] + dc;
      while (r >= 0 && r < rows && c >= 0 && c < cols) {
        var target = map[r + "," + c];
        if (target) {
          target.focus();
          if (target.select) target.select();
          return;
        }
        r += dr;
        c += dc;
      }
    }
    inputs.forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        var key = e.key;
        var dr = 0;
        var dc = 0;
        if (key === "ArrowUp") dr = -1;
        else if (key === "ArrowDown") dr = 1;
        else if (key === "ArrowLeft") dc = -1;
        else if (key === "ArrowRight") dc = 1;
        else return;
        if (e.preventDefault) e.preventDefault();
        move(this, dr, dc);
      });
    });
  }

  function renderGrid(puzzle, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + puzzle.cols + ", max-content)";

    var inputs = [];

    for (var r = 0; r < puzzle.rows; r++) {
      for (var c = 0; c < puzzle.cols; c++) {
        var cell = puzzle.grid[r][c];
        var div = document.createElement("div");
        div.className = "cell";
        if (cell.black) {
          div.classList.add("black");
        } else {
          if (cell.number) {
            var num = document.createElement("span");
            num.className = "slot-num";
            num.textContent = cell.number;
            div.appendChild(num);
          }
          var letter = document.createElement("span");
          letter.className = "letter";
          letter.textContent = cell.letter;
          div.appendChild(letter);

          var input = document.createElement("input");
          input.type = "text";
          input.maxLength = 1;
          input.className = "cell-input";
          input.dataset.pos = r + "," + c;
          input.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
          input.addEventListener("input", function () {
            this.value = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 1);
            this.parentNode.classList.remove("wrong");
          });
          inputs.push(input);
          div.appendChild(input);
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, puzzle.rows, puzzle.cols);
  }

  function renderWordList(puzzle, listEl) {
    listEl.innerHTML = "";

    var groups = {};
    puzzle.words.forEach(function (w) {
      (groups[w.length] = groups[w.length] || []).push(w);
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
        chip.className = "word-chip";
        chip.textContent = w.word.toLowerCase();
        var num = document.createElement("span");
        num.className = "num";
        num.textContent = "(" + w.number + ")";
        chip.appendChild(num);
        wordsEl.appendChild(chip);
      });
      group.appendChild(wordsEl);
      listEl.appendChild(group);
    });
  }

  function renderMeta(puzzle, titleEl, metaEl) {
    titleEl.textContent = puzzle.title;
    metaEl.textContent =
      puzzle.rows + " × " + puzzle.cols + " grid · " + puzzle.words.length + " words · " +
      (PuzzleGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
  }

  function render(puzzles) {
    currentPuzzles = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";

    var n = puzzles.length;
    sheetsEl.className = "sheets fillin-sheets sheets-" + n;

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
      list.className = "wordlist";

      sheet.appendChild(head);
      sheet.appendChild(grid);
      sheet.appendChild(list);
      sheetsEl.appendChild(sheet);

      renderGrid(puzzle, grid);
      renderWordList(puzzle, list);
      renderMeta(puzzle, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent = n + (n === 1 ? " puzzle" : " puzzles") + " generated — ready to print.";
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    var puzzles = [];
    for (var i = 0; i < count; i++) {
      puzzles.push(PuzzleGen.makePuzzle(cat, diff));
    }
    render(puzzles);
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var anyShowing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) anyShowing = true;
    }
    var showing = !anyShowing;
    for (var j = 0; j < grids.length; j++) {
      if (showing) grids[j].classList.add("show-answers");
      else grids[j].classList.remove("show-answers");
    }
    $("answers-btn").textContent = showing ? "Hide Answers" : "Show Answers";
  }

  function checkPuzzle() {
    if (!currentPuzzles.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0;
    var filled = 0;
    var totalCells = 0;
    for (var g = 0; g < grids.length; g++) {
      var puzzle = currentPuzzles[g];
      var inputs = grids[g].querySelectorAll("input.cell-input");
      totalCells += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var cell = inp.parentNode;
        cell.classList.remove("wrong");
        var v = inp.value.trim();
        if (!v) continue;
        filled++;
        var parts = inp.dataset.pos.split(",");
        var r = +parts[0];
        var c = +parts[1];
        if (v !== puzzle.grid[r][c].letter) {
          cell.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "entry" : "entries") +
        " across " + grids.length + (grids.length === 1 ? " puzzle" : " puzzles") +
        " — fix " + (wrong === 1 ? "it" : "them") + " and check again.";
    } else if (filled === 0) {
      $("status").textContent = "Type some letters first, then check again.";
    } else if (filled === totalCells) {
      $("status").textContent = "Solved! Every letter is correct. 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      if (withAnswers) grids[i].classList.add("show-answers");
      else grids[i].classList.remove("show-answers");
    }
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    // give the browser a tick to apply classes, then print
    setTimeout(function () {
      window.print();
    }, 30);
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    $("new-btn").addEventListener("click", newPuzzle);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("check-btn").addEventListener("click", checkPuzzle);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newPuzzle();
  });
})();
