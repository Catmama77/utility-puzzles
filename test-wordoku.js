/* ============================================================
   Sanity test for the wordoku generator.
   Run with: node test-wordoku.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "sudoku/js/sudoku.js", "wordoku/js/wordoku.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const WordokuGen = ctx.WordokuGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function validate(p, category, sizeKey, label) {
  const total = p.size * p.size;
  if (p.puzzle.length !== total || p.solution.length !== total) {
    fail(label + " wrong array length");
    return;
  }
  if (p.letters.length !== p.size) {
    fail(label + " expected " + p.size + " letters, got " + p.letters.length);
  }
  // all letters distinct
  if (new Set(p.letters).size !== p.letters.length) {
    fail(label + " duplicate letters in " + p.letters.join(""));
  }
  // puzzle clues must match solution
  for (let i = 0; i < total; i++) {
    if (p.puzzle[i] !== 0) {
      const expected = p.letters[p.puzzle[i] - 1];
      if (p.solution[i] !== expected) {
        fail(label + " clue at " + i + " contradicts solution");
        break;
      }
    }
  }
  // solution cells are all letters from the set (or 0 for empty)
  for (let i = 0; i < total; i++) {
    if (p.solution[i] !== 0 && !p.letters.includes(p.solution[i])) {
      fail(label + " solution letter " + p.solution[i] + " not in letter set");
      break;
    }
  }
  // category label should appear in title
  if (!p.title || p.title.indexOf(WordokuGen.DIFFICULTY[p.difficulty].label) === -1) {
    fail(label + " title missing difficulty label");
  }
}

let generated = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const sz of Object.keys(WordokuGen.SIZES)) {
    for (const diff of Object.keys(WordokuGen.DIFFICULTY)) {
      for (let i = 0; i < 10; i++) {
        const p = WordokuGen.makeWordoku(cat, sz, diff);
        generated++;
        validate(p, cat, sz, cat + "/" + sz + "/" + diff + " #" + i);
      }
    }
  }
}

// batch uniqueness
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(WordokuGen.DIFFICULTY)) {
    const batch = WordokuGen.makeBatch(8, cat, "9x9", diff);
    batchChecks += 8;
    const seen = new Set(batch.map((p) => p.puzzle.join(",")));
    if (seen.size !== 8) fail(cat + "/" + diff + " batch had " + (8 - seen.size) + " duplicate(s)");
  }
}

console.log("Generated " + generated + " wordokus");
console.log("Checked " + batchChecks + " wordokus across 8-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
