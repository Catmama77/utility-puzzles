/* ============================================================
   Crossword tool page UI.
   Renders up to 2 puzzles per page (print-friendly utility).
   ============================================================ */

(function () {
  "use strict";

  var currentPuzzles = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(CrosswordGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = CrosswordGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";

    var catSel = $("category");
    Object.keys(WORD_DATA).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat] || cat;
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

  function renderClues(listEl, clues) {
    listEl.innerHTML = "";
    clues.forEach(function (w) {
      var item = document.createElement("div");
      item.className = "clue-item";
      var num = document.createElement("span");
      num.className = "clue-num";
      num.textContent = w.number;
      var text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = w.clue;
      item.appendChild(num);
      item.appendChild(text);
      listEl.appendChild(item);
    });
  }

  function renderMeta(puzzle, titleEl, metaEl) {
    var total = puzzle.across.length + puzzle.down.length;
    titleEl.textContent = puzzle.title;
    metaEl.textContent =
      puzzle.rows + " × " + puzzle.cols + " grid · " + total + " clues · " +
      (CrosswordGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
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

      var clues = document.createElement("div");
      clues.className = "clues";
      var acrossCol = document.createElement("div");
      acrossCol.className = "clues-col";
      var acrossHead = document.createElement("h2");
      acrossHead.textContent = "Across";
      var acrossList = document.createElement("div");
      acrossList.className = "clue-list";
      acrossCol.appendChild(acrossHead);
      acrossCol.appendChild(acrossList);

      var downCol = document.createElement("div");
      downCol.className = "clues-col";
      var downHead = document.createElement("h2");
      downHead.textContent = "Down";
      var downList = document.createElement("div");
      downList.className = "clue-list";
      downCol.appendChild(downHead);
      downCol.appendChild(downList);

      clues.appendChild(acrossCol);
      clues.appendChild(downCol);

      sheet.appendChild(head);
      sheet.appendChild(grid);
      sheet.appendChild(clues);
      sheetsEl.appendChild(sheet);

      renderGrid(puzzle, grid);
      renderClues(acrossList, puzzle.across);
      renderClues(downList, puzzle.down);
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
    render(CrosswordGen.makeBatch(count, cat, diff));
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
