/* ============================================================
   Killer Sudoku tool page UI.
   Renders 1–2 killer sudoku puzzles per page (print-friendly).
   On-screen solving: type digits 1-9 into any cell, Check
   verifies each entry against the unique solution, Show Answers
   fills the whole grid. Cage borders and corner sums come from
   the generator's `edges` and `clueAt` data.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(KillerGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = KillerGen.DIFFICULTY[d].label;
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

  /* Arrow keys move focus between adjacent cells. Coordinates
     come from each input's data-nav ("r,c"). */
  function addArrowNav(gridEl, inputs, size) {
    var map = {};
    inputs.forEach(function (inp) {
      var p = inp.dataset.nav.split(",");
      map[p[0] + "," + p[1]] = inp;
    });
    function move(from, dr, dc) {
      var p = from.dataset.nav.split(",");
      var r = +p[0] + dr;
      var c = +p[1] + dc;
      while (r >= 0 && r < size && c >= 0 && c < size) {
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
        var dr = 0;
        var dc = 0;
        var key = e.key;
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

  /* ---------- rendering ---------- */

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.size + ", max-content)";
    gridEl.classList.add("killer");

    // cage sum shown in the top-left-most cell of each cage
    var clueText = new Array(p.size * p.size);
    for (var ci = 0; ci < p.cages.length; ci++) {
      clueText[p.clueAt[ci]] = p.cages[ci].sum;
    }

    var inputs = [];
    for (var r = 0; r < p.size; r++) {
      for (var c = 0; c < p.size; c++) {
        var idx = r * p.size + c;
        var e = p.edges[idx];

        var div = document.createElement("div");
        div.className = "cell";
        if (e.t) div.classList.add("thick-t");
        if (e.r) div.classList.add("thick-r");
        if (e.b) div.classList.add("thick-b");
        if (e.l) div.classList.add("thick-l");
        div.dataset.answer = p.solution[idx];

        if (clueText[idx] !== undefined) {
          var clue = document.createElement("span");
          clue.className = "killer-clue";
          clue.textContent = clueText[idx];
          div.appendChild(clue);
        }

        var input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 1;
        input.className = "killer-input";
        input.dataset.pos = idx;
        input.dataset.nav = r + "," + c;
        input.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
        input.addEventListener("input", function () {
          this.value = this.value.replace(/[^1-9]/g, "").slice(0, 1);
          this.parentNode.classList.remove("wrong");
        });
        inputs.push(input);
        div.appendChild(input);
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, p.size);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (KillerGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      "9 × 9 grid · " + p.cageCount + " cages · " + level + " level";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";

    var n = puzzles.length;
    sheetsEl.className = "sheets killer-sheets sheets-" + n;

    puzzles.forEach(function (p, i) {
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

      sheet.appendChild(head);
      sheet.appendChild(grid);
      sheetsEl.appendChild(sheet);

      renderGrid(p, grid);
      renderMeta(p, title, meta);
    });

    setAnswersBtn("Show Answers");
    $("status").textContent =
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — fill each cage so its digits add up to the corner clue, with 1–9 exactly once in every row, column and box.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(KillerGen.makeBatch(count, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      var g = grids[i];
      if (g.classList.contains("show-answers")) showing = true;
    }
    showing = !showing;
    for (var j = 0; j < grids.length; j++) {
      grids[j].classList.toggle("show-answers", showing);
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function checkPuzzle() {
    if (!current.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0;
    var filled = 0;
    var totalCells = 0;
    for (var g = 0; g < grids.length; g++) {
      var grid = grids[g];
      var p = current[g];
      var inputs = grid.querySelectorAll("input.killer-input");
      totalCells += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var cell = inp.parentNode;
        cell.classList.remove("wrong");
        var v = inp.value.trim();
        if (v === "") continue;
        filled++;
        if (parseInt(v, 10) !== p.solution[+inp.dataset.pos]) {
          cell.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "entry" : "entries") +
        " — check the cage sums and remember no digit repeats in a row, column or box.";
    } else if (filled === 0) {
      $("status").textContent = "Enter some numbers first, then check again.";
    } else if (filled === totalCells) {
      $("status").textContent = "Solved! Every number is correct. 🎉";
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
