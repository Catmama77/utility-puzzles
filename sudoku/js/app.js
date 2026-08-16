/* ============================================================
   Sudoku tool page UI.
   ============================================================ */

(function () {
  "use strict";

  var current = null;

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var sizeSel = $("size");
    Object.keys(SudokuGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = SudokuGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "9x9";

    var diffSel = $("difficulty");
    Object.keys(SudokuGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = SudokuGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";
  }

  /* ---------- rendering ---------- */

  function renderGrid(p) {
    var gridEl = $("puzzle-grid");
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.size + ", max-content)";
    gridEl.classList.add("sudoku");

    var digitRe = new RegExp("[^1-" + p.size + "]", "g");

    for (var r = 0; r < p.size; r++) {
      for (var c = 0; c < p.size; c++) {
        var idx = r * p.size + c;
        var val = p.puzzle[idx];

        var div = document.createElement("div");
        div.className = "cell";
        if ((c + 1) % p.boxCols === 0 && c + 1 !== p.size) div.classList.add("thick-right");
        if ((r + 1) % p.boxRows === 0 && r + 1 !== p.size) div.classList.add("thick-bottom");
        div.dataset.answer = p.solution[idx];

        if (val !== 0) {
          div.classList.add("given");
          div.textContent = val;
        } else {
          var input = document.createElement("input");
          input.type = "text";
          input.inputMode = "numeric";
          input.maxLength = 1;
          input.className = "sudoku-input";
          input.dataset.pos = idx;
          input.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
          input.addEventListener("input", function () {
            this.value = this.value.replace(digitRe, "").slice(0, 1);
            this.parentNode.classList.remove("wrong");
          });
          div.appendChild(input);
        }
        gridEl.appendChild(div);
      }
    }

    gridEl.classList.remove("show-answers");
    $("answers-btn").textContent = "Show Answers";
  }

  function renderMeta(p) {
    var level = (SudokuGen.DIFFICULTY[p.difficulty] || {}).label || "";
    $("print-title").textContent = p.title;
    $("print-meta").textContent =
      p.size + " × " + p.size + " grid · " + p.clues + " clues · " + level + " level";
    $("status").textContent =
      p.clues + " clues · " + p.size + " × " + p.size + " grid · " + level + " level";
  }

  function render(p) {
    current = p;
    renderGrid(p);
    renderMeta(p);
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var size = $("size").value;
    var diff = $("difficulty").value;
    render(SudokuGen.makePuzzle(size, diff));
  }

  function toggleAnswers() {
    var gridEl = $("puzzle-grid");
    var showing = gridEl.classList.toggle("show-answers");
    $("answers-btn").textContent = showing ? "Hide Answers" : "Show Answers";
  }

  function checkPuzzle() {
    if (!current) return;
    var gridEl = $("puzzle-grid");
    var inputs = gridEl.querySelectorAll("input.sudoku-input");
    var wrong = 0;
    var filled = 0;
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      var cell = inp.parentNode;
      cell.classList.remove("wrong");
      var v = inp.value.trim();
      if (v === "") continue;
      filled++;
      if (parseInt(v, 10) !== current.solution[+inp.dataset.pos]) {
        cell.classList.add("wrong");
        wrong++;
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "entry" : "entries") +
        " — fix " + (wrong === 1 ? "it" : "them") + " and check again.";
    } else if (filled === 0) {
      $("status").textContent = "Enter some numbers first, then check again.";
    } else if (filled === inputs.length) {
      $("status").textContent = "Solved! Every number is correct. 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var gridEl = $("puzzle-grid");
    if (withAnswers) {
      gridEl.classList.add("show-answers");
      $("print-title").textContent = (current ? current.title : "Sudoku") + " — Answers";
    } else {
      gridEl.classList.remove("show-answers");
      $("print-title").textContent = current ? current.title : "Sudoku";
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
