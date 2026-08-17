/* ============================================================
   Kakuro tool page UI.
   Renders up to 2 kakuro puzzles per page (print-friendly utility).
   On-screen solving: type digits 1-9 into white cells, Check
   verifies sums and repeats; Show Answers fills every cell.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var sizeSel = $("size");
    Object.keys(KakuroGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = KakuroGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "10x10";

    var diffSel = $("difficulty");
    Object.keys(KakuroGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = KakuroGen.DIFFICULTY[d].label;
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

  function addArrowNav(gridEl, inputs, rows, cols) {
    var map = {};
    inputs.forEach(function (inp) {
      map[inp.dataset.r + "," + inp.dataset.c] = inp;
    });
    function move(from, dr, dc) {
      var r = +from.dataset.r + dr;
      var c = +from.dataset.c + dc;
      while (r >= 0 && r < rows && c >= 0 && c < cols) {
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

  /* ---------- rendering ---------- */

  function renderGrid(p, gridEl) {
    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = "repeat(" + p.cols + ", max-content)";
    gridEl.classList.add("kakuro");

    var inputs = [];
    for (var r = 0; r < p.rows; r++) {
      for (var c = 0; c < p.cols; c++) {
        var cell = p.grid[r][c];
        var div = document.createElement("div");
        div.className = "cell kakuro-cell";
        div.dataset.answer = cell.digit || "";

        if (cell.black) {
          div.classList.add("black");
          var clueEl = document.createElement("div");
          clueEl.className = "kakuro-clue";
          if (cell.down) {
            var d = document.createElement("span");
            d.className = "kakuro-down";
            d.textContent = cell.down;
            clueEl.appendChild(d);
          }
          if (cell.across) {
            var a = document.createElement("span");
            a.className = "kakuro-across";
            a.textContent = cell.across;
            clueEl.appendChild(a);
          }
          div.appendChild(clueEl);
        } else {
          var input = document.createElement("input");
          input.type = "text";
          input.maxLength = 1;
          input.className = "kakuro-input";
          input.dataset.r = r;
          input.dataset.c = c;
          input.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
          input.addEventListener("input", function () {
            this.value = this.value.replace(/[^1-9]/g, "").slice(0, 1);
            this.parentNode.classList.remove("wrong");
          });
          inputs.push(input);
          div.appendChild(input);
        }
        gridEl.appendChild(div);
      }
    }
    addArrowNav(gridEl, inputs, p.rows, p.cols);
  }

  function renderMeta(p, titleEl, metaEl) {
    titleEl.textContent = p.title;
    metaEl.textContent =
      "Fill white cells with 1–9 so each run of digits adds up to the clue in its black cell — no digit repeats within a run.";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = puzzles.length;
    sheetsEl.className = "sheets kakuro-sheets sheets-" + n;

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
      n + (n === 1 ? " puzzle" : " puzzles") + " generated — fill each white run so its digits add up to the clue.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newPuzzle() {
    var size = $("size").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(KakuroGen.makeBatch(count, size, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) showing = true;
    }
    showing = !showing;
    for (var j = 0; j < grids.length; j++) {
      if (showing) fillAnswers(current[j], grids[j]);
      grids[j].classList.toggle("show-answers", showing);
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function fillAnswers(p, gridEl) {
    var inputs = gridEl.querySelectorAll(".kakuro-input");
    for (var i = 0; i < inputs.length; i++) {
      var cell = p.grid[+inputs[i].dataset.r][+inputs[i].dataset.c];
      if (cell && cell.digit) {
        inputs[i].value = cell.digit;
        inputs[i].disabled = true;
        inputs[i].parentNode.classList.add("answered");
      }
    }
  }

  function checkPuzzle() {
    if (!current.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0, filled = 0, total = 0;
    for (var g = 0; g < grids.length; g++) {
      var p = current[g];
      var inputs = grids[g].querySelectorAll(".kakuro-input");
      total += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        inp.parentNode.classList.remove("wrong");
        var v = inp.value.trim();
        if (!v) continue;
        filled++;
        var cell = p.grid[+inp.dataset.r][+inp.dataset.c];
        if (cell && v !== String(cell.digit)) {
          inp.parentNode.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "cell" : "cells") +
        " — check the sums and make sure no digit repeats in a run.";
    } else if (filled === 0) {
      $("status").textContent = "Enter some digits first, then check again.";
    } else if (filled === total) {
      $("status").textContent = "Solved! Every digit is correct. 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      if (withAnswers) {
        fillAnswers(current[i], grids[i]);
        grids[i].classList.add("show-answers");
      } else {
        grids[i].classList.remove("show-answers");
        var inputs = grids[i].querySelectorAll(".kakuro-input");
        for (var j = 0; j < inputs.length; j++) {
          inputs[j].disabled = false;
          inputs[j].parentNode.classList.remove("answered");
        }
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
    $("new-btn").addEventListener("click", newPuzzle);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("check-btn").addEventListener("click", checkPuzzle);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newPuzzle();
  });
})();
