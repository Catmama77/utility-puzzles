/* ============================================================
   Bingo card generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Two modes:
     - numbers: classic B-I-N-G-O style cards, numbers drawn
       from the traditional ranges for each column
     - words:   themed word bingo using the shared WORD_DATA
       categories (animals, food, sports, ...)
   Also produces the caller's call sheet.

   API:
     BingoGen.SIZES                        — { "3x3", "4x4", "5x5" }
     BingoGen.makeCards(mode, sizeKey, category, count, freeCenter)
       -> {
            cards:     [{ cells: [{ v, free }], size, cols }],
            callSheet: { title, columns: [{ label, items }] },
            mode, sizeKey, size, category, freeCenter
          }
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "3x3": { size: 3, label: "3 × 3", freeCenter: true, cols: ["B", "I", "N"], ranges: [[1, 15], [16, 30], [31, 45]] },
    "4x4": { size: 4, label: "4 × 4", freeCenter: false, cols: ["B", "I", "N", "G"], ranges: [[1, 20], [21, 40], [41, 60], [61, 80]] },
    "5x5": { size: 5, label: "5 × 5", freeCenter: true, cols: ["B", "I", "N", "G", "O"], ranges: [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]] }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function isFreeCell(size, r, c, free) {
    return free && r === Math.floor(size / 2) && c === Math.floor(size / 2);
  }

  function makeNumberCard(size, S, free) {
    var cells = [];
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (isFreeCell(size, r, c, free)) {
          cells.push({ v: "FREE", free: true });
          continue;
        }
        var range = S.ranges[c];
        var v;
        do {
          v = String(randInt(range[0], range[1]));
        } while (cells.some(function (cell, i) {
          return i % size === c && cell.v === v;
        }));
        cells.push({ v: v, free: false });
      }
    }
    return { cells: cells, size: size, cols: S.cols };
  }

  function makeWordCard(size, S, words, free) {
    var shuffled = shuffle(words.slice());
    var cells = [];
    var idx = 0;
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (isFreeCell(size, r, c, free)) {
          cells.push({ v: "FREE", free: true });
          continue;
        }
        cells.push({ v: shuffled[idx++ % shuffled.length], free: false });
      }
    }
    return { cells: cells, size: size, cols: S.cols };
  }

  function makeCallSheet(mode, sizeKey, category, words) {
    var S = SIZES[sizeKey] || SIZES["5x5"];
    if (mode === "words") {
      var label = (global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category || "Words";
      return {
        title: "Call Sheet — " + label,
        columns: [{ label: label, items: shuffle(words.slice()) }]
      };
    }
    var columns = S.cols.map(function (letter, i) {
      var r = S.ranges[i];
      var items = [];
      for (var n = r[0]; n <= r[1]; n++) items.push(letter + "-" + n);
      return { label: letter, items: items };
    });
    var last = S.ranges[S.ranges.length - 1][1];
    return { title: "Call Sheet — Numbers 1–" + last, columns: columns };
  }

  function makeCards(mode, sizeKey, category, count, freeCenter) {
    var S = SIZES[sizeKey] || SIZES["5x5"];
    var size = S.size;
    var free = !!(freeCenter && S.freeCenter);

    var words = null;
    if (mode === "words") {
      var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
      words = Object.keys(data);
      if (!words.length) mode = "numbers"; // fall back if category is empty
    }

    var cards = [];
    for (var i = 0; i < count; i++) {
      cards.push(mode === "words" ? makeWordCard(size, S, words, free) : makeNumberCard(size, S, free));
    }

    return {
      cards: cards,
      callSheet: makeCallSheet(mode, sizeKey, category, words),
      mode: mode,
      sizeKey: sizeKey,
      size: size,
      category: category,
      freeCenter: free
    };
  }

  global.BingoGen = {
    SIZES: SIZES,
    makeCards: makeCards
  };
})(typeof window !== "undefined" ? window : globalThis);
