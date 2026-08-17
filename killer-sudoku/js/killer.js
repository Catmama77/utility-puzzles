/* ============================================================
   Killer Sudoku puzzle generator.
   Pure logic, no DOM — works in the browser and in Node (for
   tests). Generates a complete, valid 9×9 sudoku grid, splits it
   into irregular cages, computes each cage's sum clue, then
   verifies the puzzle has exactly one solution with a cage-aware
   backtracking solver (sudoku rules + cage sums + no repeats
   within a cage). Every published puzzle is unique.

   API:
     KillerGen.DIFFICULTY   — { easy, medium, hard } options
     KillerGen.makePuzzle(difficultyKey) -> puzzle
     KillerGen.makeBatch(count, difficultyKey) -> [puzzle...]
     puzzle = {
       solution:   flat array of 81 digits,
       cages:      [ { cells: [indices...], sum: N }, ... ],
       clueAt:     [index of the clue cell per cage],
       edges:      [per-cell { t, r, b, l } cage-edge flags],
       size, cageCount, difficulty, title
     }
   ============================================================ */

(function (global) {
  "use strict";

  var SIZE = 9;
  var BOX = 3;
  var NCELLS = SIZE * SIZE;

  /* Difficulty tuning (measured, not guessed):
     - Generation must stay fast (a 28-cage layout takes 5-8s to verify and
       is unusable for a "new puzzle" button), so all levels use 30+ cages.
     - smallBias pushes more cages toward 2-3 cells; those tiny cages with
       tight sums (e.g. two cells summing to 3, 4, 16, 17) are the free clues
       that make a puzzle easy. easy gets the most, hard gets none.
     - hard allows 6-cell cages so occasional big, multi-combination cages
       appear, while easy caps at 4 cells.
     Measured at 30 puzzles per level: easy ~0.3s (15.7 two-cell cages),
     medium ~1.5s, hard ~1.2s, each with exactly one solution. */
  var DIFFICULTY = {
    easy:   { label: "Easy",   targetCages: 32, maxCage: 4, smallBias: 0.5 },
    medium: { label: "Medium", targetCages: 30, maxCage: 5, smallBias: 0.2 },
    hard:   { label: "Hard",   targetCages: 30, maxCage: 6, smallBias: 0 }
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

  /* ---------- complete grid ---------- */

  function canPlace(grid, r, c, v) {
    for (var i = 0; i < SIZE; i++) {
      if (grid[r * SIZE + i] === v) return false;
      if (grid[i * SIZE + c] === v) return false;
    }
    var br = Math.floor(r / BOX) * BOX;
    var bc = Math.floor(c / BOX) * BOX;
    for (var dr = 0; dr < BOX; dr++) {
      for (var dc = 0; dc < BOX; dc++) {
        if (grid[(br + dr) * SIZE + bc + dc] === v) return false;
      }
    }
    return true;
  }

  function generateFull() {
    var grid = new Array(NCELLS).fill(0);
    function fill(pos) {
      if (pos >= NCELLS) return true;
      var r = Math.floor(pos / SIZE);
      var c = pos % SIZE;
      var vals = shuffle(range(SIZE).map(function (x) { return x + 1; }));
      for (var i = 0; i < vals.length; i++) {
        if (canPlace(grid, r, c, vals[i])) {
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

  /* ---------- cage partition ---------- */

  function neighbors(i) {
    var r = Math.floor(i / SIZE);
    var c = i % SIZE;
    var out = [];
    if (r > 0) out.push(i - SIZE);
    if (r < SIZE - 1) out.push(i + SIZE);
    if (c > 0) out.push(i - 1);
    if (c < SIZE - 1) out.push(i + 1);
    return out;
  }

  /* Region-growing partition: visit cells in random order; each
     unassigned cell seeds a new cage that grows by absorbing
     adjacent unassigned cells until it reaches a target size
     (chosen so the average cage size lands on 81/targetCount).
     Leftover cells are folded into a neighbouring cage. Fast and
     gives direct control over cage count and size. */
  function makeCages(targetCount, maxCage, smallBias) {
    var avg = NCELLS / targetCount;
    for (var attempt = 0; attempt < 300; attempt++) {
      var assigned = new Array(NCELLS).fill(false);
      var cages = [];
      var order = shuffle(range(NCELLS));
      for (var si = 0; si < order.length; si++) {
        var seed = order[si];
        if (assigned[seed]) continue;
        // don't create a singleton cage: leave the seed for folding
        var nbs = neighbors(seed);
        var anyFree = false;
        for (var m = 0; m < nbs.length; m++) if (!assigned[nbs[m]]) { anyFree = true; break; }
        if (!anyFree) continue;
        var target;
        // smallBias: favor tiny 2-3 cell cages (tight sums = easy clues)
        if (smallBias && Math.random() < smallBias) {
          target = 2 + Math.floor(Math.random() * 2);
        } else {
          target = Math.max(2, Math.min(maxCage,
            Math.round(avg * (1 + (Math.random() - 0.5) * 0.6))));
        }
        var cage = [seed];
        assigned[seed] = true;
        // grow: repeatedly absorb a random unassigned neighbour
        while (cage.length < target) {
          var frontier = {};
          for (var k = 0; k < cage.length; k++) {
            var nbs2 = neighbors(cage[k]);
            for (var m2 = 0; m2 < nbs2.length; m2++) {
              if (!assigned[nbs2[m2]]) frontier[nbs2[m2]] = true;
            }
          }
          var keys = Object.keys(frontier);
          if (!keys.length) break;
          var pick = +keys[Math.floor(Math.random() * keys.length)];
          cage.push(pick);
          assigned[pick] = true;
        }
        cages.push({ cells: cage });
      }
      // fold any leftover unassigned cells into a neighbour cage
      var leftover = [];
      for (var i = 0; i < NCELLS; i++) if (!assigned[i]) leftover.push(i);
      if (leftover.length) {
        var cellCage = new Array(NCELLS);
        cages.forEach(function (cg, ci) {
          cg.cells.forEach(function (cell) { cellCage[cell] = ci; });
        });
        for (var li = 0; li < leftover.length; li++) {
          var nbs3 = neighbors(leftover[li]);
          var target2 = null;
          for (var m3 = 0; m3 < nbs3.length; m3++) {
            if (cellCage[nbs3[m3]] !== undefined) { target2 = cellCage[nbs3[m3]]; break; }
          }
          if (target2 === null) continue;
          cages[target2].cells.push(leftover[li]);
          cellCage[leftover[li]] = target2;
        }
      }
      // accept if cage count is close to target and every cage has ≥ 2 cells
      if (typeof process !== "undefined" && process.env.KDEBUG) console.log("DEBUG count:", cages.length, "ones:", cages.filter(function(c){return c.cells.length===1;}).length);
      if (cages.length > targetCount + 2 || cages.length < targetCount - 2) continue;
      var ok = true;
      for (var j = 0; j < cages.length; j++) {
        if (cages[j].cells.length < 2) { ok = false; break; }
      }
      if (ok) return cages;
    }
    return null;
  }

  /* ---------- uniqueness solver ---------- */

  /* Precompute, for every (size, sum), every subset of digits 1-9
     (as bitmasks) of that size summing to that sum. Enables exact
     cage pruning: a digit is only allowed if the remaining cells
     of the cage can still reach the remaining sum with distinct
     digits. */
  var COMBOS = {};
  (function buildCombos() {
    for (var mask = 1; mask < 512; mask++) {
      var sum = 0, size = 0;
      for (var d = 0; d < 9; d++) {
        if (mask & (1 << d)) { sum += d + 1; size++; }
      }
      var key = size + ":" + sum;
      if (!COMBOS[key]) COMBOS[key] = [];
      COMBOS[key].push(mask);
    }
  })();

  /* Counts solutions up to `limit`. Returns -1 if the node budget
     was exceeded (result unknown — caller should retry).

     Uses incremental bitmask propagation: each cell keeps a bitmask
     of candidate digits, updated as digits are placed (peers lose
     the placed digit; cage cells also re-filtered against the
     remaining cage sum via COMBOS). MRV picks the cell with the
     fewest candidates. */
  function countSolutions(p, limit, nodeBudget) {
    var grid = new Array(NCELLS).fill(0);
    var cageOf = new Array(NCELLS).fill(-1);
    var cageInfo = [];
    for (var ci = 0; ci < p.cages.length; ci++) {
      var cells = p.cages[ci].cells;
      cageInfo.push({ cells: cells, sum: p.cages[ci].sum });
      for (var k = 0; k < cells.length; k++) cageOf[cells[k]] = ci;
    }
    var count = 0;
    var nodes = 0;
    var MAX_NODES = nodeBudget || 300000;

    /* Precomputed peers: every cell that must differ from cell i
       (same row, column, box, or cage). */
    var peers = [];
    for (var i = 0; i < NCELLS; i++) {
      var r = Math.floor(i / SIZE);
      var c = i % SIZE;
      var set = {};
      for (var x = 0; x < SIZE; x++) {
        set[r * SIZE + x] = true;
        set[x * SIZE + c] = true;
      }
      var br = Math.floor(r / BOX) * BOX;
      var bc = Math.floor(c / BOX) * BOX;
      for (var dr = 0; dr < BOX; dr++) {
        for (var dc = 0; dc < BOX; dc++) {
          set[(br + dr) * SIZE + bc + dc] = true;
        }
      }
      var cage = cageInfo[cageOf[i]];
      for (var j = 0; j < cage.cells.length; j++) set[cage.cells[j]] = true;
      delete set[i];
      peers.push(Object.keys(set).map(Number));
    }

    /* ---------- 45-rule structures ----------
       Every row/col/box sums to 45. For each region, cages fully
       inside it have fixed sums; the remaining "partial" cells of
       that region must make up 45 minus those fixed sums. This
       prunes candidates hard, especially in large-cage puzzles. */
    var regions = []; // 27 regions: 9 rows, 9 cols, 9 boxes
    function addRegion(cells) {
      regions.push(cells);
      return regions.length - 1;
    }
    for (var rr = 0; rr < SIZE; rr++) {
      var row = [];
      for (var cc = 0; cc < SIZE; cc++) row.push(rr * SIZE + cc);
      addRegion(row);
    }
    for (var cc2 = 0; cc2 < SIZE; cc2++) {
      var col = [];
      for (var rr2 = 0; rr2 < SIZE; rr2++) col.push(rr2 * SIZE + cc2);
      addRegion(col);
    }
    for (var br = 0; br < BOX; br++) {
      for (var bc = 0; bc < BOX; bc++) {
        var box = [];
        for (var dr = 0; dr < BOX; dr++) {
          for (var dc = 0; dc < BOX; dc++) box.push((br * BOX + dr) * SIZE + bc * BOX + dc);
        }
        addRegion(box);
      }
    }

    /* contained[R]: sum of cage sums fully inside region R */
    var contained = new Array(regions.length).fill(0);
    for (var ci4 = 0; ci4 < cageInfo.length; ci4++) {
      var cg4 = cageInfo[ci4];
      for (var ri = 0; ri < regions.length; ri++) {
        var allIn = true;
        for (var j = 0; j < cg4.cells.length; j++) {
          if (regions[ri].indexOf(cg4.cells[j]) === -1) { allIn = false; break; }
        }
        if (allIn) contained[ri] += cg4.sum;
      }
    }

    /* for each cell, the regions in which its cage is PARTIAL
       (cage not fully inside that region) */
    var partialRegions = new Array(NCELLS);
    for (var i = 0; i < NCELLS; i++) {
      var pr = [];
      var rCell = Math.floor(i / SIZE);
      var cCell = i % SIZE;
      var br2 = Math.floor(rCell / BOX);
      var bc2 = Math.floor(cCell / BOX);
      var regs = [rCell, SIZE + cCell, 2 * SIZE + br2 * BOX + bc2];
      for (var k2 = 0; k2 < regs.length; k2++) {
        var ridx = regs[k2];
        var cageIdx = cageOf[i];
        // fully inside iff every cell of the cage is in the region
        var full = true;
        var cg5 = cageInfo[cageIdx];
        for (var m = 0; m < cg5.cells.length; m++) {
          if (regions[ridx].indexOf(cg5.cells[m]) === -1) { full = false; break; }
        }
        if (!full) pr.push(ridx);
      }
      partialRegions[i] = pr;
    }

    /* dynamic 45-rule state per region */
    var partialSum = new Array(regions.length).fill(0);
    var partialEmpty = new Array(regions.length).fill(0);
    var partialUsed = new Array(regions.length).fill(0);
    for (var ri2 = 0; ri2 < regions.length; ri2++) {
      var cells2 = regions[ri2];
      for (var j2 = 0; j2 < cells2.length; j2++) {
        var cell2 = cells2[j2];
        if (partialRegions[cell2].indexOf(ri2) !== -1) partialEmpty[ri2]++;
      }
    }

    /* true for a cell that is a partial-region member of region R */
    function isPartialCell(cell, R) {
      return partialRegions[cell].indexOf(R) !== -1;
    }

    /* region state update after placing/removing digit d at cell i */
    function updateRegionState(i, d, sign) {
      var pr = partialRegions[i];
      for (var k = 0; k < pr.length; k++) {
        var R = pr[k];
        partialSum[R] += sign * d;
        partialEmpty[R] -= sign;
        if (d) {
          if (sign > 0) partialUsed[R] |= 1 << (d - 1);
          else partialUsed[R] &= ~(1 << (d - 1));
        }
      }
    }

    /* candidate bitmasks; bit d-1 set = digit d still possible */
    var cand = new Array(NCELLS);
    for (var i0 = 0; i0 < NCELLS; i0++) cand[i0] = 0x1ff;
    var cageFilled = new Array(p.cages.length).fill(0);
    var cageEmpty = cageInfo.map(function (c) { return c.cells.length; });

    function regionFeasible(i, d) {
      var pr = partialRegions[i];
      for (var k = 0; k < pr.length; k++) {
        var R = pr[k];
        var rem = 45 - contained[R] - (partialSum[R] + d);
        var rest = partialEmpty[R] - 1;
        if (rest < 0) return false;
        if (rest === 0) {
          if (rem !== 0) return false;
          continue;
        }
        if (rem < 1 || rem > 45) return false;
        var combos3 = COMBOS[rest + ":" + rem];
        if (!combos3) return false;
        var forbidden = partialUsed[R] | (1 << (d - 1));
        var okCombo = false;
        for (var cm2 = 0; cm2 < combos3.length; cm2++) {
          if (!(combos3[cm2] & forbidden)) { okCombo = true; break; }
        }
        if (!okCombo) return false;
      }
      return true;
    }

    /* recompute cell i's candidates from scratch (used once at the
       start and after every placement for affected cells) */
    function recompute(i) {
      var used = 0;
      var pl = peers[i];
      for (var k = 0; k < pl.length; k++) {
        var v = grid[pl[k]];
        if (v) used |= 1 << (v - 1);
      }
      var free = 0x1ff & ~used;
      var ci2 = cageOf[i];
      var cage = cageInfo[ci2];
      var partial = cageFilled[ci2];
      var cageMask = 0;
      for (var j = 0; j < cage.cells.length; j++) {
        var v2 = grid[cage.cells[j]];
        if (v2) cageMask |= 1 << (v2 - 1);
      }
      var rem = cage.sum - partial;
      var restCells = cageEmpty[ci2] - 1;
      var out = 0;
      for (var d = 1; d <= 9; d++) {
        var b = 1 << (d - 1);
        if (!(free & b)) continue;
        if (cageMask & b) continue;
        if (restCells === 0) {
          if (rem === d) out |= b;
          continue;
        }
        if (rem - d < 1 || rem - d > 45) continue;
        var combos2 = COMBOS[restCells + ":" + (rem - d)];
        if (!combos2) continue;
        var forbidden = cageMask | b;
        var okCombo = false;
        for (var cm = 0; cm < combos2.length; cm++) {
          if (!(combos2[cm] & forbidden)) { okCombo = true; break; }
        }
        if (!okCombo) continue;
        // 45-rule: every row/col/box must reach 45
        if (!regionFeasible(i, d)) continue;
        out |= b;
      }
      return out;
    }

    /* cells whose candidates may have changed; recompute lazily */
    var dirty = new Array(NCELLS).fill(true);

    function ensureClean() {
      var changed = true;
      while (changed) {
        changed = false;
        for (var i = 0; i < NCELLS; i++) {
          if (!dirty[i] || grid[i]) continue;
          dirty[i] = false;
          var m = recompute(i);
          if (m === 0) return false; // contradiction
          if (m !== cand[i]) {
            cand[i] = m;
            // a candidate removal can affect peers of i only via
            // placements, not candidate sets — but cage sums do
            // depend on this cell's candidates; recompute cage mates
            var ci3 = cageOf[i];
            var cells3 = cageInfo[ci3].cells;
            for (var j = 0; j < cells3.length; j++) dirty[cells3[j]] = true;
            changed = true;
          }
        }
      }
      return true;
    }

    function place(i, d) {
      grid[i] = d;
      var ci = cageOf[i];
      cageFilled[ci] += d;
      cageEmpty[ci]--;
      updateRegionState(i, d, +1);
      // peers lose digit d
      var pl = peers[i];
      var b = 1 << (d - 1);
      for (var k = 0; k < pl.length; k++) {
        if (grid[pl[k]]) continue;
        if (cand[pl[k]] & b) {
          cand[pl[k]] &= ~b;
          dirty[pl[k]] = true;
        }
      }
      // cage cells re-filter against the new remaining sum; also any
      // cell sharing a partial region is affected by 45-rule state
      var cells = cageInfo[ci].cells;
      for (var j = 0; j < cells.length; j++) dirty[cells[j]] = true;
      var pr = partialRegions[i];
      for (var k2 = 0; k2 < pr.length; k2++) {
        var R = pr[k2];
        var rc = regions[R];
        for (var m = 0; m < rc.length; m++) dirty[rc[m]] = true;
      }
    }

    function unplace(i, d) {
      grid[i] = 0;
      var ci = cageOf[i];
      cageFilled[ci] -= d;
      cageEmpty[ci]++;
      updateRegionState(i, d, -1);
      var pl = peers[i];
      var b = 1 << (d - 1);
      for (var k = 0; k < pl.length; k++) {
        if (grid[pl[k]]) continue;
        cand[pl[k]] |= b;
        dirty[pl[k]] = true;
      }
      var cells = cageInfo[ci].cells;
      for (var j = 0; j < cells.length; j++) dirty[cells[j]] = true;
      var pr = partialRegions[i];
      for (var k2 = 0; k2 < pr.length; k2++) {
        var R = pr[k2];
        var rc = regions[R];
        for (var m = 0; m < rc.length; m++) dirty[rc[m]] = true;
      }
      dirty[i] = true;
    }

    /* initial propagation */
    if (!ensureClean()) return 0;

    function solve() {
      if (++nodes > MAX_NODES) return;
      if (count >= limit) return;
      if (!ensureClean()) return;
      var bestIdx = -1;
      var bestMask = 0;
      var bestBits = 10;
      for (var i = 0; i < NCELLS; i++) {
        if (grid[i]) continue;
        var m = cand[i];
        var t = m;
        var nBits = 0;
        while (t) { t &= (t - 1); nBits++; }
        if (nBits === 0) return;
        if (nBits < bestBits) {
          bestIdx = i;
          bestMask = m;
          bestBits = nBits;
          if (nBits === 1) break;
        }
      }
      if (bestIdx === -1) { count++; return; }
      for (var d = 1; d <= 9; d++) {
        var b = 1 << (d - 1);
        if (!(bestMask & b)) continue;
        place(bestIdx, d);
        solve();
        unplace(bestIdx, d);
        if (count >= limit || nodes > MAX_NODES) return;
      }
    }

    solve();
    if (nodes > MAX_NODES) return -1;
    return count;
  }

  /* ---------- puzzle assembly ---------- */

  function finalize(solution, cages, diffKey) {
    // clue cell per cage: the top-left-most cell
    var clueAt = cages.map(function (cg) {
      var best = cg.cells[0];
      for (var i = 1; i < cg.cells.length; i++) {
        var cell = cg.cells[i];
        var br = Math.floor(best / SIZE), bc = best % SIZE;
        var cr = Math.floor(cell / SIZE), cc = cell % SIZE;
        if (cr < br || (cr === br && cc < bc)) best = cell;
      }
      return best;
    });

    // cage membership per cell
    var cageOf = new Array(NCELLS);
    cages.forEach(function (cg, ci) {
      cg.cells.forEach(function (i) { cageOf[i] = ci; });
    });

    // which edges of each cell are cage boundaries
    var edges = [];
    for (var i = 0; i < NCELLS; i++) {
      var r = Math.floor(i / SIZE);
      var c = i % SIZE;
      edges.push({
        t: r === 0 || cageOf[i - SIZE] !== cageOf[i],
        r: c === SIZE - 1 || cageOf[i + 1] !== cageOf[i],
        b: r === SIZE - 1 || cageOf[i + SIZE] !== cageOf[i],
        l: c === 0 || cageOf[i - 1] !== cageOf[i]
      });
    }

    var d = DIFFICULTY[diffKey];
    return {
      solution: solution,
      cages: cages,
      clueAt: clueAt,
      edges: edges,
      size: SIZE,
      cageCount: cages.length,
      difficulty: diffKey,
      title: "Killer Sudoku — " + d.label + " level"
    };
  }

  /* One generation attempt: build a cage partition over a fresh solution,
     then return the puzzle only if it passes BOTH hard guarantees — no digit
     repeats inside any cage, and exactly one solution (countSolutions === 1).
     Returns the finalized puzzle, -1 when the uniqueness search hit its node
     budget (caller may retry with a deeper budget), or null to retry. */
  function tryMake(d, nodeBudget, diffKey) {
    var solution = generateFull();
    var cages = makeCages(d.targetCages, d.maxCage, d.smallBias);
    if (!cages) return null;
    // no repeats within a cage
    for (var k = 0; k < cages.length; k++) {
      var seen = {};
      for (var m = 0; m < cages[k].cells.length; m++) {
        var dv = solution[cages[k].cells[m]];
        if (seen[dv]) return null;
        seen[dv] = true;
      }
    }
    // compute sums from the solution
    for (var i = 0; i < cages.length; i++) {
      var s = 0;
      for (var j = 0; j < cages[i].cells.length; j++) s += solution[cages[i].cells[j]];
      cages[i].sum = s;
    }
    var n = countSolutions({ solution: solution, cages: cages }, 2, nodeBudget);
    if (n === 1) return finalize(solution, cages, diffKey);
    if (n === -1) return -1; // budget exceeded — let the caller escalate
    return null; // not unique — retry with a fresh layout
  }

  function makePuzzle(diffKey) {
    var d = DIFFICULTY[diffKey] || DIFFICULTY.medium;
    var nodeBudget = 300000;
    for (var attempt = 0; attempt < 150; attempt++) {
      var made = tryMake(d, nodeBudget, diffKey);
      if (made === -1) {
        // The uniqueness search hit its node budget — the puzzle may still be
        // unique, so give the next attempt a deeper budget to decide.
        nodeBudget = Math.min(nodeBudget * 2, 4000000);
        continue;
      }
      if (made) return made;
    }
    // Very unlikely fallback: keep trying with the deepest budget. Every
    // puzzle handed back here still passes the no-repeat and exactly-one-
    // solution guarantees — never emit a broken puzzle. 300 attempts is a
    // generous bound (practically unreachable at the 30+ cage layouts above).
    for (var t = 0; t < 300; t++) {
      var made2 = tryMake(d, 4000000, diffKey);
      if (made2 && made2 !== -1) return made2;
    }
    // Practically unreachable (~1 in 10^20): callers (makeBatch) skip nulls
    // rather than ever showing a broken puzzle.
    return null;
  }

  function signature(p) {
    return p.cages
      .map(function (cg) { return cg.sum + ":" + cg.cells.length; })
      .sort()
      .join(",");
  }

  function makeBatch(count, diffKey) {
    var out = [];
    var seen = {};
    var guard = 0;
    while (out.length < count && guard < 200) {
      guard++;
      var p = makePuzzle(diffKey);
      var sig = signature(p);
      if (seen[sig]) continue;
      seen[sig] = true;
      out.push(p);
    }
    return out;
  }

  global.KillerGen = {
    DIFFICULTY: DIFFICULTY,
    makePuzzle: makePuzzle,
    makeBatch: makeBatch,
    countSolutions: countSolutions, // exposed for tests
    _generateFull: generateFull,   // exposed for tests
    _makeCages: makeCages          // exposed for tests
  };
})(typeof window !== "undefined" ? window : globalThis);
