/* ============================================================
   Hidato tool page UI.
   Renders 1-2 hidato puzzles per page (print-friendly).
   Fill the blank cells with consecutive numbers so each number
   sits next to the previous one (including diagonally).
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(HidatoGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = HidatoGen.DIFFICULTY[d].label;
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

  function addArrowNav(gridEl, inputs, cols) {
    var map = {};
    inputs.forEach(function (inp) {
      map[inp.dataset.r + "," + inp.dataset.c] = inp;
    });
    function move(from, dr, dc) {
      var r = +from.dataset.r + dr;
      var c = +from.dataset.c + dc;
      while (r >= 0 && r < 99 && c >= 0 && c < cols) {
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

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.cols + ", max-content)";
    gridEl.classList.add("hidato", "puzzle-grid");
    var inputs = [];

    for (var i = 0; i < p.n; i++) {
      var div = document.createElement("div");
      div.className = "cell hd-cell";
      div.dataset.answer = p.num[i];
      if (p.given[i]) {
        div.classList.add("given");
        div.textContent = p.num[i];
      } else {
        div.classList.add("blank");
        var input = document.createElement("input");
        input.type = "text";
        input.inputMode = "numeric";
        input.maxLength = 3;
        input.className = "hd-input";
        input.dataset.pos = i;
        input.dataset.r = Math.floor(i / p.cols);
        input.dataset.c = i % p.cols;
        input.setAttribute("aria-label", "Row " + (Math.floor(i / p.cols) + 1) + ", column " + (i % p.cols + 1));
        input.addEventListener("input", function () {
          this.value = this.value.replace(/[^0-9]/g, "").slice(0, 3);
          this.parentNode.classList.remove("wrong");
        });
        inputs.push(input);
        div.appendChild(input);
      }
      gridEl.appendChild(div);
    }
    addArrowNav(gridEl, inputs, p.cols);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (HidatoGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      level + " level · fill the grid with consecutive numbers 1–" + p.n +
      ", each next to the previous one (including diagonally).";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    sheetsEl.className = "sheets hidato-sheets sheets-" + puzzles.length;

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
      " generated — fill the blanks with consecutive numbers, each next to the last.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(HidatoGen.makeBatch(count, diff));
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
      var inputs = grids[g].querySelectorAll("input.hd-input");
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
        " — check the sequence and the adjacency rule.";
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
