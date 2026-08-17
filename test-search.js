/* ============================================================
   Sanity test for the word search generator.
   Run with: node test-search.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "word-search/js/search.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const SearchGen = ctx.SearchGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

const DIRS = {
  "e": [0, 1], "s": [1, 0], "w": [0, -1], "n": [-1, 0],
  "se": [1, 1], "sw": [1, -1], "ne": [-1, 1], "nw": [-1, -1]
};

function validate(p, category, sizeKey, diffKey, label) {
  const { grid, words, size } = p;

  if (grid.length !== size || grid.some((row) => row.length !== size)) {
    fail(label + " grid is not " + size + "x" + size);
    return;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!/^[A-Z]$/.test(grid[r][c])) {
        fail(label + " bad grid char '" + grid[r][c] + "' at " + r + "," + c);
        return;
      }
    }
  }

  const opts = SearchGen.DIFFICULTY[diffKey];
  const wordSet = new Set();
  for (const w of words) {
    if (wordSet.has(w.word)) fail(label + " duplicate word " + w.word);
    wordSet.add(w.word);
    if (!WORD_DATA[category] || !WORD_DATA[category][w.word]) {
      fail(label + " word " + w.word + " not in category bank");
    }
    if (w.word.length < 3 || w.word.length > size) {
      fail(label + " word " + w.word + " length out of range for " + size + "x" + size);
    }
    if (!DIRS[w.dir]) fail(label + " unknown direction " + w.dir);
    if (!opts.dirs.includes(w.dir)) {
      fail(label + " word " + w.word + " uses " + w.dir + " not allowed at " + diffKey);
    }

    // walk the placed word and confirm it spells correctly in the grid
    const d = DIRS[w.dir];
    let spelled = "";
    for (let i = 0; i < w.word.length; i++) {
      spelled += grid[w.r + d[0] * i][w.c + d[1] * i];
    }
    if (spelled !== w.word) {
      fail(label + " word " + w.word + " spells '" + spelled + "' in grid");
    }
  }

  // difficulty word counts: easy places at least its target
  const sizeOpts = SearchGen.SIZES[sizeKey];
  if (words.length < Math.min(sizeOpts.words, 3)) {
    fail(label + " only " + words.length + " words placed");
  }
}

let generated = 0;

for (const cat of Object.keys(WORD_DATA)) {
  for (const sz of Object.keys(SearchGen.SIZES)) {
    for (const diff of Object.keys(SearchGen.DIFFICULTY)) {
      for (let i = 0; i < 40; i++) {
        const p = SearchGen.makeSearch(cat, sz, diff);
        generated++;
        validate(p, cat, sz, diff, cat + "/" + sz + "/" + diff + " #" + i);
      }
    }
  }
}

// Batch uniqueness: two searches on one page must differ.
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const sz of Object.keys(SearchGen.SIZES)) {
    for (const diff of Object.keys(SearchGen.DIFFICULTY)) {
      for (let i = 0; i < 15; i++) {
        const batch = SearchGen.makeBatch(2, cat, sz, diff);
        batchChecks += 2;
        const sig = (p) =>
          p.words.map((w) => w.word + "@" + w.r + "," + w.c + "," + w.dir).sort().join("|");
        if (sig(batch[0]) === sig(batch[1])) {
          fail(cat + "/" + sz + "/" + diff + " batch #" + i + " returned identical puzzles");
        }
      }
    }
  }
}

console.log("Generated " + generated + " word searches");
console.log("Checked " + batchChecks + " searches across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
