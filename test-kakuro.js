/* ============================================================
   Sanity test for the kakuro generator.
   Run with: node test-kakuro.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("kakuro/js/kakuro.js", "utf8"), ctx, { filename: "kakuro/js/kakuro.js" });

const KakuroGen = ctx.KakuroGen;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function validate(k, sizeKey, diffKey, label) {
  const S = KakuroGen.SIZES[sizeKey];
  if (k.rows !== S.rows || k.cols !== S.cols) { fail(label + " wrong size"); return; }

  // every white cell has a digit 1-9
  for (let r = 0; r < k.rows; r++) {
    for (let c = 0; c < k.cols; c++) {
      const cell = k.grid[r][c];
      if (!cell.black && (cell.digit < 1 || cell.digit > 9)) {
        fail(label + " bad digit at " + r + "," + c);
        return;
      }
    }
  }

  // horizontal runs: verify each clue's sum and digit uniqueness
  for (let r = 0; r < k.rows; r++) {
    let c = 0;
    while (c < k.cols) {
      if (k.grid[r][c].black) {
        // does a run follow?
        let start = c + 1;
        let sum = 0;
        let len = 0;
        const digits = new Set();
        let cc = start;
        while (cc < k.cols && !k.grid[r][cc].black) {
          sum += k.grid[r][cc].digit;
          digits.add(k.grid[r][cc].digit);
          len++;
          cc++;
        }
        if (len > 0) {
          if (k.grid[r][c].across !== sum) {
            fail(label + " across clue " + k.grid[r][c].across + " != actual sum " + sum + " at row " + r);
          }
          if (digits.size !== len) fail(label + " duplicate digit in across run at row " + r);
        }
        c = cc;
      } else {
        c++;
      }
    }
  }

  // vertical runs
  for (let c = 0; c < k.cols; c++) {
    let r = 0;
    while (r < k.rows) {
      if (k.grid[r][c].black) {
        let start = r + 1;
        let sum = 0;
        let len = 0;
        const digits = new Set();
        let rr = start;
        while (rr < k.rows && !k.grid[rr][c].black) {
          sum += k.grid[rr][c].digit;
          digits.add(k.grid[rr][c].digit);
          len++;
          rr++;
        }
        if (len > 0) {
          if (k.grid[r][c].down !== sum) {
            fail(label + " down clue " + k.grid[r][c].down + " != actual sum " + sum + " at col " + c);
          }
          if (digits.size !== len) fail(label + " duplicate digit in down run at col " + c);
        }
        r = rr;
      } else {
        r++;
      }
    }
  }
}

let generated = 0;
for (const sz of Object.keys(KakuroGen.SIZES)) {
  for (const diff of Object.keys(KakuroGen.DIFFICULTY)) {
    for (let i = 0; i < 30; i++) {
      const k = KakuroGen.makeKakuro(sz, diff);
      generated++;
      if (!k.rows) { fail(sz + "/" + diff + " #" + i + " failed to generate"); continue; }
      validate(k, sz, diff, sz + "/" + diff + " #" + i);
    }
  }
}

// batch uniqueness
let batchChecks = 0;
for (const sz of Object.keys(KakuroGen.SIZES)) {
  for (const diff of Object.keys(KakuroGen.DIFFICULTY)) {
    const batch = KakuroGen.makeBatch(2, sz, diff);
    batchChecks += 2;
    const sig = (k) => JSON.stringify(k.grid);
    if (batch[0].rows && batch[1].rows && sig(batch[0]) === sig(batch[1])) {
      fail(sz + "/" + diff + " batch had identical puzzles");
    }
  }
}

console.log("Generated " + generated + " kakuro puzzles");
console.log("Checked " + batchChecks + " kakuro across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
