/* ============================================================
   Word Fill-In puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Builds a crossword-style grid of letter slots plus a
   black-square layout, with numbered slots and a word list.

   API:
     PuzzleGen.DIFFICULTY   — { easy, medium, hard } options
     PuzzleGen.makePuzzle(category, difficulty) -> puzzle
     puzzle = {
       grid:  [{ black, letter|null, number|null }],
       words: [{ word, number, length }],
       rows, cols, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   minLen: 3, maxLen: 5,  target: 12, pad: 1, maxDim: 28 },
    medium: { label: "Medium", minLen: 3, maxLen: 7,  target: 16, pad: 1, maxDim: 32 },
    hard:   { label: "Hard",   minLen: 4, maxLen: 10, target: 20, pad: 2, maxDim: 36 }
  };

  function makePuzzle(category, difficulty) {
    var opts = DIFFICULTY[difficulty] || DIFFICULTY.easy;
    var bank = (global.WORD_BANK && global.WORD_BANK[category]) || [];

    // build pool: unique, normalized, in length range
    var seen = {};
    var pool = [];
    bank.forEach(function (w) {
      var n = PuzzleCore.normalize(w);
      if (!n || seen[n]) return;
      if (n.length < opts.minLen || n.length > opts.maxLen) return;
      seen[n] = true;
      pool.push(n);
    });
    PuzzleCore.shuffle(pool);
    pool.sort(function (a, b) { return b.length - a.length; });

    var layout = PuzzleCore.generateLayout(pool, opts);
    if (!layout.rows) {
      return { grid: [], words: [], rows: 0, cols: 0, title: "" };
    }

    PuzzleCore.numberSlots(layout.rows, layout.cols, layout.gridArr);

    // word list with slot numbers, sorted by length then alphabetically
    var words = layout.placed.map(function (p) {
      return {
        word: p.word,
        number: layout.gridArr[p.row][p.col].number,
        length: p.word.length
      };
    });
    words.sort(function (a, b) {
      if (a.length !== b.length) return a.length - b.length;
      return a.word < b.word ? -1 : 1;
    });

    var title = "Word Fill-In — " +
      (global.CATEGORY_LABELS && global.CATEGORY_LABELS[category] || category) +
      " · " + opts.label;

    return {
      grid: layout.gridArr,
      words: words,
      rows: layout.rows,
      cols: layout.cols,
      title: title,
      difficulty: difficulty,
      category: category
    };
  }

  global.PuzzleGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle
  };
})(typeof window !== "undefined" ? window : globalThis);
