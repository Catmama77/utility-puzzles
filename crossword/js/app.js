/* ============================================================
   Crossword tool page UI.
   ============================================================ */

(function () {
  "use strict";

  var currentPuzzle = null;

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

  function renderGrid(puzzle) {
    var gridEl = $("puzzle-grid");
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

  function renderMeta(puzzle) {
    var total = puzzle.across.length + puzzle.down.length;
    $("print-title").textContent = puzzle.title;
    $("print-meta").textContent =
      puzzle.rows + " × " + puzzle.cols + " grid · " + total + " clues · " +
      (CrosswordGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
    $("status").textContent = total + " clues (" + puzzle.across.length +
      " across, " + puzzle.down.length + " down) · " + puzzle.rows + " × " + puzzle.cols + " grid";
  }

  function render(puzzle) {
    currentPuzzle = puzzle;
    renderGrid(puzzle);
    renderClues($("across-list"), puzzle.across);
    renderClues($("down-list"), puzzle.down);
    renderMeta(puzzle);
    $("puzzle-grid").classList.remove("show-answers");
    $("answers-btn").textContent = "Show Answers";
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    render(CrosswordGen.makeCrossword(cat, diff));
  }

  function toggleAnswers() {
    var gridEl = $("puzzle-grid");
    var showing = gridEl.classList.toggle("show-answers");
    $("answers-btn").textContent = showing ? "Hide Answers" : "Show Answers";
  }

  function checkPuzzle() {
    if (!currentPuzzle) return;
    var gridEl = $("puzzle-grid");
    var inputs = gridEl.querySelectorAll("input.cell-input");
    var wrong = 0;
    var filled = 0;
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
      if (v !== currentPuzzle.grid[r][c].letter) {
        cell.classList.add("wrong");
        wrong++;
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "entry" : "entries") +
        " — fix " + (wrong === 1 ? "it" : "them") + " and check again.";
    } else if (filled === 0) {
      $("status").textContent = "Type some letters first, then check again.";
    } else if (filled === inputs.length) {
      $("status").textContent = "Solved! Every letter is correct. 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var gridEl = $("puzzle-grid");
    if (withAnswers) {
      gridEl.classList.add("show-answers");
      $("print-title").textContent = (currentPuzzle ? currentPuzzle.title : "Answer key") + " — Answers";
    } else {
      gridEl.classList.remove("show-answers");
      $("print-title").textContent = currentPuzzle ? currentPuzzle.title : "Puzzle";
    }
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
