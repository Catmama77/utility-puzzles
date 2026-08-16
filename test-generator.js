/* ============================================================
   Sanity test for the word fill-in generator.
   Run with: node test-generator.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of [
  "js/word-data.js",
  "js/puzzle-core.js",
  "word-fill/js/words.js",
  "word-fill/js/puzzles.js"
]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const PuzzleGen = ctx.PuzzleGen;
const WORD_BANK = ctx.WORD_BANK;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

/* Enumerate every maximal run of letter cells (horizontal and
   vertical). Every run must correspond to exactly one word in the
   puzzle's word list. */
function runsOf(puzzle) {
  const { grid, rows, cols } = puzzle;
  const letter = (r, c) =>
    r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].letter;

  const runs = [];
  const seenCell = (r, c, dir) => grid[r][c][dir === "h" ? "seenH" : "seenV"];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c].letter) continue;
      // horizontal run starting here?
      if (!letter(r, c - 1) && !grid[r][c].seenH) {
        let len = 0;
        let letters = "";
        while (letter(r, c + len)) {
          grid[r][c + len].seenH = true;
          letters += grid[r][c + len].letter;
          len++;
        }
        if (len > 1) runs.push({ text: letters, len });
      }
      // vertical run starting here?
      if (!letter(r - 1, c) && !grid[r][c].seenV) {
        let len = 0;
        let letters = "";
        while (letter(r + len, c)) {
          grid[r + len][c].seenV = true;
          letters += grid[r + len][c].letter;
          len++;
        }
        if (len > 1) runs.push({ text: letters, len });
      }
    }
  }
  return runs;
}

function validate(puzzle, category, difficulty, label) {
  const { grid, rows, cols, words } = puzzle;

  if (rows < 3 || cols < 3 || rows > 40 || cols > 40) {
    fail(label + " implausible grid " + rows + "x" + cols);
    return;
  }
  if (grid.length !== rows || grid.some((row) => row.length !== cols)) {
    fail(label + " grid array shape mismatch");
    return;
  }
  if (!words.length) {
    fail(label + " no words placed");
    return;
  }

  // letters are A-Z, numbers positive integers
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.black) {
        if (cell.letter !== null) fail(label + " black cell has letter at " + r + "," + c);
      } else {
        if (!/^[A-Z]$/.test(cell.letter)) fail(label + " bad letter at " + r + "," + c);
        if (cell.number !== null && cell.number < 1) fail(label + " bad number at " + r + "," + c);
      }
    }
  }

  // every word has a valid slot number and its slot spells the word.
  // A numbered cell may start BOTH an across and a down slot (shared
  // number), so accept a match in either direction.
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
  for (const w of words) {
    if (wordSet.has(w.word)) fail(label + " duplicate word " + w.word);
    wordSet.add(w.word);
    if (!numToCell.has(w.number)) {
      fail(label + " word " + w.word + " has dangling number " + w.number);
      continue;
    }
    const [sr, sc] = numToCell.get(w.number);
    const across = walkFrom(sr, sc, "h");
    const down = walkFrom(sr, sc, "v");
    if (across !== w.word && down !== w.word) {
      fail(label + " slot for " + w.word + " spells " + across + "/" + down);
    }
  }

  // runs must match the word list exactly
  const runs = runsOf(puzzle);
  const runTexts = runs.map((r) => r.text).sort();
  const wordTexts = words.map((w) => w.word).sort();
  if (JSON.stringify(runTexts) !== JSON.stringify(wordTexts)) {
    fail(label + " runs/words mismatch\n    runs:  " + runTexts.join(",") + "\n    words: " + wordTexts.join(","));
  }

  // word lengths within difficulty range
  const opts = PuzzleGen.DIFFICULTY[difficulty];
  for (const w of words) {
    if (w.length < opts.minLen || w.length > opts.maxLen) {
      fail(label + " word " + w.word + " out of difficulty range");
    }
  }
}

let generated = 0;
const stats = {};

for (const cat of Object.keys(WORD_BANK)) {
  stats[cat] = {};
  for (const diff of Object.keys(PuzzleGen.DIFFICULTY)) {
    stats[cat][diff] = { counts: [], sizes: [] };
    for (let i = 0; i < 60; i++) {
      const p = PuzzleGen.makePuzzle(cat, diff);
      generated++;
      validate(p, cat, diff, cat + "/" + diff + " #" + i);
      stats[cat][diff].counts.push(p.words.length);
      stats[cat][diff].sizes.push(p.rows + "x" + p.cols);
    }
  }
}

console.log("Generated " + generated + " puzzles");
for (const cat of Object.keys(stats)) {
  for (const diff of Object.keys(stats[cat])) {
    const s = stats[cat][diff];
    const avg = (s.counts.reduce((a, b) => a + b, 0) / s.counts.length).toFixed(1);
    const sizeSet = new Set(s.sizes);
    console.log(
      `  ${cat.padEnd(9)} ${diff.padEnd(6)} avg words: ${avg.padStart(5)}  grids: ${[...sizeSet].join(", ")}`
    );
  }
}

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
