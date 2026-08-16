/* ============================================================
   Sanity test for the sudoku generator.
   Run with: node test-sudoku.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("sudoku/js/sudoku.js", "utf8"), ctx, { filename: "sudoku/js/sudoku.js" });

const SudokuGen = ctx.SudokuGen;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

/* Independent brute-force solver (counts up to `limit` solutions),
   written separately from the generator so the two can't share a bug. */
function countSolutions(grid, size, boxRows, boxCols, limit) {
  let count = 0;
  function canPlace(r, c, v) {
    for (let k = 0; k < size; k++) {
      if (grid[r * size + k] === v) return false;
      if (grid[k * size + c] === v) return false;
    }
    const br = Math.floor(r / boxRows) * boxRows;
    const bc = Math.floor(c / boxCols) * boxCols;
    for (let i = br; i < br + boxRows; i++)
      for (let j = bc; j < bc + boxCols; j++)
        if (grid[i * size + j] === v) return false;
    return true;
  }
  function rec() {
    if (count >= limit) return;
    let pos = -1;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 0) { pos = i; break; }
    }
    if (pos === -1) { count++; return; }
    const r = Math.floor(pos / size);
    const c = pos % size;
    for (let v = 1; v <= size; v++) {
      if (canPlace(r, c, v)) {
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

function validateSolution(grid, size, boxRows, boxCols, label) {
  // rows
  for (let r = 0; r < size; r++) {
    const seen = new Set();
    for (let c = 0; c < size; c++) {
      const v = grid[r * size + c];
      if (v < 1 || v > size) {
        fail(label + " value out of range at r" + r + " c" + c + " (" + v + ")");
        return;
      }
      seen.add(v);
    }
    if (seen.size !== size) fail(label + " duplicate in row " + r);
  }
  // columns
  for (let c = 0; c < size; c++) {
    const seen = new Set();
    for (let r = 0; r < size; r++) seen.add(grid[r * size + c]);
    if (seen.size !== size) fail(label + " duplicate in column " + c);
  }
  // boxes
  for (let br = 0; br < size; br += boxRows) {
    for (let bc = 0; bc < size; bc += boxCols) {
      const seen = new Set();
      for (let r = br; r < br + boxRows; r++)
        for (let c = bc; c < bc + boxCols; c++)
          seen.add(grid[r * size + c]);
      if (seen.size !== size) fail(label + " duplicate in box " + br + "," + bc);
    }
  }
}

let generated = 0;

for (const sz of Object.keys(SudokuGen.SIZES)) {
  for (const diff of Object.keys(SudokuGen.DIFFICULTY)) {
    const target = SudokuGen.DIFFICULTY[diff].remove[SudokuGen.SIZES[sz].size];
    const total = SudokuGen.SIZES[sz].size * SudokuGen.SIZES[sz].size;
    for (let i = 0; i < 15; i++) {
      const p = SudokuGen.makePuzzle(sz, diff);
      generated++;
      const label = sz + "/" + diff + " #" + i;

      if (p.puzzle.length !== total || p.solution.length !== total) {
        fail(label + " wrong array length");
        continue;
      }

      validateSolution(p.solution, p.size, p.boxRows, p.boxCols, label);

      // every given clue must match the solution
      for (let k = 0; k < total; k++) {
        if (p.puzzle[k] !== 0 && p.puzzle[k] !== p.solution[k]) {
          fail(label + " clue at " + k + " contradicts solution");
          break;
        }
      }

      // the puzzle must have exactly one solution
      const sols = countSolutions(p.puzzle.slice(), p.size, p.boxRows, p.boxCols, 2);
      if (sols !== 1) {
        fail(label + " has " + sols + " solutions (expected exactly 1)");
      }

      // clue count should be close to the difficulty target (fallback slack)
      if (Math.abs(p.clues - (total - target)) > 4) {
        fail(label + " clue count " + p.clues + " far from target " + (total - target));
      }

      if (p.boxRows !== SudokuGen.SIZES[sz].boxRows || p.boxCols !== SudokuGen.SIZES[sz].boxCols) {
        fail(label + " box dimensions mismatch");
      }
    }
  }
}

console.log("Generated " + generated + " sudoku puzzles");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
