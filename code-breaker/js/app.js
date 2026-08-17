/* ============================================================
   Code breaker (secret message) tool page UI.
   Renders up to 2 code sheets per page (print-friendly utility).
   On-screen solving: type the decoded word under each code,
   Check verifies; Show Answers fills everything in.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of codes, one per sheet

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var catSel = $("category");
    Object.keys(WORD_DATA).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";

    var diffSel = $("difficulty");
    Object.keys(CipherGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = CipherGen.DIFFICULTY[d].label;
      diffSel.appendChild(opt);
    });
    diffSel.value = "medium";

    var clueSel = $("clues");
    clueSel.value = "1";

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

  function renderCode(c, gridEl) {
    gridEl.innerHTML = "";
    gridEl.classList.add("code-grid");

    c.words.forEach(function (w) {
      var row = document.createElement("div");
      row.className = "code-row";

      var num = document.createElement("div");
      num.className = "code-num";
      num.textContent = w.number;
      row.appendChild(num);

      var code = document.createElement("div");
      code.className = "code-encoded";
      code.textContent = w.encoded;
      row.appendChild(code);

      var input = document.createElement("input");
      input.type = "text";
      input.maxLength = w.word.length;
      input.size = w.word.length + 2;
      input.className = "code-input";
      input.dataset.number = w.number;
      input.setAttribute("aria-label", "Decoded word " + w.number);
      input.addEventListener("input", function () {
        this.value = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, w.word.length);
        this.parentNode.classList.remove("wrong");
      });
      row.appendChild(input);

      if (w.clue) {
        var clue = document.createElement("div");
        clue.className = "code-clue";
        clue.textContent = w.clue;
        row.appendChild(clue);
      }

      gridEl.appendChild(row);
    });
  }

  function renderMeta(c, titleEl, metaEl) {
    titleEl.textContent = c.title;
    metaEl.textContent =
      "Each code was made by shifting the alphabet — decode every word" +
      (c.withClues ? " (the clues will help)." : ".");
  }

  function render(codes) {
    current = codes;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = codes.length;
    sheetsEl.className = "sheets code-sheets sheets-" + n;

    codes.forEach(function (c, i) {
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

      renderCode(c, grid);
      renderMeta(c, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " code sheet" : " code sheets") + " generated — crack the code and decode every word.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newCode() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    var withClues = $("clues").value === "1";
    var count = parseInt($("count").value, 10) || 1;
    render(CipherGen.makeBatch(count, cat, diff, withClues));
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

  function fillAnswers(c, gridEl) {
    var inputs = gridEl.querySelectorAll(".code-input");
    for (var i = 0; i < inputs.length; i++) {
      var n = +inputs[i].dataset.number;
      var w = c.words.filter(function (x) { return x.number === n; })[0];
      if (w) {
        inputs[i].value = w.word;
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
      var c = current[g];
      var inputs = grids[g].querySelectorAll(".code-input");
      total += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        inp.parentNode.classList.remove("wrong");
        var v = inp.value.trim().toUpperCase();
        if (!v) continue;
        filled++;
        var n = +inp.dataset.number;
        var w = c.words.filter(function (x) { return x.number === n; })[0];
        if (w && v !== w.word) {
          inp.parentNode.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "answer" : "answers") +
        " — check your decoding and try again.";
    } else if (filled === 0) {
      $("status").textContent = "Type a word under each code, then check again.";
    } else if (filled === total) {
      $("status").textContent = "Cracked it! Every word is correct. 🎉";
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
        var inputs = grids[i].querySelectorAll(".code-input");
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
    $("new-btn").addEventListener("click", newCode);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("check-btn").addEventListener("click", checkPuzzle);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newCode();
  });
})();
