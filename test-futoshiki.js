/* Node tests for the Futoshiki generator (futoshiki/js/futoshiki.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "futoshiki/js/futoshiki.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const F = sandbox.FutoshikiGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- difficulty params ---------- */

ok(F.DIFFICULTY.easy && F.DIFFICULTY.medium && F.DIFFICULTY.hard, "three difficulty levels exist");
ok(F.DIFFICULTY.easy.n < F.DIFFICULTY.medium.n && F.DIFFICULTY.medium.n < F.DIFFICULTY.hard.n,
  "grid sizes increase with difficulty");
ok(F.DIFFICULTY.easy.givens / (F.DIFFICULTY.easy.n * F.DIFFICULTY.easy.n) >
    F.DIFFICULTY.hard.givens / (F.DIFFICULTY.hard.n * F.DIFFICULTY.hard.n),
  "easy keeps a higher share of givens than hard");

/* ---------- Latin square ---------- */

const latin = F._makeLatin(5);
ok(latin.length === 25, "5x5 latin square has 25 cells");
(function () {
  for (let r = 0; r < 5; r++) {
    const seen = new Set();
    for (let c = 0; c < 5; c++) seen.add(latin[r * 5 + c]);
    ok(seen.size === 5, "row " + r + " has 1..5 once");
  }
  for (let c = 0; c < 5; c++) {
    const seen = new Set();
    for (let r = 0; r < 5; r++) seen.add(latin[r * 5 + c]);
    ok(seen.size === 5, "column " + c + " has 1..5 once");
  }
})();

/* ---------- puzzle structure ---------- */

const pEasy = F.makePuzzle("easy");
const pMed = F.makePuzzle("medium");
const pHard = F.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.size === 4 && pMed.size === 5 && pHard.size === 6, "sizes are 4x4 / 5x5 / 6x6");

function checkPuzzle(p, label) {
  const n = p.n;
  // solution: every row and column has 1..n exactly once
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
  // every sign is consistent with the solution
  p.signs.forEach((s, i) => {
    ok(s.lt ? p.num[s.a] < p.num[s.b] : p.num[s.a] > p.num[s.b],
      label + ": sign " + i + " matches solution");
  });
  // digits in range
  p.num.forEach((v) => ok(v >= 1 && v <= n, label + ": digit " + v + " in range"));
  // givens / blanks consistent
  const blanks = p.given.filter((g) => !g).length;
  ok(blanks === p.blanks, label + ": blank count consistent (" + blanks + ")");
  ok(blanks >= 1, label + ": at least one blank");
  ok(blanks <= p.num.length - 3, label + ": at least 3 givens");
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const g = p.num.slice();
  for (let i = 0; i < p.given.length; i++) if (!p.given[i]) g[i] = 0;
  const n = F.countSolutions(g, p.n, p.signs, 2);
  ok(n === 1, label + ": exactly one solution (got " + n + ")");
}
uniqueOnce(pEasy, "easy");
uniqueOnce(pMed, "medium");
uniqueOnce(pHard, "hard");

for (let i = 0; i < 6; i++) {
  uniqueOnce(F.makePuzzle("easy"), "easy #" + i);
  uniqueOnce(F.makePuzzle("medium"), "medium #" + i);
  uniqueOnce(F.makePuzzle("hard"), "hard #" + i);
}

/* ---------- batch distinctness ---------- */

const batch = F.makeBatch(3, "medium");
ok(batch.length === 3, "makeBatch(3) returns 3 puzzles");
const sigs = batch.map((p) => p.num.join("") + p.signs.map((s) => s.a + ":" + s.b + ":" + (s.lt ? 1 : 0)).join(",") + p.given.join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
