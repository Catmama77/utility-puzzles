/* ============================================================
   Sanity test for the word ladder generator.
   Run with: node test-ladders.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "word-ladders/js/ladders.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const LadderGen = ctx.LadderGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function differsByOne(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

// merged bank of every word on the site
const merged = new Set();
for (const cat of Object.keys(WORD_DATA)) {
  for (const w of Object.keys(WORD_DATA[cat])) merged.add(w);
}

function validate(l, difficulty, label) {
  const D = LadderGen.DIFFICULTY[difficulty];
  if (!l.rungs.length) { fail(label + " empty ladder"); return; }
  if (l.rungs.length < 2) { fail(label + " ladder too short"); return; }

  const words = l.rungs.map((r) => r.word);
  if (words[0] !== l.start || words[words.length - 1] !== l.end) {
    fail(label + " endpoints mismatch");
  }
  if (l.length !== words.length - 1) fail(label + " length mismatch");
  for (let i = 1; i < words.length; i++) {
    if (!differsByOne(words[i - 1], words[i])) {
      fail(label + " step " + words[i - 1] + " -> " + words[i] + " differs by more than one letter");
      break;
    }
  }
  for (const w of words) {
    if (!merged.has(w)) fail(label + " word " + w + " not in word bank");
  }
  for (let i = 0; i < l.rungs.length; i++) {
    if (l.rungs[i].position !== i) { fail(label + " positions not sequential"); break; }
  }
}

let generated = 0;
const stats = {};
for (const diff of Object.keys(LadderGen.DIFFICULTY)) {
  stats[diff] = [];
  for (let i = 0; i < 60; i++) {
    const l = LadderGen.makeLadder(diff);
    generated++;
    validate(l, diff, diff + " #" + i);
    if (l.rungs.length) stats[diff].push(l.length);
  }
}

for (const diff of Object.keys(stats)) {
  const lens = stats[diff];
  if (!lens.length) {
    console.log(`  ${diff.padEnd(6)} no ladders found!`);
    fail(diff + " produced no ladders at all");
    continue;
  }
  const avg = (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1);
  const min = Math.min(...lens);
  const max = Math.max(...lens);
  console.log(`  ${diff.padEnd(6)} avg steps: ${avg} (min ${min}, max ${max})`);
}

// batch uniqueness
let batchChecks = 0;
for (const diff of Object.keys(LadderGen.DIFFICULTY)) {
  const batch = LadderGen.makeBatch(2, diff);
  batchChecks += 2;
  const sig = (l) => l.start + ">" + l.end;
  if (batch[0].rungs.length && batch[1].rungs.length && sig(batch[0]) === sig(batch[1])) {
    fail(diff + " batch had identical ladders");
  }
}

console.log("Generated " + generated + " word ladders");
console.log("Checked " + batchChecks + " ladders across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
