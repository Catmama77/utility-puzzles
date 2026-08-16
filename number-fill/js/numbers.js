/* ============================================================
   Number Fill-In puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Same puzzle shape as the word fill-in (crossword-style
   grid with numbered slots), but the "words" are numbers, so
   every puzzle gets a fresh random set of digits.

   API:
     NumberGen.DIFFICULTY — { easy, medium, hard } options
     NumberGen.THEMES     — { classic, even, odd, primes, threes }
     NumberGen.makePuzzle(theme, difficulty) -> puzzle
     puzzle = {
       grid:    [{ black, letter|null, number|null }],
       numbers: [{ value, slot, digits }],  // sorted by digits
       rows, cols, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   lengths: [3],        target: 12, pad: 1, maxDim: 24 },
    medium: { label: "Medium", lengths: [3, 4],     target: 14, pad: 1, maxDim: 28 },
    hard:   { label: "Hard",   lengths: [4, 5],     target: 16, pad: 1, maxDim: 32 }
  };

  function isPrime(n) {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (var i = 3; i * i <= n; i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  var THEMES = {
    classic: { label: "Classic",       ok: function () { return true; } },
    even:    { label: "Even numbers",  ok: function (n) { return n % 2 === 0; } },
    odd:     { label: "Odd numbers",   ok: function (n) { return n % 2 === 1; } },
    primes:  { label: "Prime numbers", ok: isPrime },
    threes:  { label: "Multiples of 3", ok: function (n) { return n % 3 === 0; } }
  };

  function randomWithLength(len, theme) {
    // first digit 1-9, no leading zero
    for (var attempt = 0; attempt < 200; attempt++) {
      var n = 1 + Math.floor(Math.random() * 9);
      for (var i = 1; i < len; i++) {
        n = n * 10 + Math.floor(Math.random() * 10);
      }
      if (theme.ok(n)) return n;
    }
    return null;
  }

  function makePuzzle(themeName, difficulty) {
    var opts = DIFFICULTY[difficulty] || DIFFICULTY.easy;
    var theme = THEMES[themeName] || THEMES.classic;

    // build a pool of random numbers (~2x target so placement has spares)
    var seen = {};
    var pool = [];
    var guard = 0;
    while (pool.length < opts.target * 2 && guard < 4000) {
      guard++;
      var len = opts.lengths[Math.floor(Math.random() * opts.lengths.length)];
      var n = randomWithLength(len, theme);
      if (n === null || seen[n]) continue;
      seen[n] = true;
      pool.push(String(n));
    }
    pool.sort(function (a, b) { return b.length - a.length; });

    var layout = PuzzleCore.generateLayout(pool, opts);
    if (!layout.rows) {
      return { grid: [], numbers: [], rows: 0, cols: 0, title: "" };
    }

    PuzzleCore.numberSlots(layout.rows, layout.cols, layout.gridArr);

    var numbers = layout.placed.map(function (p) {
      return {
        value: p.word,
        slot: layout.gridArr[p.row][p.col].number,
        digits: p.word.length
      };
    });
    numbers.sort(function (a, b) {
      if (a.digits !== b.digits) return a.digits - b.digits;
      return a.value < b.value ? -1 : 1;
    });

    var title = "Number Fill-In — " + theme.label + " · " + opts.label;

    return {
      grid: layout.gridArr,
      numbers: numbers,
      rows: layout.rows,
      cols: layout.cols,
      title: title,
      difficulty: difficulty,
      theme: themeName
    };
  }

  global.NumberGen = {
    DIFFICULTY: DIFFICULTY,
    THEMES: THEMES,
    makePuzzle: makePuzzle
  };
})(typeof window !== "undefined" ? window : globalThis);
