/* ============================================================
   Sanity test for the word scramble generator.
   Run with: node test-scramble.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "word-scramble/js/scramble.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const ScrambleGen = ctx.ScrambleGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function sorted(w) {
  return w.split("").sort().join("");
}

function validate(p, category, difficulty, label) {
  const opts = ScrambleGen.DIFFICULTY[difficulty];
  const bank = Object.keys(WORD_DATA[category] || {});
  const wordSet = new Set();

  for (const w of p.words) {
    if (wordSet.has(w.word)) fail(label + " duplicate word " + w.word);
    wordSet.add(w.word);

    if (w.word.length < opts.minLen || w.word.length > opts.maxLen) {
      fail(label + " word " + w.word + " out of difficulty range");
    }
    if (!WORD_DATA[category] || !WORD_DATA[category][w.word]) {
      fail(label + " word " + w.word + " not in category bank");
      continue;
    }
    if (sorted(w.scrambled) !== sorted(w.word)) {
      fail(label + " scramble '" + w.scrambled + "' is not an anagram of " + w.word);
    }
    if (w.scrambled === w.word) {
      fail(label + " word " + w.word + " was not actually scrambled");
    }
    if (bank.includes(w.scrambled) && w.scrambled !== w.word) {
      fail(label + " scramble '" + w.scrambled + "' is another real word");
    }
    if (p.withClues && (!w.clue || w.clue !== WORD_DATA[category][w.word])) {
      fail(label + " clue missing or wrong for " + w.word);
    }
    if (!p.withClues && w.clue !== null) {
      fail(label + " clue present when clues disabled");
    }
    if (w.number < 1) fail(label + " bad number " + w.number);
  }

  // numbers run 1..n in order
  for (let i = 0; i < p.words.length; i++) {
    if (p.words[i].number !== i + 1) {
      fail(label + " numbers not sequential");
      break;
    }
  }
}

let generated = 0;

for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(ScrambleGen.DIFFICULTY)) {
    for (const clues of [false, true]) {
      for (let i = 0; i < 60; i++) {
        const p = ScrambleGen.makeScramble(cat, diff, 0, clues);
        generated++;
        validate(p, cat, diff, cat + "/" + diff + "/clues=" + clues + " #" + i);
      }
    }
  }
}

// Batch uniqueness: two worksheets on one page must differ.
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(ScrambleGen.DIFFICULTY)) {
    for (let i = 0; i < 15; i++) {
      const batch = ScrambleGen.makeBatch(2, cat, diff, false);
      batchChecks += 2;
      const sig = (p) => p.words.map((w) => w.word).sort().join("|");
      if (sig(batch[0]) === sig(batch[1])) {
        fail(cat + "/" + diff + " batch #" + i + " returned identical worksheets");
      }
    }
  }
}

console.log("Generated " + generated + " word scrambles");
console.log("Checked " + batchChecks + " scrambles across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
