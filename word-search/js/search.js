/* ============================================================
   Word search puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Places words from a WORD_DATA category into a square
   letter grid, then fills the remaining cells with random
   letters.

   API:
     SearchGen.SIZES                  — { "8x8", "10x10", "12x12" }
     SearchGen.DIFFICULTY             — { easy, medium, hard }
     SearchGen.makeSearch(category, sizeKey, difficultyKey)
       -> {
            grid:   square array of arrays of letters,
            words:  [{ word, r, c, dir }]   (dir in DIRS),
            size, title, difficulty, category
          }
     SearchGen.makeBatch(count, category, sizeKey, difficultyKey)
       -> array of distinct puzzles
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "8x8":   { size: 8,  label: "8 × 8",  words: 8 },
    "10x10": { size: 10, label: "10 × 10", words: 10 },
    "12x12": { size: 12, label: "12 × 12", words: 12 }
  };

  // Direction deltas: [dr, dc]. Easy = right + down (no backward
  // words), medium adds left + up, hard adds all four diagonals.
  var DIRS = {
    "e":  [0, 1],  "s":  [1, 0],
    "w":  [0, -1], "n":  [-1, 0],
    "se": [1, 1],  "sw": [1, -1],
    "ne": [-1, 1], "nw": [-1, -1]
  };

  var DIFFICULTY = {
    easy:   { label: "Easy",   dirs: ["e", "s"] },
    medium: { label: "Medium", dirs: ["e", "s", "w", "n"] },
    hard:   { label: "Hard",   dirs: ["e", "s", "w", "n", "se", "sw", "ne", "nw"] }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function randLetter() {
    return String.fromCharCode(65 + Math.floor(Math.random() * 26));
  }

  function makeSearch(category, sizeKey, diffKey) {
    var S = SIZES[sizeKey] || SIZES["10x10"];
    var D = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    var size = S.size;
    var target = S.words;
    var data = (global.WORD_DATA && global.WORD_DATA[category]) || {};

    // Word pool: words that fit the grid, longest first (long words
    // are the hardest to place, so try them first).
    var pool = Object.keys(data).filter(function (w) {
      return w.length >= 3 && w.length <= size;
    });
    pool.sort(function (a, b) { return b.length - a.length; });

    var grid = [];
    for (var r = 0; r < size; r++) {
      grid.push(new Array(size).fill(""));
    }

    var placed = [];
    var attempts = 0;
    var maxAttempts = 2000;

    while (placed.length < target && attempts < maxAttempts && pool.length) {
      attempts++;
      var wi = Math.floor(Math.random() * pool.length);
      var word = pool.splice(wi, 1)[0];
      var dirKey = D.dirs[Math.floor(Math.random() * D.dirs.length)];
      var d = DIRS[dirKey];
      var len = word.length;

      // random start that keeps the word inside the grid
      var rMin = d[0] === 1 ? 0 : (d[0] === -1 ? len - 1 : 0);
      var rMax = d[0] === 1 ? size - len : size - 1;
      var cMin = d[1] === 1 ? 0 : (d[1] === -1 ? len - 1 : 0);
      var cMax = d[1] === 1 ? size - len : size - 1;
      if (rMin > rMax || cMin > cMax) continue;

      var sr = rMin + Math.floor(Math.random() * (rMax - rMin + 1));
      var sc = cMin + Math.floor(Math.random() * (cMax - cMin + 1));

      // check every cell is empty or already holds the same letter
      var ok = true;
      for (var i = 0; i < len; i++) {
        var cr = sr + d[0] * i;
        var cc = sc + d[1] * i;
        var existing = grid[cr][cc];
        if (existing !== "" && existing !== word[i]) { ok = false; break; }
      }
      if (!ok) continue;

      for (var j = 0; j < len; j++) {
        grid[sr + d[0] * j][sc + d[1] * j] = word[j];
      }
      placed.push({ word: word, r: sr, c: sc, dir: dirKey });
    }

    // fill the rest with random letters
    for (var rr = 0; rr < size; rr++) {
      for (var cc2 = 0; cc2 < size; cc2++) {
        if (grid[rr][cc2] === "") grid[rr][cc2] = randLetter();
      }
    }

    var title = "Word Search — " +
      ((global.CATEGORY_LABELS && global.CATEGORY_LABELS[category]) || category) +
      " · " + D.label;

    return {
      grid: grid,
      words: placed,
      size: size,
      title: title,
      difficulty: diffKey,
      category: category
    };
  }

  /* Identity of a search puzzle: which words sit where. Two puzzles
     with the same placements are the same puzzle even if the random
     filler letters differ. */
  function signature(p) {
    var parts = p.words.map(function (w) {
      return w.word + "@" + w.r + "," + w.c + "," + w.dir;
    });
    parts.sort();
    return parts.join("|");
  }

  /* Generate `count` distinct puzzles for one sheet/batch. */
  function makeBatch(count, category, sizeKey, diffKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeSearch(category, sizeKey, diffKey);
        var sig = signature(cand);
        if (!seen[sig]) {
          p = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!p) p = makeSearch(category, sizeKey, diffKey); // pool exhausted — accept one
      out.push(p);
    }
    return out;
  }

  global.SearchGen = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    makeSearch: makeSearch,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
