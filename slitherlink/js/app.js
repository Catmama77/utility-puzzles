/* ============================================================
   Slitherlink tool page UI.
   Renders 1-2 slitherlink puzzles per page. Click a grid line
   to draw it (toggle), click again to cross it out, click again
   to clear. Draw a single closed loop so every numbered cell
   has exactly that many of its sides used.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet
  var edgeState = []; // per sheet: { eid: "line" | "cross" | undefined }

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(SlitherGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = SlitherGen.DIFFICULTY[d].label;
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

  /* ---------- edge geometry ---------- */

  // matches the generator's indexing:
  // horizontal (r,c)-(r,c+1) for r in 0..h, c in 0..w-1 -> id = r*w + c
  // vertical (r,c)-(r+1,c) for r in 0..h-1, c in 0..w -> id = (h+1)*w + r*(w+1) + c
  function hedgeId(w, r, c) { return r * w + c; }
  function vedgeId(w, h, r, c) { return (h + 1) * w + r * (w + 1) + c; }

  /* ---------- rendering ---------- */

  function renderGrid(p, gridEl, sheetIndex) {
    gridEl.innerHTML = "";
    var w = p.w, h = p.h;
    var rows = 2 * h + 1, cols = 2 * w + 1;
    gridEl.style.gridTemplateColumns = "repeat(" + cols + ", max-content)";
    gridEl.classList.add("slitherlink", "puzzle-grid");
    var state = {};
    edgeState[sheetIndex] = state;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var div = document.createElement("div");
        if (r % 2 === 0 && c % 2 === 0) {
          div.className = "cell sl-dot";
        } else if (r % 2 === 0 && c % 2 === 1) {
          // horizontal edge between (r/2, (c-1)/2) and (r/2, (c+1)/2)
          var eidH = hedgeId(w, r / 2, (c - 1) / 2);
          div.className = "cell sl-edge sl-hedge";
          div.dataset.eid = eidH;
          div.dataset.sheet = sheetIndex;
          div.addEventListener("click", function () { toggleEdge(this); });
          div.addEventListener("contextmenu", function (e) {
            if (e.preventDefault) e.preventDefault();
            crossEdge(this);
          });
        } else if (r % 2 === 1 && c % 2 === 0) {
          var eidV = vedgeId(w, h, (r - 1) / 2, c / 2);
          div.className = "cell sl-edge sl-vedge";
          div.dataset.eid = eidV;
          div.dataset.sheet = sheetIndex;
          div.addEventListener("click", function () { toggleEdge(this); });
          div.addEventListener("contextmenu", function (e) {
            if (e.preventDefault) e.preventDefault();
            crossEdge(this);
          });
        } else {
          // clue cell
          var i = ((r - 1) / 2) * w + (c - 1) / 2;
          div.className = "cell sl-clue";
          if (p.clues[i] >= 0) div.textContent = p.clues[i];
        }
        gridEl.appendChild(div);
      }
    }
  }

  function toggleEdge(el) {
    var eid = +el.dataset.eid;
    var state = edgeState[+el.dataset.sheet];
    var cur = state[eid];
    if (cur === "line") state[eid] = "cross";
    else if (cur === "cross") delete state[eid];
    else state[eid] = "line";
    paintEdge(el, state[eid]);
  }

  function crossEdge(el) {
    var eid = +el.dataset.eid;
    var state = edgeState[+el.dataset.sheet];
    if (state[eid] === "cross") delete state[eid];
    else state[eid] = "cross";
    paintEdge(el, state[eid]);
  }

  function paintEdge(el, mark) {
    el.classList.remove("on", "cross");
    el.textContent = "";
    if (mark === "line") el.classList.add("on");
    else if (mark === "cross") { el.classList.add("cross"); el.textContent = "✕"; }
  }

  function renderMeta(p, titleEl, metaEl) {
    var level = (SlitherGen.DIFFICULTY[p.difficulty] || {}).label || "";
    titleEl.textContent = p.title;
    metaEl.textContent =
      level + " level · draw a single closed loop so every numbered " +
      "cell has exactly that many of its four sides used by the loop.";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    sheetsEl.className = "sheets slitherlink-sheets sheets-" + puzzles.length;

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

      renderGrid(p, grid, i);
      renderMeta(p, title, meta);
    });

    setAnswersBtn("Show Answers");
    $("status").textContent =
      puzzles.length + (puzzles.length === 1 ? " puzzle" : " puzzles") +
      " generated — click grid lines to draw the loop.";
  }

  function setAnswersBtn(label) {
    $("answers-btn").textContent = label;
  }

  /* ---------- actions ---------- */

  function newPuzzle() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(SlitherGen.makeBatch(count, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = grids.length && grids[0].classList.contains("show-answers");
    showing = !showing;
    for (var i = 0; i < grids.length; i++) {
      grids[i].classList.toggle("show-answers", showing);
      paintAnswers(grids[i], current[i], showing);
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function paintAnswers(gridEl, p, showing) {
    var w = p.w, h = p.h;
    var segments = gridEl.querySelectorAll(".sl-edge");
    for (var s = 0; s < segments.length; s++) {
      var el = segments[s];
      if (showing) {
        if (p.loop[+el.dataset.eid]) el.classList.add("answer-line");
      } else {
        el.classList.remove("answer-line");
      }
    }
  }

  function checkPuzzle() {
    if (!current.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0, drawn = 0, loopEdges = 0;
    for (var g = 0; g < grids.length; g++) {
      var p = current[g];
      var state = edgeState[g] || {};
      var segs = grids[g].querySelectorAll(".sl-edge");
      for (var s = 0; s < segs.length; s++) {
        var eid = +segs[s].dataset.eid;
        var isLine = state[eid] === "line";
        if (isLine) drawn++;
        if (p.loop[eid]) loopEdges++;
        if (isLine !== !!p.loop[eid]) wrong++;
      }
    }
    if (drawn === 0) {
      $("status").textContent = "Click grid lines to draw your loop, then check again.";
    } else if (wrong > 0) {
      $("status").textContent = wrong + " edge" + (wrong === 1 ? "" : "s") +
        " wrong — the loop must use exactly the right lines.";
    } else if (drawn === loopEdges) {
      $("status").textContent = "Solved! Your loop is exactly right. 🎉";
    } else {
      $("status").textContent = "Everything drawn so far is correct — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      grids[i].classList.remove("show-answers");
      if (withAnswers) paintAnswers(grids[i], current[i], true);
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
