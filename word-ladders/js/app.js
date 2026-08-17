/* ============================================================
   Word ladder tool page UI.
   Renders up to 2 ladders per page (print-friendly utility).
   On-screen solving: type each missing rung, Check verifies them;
   Show Answers fills every rung in.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of ladders, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var diffSel = $("difficulty");
    Object.keys(LadderGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = LadderGen.DIFFICULTY[d].label;
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

  /* ---------- rendering ---------- */

  function renderLadder(l, gridEl) {
    gridEl.innerHTML = "";
    gridEl.classList.add("ladder");

    l.rungs.forEach(function (rung, i) {
      var isEnd = i === 0 || i === l.rungs.length - 1;
      var row = document.createElement("div");
      row.className = "ladder-rung";

      var label = document.createElement("div");
      label.className = "ladder-pos";
      label.textContent = (i === 0 ? "Start" : (isEnd ? "End" : "Step " + i));
      row.appendChild(label);

      if (isEnd) {
        var wordEl = document.createElement("div");
        wordEl.className = "ladder-word given";
        wordEl.textContent = rung.word;
        row.appendChild(wordEl);
      } else {
        var input = document.createElement("input");
        input.type = "text";
        input.maxLength = rung.word.length;
        input.size = rung.word.length;
        input.className = "ladder-input";
        input.dataset.pos = i;
        input.setAttribute("aria-label", "Rung " + i);
        input.addEventListener("input", function () {
          this.value = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, rung.word.length);
          this.parentNode.classList.remove("wrong");
        });
        row.appendChild(input);
      }
      gridEl.appendChild(row);
    });
  }

  function renderMeta(l, titleEl, metaEl) {
    titleEl.textContent = l.title;
    metaEl.textContent =
      "Change one letter at a time to get from “" + l.start + "” to “" + l.end +
      "” in " + l.length + " step" + (l.length === 1 ? "" : "s") + ".";
  }

  function render(ladders) {
    current = ladders;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = ladders.length;
    sheetsEl.className = "sheets ladder-sheets sheets-" + n;

    ladders.forEach(function (l, i) {
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

      renderLadder(l, grid);
      renderMeta(l, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " ladder" : " ladders") + " generated — each step changes exactly one letter.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newLadder() {
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(LadderGen.makeBatch(count, diff));
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = false;
    for (var i = 0; i < grids.length; i++) {
      if (grids[i].classList.contains("show-answers")) showing = true;
    }
    showing = !showing;
    for (var j = 0; j < grids.length; j++) {
      if (showing) fillRungs(current[j], grids[j]);
      grids[j].classList.toggle("show-answers", showing);
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function fillRungs(l, gridEl) {
    var inputs = gridEl.querySelectorAll(".ladder-input");
    for (var i = 0; i < inputs.length; i++) {
      var pos = +inputs[i].dataset.pos;
      var rung = l.rungs[pos];
      if (rung) {
        inputs[i].value = rung.word;
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
      var l = current[g];
      var inputs = grids[g].querySelectorAll(".ladder-input");
      total += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        inp.parentNode.classList.remove("wrong");
        var v = inp.value.trim().toUpperCase();
        if (!v) continue;
        filled++;
        var rung = l.rungs[+inp.dataset.pos];
        if (rung && v !== rung.word) {
          inp.parentNode.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "rung" : "rungs") +
        " — every step must differ from the one above by exactly one letter.";
    } else if (filled === 0) {
      $("status").textContent = "Fill in the missing rungs, then check again.";
    } else if (filled === total) {
      $("status").textContent = "Solved! Every rung is correct. 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function doPrint(withAnswers) {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    for (var i = 0; i < grids.length; i++) {
      if (withAnswers) {
        fillRungs(current[i], grids[i]);
        grids[i].classList.add("show-answers");
      } else {
        grids[i].classList.remove("show-answers");
        var inputs = grids[i].querySelectorAll(".ladder-input");
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
    $("new-btn").addEventListener("click", newLadder);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("check-btn").addEventListener("click", checkPuzzle);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newLadder();
  });
})();
