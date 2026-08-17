/* ============================================================
   Futoshiki tool page UI.
   Renders 1-2 futoshiki puzzles per page (print-friendly).
   Every row and column holds 1..N once; the < > and chevron
   signs between cells point toward the smaller number.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(FutoshikiGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = FutoshikiGen.DIFFICULTY[d].label;
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

  function addArrowNav(gridEl, inputs, n) {
    var map = {};
    inputs.forEach(function (inp) {
      map[inp.dataset.r + "," + inp.dataset.c] = inp;
    });
    function move(from, dr, dc) {
      var r = +from.dataset.r + dr;
      var c = +from.dataset.c + dc;
      while (r >= 0 && r < n && c >= 0 && c < n) {
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
        var dr = 0, dc = 0, key = e.key;
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

  function signChar(signs, a, b) {
    for (var i = 0; i < signs.length; i++) {
      if (signs[i].a === a && signs[i].b === b) {
        return signs[i].lt ? "<" : ">";
      }
    }
    return "";
  }

  function vSignChar(signs, a, b) {
    for (var i = 0; i < signs.length; i++) {
      if (signs[i].a === a && signs[i].b === b) {
        return signs[i].lt ? "∧" : "∨";
      }
    }
    return "";
  }

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    var size = 2 * p.n - 1;
    gridEl.style.gridTemplateColumns = "repeat(" + size + ", max-content)";
    gridEl.classList.add("futoshiki", "puzzle-grid");
    var inputs = [];

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var div = document.createElement("div");
        if (r % 2 === 0 && c % 2 === 0) {
          div.className = "cell ft-num";
          var i = (r / 2) * p.n + c / 2;
          div.dataset.answer = p.num[i];
          if (p.given[i]) {
            div.classList.add("given");
            div.textContent = p.num[i];
          } else {
            div.classList.add("blank");
            var input = document.createElement("input");
            input.type = "text";
            input.inputMode = "numeric";
            input.maxLength = 1;
            input.className = "ft-input";
            input.dataset.pos = i;
            input.dataset.r = r / 2;
            input.dataset.c = c / 2;
            input.setAttribute("aria-label", "Row " + (r / 2 + 1) + ", column " + (c / 2 + 1));
            input.addEventListener("input", function () {
              this.value = this.value.replace(/[^0-9]/g, "").slice(0, 1);
              this.parentNode.classList.remove("wrong");
            });
            inputs.push(input);
            div.appendChild(input);
          }
        } else if (r % 2 === 0 && c % 2 === 1) {
          // horizontal sign between (r/2, (c-1)/2) and (r/2, (c+1)/2)
          if (c >= 1 && c <= size - 2) {
            var a = (r / 2) * p.n + (c - 1) / 2;
            var b = (r / 2) * p.n + (c + 1) / 2;
            div.className = "cell ft-hsign";
            div.textContent = signChar(p.signs, a, b);
          } else {
            div.className = "cell ft-fill";
          }
        } else if (r % 2 === 1 && c % 2 === 0) {
          if (r >= 1 && r <= size - 2) {
            var a2 = ((r - 1) / 2) * p.n + c / 2;
            var b2 = ((r + 1) / 2) * p.n + c / 2;
            div.className = "cell ft-vsign";
            div.textContent = vSignChar(p.signs, a2, b2);
          } else {
            div.className = "cell ft-fill";
          }
        } else {
          div.className = "cell ft-fill";
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, p.n);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (FutoshikiGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      level + " level · fill the grid so every row and column has 1–" + p.n +
      " once, and every sign points toward the smaller number.";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    sheetsEl.className = "sheets futoshiki-sheets sheets-" + puzzles.length;

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
      puzzles.length + (puzzles.length === 1 ? " puzzle" : " puzzles") +
      " generated — fill in the missing digits so every row, column and inequality works.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(FutoshikiGen.makeBatch(count, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) showing = true;
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
    var wrong = 0, filled = 0, totalCells = 0;
    for (var g = 0; g < grids.length; g++) {
      var p = current[g];
      var inputs = grids[g].querySelectorAll("input.ft-input");
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
        " — check every row, column and inequality sign.";
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
