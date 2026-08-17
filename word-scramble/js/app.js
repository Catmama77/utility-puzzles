/* ============================================================
   Word Scramble tool page UI.
   Renders up to 2 worksheets per page (print-friendly utility).
   On-screen solving: type the unscrambled word next to each
   scramble; Check highlights wrong answers. Optional clues from
   WORD_DATA turn the worksheet into a vocabulary exercise.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of worksheets, one per sheet

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
    Object.keys(ScrambleGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = ScrambleGen.DIFFICULTY[d].label;
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

  function renderWord(wordEl, item, sheetIndex) {
    wordEl.innerHTML = "";
    wordEl.className = "scramble-row";

    var num = document.createElement("span");
    num.className = "scramble-num";
    num.textContent = item.number;
    wordEl.appendChild(num);

    // scrambled letters as individual boxes
    var tiles = document.createElement("span");
    tiles.className = "scramble-tiles";
    item.scrambled.split("").forEach(function (ch) {
      var tile = document.createElement("span");
      tile.className = "scramble-tile";
      tile.textContent = ch;
      tiles.appendChild(tile);
    });
    wordEl.appendChild(tiles);

    if (item.clue) {
      var clue = document.createElement("span");
      clue.className = "scramble-clue";
      clue.textContent = item.clue;
      wordEl.appendChild(clue);
    }

    var input = document.createElement("input");
    input.type = "text";
    input.className = "cell-input scramble-input";
    input.dataset.word = item.word;
    input.dataset.sheet = sheetIndex;
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Unscrambled word " + item.number);
    input.addEventListener("input", function () {
      this.value = this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, item.word.length);
      this.parentNode.classList.remove("wrong");
    });
    wordEl.appendChild(input);
  }

  function renderMeta(sheet, titleEl, metaEl) {
    titleEl.textContent = sheet.title;
    metaEl.textContent =
      sheet.words.length + " words · " +
      (ScrambleGen.DIFFICULTY[sheet.difficulty] || {}).label + " level" +
      (sheet.withClues ? " · with clues" : "");
  }

  function render(sheets) {
    current = sheets;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";

    var n = sheets.length;
    sheetsEl.className = "sheets scramble-sheets sheets-" + n;

    sheets.forEach(function (sheet, i) {
      var wrap = document.createElement("div");
      wrap.className = "puzzle-sheet";

      var head = document.createElement("div");
      head.className = "print-heading";
      var title = document.createElement("h1");
      title.className = "print-title";
      var meta = document.createElement("p");
      meta.className = "print-meta";
      head.appendChild(title);
      head.appendChild(meta);

      var list = document.createElement("div");
      list.className = "scramble-list";

      sheet.words.forEach(function (item) {
        var row = document.createElement("div");
        row.className = "scramble-row";
        renderWord(row, item, i);
        list.appendChild(row);
      });

      wrap.appendChild(head);
      wrap.appendChild(list);
      sheetsEl.appendChild(wrap);

      renderMeta(sheet, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    $("status").textContent =
      n + (n === 1 ? " worksheet" : " worksheets") + " generated — unscramble each word and check when done.";
  }

  /* ---------- actions ---------- */

  function newScramble() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    var clues = $("clues").checked;
    render(ScrambleGen.makeBatch(count, cat, diff, clues));
  }

  function checkAnswers() {
    if (!current.length) return;
    var inputs = document.querySelectorAll(".scramble-input");
    var wrong = 0;
    var filled = 0;
    var total = inputs.length;
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      var row = inp.parentNode;
      row.classList.remove("wrong");
      var v = inp.value.trim().toUpperCase();
      if (!v) continue;
      filled++;
      if (v !== inp.dataset.word) {
        row.classList.add("wrong");
        wrong++;
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "answer" : "answers") +
        " — fix " + (wrong === 1 ? "it" : "them") + " and check again.";
    } else if (filled === 0) {
      $("status").textContent = "Type some answers first, then check again.";
    } else if (filled === total) {
      $("status").textContent = "All unscrambled — perfect! 🎉";
    } else {
      $("status").textContent = "Everything you've entered is correct so far — keep going!";
    }
  }

  function fillAll() {
    var inputs = document.querySelectorAll(".scramble-input");
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      inp.value = inp.dataset.word;
      inp.parentNode.classList.remove("wrong");
    }
  }

  function toggleAnswers() {
    var showing = $("answers-btn").textContent === "Hide Answers";
    var inputs = document.querySelectorAll(".scramble-input");
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = showing ? "" : inputs[i].dataset.word;
    }
    $("answers-btn").textContent = showing ? "Show Answers" : "Hide Answers";
  }

  function doPrint(withAnswers) {
    if (withAnswers) fillAll();
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
    $("new-btn").addEventListener("click", newScramble);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("check-btn").addEventListener("click", checkAnswers);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newScramble();
  });
})();
