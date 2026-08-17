/* Node tests for the Calcudoku generator (calcudoku/js/calcudoku.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "calcudoku/js/calcudoku.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const C = sandbox.CalcudokuGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- difficulty params ---------- */

ok(C.DIFFICULTY.easy && C.DIFFICULTY.medium && C.DIFFICULTY.hard, "three difficulty levels exist");
ok(C.DIFFICULTY.easy.n < C.DIFFICULTY.medium.n && C.DIFFICULTY.medium.n < C.DIFFICULTY.hard.n,
  "grid sizes increase with difficulty");
ok(C.DIFFICULTY.easy.givens / (C.DIFFICULTY.easy.n * C.DIFFICULTY.easy.n) >
    C.DIFFICULTY.hard.givens / (C.DIFFICULTY.hard.n * C.DIFFICULTY.hard.n),
  "easy keeps a higher share of givens than hard");

/* ---------- cages ---------- */

const cage4 = C._makeCages(4);
ok(Array.isArray(cage4) && cage4.length >= 3, "4x4 grid partitions into cages");
(function () {
  const cover = new Set();
  cage4.forEach((cg) => cg.forEach((cell) => cover.add(cell)));
  ok(cover.size === 16, "cages cover all 16 cells");
  ok(cage4.every((cg) => cg.length >= 1 && cg.length <= 6), "no cage exceeds 6 cells");
})();

/* ---------- cage rules ---------- */

(function () {
  const num = [1, 2, 3, 4];
  const r1 = C._cageRule(num, [0]);
  ok(r1.op === "" && r1.target === 1, "1-cell cage has target only");
  const r2 = C._cageRule(num, [0, 3]);
  ok(r2.target >= 1, "2-cell cage target is positive");
  const r3 = C._cageRule(num, [0, 1, 2]);
  ok((r3.op === "+" || r3.op === "×") && r3.target >= 1, "3-cell cage uses + or ×");
})();

/* ---------- puzzle structure ---------- */

const pEasy = C.makePuzzle("easy");
const pMed = C.makePuzzle("medium");
const pHard = C.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.n === 4 && pMed.n === 5 && pHard.n === 6, "sizes are 4x4 / 5x5 / 6x6");

function checkPuzzle(p, label) {
  const n = p.n;
  // solution is a latin square
  for (let r = 0; r < n; r++) {
    const seen = new Set();
    for (let c = 0; c < n; c++) seen.add(p.num[r * n + c]);
    ok(seen.size === n, label + ": row " + r + " has 1.." + n + " once");
  }
  for (let c = 0; c < n; c++) {
    const seen = new Set();
    for (let r = 0; r < n; r++) seen.add(p.num[r * n + c]);
    ok(seen.size === n, label + ": column " + c + " has 1.." + n + " once");
  }
  p.num.forEach((v) => ok(v >= 1 && v <= n, label + ": digit " + v + " in range"));
  // cages cover every cell exactly once
  const cover = new Set();
  p.cages.forEach((cg, i) => {
    cg.cells.forEach((cell) => {
      ok(cell >= 0 && cell < n * n, label + ": cage " + i + " cell in range");
      ok(!cover.has(cell), label + ": cage " + i + " doesn't overlap");
      cover.add(cell);
    });
    ok(cg.start === Math.min.apply(null, cg.cells), label + ": cage " + i + " start is top-left");
  });
  ok(cover.size === n * n, label + ": cages cover all cells");
  // every cage rule matches the solution
  p.cages.forEach((cg, i) => {
    const vals = cg.cells.map((cell) => p.num[cell]);
    let good;
    if (cg.op === "") good = vals[0] === cg.target;
    else if (cg.op === "+") good = vals.reduce((a, b) => a + b, 0) === cg.target;
    else if (cg.op === "×") good = vals.reduce((a, b) => a * b, 1) === cg.target;
    else if (cg.op === "−") good = Math.abs(vals[0] - vals[1]) === cg.target;
    else good = Math.max.apply(null, vals) / Math.min.apply(null, vals) === cg.target;
    ok(good, label + ": cage " + i + " rule (" + cg.op + " " + cg.target + ") matches solution");
  });
  // givens / blanks consistent
  const blanks = p.given.filter((g) => !g).length;
  ok(blanks === p.blanks, label + ": blank count consistent (" + blanks + ")");
  ok(blanks >= 1, label + ": at least one blank");
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- difficulty gradient ---------- */

ok(pEasy.blanks >= 5, "easy has 5+ blanks (" + pEasy.blanks + ")");
ok(pMed.blanks === 14, "medium has 14 blanks (" + pMed.blanks + ")");
ok(pHard.blanks >= 22, "hard has 22+ blanks (" + pHard.blanks + ")");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const g = p.num.slice();
  for (let i = 0; i < p.given.length; i++) if (!p.given[i]) g[i] = 0;
  const n = C.countSolutions(g, p.cages, p.n, 2);
  ok(n === 1, label + ": exactly one solution (got " + n + ")");
}
uniqueOnce(pEasy, "easy");
uniqueOnce(pMed, "medium");
uniqueOnce(pHard, "hard");

for (let i = 0; i < 6; i++) {
  uniqueOnce(C.makePuzzle("easy"), "easy #" + i);
  uniqueOnce(C.makePuzzle("medium"), "medium #" + i);
  uniqueOnce(C.makePuzzle("hard"), "hard #" + i);
}

/* ---------- batch distinctness ---------- */

const batch = C.makeBatch(3, "medium");
ok(batch.length === 3, "makeBatch(3) returns 3 puzzles");
const sigs = batch.map((p) => p.num.join("") + p.cages.map((c) => c.cells.join(":") + c.op + c.target).join("") + p.given.join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
