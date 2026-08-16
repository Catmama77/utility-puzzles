/* ============================================================
   Crossword puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Uses the shared placement core plus the WORD_DATA
   clue database.

   API:
     CrosswordGen.DIFFICULTY — { easy, medium, hard } options
     CrosswordGen.makeCrossword(category, difficulty) -> puzzle
     puzzle = {
       grid:   [{ black, letter|null, number|null }],
       across: [{ word, number, clue }],   // sorted by number
       down:   [{ word, number, clue }],
       rows, cols, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   minLen: 3, maxLen: 6,  target: 12, pad: 1, maxDim: 28 },
    medium: { label: "Medium", minLen: 4, maxLen: 8,  target: 16, pad: 1, maxDim: 32 },
    hard:   { label: "Hard",   minLen: 5, maxLen: 11, target: 20, pad: 1, maxDim: 36 }
  };

  function byNumber(a, b) { return a.number - b.number; }

  function makeCrossword(category, difficulty) {
    var opts = DIFFICULTY[difficulty] || DIFFICULTY.easy;
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};

    // build pool: unique words in the difficulty length range
    var seen = {};
    var pool = [];
    Object.keys(data).forEach(function (w) {
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
      return { grid: [], across: [], down: [], rows: 0, cols: 0, title: "" };
    }

    PuzzleCore.numberSlots(layout.rows, layout.cols, layout.gridArr);

    var words = layout.placed.map(function (p) {
      return {
        word: p.word,
        number: layout.gridArr[p.row][p.col].number,
        length: p.word.length,
        dir: p.dir,
        clue: data[p.word] || "Clue coming soon"
      };
    });

    var title = "Crossword — " + ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category) + " · " + opts.label;

    return {
      grid: layout.gridArr,
      across: words.filter(function (w) { return w.dir === "h"; }).sort(byNumber),
      down: words.filter(function (w) { return w.dir === "v"; }).sort(byNumber),
      rows: layout.rows,
      cols: layout.cols,
      title: title,
      difficulty: difficulty,
      category: category
    };
  }

  global.CrosswordGen = {
    DIFFICULTY: DIFFICULTY,
    makeCrossword: makeCrossword
  };
})(typeof window !== "undefined" ? window : globalThis);
