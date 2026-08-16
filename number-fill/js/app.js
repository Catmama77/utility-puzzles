/* ============================================================
   Number Fill-In tool page UI.
   ============================================================ */

(function () {
  "use strict";

  var currentPuzzle = null;

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var themeSel = $("theme");
    Object.keys(NumberGen.THEMES).forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t;
      opt.textContent = NumberGen.THEMES[t].label;
      themeSel.appendChild(opt);
    });
    themeSel.value = "classic";

    var diffSel = $("difficulty");
    Object.keys(NumberGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = NumberGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";
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

  function renderNumberList(puzzle) {
    var listEl = $("numberlist");
    listEl.innerHTML = "";

    var groups = {};
    puzzle.numbers.forEach(function (n) {
      (groups[n.digits] = groups[n.digits] || []).push(n);
    });

    var counts = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    counts.forEach(function (digits) {
      var group = document.createElement("div");
      group.className = "word-group";

      var label = document.createElement("div");
      label.className = "len-label";
      label.textContent = digits + " digits";
      group.appendChild(label);

      var numsEl = document.createElement("div");
      numsEl.className = "words";
      groups[digits].forEach(function (n) {
        var chip = document.createElement("span");
        chip.className = "word-chip";
        chip.textContent = n.value;
        var num = document.createElement("span");
        num.className = "num";
        num.textContent = "(" + n.slot + ")";
        chip.appendChild(num);
        numsEl.appendChild(chip);
      });
      group.appendChild(numsEl);
      listEl.appendChild(group);
    });
  }

  function renderMeta(puzzle) {
    $("print-title").textContent = puzzle.title;
    $("print-meta").textContent =
      puzzle.rows + " × " + puzzle.cols + " grid · " + puzzle.numbers.length + " numbers · " +
      (NumberGen.DIFFICULTY[puzzle.difficulty] || {}).label + " level";
    $("status").textContent = puzzle.numbers.length + " numbers · " +
      puzzle.rows + " × " + puzzle.cols + " grid";
  }

  function render(puzzle) {
    currentPuzzle = puzzle;
    renderGrid(puzzle);
    renderNumberList(puzzle);
    renderMeta(puzzle);
    $("puzzle-grid").classList.remove("show-answers");
    $("answers-btn").textContent = "Show Answers";
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var theme = $("theme").value;
    var diff = $("difficulty").value;
    render(NumberGen.makePuzzle(theme, diff));
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
