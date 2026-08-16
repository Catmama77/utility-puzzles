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
      opt.textContent = CrosswordGen.CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";
  }

  /* ---------- rendering ---------- */

  function renderGrid(puzzle) {
    var gridEl = $("puzzle-grid");
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + puzzle.cols + ", max-content)";

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
        }
        gridEl.appendChild(div);
      }
    }
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
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newPuzzle();
  });
})();
