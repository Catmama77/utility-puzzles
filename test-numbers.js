/* ============================================================
   Sanity test for the number fill-in generator.
   Run with: node test-numbers.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/puzzle-core.js", "number-fill/js/numbers.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const NumberGen = ctx.NumberGen;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

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
        let text = "";
        while (letter(r, c + len)) {
          grid[r][c + len].seenH = true;
          text += grid[r][c + len].letter;
          len++;
        }
        if (len > 1) runs.push(text);
      }
      if (!letter(r - 1, c) && !grid[r][c].seenV) {
        let len = 0;
        let text = "";
        while (letter(r + len, c)) {
          grid[r + len][c].seenV = true;
          text += grid[r + len][c].letter;
          len++;
        }
        if (len > 1) runs.push(text);
      }
    }
  }
  return runs;
}

function validate(puzzle, themeName, difficulty, label) {
  const { grid, rows, cols, numbers } = puzzle;
  const theme = NumberGen.THEMES[themeName];
  const opts = NumberGen.DIFFICULTY[difficulty];

  if (rows < 3 || cols < 3 || rows > 40 || cols > 40) {
    fail(label + " implausible grid " + rows + "x" + cols);
    return;
  }
  if (grid.length !== rows || grid.some((row) => row.length !== cols)) {
    fail(label + " grid array shape mismatch");
    return;
  }
  if (!numbers.length) {
    fail(label + " no numbers placed");
    return;
  }

  // cells hold digits, no letters
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.black) {
        if (cell.letter !== null) fail(label + " black cell has digit at " + r + "," + c);
      } else if (!/^\d$/.test(cell.letter)) {
        fail(label + " bad cell content '" + cell.letter + "' at " + r + "," + c);
      }
    }
  }

  // every number: slot exists, slot spells the number, theme + length ok
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

  const valueSet = new Set();
  for (const n of numbers) {
    if (valueSet.has(n.value)) fail(label + " duplicate number " + n.value);
    valueSet.add(n.value);
    if (!numToCell.has(n.slot)) {
      fail(label + " number " + n.value + " has dangling slot " + n.slot);
      continue;
    }
    const [sr, sc] = numToCell.get(n.slot);
    const h = walkFrom(sr, sc, "h");
    const v = walkFrom(sr, sc, "v");
    if (h !== n.value && v !== n.value) {
      fail(label + " slot for " + n.value + " spells " + h + "/" + v);
    }
    if (n.value[0] === "0") fail(label + " number " + n.value + " starts with zero");
    const asNum = parseInt(n.value, 10);
    if (!theme.ok(asNum)) fail(label + " number " + n.value + " fails theme filter");
    if (!opts.lengths.includes(n.digits) || n.digits !== n.value.length) {
      fail(label + " number " + n.value + " wrong digit count");
    }
  }

  // runs must match the number list exactly
  const runTexts = runsOf(puzzle).sort();
  const numberTexts = numbers.map((n) => n.value).sort();
  if (JSON.stringify(runTexts) !== JSON.stringify(numberTexts)) {
    fail(label + " runs/numbers mismatch\n    runs:    " + runTexts.join(",") + "\n    numbers: " + numberTexts.join(","));
  }
}

let generated = 0;

for (const theme of Object.keys(NumberGen.THEMES)) {
  for (const diff of Object.keys(NumberGen.DIFFICULTY)) {
    for (let i = 0; i < 60; i++) {
      const p = NumberGen.makePuzzle(theme, diff);
      generated++;
      validate(p, theme, diff, theme + "/" + diff + " #" + i);
    }
  }
}

console.log("Generated " + generated + " number fill-ins");

// Batch uniqueness: puzzles printed on one page must all differ.
let batchChecks = 0;
const sig = (p) => JSON.stringify(p.grid);
for (const theme of Object.keys(NumberGen.THEMES)) {
  for (const diff of Object.keys(NumberGen.DIFFICULTY)) {
    for (let i = 0; i < 25; i++) {
      const batch = NumberGen.makeBatch(2, theme, diff);
      batchChecks += 2;
      if (sig(batch[0]) === sig(batch[1])) {
        fail(theme + "/" + diff + " batch #" + i + " returned identical puzzles");
      }
    }
  }
}
console.log("Checked " + batchChecks + " fill-ins across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
