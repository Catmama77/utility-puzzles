/* ============================================================
   Futoshiki puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Builds an N x N grid where every row and column holds
   the digits 1..N exactly once, and the < / > (and up/down)
   signs between adjacent cells are respected. Some digits are
   given; fill in the blanks so the whole grid works. Every
   published puzzle has exactly one solution (verified with a
   counting solver).

   API:
     FutoshikiGen.DIFFICULTY  — { easy, medium, hard } options
     FutoshikiGen.makePuzzle(difficultyKey) -> puzzle
     FutoshikiGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       n:      grid size,
       num:    n*n flat array of solution digits,
       signs:  [ { a, b, lt }, ... ]  (lt: digit at a < digit at b)
       given:  n*n flat array of booleans,
       blanks: number of blank cells,
       difficulty, title
     }
   The app renders horizontal signs as < / > and vertical signs
   as chevrons; every sign points toward the smaller number.
   ============================================================ */

(function (global) {
  "use strict";

  // signFloor: the fraction of inequality signs that must survive
  // trimming. Signs are the defining clues of futoshiki, so easy
  // puzzles keep a bigger share of them than hard ones.
  var DIFFICULTY = {
    easy:   { label: "Easy",   n: 4, givens: 7,  signFloor: 0.5 },
    medium: { label: "Medium", n: 5, givens: 8,  signFloor: 0.4 },
    hard:   { label: "Hard",   n: 6, givens: 10, signFloor: 0.3 }
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

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
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

  /* Every adjacent pair: {a, b, lt} where lt = digit[a] < digit[b].
     Adjacent cells always differ (same row/column in a Latin square),
     so each pair has a definite direction. */
  function allSigns(n) {
    var signs = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n - 1; c++) {
        signs.push({ a: r * n + c, b: r * n + c + 1 });
      }
    }
    for (var r2 = 0; r2 < n - 1; r2++) {
      for (var c2 = 0; c2 < n; c2++) {
        signs.push({ a: r2 * n + c2, b: (r2 + 1) * n + c2 });
      }
    }
    return signs;
  }

  /* ---------- counting solver ---------- */

  /* Count solutions up to `limit` (2 = "more than one"). Cells already
     non-zero in gridIn are given; signs restrict placed neighbours.
     Returns -1 if the node budget is exceeded. */
  function countSolutions(gridIn, n, signs, limit, nodeBudget) {
    var grid = gridIn.slice();
    var fixed = grid.slice();
    var count = 0;
    var nodes = 0;
    var MAX_NODES = nodeBudget || 200000;
    // quick sign lookup: key "a-b" -> true means digit[a] < digit[b]
    var lt = {};
    for (var i = 0; i < signs.length; i++) {
      var s = signs[i];
      lt[s.a + "-" + s.b] = s.lt;
    }

    function ok(r, c, v) {
      var idx = r * n + c;
      // grid[idx] already holds v (set before this check) — skip the cell
      // itself so the row/column scan only sees the other placed digits
      for (var i = 0; i < n; i++) {
        if (i !== c && grid[r * n + i] === v) return false;
        if (i !== r && grid[i * n + c] === v) return false;
      }
      // signs only constrain pairs that actually carry one
      function check(a, b, va, vb) {
        var k = a + "-" + b;
        if (!lt.hasOwnProperty(k)) return true;
        return lt[k] ? va < vb : va > vb;
      }
      if (c > 0 && grid[idx - 1] && !check(idx - 1, idx, grid[idx - 1], v)) return false;
      if (c < n - 1 && grid[idx + 1] && !check(idx, idx + 1, v, grid[idx + 1])) return false;
      if (r > 0 && grid[idx - n] && !check(idx - n, idx, grid[idx - n], v)) return false;
      if (r < n - 1 && grid[idx + n] && !check(idx, idx + n, v, grid[idx + n])) return false;
      return true;
    }

    function dfs(pos) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (pos >= n * n) { count++; return; }
      if (fixed[pos] !== 0) { dfs(pos + 1); return; }
      for (var d = 1; d <= n; d++) {
        nodes++;
        grid[pos] = d;
        if (!ok(Math.floor(pos / n), pos % n, d)) continue;
        dfs(pos + 1);
        if (count >= limit || nodes > MAX_NODES) return;
      }
      grid[pos] = 0;
    }

    dfs(0);
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  function finalize(num, signs, given, diffKey, d) {
    var blanks = 0;
    for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
    return {
      n: d.n,
      size: d.n,
      num: num.slice(),
      signs: signs.slice(),
      given: given.slice(),
      blanks: blanks,
      difficulty: diffKey,
      title: "Futoshiki — " + d.label + " level"
    };
  }

  /* Blank cells (random order), keeping uniqueness; stops at the target
     or when no more cells can be removed. */
  function blankCells(num, n, signs, target) {
    var given = new Array(num.length).fill(true);
    var order = shuffle(range(num.length));
    var blanks = 0;
    for (var i = 0; i < order.length && blanks < target; i++) {
      var idx = order[i];
      var g = num.slice();
      given[idx] = false;
      for (var j = 0; j < num.length; j++) if (!given[j]) g[j] = 0;
      if (countSolutions(g, n, signs, 2) === 1) {
        blanks++;
      } else {
        given[idx] = true;
      }
    }
    return given;
  }

  /* Remove signs (random order) while the blanked puzzle stays unique, so
     the sign set is a real set of clues — but never below `floor` signs,
     so every puzzle is recognisably a futoshiki. `gridIn` is the puzzle
     with blanks (0 cells), not the full solution. */
  function trimSigns(gridIn, n, signs, floor) {
    var kept = signs.slice();
    var order = shuffle(range(kept.length));
    var removed = 0;
    for (var i = 0; i < order.length; i++) {
      if (kept.length <= floor) break;
      var idx = order[i] - removed;
      var trial = kept.slice();
      trial.splice(idx, 1);
      if (countSolutions(gridIn, n, trial, 2) === 1) {
        kept = trial;
        removed++;
      }
    }
    return kept;
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    for (var attempt = 0; attempt < 200; attempt++) {
      var num = makeLatin(d.n);
      var signs = allSigns(d.n);
      // direction from the solution
      for (var i = 0; i < signs.length; i++) {
        signs[i].lt = num[signs[i].a] < num[signs[i].b];
      }
      // blank digits FIRST while every sign is present (signs only matter
      // once digits are missing), then trim signs that aren't needed.
      var bestGiven = null;
      var bestBlanks = -1;
      for (var t = 0; t < 3; t++) {
        var given = blankCells(num, d.n, signs, num.length - d.givens);
        var blanks = 0;
        for (var k = 0; k < given.length; k++) if (!given[k]) blanks++;
        if (blanks > bestBlanks) { bestBlanks = blanks; bestGiven = given; }
        if (blanks >= num.length - d.givens) break;
      }
      var g = num.slice();
      for (var j = 0; j < bestGiven.length; j++) if (!bestGiven[j]) g[j] = 0;
      // trim signs against the blanked puzzle (keeping a difficulty-based
      // floor), then verify the final puzzle is still unique before
      // publishing it
      var kept = trimSigns(g, d.n, signs, Math.round(signs.length * d.signFloor));
      if (countSolutions(g, d.n, kept, 2) !== 1) continue;
      return finalize(num, kept, bestGiven, diffKey, d);
    }
    return null;
  }

  function signature(p) {
    return p.num.join("") + "|" + p.signs.map(function (s) { return s.a + ":" + s.b + ":" + (s.lt ? 1 : 0); }).join(",") +
      "|" + p.given.map(function (g) { return g ? 1 : 0; }).join("");
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

  global.FutoshikiGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _makeLatin: makeLatin,          // exposed for tests
    _allSigns: allSigns,            // exposed for tests
    _trimSigns: trimSigns,          // exposed for tests
    _blankCells: blankCells         // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
