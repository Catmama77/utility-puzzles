/* ============================================================
   Cross Math puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Builds a square grid of digits where every row and
   every column is a valid math equation using +, −, × and ÷.
   The layout is the classic "cross math" pattern: digits sit at
   the even row/column intersections, the operators sit in the
   cells between them, and each line ends with "=" and its result.
   Equations evaluate strictly left to right (documented on the
   page), so "2 + 3 × 4" is (2 + 3) × 4 = 20, not 14.

   Difficulty controls the grid size, the operator set and how
   many digits are blanked out. Every published puzzle has
   exactly one solution (verified with a counting solver), and
   every puzzle in a batch is distinct.

   API:
     CrossMathGen.DIFFICULTY    — { easy, medium, hard } options
     CrossMathGen.makePuzzle(difficultyKey) -> puzzle
     CrossMathGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       k:       digits per line (grid is (2k-1) x (2k-1) cells),
       size:    2k-1, the rendered cell-grid size,
       num:     k x k flat array of solution digits,
       rowOps:  k lines of (k-2) operators (flat array),
       colOps:  k lines of (k-2) operators (flat array),
       given:   k x k flat array of booleans (true = pre-filled),
       blanks:  number of blank cells,
       difficulty, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  var DIFFICULTY = {
    easy:   { label: "Easy",   k: 3, ops: ["+", "−"], blanks: 5 },
    medium: { label: "Medium", k: 3, ops: ["+", "−", "×"], blanks: 6 },
    hard:   { label: "Hard",   k: 3, ops: ["+", "−", "×", "÷"], blanks: 7 }
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------- line arithmetic ---------- */

  /* Apply one operator; returns null when the step is not allowed
     (division that isn't exact, or a non-positive result). */
  function applyOp(acc, op, b) {
    var v;
    if (op === "+") v = acc + b;
    else if (op === "−") v = acc - b;
    else if (op === "×") v = acc * b;
    else {
      if (b === 0 || acc % b !== 0) return null;
      v = acc / b;
    }
    return v >= 1 ? v : null;
  }

  /* Evaluate a line left to right. nums are the first k-1 digits,
     ops are the k-2 operators between them. Returns the value the
     line's result cell must equal, or null if any step fails. */
  function lineValue(nums, ops) {
    var acc = nums[0];
    for (var i = 0; i < ops.length; i++) {
      acc = applyOp(acc, ops[i], nums[i + 1]);
      if (acc === null) return null;
    }
    return acc;
  }

  /* Full equation check: first k-1 digits with the operators must
     evaluate to the last digit. */
  function lineOk(nums, ops) {
    if (nums.length < 2) return true;
    return lineValue(nums.slice(0, nums.length - 1), ops) === nums[nums.length - 1];
  }

  /* ---------- solution search ---------- */

  /* Find one digit assignment for the k x k grid satisfying every
     row and column equation. Returns null if the operator layout
     is unsatisfiable. Randomized so successive puzzles differ. */
  function solveFirst(k, rowOps, colOps) {
    var n = k * k;
    var grid = new Array(n).fill(0);
    // Natural row-major fill: a row is checked the moment its last
    // cell is placed, a column the moment its bottom cell is placed.
    // The node budget bails out on pathological layouts (mainly hard's
    // division-heavy ones) so the caller can retry with new operators.
    var NODE_BUDGET = 150000;
    var nodes = 0;

    function dfs(pos) {
      if (++nodes > NODE_BUDGET) return false;
      if (pos >= n) return true;
      var digits = shuffle(DIGITS.slice());
      for (var i = 0; i < digits.length; i++) {
        grid[pos] = digits[i];
        if (!partialOk(grid, k, rowOps, colOps, pos)) continue;
        if (dfs(pos + 1)) return true;
      }
      grid[pos] = 0;
      return false;
    }

    return dfs(0) ? grid : null;
  }

  function range(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i);
    return out;
  }

  /* After placing the cell at flat index `idx`, check any row or
     column that has just become complete (all its digits placed). */
  function partialOk(grid, k, rowOps, colOps, idx) {
    var r = Math.floor(idx / k);
    var c = idx % k;

    var rowComplete = true;
    for (var cc = 0; cc < k; cc++) {
      if (grid[r * k + cc] === 0) { rowComplete = false; break; }
    }
    if (rowComplete) {
      var row = [];
      for (var cc2 = 0; cc2 < k; cc2++) row.push(grid[r * k + cc2]);
      if (!lineOk(row, rowOps.slice(r * (k - 2), r * (k - 2) + (k - 2)))) return false;
    }

    var colComplete = true;
    for (var rr = 0; rr < k; rr++) {
      if (grid[rr * k + c] === 0) { colComplete = false; break; }
    }
    if (colComplete) {
      var col = [];
      for (var rr2 = 0; rr2 < k; rr2++) col.push(grid[rr2 * k + c]);
      if (!lineOk(col, colOps.slice(c * (k - 2), c * (k - 2) + (k - 2)))) return false;
    }
    return true;
  }

  /* Count solutions up to `limit` (2 means "more than one"). Cells
     already non-zero in gridIn are treated as given. Fills in
     natural order and rejects partial lines the moment they are
     complete. Returns -1 if the node budget is exceeded (callers
     treat that as "retry with different operators"). */
  function countSolutions(gridIn, k, rowOps, colOps, limit, nodeBudget) {
    var grid = gridIn.slice();
    var fixed = grid.slice();
    var count = 0;
    var nodes = 0;
    var MAX_NODES = nodeBudget || 400000;
    var n = k * k;

    function dfs(pos) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (pos >= n) { count++; return; }
      if (fixed[pos] !== 0) { dfs(pos + 1); return; }
      for (var d = 1; d <= 9; d++) {
        nodes++;
        grid[pos] = d;
        if (!partialOk(grid, k, rowOps, colOps, pos)) continue;
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

  function makeGrid(d) {
    var k = d.k;
    // total operator slots: k lines per direction x (k-2) operators each
    var slots = k * (k - 2) * 2;
    for (var attempt = 0; attempt < 300; attempt++) {
      // Guarantee every allowed operator appears at least once, so Hard always
      // contains division and Medium always contains multiplication (a "hard"
      // puzzle with no ÷ would feel identical to medium).
      var opsList = d.ops.slice();
      while (opsList.length < slots) opsList.push(pick(d.ops));
      opsList = shuffle(opsList);
      var rowOps = opsList.slice(0, k * (k - 2));
      var colOps = opsList.slice(k * (k - 2));
      var grid = solveFirst(k, rowOps, colOps);
      if (!grid) continue;
      return { grid: grid, rowOps: rowOps, colOps: colOps, k: k };
    }
    return null;
  }

  /* Blank cells one at a time (random order), keeping every blank
     only if the puzzle stays unique. Stops at the target blank
     count or when no more cells can be removed. */
  function blankCells(gridIn, k, rowOps, colOps, target) {
    var given = new Array(gridIn.length).fill(true);
    var order = shuffle(range(gridIn.length));
    var blanks = 0;
    for (var i = 0; i < order.length && blanks < target; i++) {
      var idx = order[i];
      given[idx] = false;
      var g = gridIn.slice();
      for (var j = 0; j < given.length; j++) if (!given[j]) g[j] = 0;
      if (countSolutions(g, k, rowOps, colOps, 2) === 1) {
        blanks++;
      } else {
        given[idx] = true;
      }
    }
    return given;
  }

  function finalize(d, grid, rowOps, colOps, given) {
    var blanks = 0;
    for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
    return {
      k: d.k,
      size: 2 * d.k - 1,
      num: grid.slice(),
      rowOps: rowOps.slice(),
      colOps: colOps.slice(),
      given: given.slice(),
      blanks: blanks,
      difficulty: d.label.toLowerCase(),
      title: "Cross Math — " + d.label + " level"
    };
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    var made = makeGrid(d);
    if (!made) return null;
    // Blanking order is random and one unlucky order can stall below the
    // target; try a few orders and keep the most-blanked result so hard
    // reliably reaches its 7-blank target instead of occasionally shipping
    // an easy-level 5-blank puzzle.
    var bestGiven = null;
    var bestBlanks = -1;
    for (var t = 0; t < 3; t++) {
      var given = blankCells(made.grid, d.k, made.rowOps, made.colOps, d.blanks);
      var blanks = 0;
      for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
      if (blanks > bestBlanks) { bestBlanks = blanks; bestGiven = given; }
      if (blanks >= d.blanks) break;
    }
    return finalize(d, made.grid, made.rowOps, made.colOps, bestGiven);
  }

  function signature(p) {
    return p.num.join("") + "|" + p.rowOps.join("") + "|" + p.colOps.join("") + "|" + p.given.map(function (g) { return g ? 1 : 0; }).join("");
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

  global.CrossMathGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    lineOk: lineOk,                 // exposed for tests
    _solveFirst: solveFirst,        // exposed for tests
    _blankCells: blankCells         // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
