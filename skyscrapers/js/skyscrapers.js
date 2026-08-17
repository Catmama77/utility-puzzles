/* ============================================================
   Skyscrapers (Towers) puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Place building heights 1..N into an N x N grid so
   every row and column holds each height exactly once, and the
   numbers around the edge say how many buildings are visible
   from that side (a taller building hides the shorter ones
   behind it). Inner digits are added only when the edge clues
   alone don't pin down a single solution. Every published
   puzzle has exactly one solution (verified with a counting
   solver).

   API:
     SkyGen.DIFFICULTY  — { easy, medium, hard } options
     SkyGen.makePuzzle(difficultyKey) -> puzzle
     SkyGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       n:     grid size,
       num:   n*n flat array of solution heights,
       clues: 4n edge clues (top, right, bottom, left),
       given: n*n flat array of booleans,
       blanks: number of blank cells,
       difficulty, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   n: 4, maxGivens: 8 },
    medium: { label: "Medium", n: 5, maxGivens: 10 },
    hard:   { label: "Hard",   n: 6, maxGivens: 14 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function range(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    return out;
  }

  /* ---------- Latin square ---------- */

  function makeLatin(n) {
    var grid = new Array(n * n).fill(0);
    function can(r, c, v) {
      for (var i = 0; i < n; i++) {
        if (grid[r * n + i] === v) return false;
        if (grid[i * n + c] === v) return false;
      }
      return true;
    }
    function fill(pos) {
      if (pos >= n * n) return true;
      var r = Math.floor(pos / n), c = pos % n;
      var vals = shuffle(range(n).map(function (x) { return x + 1; }));
      for (var i = 0; i < vals.length; i++) {
        if (can(r, c, vals[i])) {
          grid[pos] = vals[i];
          if (fill(pos + 1)) return true;
          grid[pos] = 0;
        }
      }
      return false;
    }
    fill(0);
    return grid;
  }

  /* ---------- visibility clues ---------- */

  function visible(line) {
    var count = 0, max = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i] > max) { count++; max = line[i]; }
    }
    return count;
  }

  /* clues layout: [top(0..n-1), right(n..2n-1), bottom(2n..3n-1), left(3n..4n-1)] */
  function computeClues(num, n) {
    var clues = new Array(4 * n);
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(num[r * n + c]);
      clues[3 * n + r] = visible(row);               // left
      clues[n + r] = visible(row.slice().reverse()); // right
    }
    for (var c2 = 0; c2 < n; c2++) {
      var col = [];
      for (var r2 = 0; r2 < n; r2++) col.push(num[r2 * n + c2]);
      clues[c2] = visible(col);                       // top
      clues[2 * n + c2] = visible(col.slice().reverse()); // bottom
    }
    return clues;
  }

  /* ---------- counting solver ---------- */

  /* Count solutions (up to `limit`) of the skyscrapers puzzle.
     `gridIn` is the grid with 0 for blank cells. Cells with a
     given height are fixed. Prunes: latin-square uniqueness plus
     edge clues on completed rows/columns, plus a cheap bound for
     partially-filled rows (top/bottom checked on completion).
     Returns -1 if the node budget is exceeded. */
  function countSolutions(gridIn, clues, n, limit, nodeBudget) {
    var MAX_NODES = nodeBudget || 300000;
    var grid = gridIn.slice();
    var fixed = grid.slice();
    var count = 0;
    var nodes = 0;

    function rowVisible(r) {
      var count = 0, max = 0;
      for (var c = 0; c < n; c++) {
        if (grid[r * n + c] > max) { count++; max = grid[r * n + c]; }
      }
      return count;
    }
    function colVisible(c) {
      var count = 0, max = 0;
      for (var r = 0; r < n; r++) {
        if (grid[r * n + c] > max) { count++; max = grid[r * n + c]; }
      }
      return count;
    }
    function rowVisibleRev(r) {
      var count = 0, max = 0;
      for (var c = n - 1; c >= 0; c--) {
        if (grid[r * n + c] > max) { count++; max = grid[r * n + c]; }
      }
      return count;
    }
    function colVisibleRev(c) {
      var count = 0, max = 0;
      for (var r = n - 1; r >= 0; r--) {
        if (grid[r * n + c] > max) { count++; max = grid[r * n + c]; }
      }
      return count;
    }

    function dfs(pos) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (pos >= n * n) { count++; return; }
      if (fixed[pos] !== 0) { dfs(pos + 1); return; }
      var r = Math.floor(pos / n), c = pos % n;
      var endOfRow = c === n - 1;
      var endOfCol = r === n - 1;
      for (var d = 1; d <= n; d++) {
        nodes++;
        var dup = false;
        for (var i = 0; i < n; i++) {
          if (grid[r * n + i] === d) { dup = true; break; }
          if (grid[i * n + c] === d) { dup = true; break; }
        }
        if (dup) continue;
        grid[pos] = d;
        if (endOfRow && (rowVisible(r) !== clues[3 * n + r] || rowVisibleRev(r) !== clues[n + r])) {
          grid[pos] = 0;
          continue;
        }
        if (endOfCol && (colVisible(c) !== clues[c] || colVisibleRev(c) !== clues[2 * n + c])) {
          grid[pos] = 0;
          continue;
        }
        dfs(pos + 1);
        grid[pos] = 0;
        if (count >= limit || nodes > MAX_NODES) return;
      }
    }

    dfs(0);
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  function finalize(num, clues, given, diffKey, d) {
    var blanks = 0;
    for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
    return {
      n: d.n,
      size: d.n,
      num: num.slice(),
      clues: clues.slice(),
      given: given.slice(),
      blanks: blanks,
      difficulty: diffKey,
      title: "Skyscrapers — " + d.label + " level"
    };
  }

  /* Add inner givens (random order) until the clue set pins down a
     single solution, or until `max` givens are placed. Returns the
     given mask, or null if uniqueness couldn't be reached. */
  function addGivens(num, clues, n, max) {
    var given = new Array(n * n).fill(false);
    var placed = 0;
    var order = shuffle(range(n * n));
    for (var i = 0; i < order.length && placed <= max; i++) {
      if (countSolutions(blankGrid(num, given, n), clues, n, 2) === 1) {
        return given;
      }
      var cell = order[i];
      given[cell] = true;
      placed++;
    }
    if (countSolutions(blankGrid(num, given, n), clues, n, 2) === 1) return given;
    return null;
  }

  function blankGrid(num, given, n) {
    var g = num.slice();
    for (var i = 0; i < given.length; i++) if (!given[i]) g[i] = 0;
    return g;
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    for (var attempt = 0; attempt < 100; attempt++) {
      var num = makeLatin(d.n);
      var clues = computeClues(num, d.n);
      var given = null;
      if (countSolutions(blankGrid(num, new Array(d.n * d.n).fill(false), d.n), clues, d.n, 2) === 1) {
        given = new Array(d.n * d.n).fill(false); // clues alone are enough
      } else {
        given = addGivens(num, clues, d.n, d.maxGivens);
        if (!given) continue;
      }
      // final belt-and-suspenders uniqueness check with a bigger budget
      if (countSolutions(blankGrid(num, given, d.n), clues, d.n, 2, 500000) !== 1) continue;
      return finalize(num, clues, given, diffKey, d);
    }
    return null;
  }

  function signature(p) {
    return p.num.join("") + "|" + p.clues.join(",") + "|" + p.given.map(function (g) { return g ? 1 : 0; }).join("");
  }

  function makeBatch(count, diffKey) {
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard < 200) {
      guard++;
      var p = makePuzzle(diffKey);
      if (!p) continue;
      var sig = signature(p);
      if (seen[sig]) continue;
      seen[sig] = true;
      out.push(p);
    }
    return out;
  }

  global.SkyGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _makeLatin: makeLatin,          // exposed for tests
    _computeClues: computeClues,    // exposed for tests
    _visible: visible,              // exposed for tests
    _addGivens: addGivens           // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
