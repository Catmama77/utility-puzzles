/* ============================================================
   Kakuro generator.
   Pure logic, no DOM. Builds a crossword-style grid where white
   cells must be filled with digits 1-9 — no digit repeated within
   a run — so each horizontal/vertical run adds up to the clue in
   its black cell.

   API:
     KakuroGen.SIZES          — { "8x8", "10x10", "12x12" }
     KakuroGen.DIFFICULTY     — { easy, medium, hard } (black density)
     KakuroGen.makeKakuro(sizeKey, difficultyKey)
       -> {
            grid:  rows x cols of { black, across|null, down|null, digit|null },
            rows, cols, title, difficulty, sizeKey
          }
     KakuroGen.makeBatch(count, sizeKey, difficultyKey)
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "8x8":   { rows: 8,  cols: 8,  label: "8 × 8" },
    "10x10": { rows: 10, cols: 10, label: "10 × 10" },
    "12x12": { rows: 12, cols: 12, label: "12 × 12" }
  };

  var DIFFICULTY = {
    easy:   { label: "Easy",   black: 0.18 },
    medium: { label: "Medium", black: 0.26 },
    hard:   { label: "Hard",   black: 0.34 }
  };

  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Fill the white cells so every run has distinct digits. Greedy
  // row-major with a bounded re-fill loop when a cell gets stuck
  // (runs are short, so this converges fast).
  function fillGrid(grid, rows, cols, blackP) {
    // layout first: decide black/white up front so the fill is stable
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var isBlack;
        if (r === 0 || c === 0) isBlack = true; // clue border
        else isBlack = Math.random() < blackP;
        grid[r][c] = { black: isBlack, across: null, down: null, digit: null };
      }
    }

    // run-length cap: a run can never exceed 9 (digits 1..9), and
    // keeping runs short makes the fill trivially satisfiable. If a
    // run would be longer than 7, force a black cell in the middle.
    var forced = 0;
    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < cols; cc++) {
        if (grid[rr][cc].black) continue;
        // count run length to the right and below
        var right = 0;
        for (var c2 = cc; c2 < cols && !grid[rr][c2].black; c2++) right++;
        var down = 0;
        for (var r2 = rr; r2 < rows && !grid[r2][cc].black; r2++) down++;
        if (right > 7 || down > 7) {
          grid[rr][cc].black = true;
          grid[rr][cc].digit = null;
          forced++;
        }
      }
    }

    // digits with per-attempt retries
    for (var attempt = 0; attempt < 500; attempt++) {
      var ok = true;
      for (var r3 = 0; r3 < rows && ok; r3++) {
        for (var c3 = 0; c3 < cols && ok; c3++) {
          var cell = grid[r3][c3];
          if (cell.black) continue;
          var used = {};
          for (var c4 = c3 - 1; c4 >= 0 && !grid[r3][c4].black; c4--) {
            used[grid[r3][c4].digit] = true;
          }
          for (var r4 = r3 - 1; r4 >= 0 && !grid[r4][c3].black; r4--) {
            used[grid[r4][c3].digit] = true;
          }
          var options = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(function (d) {
            return !used[d];
          }));
          if (!options.length) { ok = false; break; }
          cell.digit = options[0];
        }
      }
      if (ok) return true;
      // clear digits and retry with a fresh layout
      for (var r5 = 0; r5 < rows; r5++) {
        for (var c5 = 0; c5 < cols; c5++) {
          if (!grid[r5][c5].black) grid[r5][c5].digit = null;
        }
      }
      if (attempt % 5 === 4) {
        // occasionally re-randomize the layout too
        for (var r6 = 1; r6 < rows; r6++) {
          for (var c6 = 1; c6 < cols; c6++) {
            grid[r6][c6].black = Math.random() < blackP;
            grid[r6][c6].digit = null;
          }
        }
        forced = 0;
      }
    }
    return false;
  }

  // compute sums for every run and attach clues to the black cell
  // immediately left (across) / above (down) it.
  function computeSums(grid, rows, cols) {
    // horizontal runs
    for (var r = 0; r < rows; r++) {
      var c = 0;
      while (c < cols) {
        if (!grid[r][c].black) { c++; continue; }
        var start = c + 1;
        var sum = 0;
        var len = 0;
        var cc = start;
        while (cc < cols && !grid[r][cc].black) {
          sum += grid[r][cc].digit;
          len++;
          cc++;
        }
        if (len > 0) grid[r][c].across = sum;
        c = cc;
      }
    }
    // vertical runs
    for (var c2 = 0; c2 < cols; c2++) {
      var r2 = 0;
      while (r2 < rows) {
        if (!grid[r2][c2].black) { r2++; continue; }
        var start2 = r2 + 1;
        var sum2 = 0;
        var len2 = 0;
        var rr = start2;
        while (rr < rows && !grid[rr][c2].black) {
          sum2 += grid[rr][c2].digit;
          len2++;
          rr++;
        }
        if (len2 > 0) grid[r2][c2].down = sum2;
        r2 = rr;
      }
    }
  }

  function makeKakuro(sizeKey, diffKey) {
    var S = SIZES[sizeKey] || SIZES["10x10"];
    var D = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    var rows = S.rows;
    var cols = S.cols;

    var grid = [];
    for (var r = 0; r < rows; r++) grid.push([]);

    if (!fillGrid(grid, rows, cols, D.black)) {
      return { grid: [], rows: 0, cols: 0, title: "" };
    }
    computeSums(grid, rows, cols);

    // white cells are hidden in the puzzle (digit kept for solution)
    var title = "Kakuro — " + S.label + " · " + D.label;

    return {
      grid: grid,
      rows: rows,
      cols: cols,
      title: title,
      difficulty: diffKey,
      sizeKey: sizeKey
    };
  }

  function signature(k) {
    var parts = [];
    for (var r = 0; r < k.rows; r++) {
      for (var c = 0; c < k.cols; c++) {
        var cell = k.grid[r][c];
        parts.push(
          cell.black
            ? "#" + (cell.across || "") + "/" + (cell.down || "")
            : String(cell.digit)
        );
      }
    }
    return parts.join("|");
  }

  function makeBatch(count, sizeKey, diffKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 60;
    for (var i = 0; i < count; i++) {
      var k = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makeKakuro(sizeKey, diffKey);
        if (!cand.rows) continue;
        var sig = signature(cand);
        if (!seen[sig]) {
          k = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!k) {
        k = makeKakuro(sizeKey, diffKey);
        if (!k.rows) k = { grid: [], rows: 0, cols: 0, title: "" };
      }
      out.push(k);
    }
    return out;
  }

  global.KakuroGen = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    makeKakuro: makeKakuro,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
