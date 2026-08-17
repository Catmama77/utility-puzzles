/* ============================================================
   Sanity test for the crossword generator.
   Run with: node test-crossword.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of [
  "js/word-data.js",
  "js/puzzle-core.js",
  "crossword/js/crossword.js"
]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const CrosswordGen = ctx.CrosswordGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

/* Enumerate every maximal run of letter cells (horizontal and
   vertical). Every run must correspond to exactly one word in the
   puzzle's across/down lists. */
function runsOf(puzzle) {
  const { grid, rows, cols } = puzzle;
  const letter = (r, c) =>
    r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].letter;

  const runs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].letter) continue;
      if (!letter(r, c - 1) && !grid[r][c].seenH) {
        let len = 0;
        let letters = "";
        while (letter(r, c + len)) {
          grid[r][c + len].seenH = true;
          letters += grid[r][c + len].letter;
          len++;
        }
        if (len > 1) runs.push({ text: letters, dir: "h" });
      }
      if (!letter(r - 1, c) && !grid[r][c].seenV) {
        let len = 0;
        let letters = "";
        while (letter(r + len, c)) {
          grid[r + len][c].seenV = true;
          letters += grid[r + len][c].letter;
          len++;
        }
        if (len > 1) runs.push({ text: letters, dir: "v" });
      }
    }
  }
  return runs;
}

function validate(puzzle, category, difficulty, label) {
  const { grid, rows, cols, across, down } = puzzle;

  if (rows < 3 || cols < 3 || rows > 40 || cols > 40) {
    fail(label + " implausible grid " + rows + "x" + cols);
    return;
  }
  if (grid.length !== rows || grid.some((row) => row.length !== cols)) {
    fail(label + " grid array shape mismatch");
    return;
  }

  const all = across.concat(down);
  if (!all.length) {
    fail(label + " no words placed");
    return;
  }

  // letters are A-Z
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.black) {
        if (cell.letter !== null) fail(label + " black cell has letter at " + r + "," + c);
      } else if (!/^[A-Z]$/.test(cell.letter)) {
        fail(label + " bad letter at " + r + "," + c);
      }
    }
  }

  // every word: has a clue from the database, a number, correct length
  const numToCell = new Map();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c].number) numToCell.set(grid[r][c].number, [r, c]);

  const walkFrom = (sr, sc, dir) => {
    let text = "";
    if (dir === "h") {
      let c = sc;
      while (c < cols && grid[sr][c].letter) text += grid[sr][c++].letter;
    } else {
      let r = sr;
      while (r < rows && grid[r][sc].letter) text += grid[r++][sc].letter;
    }
    return text;
  };

  const wordSet = new Set();
  for (const w of all) {
    if (wordSet.has(w.word)) fail(label + " duplicate word " + w.word);
    wordSet.add(w.word);
    if (!WORD_DATA[category] || !WORD_DATA[category][w.word]) {
      fail(label + " word " + w.word + " missing from clue database");
      continue;
    }
    if (!w.clue || w.clue === "Clue coming soon") {
      fail(label + " word " + w.word + " has no real clue");
    }
    if (!numToCell.has(w.number)) {
      fail(label + " word " + w.word + " has dangling number " + w.number);
      continue;
    }
    const [sr, sc] = numToCell.get(w.number);
    const acrossText = walkFrom(sr, sc, "h");
    const downText = walkFrom(sr, sc, "v");
    const expected = w.dir === "h" ? acrossText : downText;
    if (expected !== w.word) {
      fail(label + " " + w.dir + " slot for " + w.word + " spells " + expected);
    }
  }

  // runs must match across/down words exactly
  const runs = runsOf(puzzle);
  const runTexts = runs.map((r) => r.text).sort();
  const wordTexts = all.map((w) => w.word).sort();
  if (JSON.stringify(runTexts) !== JSON.stringify(wordTexts)) {
    fail(label + " runs/words mismatch\n    runs:  " + runTexts.join(",") + "\n    words: " + wordTexts.join(","));
  }

  // across/down are sorted by number
  for (const list of [across, down]) {
    for (let i = 1; i < list.length; i++) {
      if (list[i].number <= list[i - 1].number) {
        fail(label + " " + (list === across ? "across" : "down") + " not sorted by number");
        break;
      }
    }
  }

  // word lengths within difficulty range
  const opts = CrosswordGen.DIFFICULTY[difficulty];
  for (const w of all) {
    if (w.word.length < opts.minLen || w.word.length > opts.maxLen) {
      fail(label + " word " + w.word + " out of difficulty range");
    }
  }
}

let generated = 0;

for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(CrosswordGen.DIFFICULTY)) {
    for (let i = 0; i < 60; i++) {
      const p = CrosswordGen.makeCrossword(cat, diff);
      generated++;
      validate(p, cat, diff, cat + "/" + diff + " #" + i);
    }
  }
}

console.log("Generated " + generated + " crosswords");

// Batch uniqueness: puzzles printed on one page must all differ.
let batchChecks = 0;
const sig = (p) => JSON.stringify(p.grid);
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(CrosswordGen.DIFFICULTY)) {
    for (let i = 0; i < 25; i++) {
      const batch = CrosswordGen.makeBatch(2, cat, diff);
      batchChecks += 2;
      if (sig(batch[0]) === sig(batch[1])) {
        fail(cat + "/" + diff + " batch #" + i + " returned identical puzzles");
      }
    }
  }
}
console.log("Checked " + batchChecks + " crosswords across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
