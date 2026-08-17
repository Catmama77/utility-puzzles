(function () {
  "use strict";

  var difficultyEl = document.getElementById("difficulty");
  var countEl = document.getElementById("count");
  var newBtn = document.getElementById("new-btn");
  var checkBtn = document.getElementById("check-btn");
  var answersBtn = document.getElementById("answers-btn");
  var printPuzzleBtn = document.getElementById("print-puzzle-btn");
  var printAnswersBtn = document.getElementById("print-answers-btn");
  var fillModeBtn = document.getElementById("mode-fill");
  var crossModeBtn = document.getElementById("mode-cross");
  var sheetsEl = document.getElementById("sheets");
  var statusEl = document.getElementById("status");

  var mode = "fill";
  var puzzles = [];

  function label(d) {
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  function setMode(m) {
    mode = m;
    fillModeBtn.classList.toggle("active", m === "fill");
    crossModeBtn.classList.toggle("active", m === "cross");
  }

  function render() {
    sheetsEl.innerHTML = "";
    var count = parseInt(countEl.value, 10) || 1;
    var diff = difficultyEl.value || "medium";
    puzzles = NonogramGen.generateSheet(diff, count);
    sheetsEl.className = "sheets nono-sheets sheets-" + count;
    for (var i = 0; i < puzzles.length; i++) renderSheet(puzzles[i], i, puzzles.length);
    statusEl.textContent = "";
  }

  function renderSheet(p, idx, total) {
    var n = p.size;
    var sheet = document.createElement("div");
    sheet.className = "puzzle-sheet";

    var head = document.createElement("div");
    head.className = "print-heading";
    var h1 = document.createElement("h1");
    h1.textContent = "Nonogram — " + label(p.difficulty) + (total > 1 ? " — Puzzle " + (idx + 1) + " of " + total : "");
    head.appendChild(h1);
    sheet.appendChild(head);

    var grid = document.createElement("div");
    grid.className = "puzzle-grid nonogram";
    grid.style.setProperty("--n", n);

    // corner cell
    grid.appendChild(clueCell("", "corner"));
    // column clue row
    for (var c = 0; c < n; c++) grid.appendChild(clueCell(p.clues.cols[c].join("\n"), "col"));
    // rows: gutter clue + cells
    for (var r = 0; r < n; r++) {
      grid.appendChild(clueCell(p.clues.rows[r].join(" "), "row"));
      for (var cc = 0; cc < n; cc++) {
        var cell = document.createElement("div");
        cell.className = "cell";
        cell.tabIndex = 0;
        cell.dataset.r = r;
        cell.dataset.c = cc;
        grid.appendChild(cell);
      }
    }
    sheet.appendChild(grid);

    var legend = document.createElement("div");
    legend.className = "nono-legend";
    legend.innerHTML = "Click a square to fill it <b>■</b> · right-click or Shift+click (or use <b>Mark ×</b>) to mark an empty square <b>×</b>";
    sheet.appendChild(legend);

    sheetsEl.appendChild(sheet);
  }

  function clueCell(text, kind) {
    var el = document.createElement("div");
    el.className = "nono-clue " + kind;
    if (kind === "col") {
      // stacked numbers, bottom-aligned toward the grid
      var parts = text.split("\n");
      for (var i = 0; i < parts.length; i++) {
        var s = document.createElement("span");
        s.textContent = parts[i];
        el.appendChild(s);
      }
    } else {
      el.textContent = text;
    }
    return el;
  }

  // ---- interactions (event delegation on the sheets container) ----

  sheetsEl.addEventListener("click", function (e) {
    var cell = e.target.closest ? e.target.closest(".cell") : null;
    if (!cell) return;
    if (e.shiftKey) { toggleCross(cell); return; }
    if (mode === "fill") toggleBlack(cell);
    else toggleCross(cell);
  });

  sheetsEl.addEventListener("contextmenu", function (e) {
    var cell = e.target.closest ? e.target.closest(".cell") : null;
    if (!cell) return;
    e.preventDefault();
    toggleCross(cell);
  });

  function toggleBlack(el) {
    if (el.classList.contains("black")) el.classList.remove("black");
    else { el.classList.add("black"); el.classList.remove("cross"); }
    el.classList.remove("wrong");
  }

  function toggleCross(el) {
    if (el.classList.contains("cross")) el.classList.remove("cross");
    else { el.classList.add("cross"); el.classList.remove("black"); }
    el.classList.remove("wrong");
  }

  // arrow-key navigation between cells
  sheetsEl.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    var cell = e.target.closest ? e.target.closest(".cell") : null;
    if (!cell || !cell.dataset.r) return;
    e.preventDefault();
    var grid = cell.closest(".puzzle-grid");
    var n = parseInt(grid.style.getPropertyValue("--n"), 10);
    var r = parseInt(cell.dataset.r, 10);
    var c = parseInt(cell.dataset.c, 10);
    var nr = r, nc = c;
    if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
    else if (e.key === "ArrowDown") nr = Math.min(n - 1, r + 1);
    else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
    else nc = Math.min(n - 1, c + 1);
    var target = grid.querySelector('.cell[data-r="' + nr + '"][data-c="' + nc + '"]');
    if (target) target.focus();
  });

  // ---- actions ----

  function check() {
    var wrongTotal = 0;
    var grids = sheetsEl.querySelectorAll(".puzzle-grid.nonogram");
    for (var g = 0; g < grids.length; g++) {
      var grid = grids[g];
      var p = puzzles[g];
      var cells = grid.querySelectorAll(".cell");
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var r = parseInt(cell.dataset.r, 10);
        var c = parseInt(cell.dataset.c, 10);
        var expectBlack = p.solution[r][c];
        var isBlack = cell.classList.contains("black");
        if (isBlack !== expectBlack) {
          cell.classList.add("wrong");
          wrongTotal++;
        } else {
          cell.classList.remove("wrong");
        }
      }
    }
    if (wrongTotal === 0) {
      statusEl.textContent = "Everything you've entered is correct so far!";
    } else {
      statusEl.textContent = wrongTotal + " square" + (wrongTotal === 1 ? "" : "s") + " don't match yet — check the highlighted squares.";
    }
  }

  function showAnswers() {
    var grids = sheetsEl.querySelectorAll(".puzzle-grid.nonogram");
    for (var g = 0; g < grids.length; g++) {
      var p = puzzles[g];
      var cells = grids[g].querySelectorAll(".cell");
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var r = parseInt(cell.dataset.r, 10);
        var c = parseInt(cell.dataset.c, 10);
        cell.classList.remove("wrong", "cross");
        if (p.solution[r][c]) cell.classList.add("black");
        else cell.classList.remove("black");
      }
    }
    statusEl.textContent = "Answers shown.";
  }

  function fillAnswersInDom() {
    var grids = sheetsEl.querySelectorAll(".puzzle-grid.nonogram");
    for (var g = 0; g < grids.length; g++) {
      var p = puzzles[g];
      var cells = grids[g].querySelectorAll(".cell");
      for (var i = 0; i < cells.length; i++) {
        var cell = cells[i];
        var r = parseInt(cell.dataset.r, 10);
        var c = parseInt(cell.dataset.c, 10);
        cell.classList.remove("cross", "wrong");
        if (p.solution[r][c]) cell.classList.add("black");
        else cell.classList.remove("black");
      }
    }
  }

  function printAnswers() {
    fillAnswersInDom();
    window.print();
    // restore the blank puzzle after the print dialog closes
    window.addEventListener("afterprint", function () { render(); }, { once: true });
    setTimeout(function () { render(); }, 1500);
  }

  newBtn.addEventListener("click", render);
  checkBtn.addEventListener("click", check);
  answersBtn.addEventListener("click", showAnswers);
  printPuzzleBtn.addEventListener("click", function () { window.print(); });
  printAnswersBtn.addEventListener("click", printAnswers);
  fillModeBtn.addEventListener("click", function () { setMode("fill"); });
  crossModeBtn.addEventListener("click", function () { setMode("cross"); });
  difficultyEl.addEventListener("change", render);
  countEl.addEventListener("change", render);

  setMode("fill");
  render();
})();
