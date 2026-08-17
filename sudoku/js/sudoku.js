/* ============================================================
   Sudoku puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Generates a complete, valid grid, then removes
   numbers while guaranteeing the puzzle keeps exactly one
   solution.

   API:
     SudokuGen.SIZES          — { "4x4", "6x6", "9x9" } options
     SudokuGen.DIFFICULTY     — { easy, medium, hard } options
     SudokuGen.makePuzzle(sizeKey, difficultyKey) -> puzzle
     puzzle = {
       puzzle:   flat array of numbers (0 = empty cell),
       solution: flat array of numbers (complete grid),
       size, boxRows, boxCols, clues, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var SIZES = {
    "4x4": { size: 4, boxRows: 2, boxCols: 2, label: "4 × 4 Mini" },
    "6x6": { size: 6, boxRows: 2, boxCols: 3, label: "6 × 6 Junior" },
    "9x9": { size: 9, boxRows: 3, boxCols: 3, label: "9 × 9 Classic" }
  };

  // "remove" = how many numbers to take out of the completed grid.
  // The remaining clues are: total cells − removed.
  var DIFFICULTY = {
    easy:   { label: "Easy",   remove: { 4: 8, 6: 18, 9: 41 } },
    medium: { label: "Medium", remove: { 4: 10, 6: 22, 9: 49 } },
    hard:   { label: "Hard",   remove: { 4: 11, 6: 25, 9: 53 } }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function range(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    return a;
  }

  function canPlace(grid, size, boxRows, boxCols, r, c, v) {
    for (var k = 0; k < size; k++) {
      if (grid[r * size + k] === v) return false;
      if (grid[k * size + c] === v) return false;
    }
    var br = Math.floor(r / boxRows) * boxRows;
    var bc = Math.floor(c / boxCols) * boxCols;
    for (var i = br; i < br + boxRows; i++) {
      for (var j = bc; j < bc + boxCols; j++) {
        if (grid[i * size + j] === v) return false;
      }
    }
    return true;
  }

  // Randomized backtracking fill of a complete valid grid.
  function generateFull(size, boxRows, boxCols) {
    var grid = new Array(size * size).fill(0);

    function fill(idx) {
      if (idx === grid.length) return true;
      var r = Math.floor(idx / size);
      var c = idx % size;
      var vals = shuffle(range(size)).map(function (x) { return x + 1; });
      for (var i = 0; i < vals.length; i++) {
        if (canPlace(grid, size, boxRows, boxCols, r, c, vals[i])) {
          grid[idx] = vals[i];
          if (fill(idx + 1)) return true;
        }
      }
      grid[idx] = 0;
      return false;
    }

    fill(0);
    return grid;
  }

  // Count solutions of a (possibly partial) grid, stopping at `limit`.
  function countSolutions(grid, size, boxRows, boxCols, limit) {
    var count = 0;

    function rec() {
      if (count >= limit) return;
      var pos = -1;
      for (var i = 0; i < grid.length; i++) {
        if (grid[i] === 0) { pos = i; break; }
      }
      if (pos === -1) { count++; return; }
      var r = Math.floor(pos / size);
      var c = pos % size;
      for (var v = 1; v <= size; v++) {
        if (canPlace(grid, size, boxRows, boxCols, r, c, v)) {
          grid[pos] = v;
          rec();
          if (count >= limit) { grid[pos] = 0; return; }
        }
      }
      grid[pos] = 0;
    }

    rec();
    return count;
  }

  /* Generate `count` distinct puzzles for one sheet/batch. Two sudoku
     with the same clue layout are the same puzzle, so the clue array
     is the identity. Retries with fresh puzzles until each one differs
     from every other in the batch (bounded attempts). */
  function makeBatch(count, sizeKey, diffKey) {
    var out = [];
    var seen = {};
    var maxAttempts = 20;
    for (var i = 0; i < count; i++) {
      var p = null;
      for (var a = 0; a < maxAttempts; a++) {
        var cand = makePuzzle(sizeKey, diffKey);
        var sig = cand.puzzle.join(",");
        if (!seen[sig]) {
          p = cand;
          seen[sig] = true;
          break;
        }
      }
      if (!p) p = makePuzzle(sizeKey, diffKey); // pool exhausted — accept one
      out.push(p);
    }
    return out;
  }

  function makePuzzle(sizeKey, diffKey) {
    var S = SIZES[sizeKey] || SIZES["9x9"];
    var D = DIFFICULTY[diffKey] || DIFFICULTY.easy;
    var size = S.size;
    var boxRows = S.boxRows;
    var boxCols = S.boxCols;
    var target = D.remove[size];
    var total = size * size;
    var deadline = Date.now() + 2500;

    var best = null; // { puzzle, removed, full }

    for (var attempt = 0; attempt < 40; attempt++) {
      var full = generateFull(size, boxRows, boxCols);
      var puzzle = full.slice();
      var order = shuffle(range(total));
      var removed = 0;

      for (var i = 0; i < order.length && removed < target; i++) {
        if (Date.now() > deadline) break;
        var pos = order[i];
        var saved = puzzle[pos];
        puzzle[pos] = 0;
        if (countSolutions(puzzle, size, boxRows, boxCols, 2) !== 1) {
          puzzle[pos] = saved; // would break uniqueness — keep the clue
        } else {
          removed++;
        }
      }

      if (!best || removed > best.removed) {
        best = { puzzle: puzzle, removed: removed, full: full };
      }
      if (removed === target) break;
      if (Date.now() > deadline) break;
    }

    return {
      puzzle: best.puzzle,
      solution: best.full,
      size: size,
      boxRows: boxRows,
      boxCols: boxCols,
      clues: total - best.removed,
      sizeKey: sizeKey,
      difficulty: diffKey,
      title: "Sudoku — " + S.label + " · " + D.label
    };
  }

  global.SudokuGen = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch
  };
})(typeof window !== "undefined" ? window : globalThis);
