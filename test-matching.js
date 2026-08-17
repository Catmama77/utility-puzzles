/* ============================================================
   Sanity test for the matching / flashcards generator.
   Run with: node test-matching.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "matching/js/matching.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const MatchGen = ctx.MatchGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function validate(s, category, mode, label) {
  if (s.mode !== mode) fail(label + " wrong mode");
  if (!s.words.length) { fail(label + " no words"); return; }

  // words numbered 1..n, unique, from bank, with real clues
  const nums = new Set();
  const wordSet = new Set();
  for (const w of s.words) {
    if (!WORD_DATA[category] || !WORD_DATA[category][w.word]) fail(label + " word " + w.word + " not in bank");
    if (wordSet.has(w.word)) fail(label + " duplicate word " + w.word);
    wordSet.add(w.word);
    if (!w.clue || w.clue === "?") fail(label + " word " + w.word + " missing clue");
    nums.add(w.number);
  }
  if (nums.size !== s.words.length) fail(label + " numbers not unique");
  for (let i = 1; i <= s.words.length; i++) {
    if (!nums.has(i)) { fail(label + " missing number " + i); break; }
  }

  if (mode === "match") {
    // clues: unique letters, each maps back to a real word number
    const letters = new Set();
    for (const c of s.clues) {
      if (letters.has(c.letter)) fail(label + " duplicate clue letter " + c.letter);
      letters.add(c.letter);
      const word = s.words.find((w) => w.number === c.number);
      if (!word) fail(label + " clue letter " + c.letter + " dangles to number " + c.number);
      else if (c.clue !== word.clue) fail(label + " clue letter " + c.letter + " has wrong clue");
    }
  }
}

let generated = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const mode of ["match", "cards"]) {
    for (const diff of Object.keys(MatchGen.DIFFICULTY)) {
      for (let i = 0; i < 40; i++) {
        const s = MatchGen.makeSet(cat, mode, diff);
        generated++;
        validate(s, cat, mode, cat + "/" + mode + "/" + diff + " #" + i);
      }
    }
  }
}

// batch uniqueness
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const mode of ["match", "cards"]) {
    const batch = MatchGen.makeBatch(2, cat, mode, "medium");
    batchChecks += 2;
    const sig = (s) => s.words.map((w) => w.word).sort().join("|");
    if (sig(batch[0]) === sig(batch[1])) fail(cat + "/" + mode + " batch had identical sets");
  }
}

console.log("Generated " + generated + " matching/flashcard sets");
console.log("Checked " + batchChecks + " sets across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
