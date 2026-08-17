/* ============================================================
   Skyscrapers tool page UI.
   Renders 1-2 skyscrapers puzzles per page (print-friendly).
   The grid is bordered by visibility clues; fill the inner
   cells so every row and column holds 1..N once and the clue
   numbers match the buildings visible from each side.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(SkyGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = SkyGen.DIFFICULTY[d].label;
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

  function clueAt(p, r, c) {
    var n = p.n;
    if (r === 0 && c >= 1 && c <= n) return p.clues[c - 1];            // top
    if (r === n + 1 && c >= 1 && c <= n) return p.clues[2 * n + c - 1]; // bottom
    if (c === 0 && r >= 1 && r <= n) return p.clues[3 * n + r - 1];     // left
    if (c === n + 1 && r >= 1 && r <= n) return p.clues[n + r - 1];     // right
    return 0;
  }

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    var n = p.n;
    var size = n + 2;
    gridEl.style.gridTemplateColumns = "repeat(" + size + ", max-content)";
    gridEl.classList.add("skyscrapers", "puzzle-grid");
    var inputs = [];

    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        var div = document.createElement("div");
        var clue = clueAt(p, r, c);
        if (clue) {
          div.className = "cell sky-clue";
          div.textContent = clue;
        } else if (r >= 1 && r <= n && c >= 1 && c <= n) {
          var i = (r - 1) * n + (c - 1);
          div.className = "cell sky-num";
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
            input.className = "sky-input";
            input.dataset.pos = i;
            input.dataset.r = r - 1;
            input.dataset.c = c - 1;
            input.setAttribute("aria-label", "Row " + r + ", column " + c);
            input.addEventListener("input", function () {
              this.value = this.value.replace(/[^0-9]/g, "").slice(0, 1);
              this.parentNode.classList.remove("wrong");
            });
            inputs.push(input);
            div.appendChild(input);
          }
        } else {
          div.className = "cell sky-fill";
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, n);
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (SkyGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      level + " level · place heights 1–" + p.n + " in every row and column so the " +
      "edge numbers match the buildings visible from each side.";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    sheetsEl.className = "sheets skyscrapers-sheets sheets-" + puzzles.length;

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
      " generated — fill the grid so every row, column and clue works.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(SkyGen.makeBatch(count, diff));
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
      var inputs = grids[g].querySelectorAll("input.sky-input");
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
        " — check every row, column and edge clue.";
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
