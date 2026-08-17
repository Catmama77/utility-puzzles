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

function validate(w, category, minLen, label) {
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
    if (word.length < minLen) fail(label + " word " + word + " shorter than difficulty minimum " + minLen);
    if (word.length > 9) fail(label + " word " + word + " too long for a 9-letter wheel");
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

const DIFFS = ["easy", "medium", "hard"];
let generated = 0;

// per-category average word count per difficulty
const avgWords = {};
for (const cat of Object.keys(WORD_DATA)) {
  avgWords[cat] = {};
  for (const diff of DIFFS) {
    const minLen = WheelGen.DIFFICULTY[diff].minLen;
    let total = 0;
    let withWords = 0;
    for (let i = 0; i < 40; i++) {
      const w = WheelGen.makeWheel(cat, diff);
      generated++;
      validate(w, cat, minLen, cat + "/" + diff + " #" + i);
      total += w.words.length;
      if (w.words.length > 0) withWords++;
    }
    const avg = total / 40;
    avgWords[cat][diff] = avg;
    console.log(`  ${cat.padEnd(9)} ${diff.padEnd(6)} avg words: ${avg.toFixed(1).padStart(5)}  wheels with words: ${withWords}/40`);
    if (withWords < 30) fail(cat + "/" + diff + " too often produces empty wheels (" + withWords + "/40)");
  }
}

// difficulty ordering: Easy wheels should offer at least as many words as
// Hard wheels for the same category (shorter minimum length => more words)
for (const cat of Object.keys(WORD_DATA)) {
  if (avgWords[cat].easy + 0.5 < avgWords[cat].hard) {
    fail(cat + " easy avg (" + avgWords[cat].easy.toFixed(1) +
      ") should be >= hard avg (" + avgWords[cat].hard.toFixed(1) + ")");
  }
}

// batch uniqueness per difficulty
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of DIFFS) {
    const batch = WheelGen.makeBatch(2, cat, diff);
    batchChecks += 2;
    if (batch[0].letters.join("") === batch[1].letters.join("")) {
      fail(cat + "/" + diff + " batch had identical wheels");
    }
  }
}

console.log("Generated " + generated + " word wheels");
console.log("Checked " + batchChecks + " wheels across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
