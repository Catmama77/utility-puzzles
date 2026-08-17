/* ============================================================
   Nonogram (Picross) generator.
   ------------------------------------------------------------
   Generates a random filled grid, computes the run clues for
   every row and column, then verifies the puzzle has exactly
   one solution using a line-propagation solver with bounded
   backtracking. Puzzles that are not unique are rejected and
   regenerated, so every puzzle printed is solvable by logic.
   ============================================================ */

(function (global) {
  "use strict";

  var CONFIG = {
    sizes: { easy: 8, medium: 10, hard: 12 },
    density: { easy: 0.38, medium: 0.50, hard: 0.58 }
  };

  /* ---------- clue computation ---------- */

  // Runs of `true` in a line, e.g. [T,T,F,T] -> [2, 1]
  function lineClues(line) {
    var clues = [];
    var run = 0;
    for (var i = 0; i < line.length; i++) {
      if (line[i]) run++;
      else if (run) { clues.push(run); run = 0; }
    }
    if (run) clues.push(run);
    return clues;
  }

  /* ---------- line solving ---------- */

  // Every valid placement of `clue` (array of run lengths) on a line of
  // length n. Returns an array of boolean arrays.
  function placements(clue, n) {
    var out = [];
    function rec(idx, start, arr) {
      if (idx === clue.length) {
        out.push(arr.slice());
        return;
      }
      var run = clue[idx];
      var remaining = 0;
      for (var k = idx + 1; k < clue.length; k++) remaining += clue[k] + 1;
      var limit = n - run - remaining;
      for (var s = start; s <= limit; s++) {
        var copy = arr.slice();
        for (var c = s; c < s + run; c++) copy[c] = true;
        rec(idx + 1, s + run + 1, copy);
      }
    }
    rec(0, 0, new Array(n).fill(false));
    return out;
  }

  // Given a line's clue, the line length, and current constraints
  // (array of true/false/null), return the cells forced by every
  // remaining valid placement, or null if the line is impossible.
  function lineSolve(clue, n, fixed) {
    var pl = placements(clue, n);
    var filtered = [];
    for (var i = 0; i < pl.length; i++) {
      var p = pl[i];
      var ok = true;
      for (var j = 0; j < n; j++) {
        if (fixed[j] !== null && fixed[j] !== p[j]) { ok = false; break; }
      }
      if (ok) filtered.push(p);
    }
    if (!filtered.length) return null;
    var forced = [];
    for (var c = 0; c < n; c++) {
      var v = filtered[0][c];
      var same = true;
      for (var k = 1; k < filtered.length; k++) {
        if (filtered[k][c] !== v) { same = false; break; }
      }
      if (same) forced.push([c, v]);
    }
    return { forced: forced, count: filtered.length };
  }

  /* ---------- full solver ---------- */

  function makeSolver(cluesR, cluesC, n) {
    function clone(s) { return s.map(function (row) { return row.slice(); }); }

    // Apply row/col line solving until nothing changes. Returns false
    // if a contradiction is found.
    function propagate(s) {
      var changed = true;
      var guard = 0;
      while (changed && guard++ < 200) {
        changed = false;
        for (var r = 0; r < n; r++) {
          var res = lineSolve(cluesR[r], n, s[r]);
          if (!res) return false;
          for (var i = 0; i < res.forced.length; i++) {
            var idx = res.forced[i][0], val = res.forced[i][1];
            if (s[r][idx] === null) { s[r][idx] = val; changed = true; }
          }
        }
        for (var c = 0; c < n; c++) {
          var col = new Array(n);
          for (var rr = 0; rr < n; rr++) col[rr] = s[rr][c];
          var resC = lineSolve(cluesC[c], n, col);
          if (!resC) return false;
          for (var j = 0; j < resC.forced.length; j++) {
            var ci = resC.forced[j][0], cv = resC.forced[j][1];
            if (s[ci][c] === null) { s[ci][c] = cv; changed = true; }
          }
        }
      }
      return true;
    }

    function isSolved(s) {
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (s[r][c] === null) return false;
      return true;
    }

    // Count solutions up to maxCount; returns { count, solution }.
    function count(s, maxCount) {
      if (!propagate(s)) return { count: 0, solution: null };
      if (isSolved(s)) return { count: 1, solution: clone(s) };
      var br = -1, bc = -1;
      for (var r = 0; r < n && br < 0; r++) {
        for (var c = 0; c < n; c++) {
          if (s[r][c] === null) { br = r; bc = c; break; }
        }
      }
      var total = 0;
      var sol = null;
      var values = [true, false];
      for (var v = 0; v < 2; v++) {
        var copy = clone(s);
        copy[br][bc] = values[v];
        var res = count(copy, maxCount - total);
        total += res.count;
        if (!sol && res.solution) sol = res.solution;
        if (total >= maxCount) break;
      }
      return { count: total, solution: sol };
    }

    return {
      solve: function () {
        var s = clone(new Array(n).fill(null).map(function () { return new Array(n).fill(null); }));
        if (!propagate(s)) return { unique: false, solution: null };
        var res = count(s, 2);
        return { unique: res.count === 1, solution: res.count === 1 ? res.solution : null };
      }
    };
  }

  /* ---------- generation ---------- */

  // Exact-density random grid: exactly `filled` cells are true.
  function randomGrid(n, density, rng) {
    var total = n * n;
    var filled = Math.round(total * density);
    var cells = [];
    for (var i = 0; i < total; i++) cells.push(i);
    // partial Fisher-Yates to pick `filled` positions
    for (var j = 0; j < filled; j++) {
      var k = j + Math.floor(rng() * (total - j));
      var t = cells[j]; cells[j] = cells[k]; cells[k] = t;
    }
    var set = {};
    for (var m = 0; m < filled; m++) set[cells[m]] = true;
    var grid = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < n; c++) row.push(!!set[r * n + c]);
      grid.push(row);
    }
    return grid;
  }

  function generate(difficulty, rng) {
    rng = rng || Math.random;
    var n = CONFIG.sizes[difficulty];
    var density = CONFIG.density[difficulty];
    for (var attempt = 0; attempt < 250; attempt++) {
      var grid = randomGrid(n, density, rng);
      var cluesR = [], cluesC = [];
      for (var r = 0; r < n; r++) cluesR.push(lineClues(grid[r]));
      for (var c = 0; c < n; c++) {
        var col = [];
        for (var r2 = 0; r2 < n; r2++) col.push(grid[r2][c]);
        cluesC.push(lineClues(col));
      }
      var sol = makeSolver(cluesR, cluesC, n).solve();
      if (sol.unique) {
        return {
          size: n,
          difficulty: difficulty,
          clues: { rows: cluesR, cols: cluesC },
          solution: grid,
          key: JSON.stringify(cluesR) + "|" + JSON.stringify(cluesC)
        };
      }
    }
    return null;
  }

  // Generate `count` distinct puzzles (no two share the same clue set).
  function generateSheet(difficulty, count, rng) {
    rng = rng || Math.random;
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard++ < count * 40) {
      var p = generate(difficulty, rng);
      if (!p) continue;
      if (seen[p.key]) continue;
      seen[p.key] = true;
      out.push(p);
    }
    return out;
  }

  var api = {
    CONFIG: CONFIG,
    lineClues: lineClues,
    placements: placements,
    generate: generate,
    generateSheet: generateSheet
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.NonogramGen = api;
})(typeof window !== "undefined" ? window : globalThis);
