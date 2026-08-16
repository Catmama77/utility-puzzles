/* ============================================================
   Bingo tool page UI.
   ============================================================ */

(function () {
  "use strict";

  var current = null;

  function $(id) { return document.getElementById(id); }

  /* ---------- setup ---------- */

  function populateSelects() {
    var modeSel = $("mode");
    [["numbers", "Numbers (B-I-N-G-O)"], ["words", "Themed words"]].forEach(function (m) {
      var opt = document.createElement("option");
      opt.value = m[0];
      opt.textContent = m[1];
      modeSel.appendChild(opt);
    });
    modeSel.value = "numbers";

    var catSel = $("category");
    Object.keys(WORD_DATA).forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = CATEGORY_LABELS[cat] || cat;
      catSel.appendChild(opt);
    });
    catSel.value = "animals";

    var sizeSel = $("size");
    Object.keys(BingoGen.SIZES).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = BingoGen.SIZES[k].label;
      sizeSel.appendChild(opt);
    });
    sizeSel.value = "5x5";

    var countSel = $("count");
    [1, 2, 4, 6].forEach(function (n) {
      var opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n === 1 ? "1 card" : n + " cards";
      countSel.appendChild(opt);
    });
    countSel.value = "4";
  }

  function syncControls() {
    var wordMode = $("mode").value === "words";
    $("category").parentNode.style.display = wordMode ? "" : "none";

    var size = $("size").value;
    var free = $("free-center");
    var hasCenter = BingoGen.SIZES[size].freeCenter;
    free.disabled = !hasCenter;
    if (!hasCenter) free.checked = false;
  }

  /* ---------- rendering ---------- */

  function renderCards(batch) {
    var area = $("cards");
    area.innerHTML = "";
    area.className = "bingo-cards cards-" + batch.cards.length;

    batch.cards.forEach(function (card, ci) {
      var wrap = document.createElement("div");
      wrap.className = "bingo-card";

      var label = document.createElement("div");
      label.className = "card-label";
      label.textContent = "Card " + (ci + 1);
      wrap.appendChild(label);

      var header = document.createElement("div");
      header.className = "bingo-header";
      header.style.setProperty("--cols", card.size);
      if (batch.mode === "words") {
        var h = document.createElement("span");
        h.className = "wide";
        h.textContent = CATEGORY_LABELS[batch.category] || batch.category;
        header.appendChild(h);
      } else {
        card.cols.forEach(function (letter) {
          var h = document.createElement("span");
          h.textContent = letter;
          header.appendChild(h);
        });
      }
      wrap.appendChild(header);

      var grid = document.createElement("div");
      grid.className = "bingo-grid" + (batch.mode === "words" ? " words" : "");
      grid.style.setProperty("--cols", card.size);
      card.cells.forEach(function (cell) {
        var div = document.createElement("div");
        div.className = "cell" + (cell.free ? " free" : "") + (batch.mode === "words" ? " word" : "");
        div.textContent = cell.v;
        grid.appendChild(div);
      });
      wrap.appendChild(grid);

      area.appendChild(wrap);
    });
  }

  function renderCallSheet(sheet) {
    var wrap = $("call-sheet");
    $("call-title").textContent = sheet.title;
    var colsEl = $("call-columns");
    colsEl.innerHTML = "";
    sheet.columns.forEach(function (col) {
      var colEl = document.createElement("div");
      colEl.className = "call-col";
      var h = document.createElement("h3");
      h.textContent = col.label;
      colEl.appendChild(h);
      col.items.forEach(function (item) {
        var it = document.createElement("div");
        it.className = "call-item";
        it.textContent = item;
        it.addEventListener("click", function () {
          this.classList.toggle("called");
        });
        colEl.appendChild(it);
      });
      colsEl.appendChild(colEl);
    });
    wrap.style.display = "block";
  }

  function render(batch) {
    current = batch;
    renderCards(batch);
    renderCallSheet(batch.callSheet);
    var size = BingoGen.SIZES[batch.sizeKey];
    var base = batch.callSheet.title.replace("Call Sheet — ", "");
    $("print-title").textContent =
      "Bingo Cards — " + base + " · " + size.label +
      (batch.freeCenter ? " · Free center" : "");
    $("print-meta").textContent = batch.cards.length + " cards · " + size.label + " grid";
    $("status").textContent =
      (batch.mode === "words" ? "Word bingo" : "Number bingo") + " · " +
      size.label + " · " + batch.cards.length + " cards · " +
      (batch.freeCenter ? "free center" : "no free space");
  }

  /* ---------- actions ---------- */

  function newCards() {
    var mode = $("mode").value;
    var cat = $("category").value;
    var size = $("size").value;
    var count = parseInt($("count").value, 10) || 4;
    var free = $("free-center").checked;
    render(BingoGen.makeCards(mode, size, cat, count, free));
  }

  function doPrint(kind) {
    // kind: "cards" or "call"
    document.body.classList.toggle("print-call", kind === "call");
    document.body.classList.toggle("print-cards", kind === "cards");
    setTimeout(function () {
      window.print();
    }, 30);
  }

  /* ---------- init ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    populateSelects();
    syncControls();
    $("mode").addEventListener("change", syncControls);
    $("size").addEventListener("change", syncControls);
    $("new-btn").addEventListener("click", newCards);
    $("print-cards-btn").addEventListener("click", function () { doPrint("cards"); });
    $("print-call-btn").addEventListener("click", function () { doPrint("call"); });
    newCards();
  });
})();
