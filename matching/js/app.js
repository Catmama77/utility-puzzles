/* ============================================================
   Matching / flashcards tool page UI.
   Two worksheet styles:
     - "match": words (numbered) and shuffled clues (lettered) —
       click a word then its clue to mark a correct pair.
     - "cards": printable flashcards, word + clue on each card.
   Renders up to 2 worksheets per page (print-friendly utility).
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of sets, one per sheet

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

    var modeSel = $("mode");
    [["match", "Matching worksheet"], ["cards", "Flashcards"]].forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m[0];
      opt.textContent = m[1];
      modeSel.appendChild(opt);
    });
    modeSel.value = "match";

    var diffSel = $("difficulty");
    Object.keys(MatchGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = MatchGen.DIFFICULTY[d].label;
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

  function renderMatch(s, sheetEl, statusEl) {
    var wordsEl = document.createElement("div");
    wordsEl.className = "match-col words-col";
    var cluesEl = document.createElement("div");
    cluesEl.className = "match-col clues-col";

    s.words.forEach(function (w) {
      var item = document.createElement("div");
      item.className = "match-item word-item";
      item.dataset.number = w.number;
      item.innerHTML = "<span class='match-tag'>" + w.number + "</span> " + w.word;
      item.addEventListener("click", function () {
        handleMatchClick(s, wordsEl, cluesEl, this, w.number, statusEl);
      });
      wordsEl.appendChild(item);
    });

    s.clues.forEach(function (cl) {
      var item = document.createElement("div");
      item.className = "match-item clue-item";
      item.dataset.letter = cl.letter;
      item.dataset.number = cl.number;
      item.innerHTML = "<span class='match-tag'>" + cl.letter + "</span> " + cl.clue;
      item.addEventListener("click", function () {
        handleMatchClick(s, wordsEl, cluesEl, this, cl.number, statusEl);
      });
      cluesEl.appendChild(item);
    });

    var wrap = document.createElement("div");
    wrap.className = "match-wrap";
    wrap.appendChild(wordsEl);
    wrap.appendChild(cluesEl);
    sheetEl.appendChild(wrap);
  }

  function renderCards(s, sheetEl) {
    var grid = document.createElement("div");
    grid.className = "flashcards";
    s.words.forEach(function (w) {
      var card = document.createElement("div");
      card.className = "flashcard";
      var wordEl = document.createElement("div");
      wordEl.className = "flash-word";
      wordEl.textContent = w.word;
      var clueEl = document.createElement("div");
      clueEl.className = "flash-clue";
      clueEl.textContent = w.clue;
      card.appendChild(wordEl);
      card.appendChild(clueEl);
      grid.appendChild(card);
    });
    sheetEl.appendChild(grid);
  }

  function renderMeta(s, titleEl, metaEl) {
    titleEl.textContent = s.title;
    metaEl.textContent =
      s.words.length + " " + (s.mode === "cards" ? "flashcards" : "word–clue pairs to match");
  }

  function render(sets) {
    current = sets;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = sets.length;
    sheetsEl.className = "sheets match-sheets sheets-" + n;

    sets.forEach(function (s, i) {
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

      sheet.appendChild(head);

      if (s.mode === "cards") renderCards(s, sheet);
      else renderMatch(s, sheet, $("status"));

      sheetsEl.appendChild(sheet);
      renderMeta(s, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    var mode = sets[0].mode;
    $("status").textContent =
      n + (n === 1 ? " worksheet" : " worksheets") + " generated — " +
      (mode === "cards"
        ? "cut out the flashcards and test yourself on each word."
        : "draw a line from each word to its matching clue.");
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newSet() {
    var cat = $("category").value;
    var mode = $("mode").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(MatchGen.makeBatch(count, cat, mode, diff));
  }

  /* ---------- match-mode solving ---------- */

  var pendingWord = null; // { number, el }

  function handleMatchClick(s, wordsEl, cluesEl, clickedEl, number, statusEl) {
    if (s.mode !== "match") return;

    if (clickedEl.classList.contains("word-item")) {
      if (pendingWord && pendingWord.el !== clickedEl) {
        pendingWord.el.classList.remove("pending");
      }
      pendingWord = { number: number, el: clickedEl };
      clickedEl.classList.add("pending");
      return;
    }

    // clue clicked — resolve against pending word
    if (!pendingWord) {
      statusEl.textContent = "Click a word first, then its matching clue.";
      return;
    }
    var wordEl = pendingWord.el;
    var wordNumber = pendingWord.number;
    pendingWord = null;
    wordEl.classList.remove("pending");

    if (wordNumber === number) {
      markPair(s, wordsEl, cluesEl, wordEl, clickedEl, number);
    } else {
      wordEl.classList.add("shake");
      clickedEl.classList.add("shake");
      setTimeout(function () {
        wordEl.classList.remove("shake");
        clickedEl.classList.remove("shake");
      }, 400);
      $("status").textContent = "Not quite — that clue belongs to a different word.";
    }
  }

  function markPair(s, wordsEl, cluesEl, wordEl, clueEl, number) {
    wordEl.classList.add("matched");
    clueEl.classList.add("matched");
    var done = wordsEl.querySelectorAll(".matched").length;
    var total = s.words.length;
    var statusEl = $("status");
    statusEl.textContent =
      done + " of " + total + " matched." +
      (done === total ? " All matched — great job! 🎉" : "");
  }

  /* ---------- answers ---------- */

  function showAnswers() {
    var sheetsEl = $("sheets");
    sheetsEl.classList.add("show-answers");
    var sheets = sheetsEl.children;
    for (var i = 0; i < sheets.length; i++) {
      var s = current[i];
      if (!s || s.mode !== "match") continue;
      var words = sheets[i].querySelectorAll(".word-item");
      var clues = sheets[i].querySelectorAll(".clue-item");
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        for (var k = 0; k < clues.length; k++) {
          if (clues[k].dataset.number === w.dataset.number) {
            w.classList.add("matched");
            clues[k].classList.add("matched");
          }
        }
      }
    }
    setAnswersBtn("Hide Answers");
  }

  function hideAnswers() {
    var sheetsEl = $("sheets");
    sheetsEl.classList.remove("show-answers");
    var words = sheetsEl.querySelectorAll(".word-item.matched");
    var clues = sheetsEl.querySelectorAll(".clue-item.matched");
    for (var i = 0; i < words.length; i++) words[i].classList.remove("matched");
    for (var j = 0; j < clues.length; j++) clues[j].classList.remove("matched");
    setAnswersBtn("Show Answers");
  }

  function toggleAnswers() {
    if ($("sheets").classList.contains("show-answers")) hideAnswers();
    else showAnswers();
  }

  function doPrint(withAnswers) {
    if (withAnswers) showAnswers();
    else hideAnswers();
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    setTimeout(function () { window.print(); }, 30);
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    $("new-btn").addEventListener("click", newSet);
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newSet();
  });
})();
