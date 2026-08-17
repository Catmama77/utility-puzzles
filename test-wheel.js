/* ============================================================
   Sanity test for the word wheel generator.
   Run with: node test-wheel.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "word-wheel/js/wheel.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const WheelGen = ctx.WheelGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function counts(w) {
  const m = {};
  for (let i = 0; i < w.length; i++) m[w[i]] = (m[w[i]] || 0) + 1;
  return m;
}

function validate(w, category, label) {
  if (w.letters.length !== 9) { fail(label + " expected 9 letters"); return; }
  if (new Set(w.letters).size !== 9) { fail(label + " duplicate letters in wheel"); return; }
  if (w.letters[w.center] !== w.centerLetter) fail(label + " center mismatch");

  const avail = counts(w.letters.join(""));
  const seen = new Set();
  for (const item of w.words) {
    const word = item.word;
    if (seen.has(word)) fail(label + " duplicate word " + word);
    seen.add(word);
    if (!WORD_DATA[category] || !WORD_DATA[category][word]) fail(label + " word " + word + " not in bank");
    if (word.length < 3) fail(label + " word " + word + " too short");
    if (word.indexOf(w.centerLetter) === -1) fail(label + " word " + word + " missing center letter");
    const need = counts(word);
    for (const ch in need) {
      if ((avail[ch] || 0) < need[ch]) fail(label + " word " + word + " uses too many " + ch);
    }
  }
  // words sorted longest-first
  for (let i = 1; i < w.words.length; i++) {
    if (w.words[i - 1].word.length < w.words[i].word.length) {
      fail(label + " words not sorted longest-first");
      break;
    }
  }
}

let generated = 0;
const countsByCat = {};
for (const cat of Object.keys(WORD_DATA)) {
  let found = 0;
  for (let i = 0; i < 60; i++) {
    const w = WheelGen.makeWheel(cat, "medium");
    generated++;
    validate(w, cat, cat + " #" + i);
    if (w.words.length) found++;
  }
  countsByCat[cat] = found;
  console.log(`  ${cat.padEnd(9)} wheels with words: ${found}/60`);
  if (found < 10) fail(cat + " rarely produces words");
}

// batch uniqueness
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  const batch = WheelGen.makeBatch(2, cat, "medium");
  batchChecks += 2;
  if (batch[0].letters.join("") === batch[1].letters.join("")) fail(cat + " batch had identical wheels");
}

console.log("Generated " + generated + " word wheels");
console.log("Checked " + batchChecks + " wheels across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
