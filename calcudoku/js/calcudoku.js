/* ============================================================
   Calcudoku (KenKen-style) puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). An N x N grid where every row and column holds the
   digits 1..N exactly once. The grid is divided into cages;
   each cage shows a target number and an operator, and the
   digits inside it must produce the target when the operator
   is applied. Unlike killer sudoku, digits MAY repeat inside a
   cage (only rows and columns forbid repeats). Every published
   puzzle has exactly one solution (verified with a counting
   solver).

   API:
     CalcudokuGen.DIFFICULTY  — { easy, medium, hard } options
     CalcudokuGen.makePuzzle(difficultyKey) -> puzzle
     CalcudokuGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       n:     grid size,
       num:   n*n flat array of solution digits,
       given: n*n flat array of booleans,
       cages: [ { cells: [...], op: "+", target: n, start: topLeftCell } ],
       blanks: number of blank cells,
       difficulty, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var DIFFICULTY = {
    easy:   { label: "Easy",   n: 4, givens: 10 },
    medium: { label: "Medium", n: 5, givens: 11 },
    hard:   { label: "Hard",   n: 6, givens: 12 }
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

  /* ---------- cages ---------- */

  function neighbors(n, cell) {
    var r = Math.floor(cell / n), c = cell % n;
    var out = [];
    if (r > 0) out.push(cell - n);
    if (r < n - 1) out.push(cell + n);
    if (c > 0) out.push(cell - 1);
    if (c < n - 1) out.push(cell + 1);
    return out;
  }

  /* Partition the grid into connected cages of 1-4 cells
     (occasionally 5-6). Returns a list of cell arrays. */
  function makeCages(n) {
    var NCELLS = n * n;
    for (var attempt = 0; attempt < 300; attempt++) {
      var assigned = new Array(NCELLS).fill(false);
      var cages = [];
      var order = shuffle(range(NCELLS));
      for (var si = 0; si < order.length; si++) {
        var seed = order[si];
        if (assigned[seed]) continue;
        var target = 1 + Math.floor(Math.random() * 4); // 1-4 cells
        var cage = [seed];
        assigned[seed] = true;
        while (cage.length < target) {
          var frontier = {};
          for (var k = 0; k < cage.length; k++) {
            var nbs = neighbors(n, cage[k]);
            for (var m = 0; m < nbs.length; m++) {
              if (!assigned[nbs[m]]) frontier[nbs[m]] = true;
            }
          }
          var keys = Object.keys(frontier);
          if (!keys.length) break;
          var nxt = +keys[Math.floor(Math.random() * keys.length)];
          cage.push(nxt);
          assigned[nxt] = true;
        }
        cages.push(cage);
      }
      // fold any leftover unassigned cells into a neighbour cage
      var leftover = [];
      for (var i = 0; i < NCELLS; i++) if (!assigned[i]) leftover.push(i);
      if (leftover.length) {
        var cellCage = new Array(NCELLS);
        cages.forEach(function (cg, ci) {
          cg.forEach(function (cell) { cellCage[cell] = ci; });
        });
        for (var li = 0; li < leftover.length; li++) {
          var nbs2 = neighbors(n, leftover[li]);
          for (var m2 = 0; m2 < nbs2.length; m2++) {
            if (cellCage[nbs2[m2]] !== undefined) {
              cages[cellCage[nbs2[m2]]].push(leftover[li]);
              cellCage[leftover[li]] = cellCage[nbs2[m2]];
              break;
            }
          }
        }
      }
      // accept if no cage is absurdly large
      var ok = true;
      for (var j = 0; j < cages.length; j++) {
        if (cages[j].length > 6) { ok = false; break; }
      }
      if (ok) return cages;
    }
    return null;
  }

  /* ---------- operator + target ---------- */

  /* Choose an operator for a cage based on its solution digits and
     compute the target. Returns { op, target }. */
  function cageRule(num, cells) {
    var size = cells.length;
    if (size === 1) {
      return { op: "", target: num[cells[0]] };
    }
    if (size === 2) {
      var a = num[cells[0]], b = num[cells[1]];
      var lo = Math.min(a, b), hi = Math.max(a, b);
      var choices = ["+", "×", "−"];
      if (hi % lo === 0) choices.push("÷");
      var op = pick(choices);
      if (op === "+") return { op: "+", target: a + b };
      if (op === "×") return { op: "×", target: a * b };
      if (op === "−") return { op: "−", target: hi - lo };
      return { op: "÷", target: hi / lo };
    }
    var op2 = pick(["+", "×"]);
    var val = op2 === "+" ? 0 : 1;
    for (var i = 0; i < size; i++) {
      val = op2 === "+" ? val + num[cells[i]] : val * num[cells[i]];
    }
    return { op: op2, target: val };
  }

  /* ---------- counting solver ---------- */

  /* Count solutions up to `limit`. `gridIn` has 0 for blanks.
     Returns -1 if the node budget is exceeded. Prunes with
     row/column uniqueness, exact cage checks on completion, and
     partial bounds for + and × cages. Digits may repeat inside a
     cage, so the partial bounds don't assume distinctness. */
  function countSolutions(gridIn, cages, n, limit, nodeBudget) {
    var NCELLS = n * n;
    var MAX_NODES = nodeBudget || 300000;
    var grid = gridIn.slice();
    var fixed = grid.slice();
    var count = 0;
    var nodes = 0;

    var cageOf = new Array(NCELLS).fill(-1);
    for (var ci = 0; ci < cages.length; ci++) {
      for (var k = 0; k < cages[ci].cells.length; k++) cageOf[cages[ci].cells[k]] = ci;
    }
    var runVal = new Array(cages.length).fill(0); // running sum (or product for ×)
    var done = new Array(cages.length).fill(0);
    for (var ri = 0; ri < cages.length; ri++) {
      if (cages[ri].op === "×") runVal[ri] = 1; // multiplicative identity
    }

    function cageOk(ci) {
      var cg = cages[ci];
      if (cg.op === "") return runVal[ci] === cg.target;
      if (cg.op === "+") return runVal[ci] === cg.target;
      if (cg.op === "×") return runVal[ci] === cg.target;
      var a = grid[cg.cells[0]], b = grid[cg.cells[1]];
      if (cg.op === "−") return Math.abs(a - b) === cg.target;
      return Math.max(a, b) / Math.min(a, b) === cg.target;
    }

    function dfs(pos) {
      if (count >= limit || nodes > MAX_NODES) return;
      if (pos >= NCELLS) { count++; return; }
      if (fixed[pos] !== 0) { dfs(pos + 1); return; }
      var r = Math.floor(pos / n), c = pos % n;
      var ci = cageOf[pos];
      var op = ci !== -1 ? cages[ci].op : "";
      for (var d = 1; d <= n; d++) {
        nodes++;
        var dup = false;
        for (var i = 0; i < n; i++) {
          if (grid[r * n + i] === d) { dup = true; break; }
          if (grid[i * n + c] === d) { dup = true; break; }
        }
        if (dup) continue;
        // partial cage bounds (repeats allowed inside a cage)
        if (op === "+") {
          var sum = runVal[ci] + d;
          var rem = cages[ci].cells.length - done[ci] - 1;
          if (sum + rem * 1 > cages[ci].target || sum + rem * n < cages[ci].target) continue;
        } else if (op === "×") {
          var prod = runVal[ci] * d;
          if (cages[ci].target % prod !== 0) continue;
          var rem2 = cages[ci].cells.length - done[ci] - 1;
          if (cages[ci].target / prod > Math.pow(n, rem2)) continue;
        }
        grid[pos] = d;
        if (op === "+") runVal[ci] += d;
        else if (op === "×") runVal[ci] *= d;
        done[ci]++;
        var ok = true;
        if (done[ci] === cages[ci].cells.length && !cageOk(ci)) ok = false;
        if (ok) dfs(pos + 1);
        done[ci]--;
        if (op === "+") runVal[ci] -= d;
        else if (op === "×") runVal[ci] /= d;
        grid[pos] = 0;
        if (count >= limit || nodes > MAX_NODES) return;
      }
    }

    dfs(0);
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  /* Thick-border flags per cell: thick where the neighbour is in a
     different cage (or the grid edge), so cages are visible. */
  function computeEdges(cages, n) {
    var cageOf = new Array(n * n).fill(-1);
    for (var ci = 0; ci < cages.length; ci++) {
      for (var k = 0; k < cages[ci].cells.length; k++) cageOf[cages[ci].cells[k]] = ci;
    }
    var edges = new Array(n * n);
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        var idx = r * n + c;
        var me = cageOf[idx];
        edges[idx] = {
          t: r === 0 || cageOf[idx - n] !== me,
          b: r === n - 1 || cageOf[idx + n] !== me,
          l: c === 0 || cageOf[idx - 1] !== me,
          r: c === n - 1 || cageOf[idx + 1] !== me
        };
      }
    }
    return edges;
  }

  function finalize(num, given, cages, diffKey, d) {
    var blanks = 0;
    for (var i = 0; i < given.length; i++) if (!given[i]) blanks++;
    var full = cages.map(function (cg) {
      var start = cg.cells[0];
      for (var k = 1; k < cg.cells.length; k++) {
        if (cg.cells[k] < start) start = cg.cells[k];
      }
      return { cells: cg.cells.slice(), op: cg.op, target: cg.target, start: start };
    });
    return {
      n: d.n,
      size: d.n,
      num: num.slice(),
      given: given.slice(),
      cages: full,
      edges: computeEdges(full, d.n),
      blanks: blanks,
      difficulty: diffKey,
      title: "Calcudoku — " + d.label + " level"
    };
  }

  /* Blank cells (random order) keeping uniqueness; stops at the
     target or when no more cells can be removed. */
  function blankCells(num, cages, n, target) {
    var given = new Array(num.length).fill(true);
    var order = shuffle(range(num.length));
    var blanks = 0;
    for (var i = 0; i < order.length && blanks < target; i++) {
      var idx = order[i];
      var g = num.slice();
      given[idx] = false;
      for (var j = 0; j < num.length; j++) if (!given[j]) g[j] = 0;
      if (countSolutions(g, cages, n, 2) === 1) {
        blanks++;
      } else {
        given[idx] = true;
      }
    }
    return given;
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    for (var attempt = 0; attempt < 200; attempt++) {
      var num = makeLatin(d.n);
      var cageList = makeCages(d.n);
      if (!cageList) continue;
      var cages = cageList.map(function (cells) {
        var rule = cageRule(num, cells);
        return { cells: cells, op: rule.op, target: rule.target };
      });
      var bestGiven = null;
      var bestBlanks = -1;
      for (var t = 0; t < 3; t++) {
        var given = blankCells(num, cages, d.n, num.length - d.givens);
        var blanks = 0;
        for (var k = 0; k < given.length; k++) if (!given[k]) blanks++;
        if (blanks > bestBlanks) { bestBlanks = blanks; bestGiven = given; }
        if (blanks >= num.length - d.givens) break;
      }
      var g = num.slice();
      for (var j = 0; j < bestGiven.length; j++) if (!bestGiven[j]) g[j] = 0;
      // final belt-and-suspenders uniqueness check with a bigger budget
      if (countSolutions(g, cages, d.n, 2, 500000) !== 1) continue;
      return finalize(num, bestGiven, cages, diffKey, d);
    }
    return null;
  }

  function signature(p) {
    return p.num.join("") + "|" + p.cages.map(function (c) { return c.cells.join(":") + c.op + c.target; }).join("|") +
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

  global.CalcudokuGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _makeLatin: makeLatin,          // exposed for tests
    _makeCages: makeCages,          // exposed for tests
    _cageRule: cageRule,            // exposed for tests
    _blankCells: blankCells,        // exposed for tests
    _computeEdges: computeEdges     // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
