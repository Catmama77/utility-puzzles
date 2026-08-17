/* Node tests for the Cross Math generator (cross-math/js/cross-math.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "cross-math/js/cross-math.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const C = sandbox.CrossMathGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- helpers ---------- */

function lineVals(nums, ops) {
  return C.lineOk(nums, ops);
}

function puzzleAllLinesOk(p) {
  const k = p.k;
  for (let r = 0; r < k; r++) {
    const row = [];
    for (let c = 0; c < k; c++) row.push(p.num[r * k + c]);
    if (!C.lineOk(row, p.rowOps.slice(r * (k - 2), r * (k - 2) + (k - 2)))) return false;
  }
  for (let c = 0; c < k; c++) {
    const col = [];
    for (let r = 0; r < k; r++) col.push(p.num[r * k + c]);
    if (!C.lineOk(col, p.colOps.slice(c * (k - 2), c * (k - 2) + (k - 2)))) return false;
  }
  return true;
}

/* ---------- difficulty params ---------- */

ok(C.DIFFICULTY.easy && C.DIFFICULTY.medium && C.DIFFICULTY.hard, "three difficulty levels exist");
ok(C.DIFFICULTY.easy.k <= C.DIFFICULTY.hard.k, "hard grid is at least as large as easy");
ok(C.DIFFICULTY.easy.blanks < C.DIFFICULTY.hard.blanks, "hard blanks more cells than easy");
ok(C.DIFFICULTY.medium.ops.length >= C.DIFFICULTY.easy.ops.length, "medium operator set covers easy's");

/* ---------- line arithmetic ---------- */

ok(lineVals([3, 4, 7], ["+"]), "3 + 4 = 7 holds");
ok(lineVals([9, 4, 5], ["−"]), "9 − 4 = 5 holds");
ok(!lineVals([4, 3, 7], ["−"]), "4 − 3 = 7 does not hold");
ok(lineVals([6, 3, 2, 4], ["÷", "×"]), "(6 ÷ 3) × 2 = 4 holds");
ok(!lineVals([7, 3, 2, 1], ["÷", "÷"]), "non-exact division rejected");
ok(lineVals([2, 3, 4, 20], ["+", "×"]), "(2 + 3) × 4 = 20 holds (left to right)");

/* ---------- puzzle structure ---------- */

const pEasy = C.makePuzzle("easy");
const pMed = C.makePuzzle("medium");
const pHard = C.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.size === 5 && pMed.size === 5 && pHard.size === 5, "grid sizes are 5x5 for every difficulty");
ok(pEasy.num.length === 9 && pMed.num.length === 9 && pHard.num.length === 9, "digit counts match k*k");
ok(puzzleAllLinesOk(pEasy), "easy: every row and column equation holds");
ok(puzzleAllLinesOk(pMed), "medium: every row and column equation holds");
ok(puzzleAllLinesOk(pHard), "hard: every row and column equation holds");

function checkPuzzle(p, label) {
  // all digits 1-9
  p.num.forEach((v) => {
    ok(v >= 1 && v <= 9, label + ": digit " + v + " in range 1-9");
  });
  // operator counts: k lines x (k-2) ops per direction
  ok(p.rowOps.length === p.k * (p.k - 2), label + ": row operator count");
  ok(p.colOps.length === p.k * (p.k - 2), label + ": column operator count");
  // operators come from the difficulty set
  const diff = C.DIFFICULTY[p.difficulty];
  p.rowOps.concat(p.colOps).forEach((op) => {
    ok(diff.ops.indexOf(op) !== -1, label + ": operator " + op + " is in the difficulty set");
  });
  // blanks: given flags count matches
  const blanks = p.given.filter((g) => !g).length;
  ok(blanks === p.blanks, label + ": blank count consistent (" + blanks + ")");
  ok(blanks >= 1, label + ": at least one blank");
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- operator coverage ---------- */

// Every difficulty must reliably feature its signature operators — hard
// always has division, medium always has multiplication.
(function () {
  const n = 30;
  let hardDiv = 0, medMul = 0;
  for (let i = 0; i < n; i++) {
    const pH = C.makePuzzle("hard");
    if (pH.rowOps.concat(pH.colOps).indexOf("÷") !== -1) hardDiv++;
    const pM = C.makePuzzle("medium");
    if (pM.rowOps.concat(pM.colOps).indexOf("×") !== -1) medMul++;
  }
  ok(hardDiv === n, "hard always includes division (" + hardDiv + "/" + n + ")");
  ok(medMul === n, "medium always includes multiplication (" + medMul + "/" + n + ")");
})();

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const g = p.num.slice();
  for (let i = 0; i < p.given.length; i++) if (!p.given[i]) g[i] = 0;
  const n = C.countSolutions(g, p.k, p.rowOps, p.colOps, 2);
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
const sigs = batch.map((p) => p.num.join("") + p.rowOps.join("") + p.colOps.join("") + p.given.join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
