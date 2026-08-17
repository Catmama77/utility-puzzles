/* ============================================================
   Word wheel tool page UI.
   Renders up to 2 wheels per page (print-friendly utility).
   On-screen: type words you spot (each must use the center
   letter); found words are marked off. Show Answers lists them.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of wheels, one per sheet

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
    Object.keys(WheelGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = WheelGen.DIFFICULTY[d].label;
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

  function renderWheel(w, gridEl, listEl) {
    gridEl.innerHTML = "";
    gridEl.classList.add("wheel");

    w.letters.forEach(function (ch, i) {
      var tile = document.createElement("div");
      tile.className = "wheel-tile" + (i === w.center ? " center" : "");
      tile.textContent = ch;
      gridEl.appendChild(tile);
    });

    // found-word chips
    var foundEl = document.createElement("div");
    foundEl.className = "wheel-found";
    listEl.appendChild(foundEl);
  }

  function renderMeta(w, titleEl, metaEl) {
    titleEl.textContent = w.title;
    metaEl.textContent =
      "Make as many " + w.category + " words as you can — every word must use the middle letter, " +
      w.centerLetter + ", and be at least " +
      (WheelGen.DIFFICULTY[w.difficulty] || {}).minLen + " letters long.";
  }

  function render(wheels) {
    current = wheels;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = wheels.length;
    sheetsEl.className = "sheets wheel-sheets sheets-" + n;

    wheels.forEach(function (w, i) {
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

      var list = document.createElement("div");
      list.className = "wheel-answers";

      sheet.appendChild(head);
      sheet.appendChild(grid);
      sheet.appendChild(list);
      sheetsEl.appendChild(sheet);

      renderWheel(w, grid, list);
      renderMeta(w, title, meta);
    });

    $("answers-btn").textContent = "Show Answers";
    var minLen = (WheelGen.DIFFICULTY[wheels[0].difficulty] || {}).minLen;
    $("status").textContent =
      n + (n === 1 ? " wheel" : " wheels") + " generated — make words of " + minLen +
      "+ letters, each using the center letter.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newWheel() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(WheelGen.makeBatch(count, cat, diff));
  }

  /* ---------- on-screen word entry ---------- */

  function submitWord() {
    if (!current.length) return;
    var input = $("word-input");
    var v = (input.value || "").trim().toUpperCase().replace(/[^A-Z]/g, "");
    input.value = "";
    if (!v) return;

    var foundAny = false;
    var allFound = true;
    for (var i = 0; i < current.length; i++) {
      var w = current[i];
      var entry = w.words.filter(function (x) { return x.word === v; })[0];
      if (entry && !entry.found) {
        entry.found = true;
        foundAny = true;
        var sheets = document.querySelectorAll("#sheets .puzzle-sheet");
        var foundEl = sheets[i].querySelector(".wheel-found");
        var chip = document.createElement("span");
        chip.className = "word-chip find-chip found";
        chip.textContent = v.toLowerCase();
        foundEl.appendChild(chip);
      }
      var done = w.words.filter(function (x) { return x.found; }).length;
      if (done !== w.words.length) allFound = false;
    }
    if (foundAny) {
      var total = 0, doneCount = 0;
      current.forEach(function (w) {
        total += w.words.length;
        doneCount += w.words.filter(function (x) { return x.found; }).length;
      });
      $("status").textContent = doneCount + " of " + total + " words found." +
        (allFound ? " All found — incredible! 🎉" : "");
    } else {
      $("status").textContent = "“" + v.toLowerCase() + "” isn't on this wheel's word list — try another.";
      input.classList.add("shake");
      setTimeout(function () { input.classList.remove("shake"); }, 400);
    }
  }

  /* ---------- answers + print ---------- */

  function showAll() {
    var sheets = document.querySelectorAll("#sheets .puzzle-sheet");
    for (var i = 0; i < sheets.length; i++) {
      var w = current[i];
      var foundEl = sheets[i].querySelector(".wheel-found");
      w.words.forEach(function (x) {
        if (!x.found) {
          x.found = true;
          var chip = document.createElement("span");
          chip.className = "word-chip find-chip found";
          chip.textContent = x.word.toLowerCase();
          foundEl.appendChild(chip);
        }
      });
      sheets[i].querySelector(".puzzle-grid").classList.add("show-answers");
    }
    setAnswersBtn("Hide Answers");
  }

  function hideAll() {
    var sheets = document.querySelectorAll("#sheets .puzzle-sheet");
    for (var i = 0; i < sheets.length; i++) {
      var w = current[i];
      w.words.forEach(function (x) { x.found = false; });
      sheets[i].querySelector(".wheel-found").innerHTML = "";
      sheets[i].querySelector(".puzzle-grid").classList.remove("show-answers");
    }
    setAnswersBtn("Show Answers");
  }

  function toggleAnswers() {
    if (document.querySelector("#sheets .puzzle-grid.show-answers")) hideAll();
    else showAll();
  }

  function doPrint(withAnswers) {
    if (withAnswers) showAll();
    else hideAll();
    var sheetsEl = $("sheets");
    if (withAnswers) sheetsEl.classList.add("print-answers");
    else sheetsEl.classList.remove("print-answers");
    setTimeout(function () { window.print(); }, 30);
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    $("new-btn").addEventListener("click", newWheel);
    $("add-word-btn").addEventListener("click", submitWord);
    $("word-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") submitWord();
    });
    $("answers-btn").addEventListener("click", toggleAnswers);
    $("print-puzzle-btn").addEventListener("click", function () { doPrint(false); });
    $("print-answers-btn").addEventListener("click", function () { doPrint(true); });
    newWheel();
  });
})();
