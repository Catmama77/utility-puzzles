/* Node tests for the Hidato generator (hidato/js/hidato.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "hidato/js/hidato.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const H = sandbox.HidatoGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- difficulty params ---------- */

ok(H.DIFFICULTY.easy && H.DIFFICULTY.medium && H.DIFFICULTY.hard, "three difficulty levels exist");
ok(H.DIFFICULTY.easy.rows * H.DIFFICULTY.easy.cols < H.DIFFICULTY.medium.rows * H.DIFFICULTY.medium.cols &&
   H.DIFFICULTY.medium.rows * H.DIFFICULTY.medium.cols < H.DIFFICULTY.hard.rows * H.DIFFICULTY.hard.cols,
  "grid sizes increase with difficulty");
ok(H.DIFFICULTY.easy.keep / (H.DIFFICULTY.easy.rows * H.DIFFICULTY.easy.cols) >
    H.DIFFICULTY.hard.keep / (H.DIFFICULTY.hard.rows * H.DIFFICULTY.hard.cols),
  "easy keeps a higher share of givens than hard");

/* ---------- path validity ---------- */

const pEasy = H.makePuzzle("easy");
const pMed = H.makePuzzle("medium");
const pHard = H.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.n === 49 && pMed.n === 81 && pHard.n === 121, "cell counts are 49 / 81 / 121");

function checkPuzzle(p, label) {
  const adj = H._buildAdj(p.rows, p.cols);
  // every number 1..N appears exactly once, at a valid cell
  const seen = new Set();
  p.num.forEach((v) => {
    ok(v >= 1 && v <= p.n, label + ": number " + v + " in range");
    ok(!seen.has(v), label + ": number " + v + " not duplicated");
    seen.add(v);
  });
  ok(seen.size === p.n, label + ": all " + p.n + " numbers present");
  // consecutive numbers are king-move adjacent
  for (let k = 2; k <= p.n; k++) {
    const a = p.num.indexOf(k - 1);
    const b = p.num.indexOf(k);
    ok(adj[a].indexOf(b) !== -1, label + ": " + (k - 1) + " is adjacent to " + k);
  }
  // the start and end are always given
  ok(p.given[p.num.indexOf(1)], label + ": start (1) is given");
  ok(p.given[p.num.indexOf(p.n)], label + ": end (" + p.n + ") is given");
  // givens / blanks consistent
  const blanks = p.given.filter((g) => !g).length;
  ok(blanks === p.blanks, label + ": blank count consistent (" + blanks + ")");
  ok(blanks >= 1, label + ": at least one blank");
  ok(p.given.filter(Boolean).length >= 3, label + ": at least 3 givens");
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const adj = H._buildAdj(p.rows, p.cols);
  const n = H.countSolutions(p.num, p.given, adj, p.n, 2);
  ok(n === 1, label + ": exactly one solution (got " + n + ")");
}
uniqueOnce(pEasy, "easy");
uniqueOnce(pMed, "medium");
uniqueOnce(pHard, "hard");

for (let i = 0; i < 6; i++) {
  uniqueOnce(H.makePuzzle("easy"), "easy #" + i);
  uniqueOnce(H.makePuzzle("medium"), "medium #" + i);
  uniqueOnce(H.makePuzzle("hard"), "hard #" + i);
}

/* ---------- batch distinctness ---------- */

const batch = H.makeBatch(3, "medium");
ok(batch.length === 3, "makeBatch(3) returns 3 puzzles");
const sigs = batch.map((p) => p.num.join("") + p.given.map((g) => g ? 1 : 0).join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
