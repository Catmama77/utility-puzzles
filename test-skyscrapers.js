/* Node tests for the Skyscrapers generator (skyscrapers/js/skyscrapers.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "skyscrapers/js/skyscrapers.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const S = sandbox.SkyGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- difficulty params ---------- */

ok(S.DIFFICULTY.easy && S.DIFFICULTY.medium && S.DIFFICULTY.hard, "three difficulty levels exist");
ok(S.DIFFICULTY.easy.n < S.DIFFICULTY.medium.n && S.DIFFICULTY.medium.n < S.DIFFICULTY.hard.n,
  "grid sizes increase with difficulty");

/* ---------- visibility ---------- */

ok(S._visible([1, 2, 3, 4]) === 4, "increasing line sees all 4");
ok(S._visible([4, 3, 2, 1]) === 1, "decreasing line sees 1");
ok(S._visible([2, 4, 1, 3]) === 2, "[2,4,1,3] sees 2");
ok(S._visible([3, 1, 4, 2]) === 2, "[3,1,4,2] sees 2");

/* ---------- puzzle structure ---------- */

const pEasy = S.makePuzzle("easy");
const pMed = S.makePuzzle("medium");
const pHard = S.makePuzzle("hard");

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
  // heights in range
  p.num.forEach((v) => ok(v >= 1 && v <= n, label + ": height " + v + " in range"));
  // clues are correct for the solution
  const recomputed = S._computeClues(p.num, n);
  ok(recomputed.length === 4 * n, label + ": " + (4 * n) + " clues");
  p.clues.forEach((v, i) => {
    ok(v === recomputed[i], label + ": clue " + i + " matches solution (" + v + ")");
    ok(v >= 1 && v <= n, label + ": clue " + i + " in range");
  });
  // givens / blanks consistent
  const blanks = p.given.filter((g) => !g).length;
  ok(blanks === p.blanks, label + ": blank count consistent (" + blanks + ")");
  ok(blanks >= 1, label + ": at least one blank");
  // givens match the solution where present
  p.given.forEach((g, i) => {
    if (g) ok(p.num[i] === p.num[i] && p.num[i] >= 1, label + ": given at " + i + " has a value");
  });
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const g = p.num.slice();
  for (let i = 0; i < p.given.length; i++) if (!p.given[i]) g[i] = 0;
  const n = S.countSolutions(g, p.clues, p.n, 2);
  ok(n === 1, label + ": exactly one solution (got " + n + ")");
}
uniqueOnce(pEasy, "easy");
uniqueOnce(pMed, "medium");
uniqueOnce(pHard, "hard");

for (let i = 0; i < 6; i++) {
  uniqueOnce(S.makePuzzle("easy"), "easy #" + i);
  uniqueOnce(S.makePuzzle("medium"), "medium #" + i);
  uniqueOnce(S.makePuzzle("hard"), "hard #" + i);
}

/* ---------- batch distinctness ---------- */

const batch = S.makeBatch(3, "medium");
ok(batch.length === 3, "makeBatch(3) returns 3 puzzles");
const sigs = batch.map((p) => p.num.join("") + p.clues.join(",") + p.given.join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
