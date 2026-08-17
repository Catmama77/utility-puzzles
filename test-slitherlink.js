/* Node tests for the Slitherlink generator (slitherlink/js/slitherlink.js). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const code = fs.readFileSync(path.join(__dirname, "slitherlink/js/slitherlink.js"), "utf8");
const sandbox = { console: console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const S = sandbox.SlitherGen;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log("FAIL: " + msg); }
}

/* ---------- difficulty params ---------- */

ok(S.DIFFICULTY.easy && S.DIFFICULTY.medium && S.DIFFICULTY.hard, "three difficulty levels exist");
ok(S.DIFFICULTY.easy.w * S.DIFFICULTY.easy.h < S.DIFFICULTY.medium.w * S.DIFFICULTY.medium.h &&
   S.DIFFICULTY.medium.w * S.DIFFICULTY.medium.h < S.DIFFICULTY.hard.w * S.DIFFICULTY.hard.h,
  "grid sizes increase with difficulty");
ok(S.DIFFICULTY.easy.hide <= S.DIFFICULTY.medium.hide && S.DIFFICULTY.medium.hide <= S.DIFFICULTY.hard.hide,
  "hide targets increase with difficulty");

/* ---------- tiny solver cases ---------- */

ok(S.countSolutions([4], 1, 1, 2) === 1, "1x1 clue 4 has exactly one loop");
ok(S.countSolutions([0], 1, 1, 2) === 0, "1x1 clue 0 has no loop");
ok(S.countSolutions([3, 3], 2, 1, 2) === 1, "2x1 clues 3,3 has exactly one loop");
ok(S.countSolutions([-1], 1, 1, 2) === 1, "1x1 unnumbered still has one loop");

/* ---------- puzzle structure ---------- */

const pEasy = S.makePuzzle("easy");
const pMed = S.makePuzzle("medium");
const pHard = S.makePuzzle("hard");

ok(pEasy && pMed && pHard, "makePuzzle returns puzzles for every difficulty");
ok(pEasy.w === 4 && pEasy.h === 4 && pMed.w === 5 && pMed.h === 5 && pHard.w === 6 && pHard.h === 6,
  "sizes are 4x4 / 5x5 / 6x6");

function checkPuzzle(p, label) {
  const w = p.w, h = p.h;
  const ends = S._edgeEndpoints(w, h);
  // clues length and values
  ok(p.clues.length === w * h, label + ": one clue per cell (" + p.clues.length + ")");
  p.clues.forEach((c, i) => {
    ok(c >= -1 && c <= 4, label + ": clue " + i + " in {-1..4} (got " + c + ")");
  });
  // loop: every vertex degree 0 or 2
  const deg = new Array((w + 1) * (h + 1)).fill(0);
  let loopEdges = 0;
  for (let e = 0; e < ends.length; e++) {
    if (p.loop[e]) { loopEdges++; deg[ends[e][0]]++; deg[ends[e][1]]++; }
  }
  ok(loopEdges >= 4, label + ": loop uses " + loopEdges + " edges");
  ok(deg.every((d) => d === 0 || d === 2), label + ": every vertex has degree 0 or 2");
  // loop: single connected component
  const seen = new Array((w + 1) * (h + 1)).fill(false);
  let start = -1;
  for (let e = 0; e < ends.length; e++) if (p.loop[e]) { start = ends[e][0]; break; }
  const queue = [start];
  seen[start] = true;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (let e = 0; e < ends.length; e++) {
      if (!p.loop[e]) continue;
      const nxt = ends[e][0] === cur ? ends[e][1] : (ends[e][1] === cur ? ends[e][0] : -1);
      if (nxt !== -1 && !seen[nxt]) { seen[nxt] = true; queue.push(nxt); }
    }
  }
  ok(ends.every((en, e) => !p.loop[e] || (seen[en[0]] && seen[en[1]])),
    label + ": loop edges form one connected component");
  // shown clues match the loop
  const recomputed = S._computeClues(w, h, p.loop);
  p.clues.forEach((c, i) => {
    if (c >= 0) ok(c === recomputed[i], label + ": clue " + i + " matches the loop (" + c + ")");
  });
  // hidden count
  const hidden = p.clues.filter((c) => c < 0).length;
  ok(hidden === p.blanks, label + ": blank count consistent (" + hidden + ")");
  ok(hidden >= 1, label + ": at least one hidden clue");
  ok(hidden <= w * h - 4, label + ": at least 4 clues shown");
}

checkPuzzle(pEasy, "easy");
checkPuzzle(pMed, "medium");
checkPuzzle(pHard, "hard");

/* ---------- difficulty gradients ---------- */

const easyHidden = pEasy.clues.filter((c) => c < 0).length;
const medHidden = pMed.clues.filter((c) => c < 0).length;
const hardHidden = pHard.clues.filter((c) => c < 0).length;
ok(easyHidden === 2, "easy hides exactly 2 (" + easyHidden + ")");
ok(medHidden === 4, "medium hides exactly 4 (" + medHidden + ")");
ok(hardHidden >= 4, "hard hides at least 4 (" + hardHidden + ")");

/* ---------- uniqueness ---------- */

function uniqueOnce(p, label) {
  const n = S.countSolutions(p.clues, p.w, p.h, 2, 2000000);
  ok(n === 1, label + ": exactly one loop (got " + n + ")");
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
const sigs = batch.map((p) => p.loop.join("") + p.clues.map((c) => c < 0 ? "x" : c).join(""));
ok(new Set(sigs).size === 3, "batch puzzles are distinct");
batch.forEach((p) => uniqueOnce(p, "batch"));

/* ---------- titles ---------- */

ok(/Easy/.test(pEasy.title), "easy title mentions level");
ok(/Hard/.test(pHard.title), "hard title mentions level");

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
