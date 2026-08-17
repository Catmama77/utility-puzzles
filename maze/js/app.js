/* ============================================================
   Maze tool page UI.
   Renders up to 2 mazes per page (print-friendly utility).
   On-screen: show solution path; print blank or with solution.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of mazes, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var sizeSel = $("size");
    Object.keys(MazeGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = MazeGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "12x12";

    var countSel = $("count");
    [1, 2].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n + " per page";
      countSel.appendChild(opt);
    });
    countSel.value = "1";
  }

  /* ---------- rendering ---------- */

  function renderMaze(m, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + m.cols + ", var(--maze-cell, 20px))";
    gridEl.classList.add("maze");

    for (var r = 0; r < m.rows; r++) {
      for (var c = 0; c < m.cols; c++) {
        var div = document.createElement("div");
        div.className = "maze-cell";
        div.dataset.r = r;
        div.dataset.c = c;
        var w = m.walls[r][c];
        div.style.borderTop = w.n ? "2px solid #1f2937" : "none";
        div.style.borderRight = w.e ? "2px solid #1f2937" : "none";
        div.style.borderBottom = w.s ? "2px solid #1f2937" : "none";
        div.style.borderLeft = w.w ? "2px solid #1f2937" : "none";
        if (r === m.start.r && c === m.start.c) {
          div.classList.add("maze-start");
          div.textContent = "S";
        } else if (r === m.end.r && c === m.end.c) {
          div.classList.add("maze-end");
          div.textContent = "E";
        }
        gridEl.appendChild(div);
      }
    }
  }

  function highlightSolution(m, gridEl) {
    var cells = gridEl.children;
    for (var i = 0; i < m.solution.length; i++) {
      var idx = m.solution[i].r * m.cols + m.solution[i].c;
      if (cells[idx]) cells[idx].classList.add("sol");
    }
  }

  function renderMeta(m, titleEl, metaEl) {
    titleEl.textContent = m.title;
    metaEl.textContent = "Find the path from S (start) to E (end) — there is exactly one route.";
  }

  function render(mazes) {
    current = mazes;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = mazes.length;
    sheetsEl.className = "sheets maze-sheets sheets-" + n;

    mazes.forEach(function (m, i) {
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

      renderMaze(m, grid);
      renderMeta(m, title, meta);
    });

    $("answers-btn").textContent = "Show Solution";
    $("status").textContent =
      n + (n === 1 ? " maze" : " mazes") + " generated — trace a path from S to E without crossing walls.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newMaze() {
    var size = $("size").value;
    var count = parseInt($("count").value, 10) || 1;
    render(MazeGen.makeBatch(count, size));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) showing = true;
    }
    showing = !showing;
    for (var j = 0; j < grids.length; j++) {
      if (showing) {
        highlightSolution(current[j], grids[j]);
      } else {
        var cells = grids[j].children;
        for (var k = 0; k < cells.length; k++) cells[k].classList.remove("sol");
      }
      grids[j].classList.toggle("show-answers", showing);
    }
    setAnswersBtn(showing ? "Hide Solution" : "Show Solution");
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      if (withAnswers) {
        highlightSolution(current[i], grids[i]);
        grids[i].classList.add("show-answers");
      } else {
        grids[i].classList.remove("show-answers");
        var cells = grids[i].children;
        for (var j = 0; j < cells.length; j++) cells[j].classList.remove("sol");
      }
    }
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    setTimeout(function () { window.print(); }, 30);
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    $("new-btn").addEventListener("click", newMaze);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newMaze();
  });
})();
