/* ============================================================
   Cross Math tool page UI.
   Renders 1–2 cross math puzzles per page (print-friendly).
   Each row and each column of the grid is a math equation using
   +, −, × and ÷; equations read left to right. Some digits are
   given — fill in the blanks so every row and column is true.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(CrossMathGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = CrossMathGen.DIFFICULTY[d].label;
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

  /* Arrow keys move focus between blank number cells. */
  function addArrowNav(gridEl, inputs, k) {
    var map = {};
    inputs.forEach(function (inp) {
      map[inp.dataset.r + "," + inp.dataset.c] = inp;
    });
    function move(from, dr, dc) {
      var r = +from.dataset.r + dr;
      var c = +from.dataset.c + dc;
      while (r >= 0 && r < k && c >= 0 && c < k) {
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

  /* What kind of cell sits at (r, c) of the full (2k-1) grid:
     num = digit, rop/cop = row/column operator, eq = "=",
     unused = shaded filler. */
  function cellKind(r, c, k) {
    var edge = 2 * k - 2;
    if (r % 2 === 0 && c % 2 === 0) return "num";
    if (r % 2 === 0 && c % 2 === 1) {
      if (c === edge - 1) return "eq";      // "=" at the far right
      if (c <= edge - 3) return "rop";
      return "unused";
    }
    if (r % 2 === 1 && c % 2 === 0) {
      if (r === edge - 1) return "eq";      // "=" at the bottom
      if (r <= edge - 3) return "cop";
      return "unused";
    }
    return "unused";
  }

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.size + ", max-content)";
    gridEl.classList.add("cross-math");
    if (gridEl.classList.contains("puzzle-grid") === false) gridEl.classList.add("puzzle-grid");

    var k = p.k;
    var edge = 2 * k - 2;
    var inputs = [];

    for (var r = 0; r < p.size; r++) {
      for (var c = 0; c < p.size; c++) {
        var kind = cellKind(r, c, k);
        var div = document.createElement("div");
        div.className = "cell cm-" + kind;

        if (kind === "num") {
          var i = (r / 2) * k + c / 2;
          var val = p.num[i];
          div.dataset.answer = val;
          if (p.given[i]) {
            div.classList.add("given");
            div.textContent = val;
          } else {
            div.classList.add("blank");
            var input = document.createElement("input");
            input.type = "text";
            input.inputMode = "numeric";
            input.maxLength = 1;
            input.className = "cm-input";
            input.dataset.pos = i;
            input.dataset.r = r / 2;
            input.dataset.c = c / 2;
            input.setAttribute("aria-label", "Row " + (r / 2 + 1) + ", column " + (c / 2 + 1));
            input.addEventListener("input", function () {
              this.value = this.value.replace(/[^1-9]/g, "").slice(0, 1);
              this.parentNode.classList.remove("wrong");
            });
            inputs.push(input);
            div.appendChild(input);
          }
        } else if (kind === "rop") {
          div.textContent = p.rowOps[(r / 2) * (k - 2) + (c - 1) / 2];
        } else if (kind === "cop") {
          div.textContent = p.colOps[(c / 2) * (k - 2) + (r - 1) / 2];
        } else if (kind === "eq") {
          div.textContent = "=";
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, k);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (CrossMathGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      level + " level · fill the blanks so every row and column equation is true (work left to right).";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";

    var n = puzzles.length;
    sheetsEl.className = "sheets cross-math-sheets sheets-" + n;

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
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — fill in the blank numbers so every row and column adds, subtracts, multiplies or divides correctly.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(CrossMathGen.makeBatch(count, diff));
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
      var inputs = grid.querySelectorAll("input.cm-input");
      totalCells += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var cell = inp.parentNode;
        cell.classList.remove("wrong");
        var v = inp.value.trim();
        if (v === "") continue;
        filled++;
        if (parseInt(v, 10) !== p.num[+inp.dataset.pos]) {
          cell.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "entry" : "entries") +
        " — check that every row and column is a correct equation.";
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
