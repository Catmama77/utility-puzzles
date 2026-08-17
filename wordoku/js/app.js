/* ============================================================
   Wordoku tool page UI.
   Renders 1-8 letter-sudoku puzzles per page, on-screen solving
   with check, printable with answers.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles

  function $(id) { return document.getElementById(id); }

  function populateSelects() {
    var catSel = $("category");
    Object.keys(WORD_DATA).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";

    var sizeSel = $("size");
    Object.keys(WordokuGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = WordokuGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "9x9";

    var diffSel = $("difficulty");
    Object.keys(WordokuGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = WordokuGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";

    var countSel = $("count");
    [1, 2, 4, 6, 8].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n + " per page";
      countSel.appendChild(opt);
    });
    countSel.value = "1";
  }

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
        if (target) { target.focus(); if (target.select) target.select(); return; }
        r += dr; c += dc;
      }
    }
    inputs.forEach(function (inp) {
      inp.addEventListener("keydown", function (e) {
        var dr = 0, dc = 0;
        if (e.key === "ArrowUp") dr = -1;
        else if (e.key === "ArrowDown") dr = 1;
        else if (e.key === "ArrowLeft") dc = -1;
        else if (e.key === "ArrowRight") dc = 1;
        else return;
        if (e.preventDefault) e.preventDefault();
        move(this, dr, dc);
      });
    });
  }

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.size + ", max-content)";
    gridEl.classList.add("sudoku");

    var letterRe = new RegExp("[^A-Z]", "g");
    var inputs = [];
    var given = new Set();

    for (var r = 0; r < p.size; r++) {
      for (var c = 0; c < p.size; c++) {
        var idx = r * p.size + c;
        var clue = p.puzzle[idx];
        var sol = p.solution[idx];

        var div = document.createElement("div");
        div.className = "cell";
        if ((c + 1) % p.boxCols === 0 && c + 1 !== p.size) div.classList.add("thick-right");
        if ((r + 1) % p.boxRows === 0 && r + 1 !== p.size) div.classList.add("thick-bottom");
        div.dataset.answer = sol;

        if (clue !== 0) {
          div.classList.add("given");
          div.textContent = p.letters[clue - 1];
          given.add(idx);
        } else {
          var input = document.createElement("input");
          input.type = "text";
          input.maxLength = 1;
          input.className = "sudoku-input";
          input.dataset.pos = idx;
          input.dataset.nav = r + "," + c;
          input.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
          input.addEventListener("input", function () {
            this.value = this.value.replace(letterRe, "").toUpperCase().slice(0, 1);
            this.parentNode.classList.remove("wrong");
          });
          inputs.push(input);
          div.appendChild(input);
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, p.size);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (WordokuGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      p.size + " × " + p.size + " grid · letters " + p.letters.join(" ") +
      " · " + level + " level";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = puzzles.length;
    sheetsEl.className = "sheets sudoku-sheets sheets-" + n;

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

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — fill each row, column and box with every letter exactly once.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newPuzzle() {
    var cat = $("category").value;
    var size = $("size").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(WordokuGen.makeBatch(count, cat, size, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) showing = true;
    }
    showing = !showing;
    for (var j = 0; j < grids.length; j++) {
      if (showing) grids[j].classList.add("show-answers");
      else grids[j].classList.remove("show-answers");
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function checkPuzzle() {
    if (!current.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0, filled = 0, totalCells = 0;
    for (var g = 0; g < grids.length; g++) {
      var p = current[g];
      var inputs = grids[g].querySelectorAll("input.sudoku-input");
      totalCells += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        var cell = inp.parentNode;
        cell.classList.remove("wrong");
        var v = inp.value.trim().toUpperCase();
        if (!v) continue;
        filled++;
        if (v !== p.solution[+inp.dataset.pos]) {
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
      $("status").textContent = "Enter some letters first, then check again.";
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
    setTimeout(function () { window.print(); }, 30);
  }

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
