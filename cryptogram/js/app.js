/* ============================================================
   Cryptogram tool page UI.
   Renders up to 2 cryptograms per page (print-friendly utility).
   On-screen solving: type the decoded letter under each cipher
   letter — solving a letter fills every occurrence (classic
   cryptogram behaviour). Check verifies; Show Answers fills in.
   ============================================================ */

(function () {
  "use strict";

  var current = []; // array of puzzles, one per sheet

  function $(id) { return document.getElementById(id); }

  function letterOnly() {
    return this.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 1);
  }

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
    Object.keys(CryptGen.DIFFICULTY).forEach(function (d) {
      var opt = document.createElement("option");
      opt.value = d;
      opt.textContent = CryptGen.DIFFICULTY[d].label;
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

  /* Fill every input (cipher cells + the letter strip) that shows the
     given cipher letter with the typed plaintext letter. */
  function applyLetter(sheetEl, cipherLetter, plainLetter) {
    var inputs = sheetEl.querySelectorAll(".cipher-input, .map-input");
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].dataset.cipher === cipherLetter) {
        inputs[i].value = plainLetter;
        inputs[i].parentNode.classList.remove("wrong");
      }
    }
  }

  function makeLetterInput(sheetEl, cipherLetter, revealed) {
    var input = document.createElement("input");
    input.type = "text";
    input.inputMode = "text";
    input.maxLength = 1;
    input.className = revealed ? "cipher-input revealed" : "cipher-input";
    input.dataset.cipher = cipherLetter;
    input.setAttribute("aria-label", "Plaintext letter for code " + cipherLetter);
    input.addEventListener("input", function () {
      this.value = letterOnly.call(this);
      if (this.value) applyLetter(sheetEl, cipherLetter, this.value);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        var all = sheetEl.querySelectorAll(".cipher-input, .map-input");
        var idx = Array.prototype.indexOf.call(all, this);
        var nxt = e.key === "ArrowRight" ? idx + 1 : idx - 1;
        if (nxt >= 0 && nxt < all.length) {
          e.preventDefault();
          all[nxt].focus();
        }
      }
    });
    return input;
  }

  function renderPuzzle(c, gridEl) {
    gridEl.innerHTML = "";
    gridEl.classList.add("crypto-grid");

    var line = document.createElement("div");
    line.className = "crypto-line";

    c.words.forEach(function (w, wi) {
      if (wi > 0) {
        var gap = document.createElement("span");
        gap.className = "crypto-gap";
        gap.innerHTML = "&nbsp;&nbsp;";
        line.appendChild(gap);
      }
      for (var i = 0; i < w.cipher.length; i++) {
        var ch = w.cipher[i];
        if (ch >= "A" && ch <= "Z") {
          var cell = document.createElement("span");
          cell.className = "crypto-cell";
          var lab = document.createElement("span");
          lab.className = "crypto-cipher";
          lab.textContent = ch;
          var revealed = !!c.reveals[ch];
          var input = makeLetterInput(gridEl, ch, revealed);
          cell.appendChild(lab);
          cell.appendChild(input);
          line.appendChild(cell);
        } else {
          // punctuation (comma or period) stays visible as text
          var punc = document.createElement("span");
          punc.className = "crypto-punc";
          punc.textContent = ch;
          line.appendChild(punc);
        }
      }
    });
    gridEl.appendChild(line);

    // letter strip: cipher letter above, blank input below
    var strip = document.createElement("div");
    strip.className = "crypto-strip";
    for (var s = 0; s < 26; s++) {
      var ciph = c.mapping["ABCDEFGHIJKLMNOPQRSTUVWXYZ"[s]];
      var cell2 = document.createElement("span");
      cell2.className = "crypto-map-cell";
      var lab2 = document.createElement("span");
      lab2.className = "crypto-cipher";
      lab2.textContent = ciph;
      var rev = !!c.reveals[ciph];
      var inp2 = makeLetterInput(gridEl, ciph, rev);
      inp2.className = rev ? "map-input revealed" : "map-input";
      cell2.appendChild(lab2);
      cell2.appendChild(inp2);
      strip.appendChild(cell2);
    }
    gridEl.appendChild(strip);

    // pre-fill revealed letters
    Object.keys(c.reveals).forEach(function (ciph) {
      applyLetter(gridEl, ciph, c.reveals[ciph]);
    });
  }

  function renderMeta(c, titleEl, metaEl) {
    titleEl.textContent = c.title;
    metaEl.textContent =
      "Decode the hidden sentence — every code letter stands for a different letter of the alphabet. " +
      CryptGen.DIFFICULTY[c.difficulty].label + " level, " + c.cipherLength + " letters to crack.";
  }

  function render(puzzles) {
    current = puzzles;
    var sheetsEl = $("sheets");
    sheetsEl.innerHTML = "";
    var n = puzzles.length;
    sheetsEl.className = "sheets crypto-sheets sheets-" + n;

    puzzles.forEach(function (c, i) {
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

      renderPuzzle(c, grid);
      renderMeta(c, title, meta);
    });

    setAnswersBtn("Show Answers");
    $("status").textContent =
      n + (n === 1 ? " cryptogram" : " cryptograms") +
      " generated — crack the code to reveal the hidden sentence.";
  }

  function setAnswersBtn(label) { $("answers-btn").textContent = label; }

  function newPuzzle() {
    var cat = $("category").value;
    var diff = $("difficulty").value;
    var count = parseInt($("count").value, 10) || 1;
    render(CryptGen.makeBatch(count, cat, diff));
  }

  /* ---------- answers / check / print ---------- */

  function isRevealed(c, ciph) { return !!c.reveals[ciph]; }

  function fillAnswers(c, gridEl) {
    var inputs = gridEl.querySelectorAll(".cipher-input, .map-input");
    for (var i = 0; i < inputs.length; i++) {
      var ciph = inputs[i].dataset.cipher;
      var plain = c.mappingInverse[ciph];
      inputs[i].value = plain;
      inputs[i].parentNode.classList.remove("wrong");
    }
  }

  function hideAnswers(c, gridEl) {
    var inputs = gridEl.querySelectorAll(".cipher-input, .map-input");
    for (var i = 0; i < inputs.length; i++) {
      var ciph = inputs[i].dataset.cipher;
      if (!isRevealed(c, ciph)) inputs[i].value = "";
      inputs[i].parentNode.classList.remove("wrong");
    }
  }

  function toggleAnswers() {
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var showing = grids.length > 0 && grids[0].classList.contains("show-answers");
    showing = !showing;
    for (var g = 0; g < grids.length; g++) {
      if (showing) fillAnswers(current[g], grids[g]);
      else hideAnswers(current[g], grids[g]);
      grids[g].classList.toggle("show-answers", showing);
    }
    setAnswersBtn(showing ? "Hide Answers" : "Show Answers");
  }

  function checkPuzzle() {
    if (!current.length) return;
    var grids = document.querySelectorAll("#sheets .puzzle-grid");
    var wrong = 0, filled = 0, total = 0;
    for (var g = 0; g < grids.length; g++) {
      var c = current[g];
      var inputs = grids[g].querySelectorAll(".cipher-input, .map-input");
      total += inputs.length;
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        inp.parentNode.classList.remove("wrong");
        var v = inp.value.trim().toUpperCase();
        if (!v) continue;
        filled++;
        if (v !== c.mappingInverse[inp.dataset.cipher]) {
          inp.parentNode.classList.add("wrong");
          wrong++;
        }
      }
    }
    if (wrong > 0) {
      $("status").textContent = wrong + " wrong " + (wrong === 1 ? "letter" : "letters") +
        " — fix them and check again.";
    } else if (filled === 0) {
      $("status").textContent = "Type a letter under each code, then check again.";
    } else if (filled === total) {
      $("status").textContent = "Cracked it! The sentence is decoded. 🎉";
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
        hideAnswers(current[i], grids[i]);
        grids[i].classList.remove("show-answers");
      }
    }
    var sheetsEl = $("sheets");
    sheetsEl.classList.toggle("print-answers", withAnswers);
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
