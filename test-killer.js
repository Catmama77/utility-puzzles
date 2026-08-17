/* Node tests for the Killer Sudoku generator (killer-sudoku/js/killer.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "killer-sudoku/js/killer.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const K = sandbox.KillerGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- helpers ---------- */

function idx(r, c) { return r * 9 + c; }

function validSudokuGrid(grid) {
  for (let r = 0; r < 9; r++) {
    const seen = {};
    for (let c = 0; c < 9; c++) {
      const v = grid[idx(r, c)];
      if (v < 1 || v > 9 || seen[v]) return false;
      seen[v] = true;
    }
  }
  for (let c = 0; c < 9; c++) {
    const seen = {};
    for (let r = 0; r < 9; r++) {
      const v = grid[idx(r, c)];
      if (seen[v]) return false;
      seen[v] = true;
    }
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = {};
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const v = grid[idx(br * 3 + dr, bc * 3 + dc)];
          if (seen[v]) return false;
          seen[v] = true;
        }
      }
    }
  }
  return true;
}

/* ---------- difficulty params ---------- */

ok(K.DIFFICULTY.easy && K.DIFFICULTY.medium && K.DIFFICULTY.hard,
  "three difficulty levels exist");
ok(K.DIFFICULTY.easy.targetCages >= K.DIFFICULTY.hard.targetCages,
  "easy has at least as many cages as hard (more clues) (" + K.DIFFICULTY.easy.targetCages + " vs " + K.DIFFICULTY.hard.targetCages + ")");
ok(K.DIFFICULTY.easy.maxCage < K.DIFFICULTY.hard.maxCage,
  "hard allows larger cages than easy (" + K.DIFFICULTY.easy.maxCage + " vs " + K.DIFFICULTY.hard.maxCage + ")");
ok(K.DIFFICULTY.easy.smallBias > K.DIFFICULTY.hard.smallBias,
  "easy favors more small clue cages than hard");

/* ---------- puzzle structure ---------- */

const pEasy = K.makePuzzle("easy");
const pMed = K.makePuzzle("medium");
const pHard = K.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.size === 9, "puzzle is 9×9");
ok(validSudokuGrid(pEasy.solution), "easy solution is a valid sudoku grid");
ok(validSudokuGrid(pMed.solution), "medium solution is a valid sudoku grid");
ok(validSudokuGrid(pHard.solution), "hard solution is a valid sudoku grid");

function checkCages(p, label) {
  // cages cover all 81 cells exactly once
  const covered = new Array(81).fill(false);
  p.cages.forEach((cg, i) => {
    ok(cg.cells.length >= 2, label + ": cage " + i + " has at least 2 cells");
    ok(typeof cg.sum === "number" && cg.sum >= 3 && cg.sum <= 45,
      label + ": cage " + i + " sum " + cg.sum + " in range");
    let s = 0;
    const seen = {};
    cg.cells.forEach((cell) => {
      ok(cell >= 0 && cell < 81, label + ": cage cell index in range");
      ok(!covered[cell], label + ": cell " + cell + " covered exactly once");
      covered[cell] = true;
      s += p.solution[cell];
      ok(!seen[p.solution[cell]], label + ": no repeat within cage " + i);
      seen[p.solution[cell]] = true;
    });
    ok(s === cg.sum, label + ": cage " + i + " sum matches solution (" + s + " vs " + cg.sum + ")");
  });
  ok(covered.every((x) => x), label + ": all 81 cells covered");
  // clueAt: one per cage, top-left-most cell
  ok(p.clueAt.length === p.cages.length, label + ": one clue cell per cage");
  p.cages.forEach((cg, i) => {
    const clue = p.clueAt[i];
    const cr = Math.floor(clue / 9), cc = clue % 9;
    ok(cg.cells.indexOf(clue) !== -1, label + ": clue cell is in its cage");
    cg.cells.forEach((cell) => {
      const r = Math.floor(cell / 9), c = cell % 9;
      ok(!(r < cr || (r === cr && c < cc)), label + ": clue is top-left-most");
    });
  });
  // edges: cage boundary flags consistent with membership
  p.edges.forEach((e, i) => {
    const r = Math.floor(i / 9), c = i % 9;
    const cageOf = (j) => p.cages.findIndex((cg) => cg.cells.indexOf(j) !== -1);
    ok(e.t === (r === 0 || cageOf(i) !== cageOf(i - 9)), label + ": edge t consistent @" + i);
    ok(e.b === (r === 8 || cageOf(i) !== cageOf(i + 9)), label + ": edge b consistent @" + i);
    ok(e.l === (c === 0 || cageOf(i) !== cageOf(i - 1)), label + ": edge l consistent @" + i);
    ok(e.r === (c === 8 || cageOf(i) !== cageOf(i + 1)), label + ": edge r consistent @" + i);
  });
}

checkCages(pEasy, "easy");
checkCages(pMed, "medium");
checkCages(pHard, "hard");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const n = K.countSolutions({ cages: p.cages, solution: p.solution }, 2);
  ok(n === 1, label + ": exactly one solution (got " + n + ")");
}
uniqueOnce(pEasy, "easy");
uniqueOnce(pMed, "medium");
uniqueOnce(pHard, "hard");

// a few more across difficulties
for (let i = 0; i < 6; i++) {
  uniqueOnce(K.makePuzzle("easy"), "easy #" + i);
  uniqueOnce(K.makePuzzle("medium"), "medium #" + i);
  uniqueOnce(K.makePuzzle("hard"), "hard #" + i);
}

/* ---------- batch distinctness ---------- */

const batch = K.makeBatch(3, "medium");
ok(batch.length === 3, "makeBatch(3) returns 3 puzzles");
const sigs = batch.map((p) => p.cages.map((cg) => cg.sum + ":" + cg.cells.length).sort().join(","));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
