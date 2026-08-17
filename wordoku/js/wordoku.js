/* ============================================================
   Wordoku (letter sudoku) generator.
   Reuses the sudoku engine: generates a valid numbered grid and
   maps each number to a letter from a themed word's letters.
   Same sizes (4x4 / 6x6 / 9x9) and difficulties as sudoku.

   API:
     WordokuGen.SIZES          — { "4x4", "6x6", "9x9" }
     WordokuGen.DIFFICULTY     — { easy, medium, hard }
     WordokuGen.makeWordoku(category, sizeKey, difficultyKey)
       -> {
            puzzle:   flat array (0 = empty),
            solution: flat array (letters),
            letters:  array of the themed letters used,
            size, boxRows, boxCols, clues, title
          }
     WordokuGen.makeBatch(count, category, sizeKey, difficultyKey)
   ============================================================ */

(function (global) {
  "use strict";

  // Pick `n` distinct letters for a category: the first `n` letters
  // of the longest words in the category, padded with A-Z if needed.
  function pickLetters(category, n) {
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};
    var words = Object.keys(data);
    words.sort(function (a, b) { return b.length - a.length || (a < b ? -1 : 1); });

    var letters = [];
    var seen = {};
    for (var i = 0; i < words.length && letters.length < n; i++) {
      var w = words[i];
      for (var j = 0; j < w.length && letters.length < n; j++) {
        var ch = w[j];
        if (!seen[ch]) {
          seen[ch] = true;
          letters.push(ch);
        }
      }
    }
    // pad with alphabet letters that aren't used yet
    for (var k = 0; k < 26 && letters.length < n; k++) {
      var ch2 = String.fromCharCode(65 + k);
      if (!seen[ch2]) {
        seen[ch2] = true;
        letters.push(ch2);
      }
    }
    return letters;
  }

  function makeWordoku(category, sizeKey, diffKey) {
    var S = (global.SudokuGen && global.SudokuGen.SIZES[sizeKey]) ||
      { size: 9, boxRows: 3, boxCols: 3, label: "9 × 9 Classic" };
    var D = (global.SudokuGen && global.SudokuGen.DIFFICULTY[diffKey]) ||
      { label: "Medium" };

    var letters = pickLetters(category, S.size);

    // generate the numeric puzzle via the sudoku engine
    var base = global.SudokuGen.makePuzzle(sizeKey, diffKey);

    // map numbers to letters: number 1..size -> letters[0..size-1]
    var solution = base.solution.map(function (v) {
      return v === 0 ? 0 : letters[v - 1];
    });

    var catLabel = (global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category;
    var title = "Wordoku — " + catLabel + " · " + S.label + " · " + D.label;

    return {
      puzzle: base.puzzle,   // numeric clues (0 = empty)
      solution: solution,    // letter solution (0 for empty cells)
      letters: letters,
      size: S.size,
      boxRows: S.boxRows,
      boxCols: S.boxCols,
      clues: base.clues,
      sizeKey: sizeKey,
      difficulty: diffKey,
      category: category,
      title: title
    };
  }

  function makeBatch(count, category, sizeKey, diffKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 20;
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeWordoku(category, sizeKey, diffKey);
        var sig = cand.puzzle.join(",");
        if (!seen[sig]) {
          p = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!p) p = makeWordoku(category, sizeKey, diffKey);
      out.push(p);
    }
    return out;
  }

  global.WordokuGen = {
    SIZES: (global.SudokuGen && global.SudokuGen.SIZES) || {},
    DIFFICULTY: (global.SudokuGen && global.SudokuGen.DIFFICULTY) || {},
    makeWordoku: makeWordoku,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
