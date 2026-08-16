/* ============================================================
   Shared puzzle placement engine (pure logic, no DOM).
   Used by the word fill-in and crossword generators.

   API:
     PuzzleCore.generateLayout(pool, opts) -> {
       gridArr: [{ black, letter|null, number|null }],
       placed:  [{ word, row, col, dir }]  (grid coordinates),
       rows, cols
     }
     PuzzleCore.numberSlots(rows, cols, gridArr) -> assigns numbers
     PuzzleCore.shuffle(arr)
     PuzzleCore.normalize(word)
   ============================================================ */

(function (global) {
  "use strict";

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function normalize(word) {
    return String(word).toUpperCase().replace(/[^A-Z]/g, "");
  }

  function key(r, c) { return r + "," + c; }

  // Cells store { letter, dirs } where dirs tracks which
  // directions ('h'/'v') run through the cell.
  function getCell(grid, r, c) { return grid.get(key(r, c)); }

  /* ---------- placement validation ----------
     A word may be placed at (r, c) going horizontally ('h') or
     vertically ('v') if:
       - every cell is empty, or holds the same letter from a word
         running in the PERPENDICULAR direction (a true crossing)
       - the cells just before the start and after the end are empty
       - for empty cells, the two perpendicular neighbours are empty
     Crossing cells are not re-checked: the crossing word already
     validated them when it was placed. */

  function canPlace(grid, word, r, c, dir) {
    var len = word.length;

    var br = dir === "h" ? r : r - 1;
    var bc = dir === "h" ? c - 1 : c;
    if (getCell(grid, br, bc)) return false;

    var ar = dir === "h" ? r : r + len;
    var ac = dir === "h" ? c + len : c;
    if (getCell(grid, ar, ac)) return false;

    for (var i = 0; i < len; i++) {
      var cr = dir === "h" ? r : r + i;
      var cc = dir === "h" ? c + i : c;
      var cell = getCell(grid, cr, cc);
      if (cell) {
        // collinear overlap is never allowed
        if (cell.dirs.indexOf(dir) !== -1) return false;
        // crossing: the letter must match
        if (cell.letter !== word[i]) return false;
        continue; // crossing cell: neighbours already validated
      }
      if (dir === "h") {
        if (getCell(grid, cr - 1, cc)) return false;
        if (getCell(grid, cr + 1, cc)) return false;
      } else {
        if (getCell(grid, cr, cc - 1)) return false;
        if (getCell(grid, cr, cc + 1)) return false;
      }
    }
    return true;
  }

  function placeAt(grid, word, r, c, dir) {
    for (var i = 0; i < word.length; i++) {
      var cr = dir === "h" ? r : r + i;
      var cc = dir === "h" ? c + i : c;
      var k = key(cr, cc);
      var cell = grid.get(k);
      if (cell) {
        cell.dirs += dir; // crossing cell
      } else {
        grid.set(k, { letter: word[i], dirs: dir });
      }
    }
  }

  function bbox(grid) {
    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    grid.forEach(function (_, k) {
      var parts = k.split(",");
      var r = +parts[0], c = +parts[1];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    });
    if (minR === Infinity) return { minR: 0, maxR: 0, minC: 0, maxC: 0 };
    return { minR: minR, maxR: maxR, minC: minC, maxC: maxC };
  }

  // Candidate metrics: prefer compact, roughly-square grids, so
  // puzzles stay a good size for printing.
  function dimsOf(grid, word, r, c, dir) {
    var b = bbox(grid);
    var wMaxR = dir === "h" ? r : r + word.length - 1;
    var wMaxC = dir === "h" ? c + word.length - 1 : c;
    var rows = Math.max(b.maxR, wMaxR) - Math.min(b.minR, r) + 1;
    var cols = Math.max(b.maxC, wMaxC) - Math.min(b.minC, c) + 1;
    return { rows: rows, cols: cols, max: Math.max(rows, cols), area: rows * cols };
  }

  function better(a, b) {
    if (!a) return b;
    if (!b) return a;
    if (a.max !== b.max) return a.max < b.max ? a : b;
    return a.area < b.area ? a : b;
  }

  // Try to place `word` intersecting an already-placed word.
  // Candidates that would push the grid past maxDim are skipped.
  function findIntersection(grid, placed, word, maxDim) {
    var best = null;
    for (var p = 0; p < placed.length; p++) {
      var pw = placed[p];
      for (var li = 0; li < word.length; li++) {
        for (var pi = 0; pi < pw.word.length; pi++) {
          if (pw.word[pi] !== word[li]) continue;
          var dir = pw.dir === "h" ? "v" : "h";
          var row = dir === "h" ? pw.row + pi : pw.row - li;
          var col = dir === "h" ? pw.col - li : pw.col + pi;
          if (!canPlace(grid, word, row, col, dir)) continue;
          var d = dimsOf(grid, word, row, col, dir);
          if (d.max > maxDim) continue;
          var cand = { row: row, col: col, dir: dir, max: d.max, area: d.area };
          best = better(best, cand);
        }
      }
    }
    return best;
  }

  // Try to place `word` standalone inside the current bounding box
  // (fills gaps without stretching the grid further).
  function findStandalone(grid, word, maxDim) {
    var b = bbox(grid);
    var best = null;
    for (var r = b.minR; r <= b.maxR; r++) {
      for (var c = b.minC; c <= b.maxC; c++) {
        for (var d = 0; d < 2; d++) {
          var dir = d === 0 ? "h" : "v";
          if (!canPlace(grid, word, r, c, dir)) continue;
          var dim = dimsOf(grid, word, r, c, dir);
          if (dim.max > maxDim) continue;
          var cand = { row: r, col: c, dir: dir, max: dim.max, area: dim.area };
          best = better(best, cand);
        }
      }
    }
    return best;
  }

  /* ---------- main layout ----------
     pool: array of unique uppercase words (sorted longest-first)
     opts: { minLen, maxLen, target, pad }
     Returns the final grid plus the placed words with grid coords. */

  function generateLayout(pool, opts) {
    var maxDim = opts.maxDim || Infinity;
    var grid = new Map();
    var placed = [];

    if (!pool.length) {
      return { gridArr: [], placed: [], rows: 0, cols: 0 };
    }

    // Phase 1: place the first word, then intersect the rest
    var first = pool[0];
    placeAt(grid, first, 0, 0, "h");
    placed.push({ word: first, row: 0, col: 0, dir: "h" });

    for (var i = 1; i < pool.length && placed.length < opts.target; i++) {
      var w = pool[i];
      var spot = findIntersection(grid, placed, w, maxDim);
      if (!spot) continue;
      placeAt(grid, w, spot.row, spot.col, spot.dir);
      placed.push({ word: w, row: spot.row, col: spot.col, dir: spot.dir });
    }

    // Phase 2: fill gaps with standalone words if still under target
    if (placed.length < opts.target) {
      for (var j = 0; j < pool.length && placed.length < opts.target; j++) {
        var w2 = pool[j];
        var already = placed.some(function (p) { return p.word === w2; });
        if (already) continue;
        var spot2 = findStandalone(grid, w2, maxDim);
        if (!spot2) continue;
        placeAt(grid, w2, spot2.row, spot2.col, spot2.dir);
        placed.push({ word: w2, row: spot2.row, col: spot2.col, dir: spot2.dir });
      }
    }

    // Normalize coordinates and build the final grid array
    var b = bbox(grid);
    var offR = -b.minR + opts.pad;
    var offC = -b.minC + opts.pad;
    var rows = b.maxR - b.minR + 1 + opts.pad * 2;
    var cols = b.maxC - b.minC + 1 + opts.pad * 2;

    var gridArr = [];
    for (var r = 0; r < rows; r++) {
      gridArr.push([]);
      for (var c = 0; c < cols; c++) {
        var stored = getCell(grid, r - offR, c - offC);
        var letter = stored ? stored.letter : undefined;
        gridArr[r].push({ black: letter === undefined, letter: letter === undefined ? null : letter, number: null });
      }
    }

    var placedOut = placed.map(function (p) {
      return { word: p.word, row: p.row + offR, col: p.col + offC, dir: p.dir };
    });

    return { gridArr: gridArr, placed: placedOut, rows: rows, cols: cols };
  }

  /* ---------- numbering ----------
     Number each cell that starts an across and/or down slot,
     row-major. A cell starting both gets a single number. */

  function numberSlots(rows, cols, gridArr) {
    var next = 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var cell = gridArr[r][c];
        if (cell.black || !cell.letter) continue;
        var leftLetter = c > 0 && gridArr[r][c - 1].letter;
        var topLetter = r > 0 && gridArr[r - 1][c].letter;
        if (!leftLetter || !topLetter) {
          cell.number = next++;
        }
      }
    }
  }

  global.PuzzleCore = {
    generateLayout: generateLayout,
    numberSlots: numberSlots,
    shuffle: shuffle,
    normalize: normalize
  };
})(typeof window !== "undefined" ? window : globalThis);
