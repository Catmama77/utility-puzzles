/* ============================================================
   Sanity test for the number search generator.
   Run with: node test-nsearch.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("number-search/js/nsearch.js", "utf8"), ctx, { filename: "number-search/js/nsearch.js" });

const NSearchGen = ctx.NSearchGen;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

const DIRS = {
  "e": [0, 1], "s": [1, 0], "w": [0, -1], "n": [-1, 0],
  "se": [1, 1], "sw": [1, -1], "ne": [-1, 1], "nw": [-1, -1]
};

function validate(p, sizeKey, diffKey, label) {
  const { grid, nums, size } = p;
  if (grid.length !== size || grid.some((row) => row.length !== size)) {
    fail(label + " grid not " + size + "x" + size);
    return;
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!/^[0-9]$/.test(grid[r][c])) fail(label + " non-digit at " + r + "," + c);
    }
  }
  const D = NSearchGen.DIFFICULTY[diffKey];
  const seen = new Set();
  for (const n of nums) {
    if (seen.has(n.value)) fail(label + " duplicate number " + n.value);
    seen.add(n.value);
    if (n.value.length < D.digits[0] || n.value.length > D.digits[1]) {
      fail(label + " number " + n.value + " wrong length for " + diffKey);
    }
    if (n.value[0] === "0") fail(label + " number " + n.value + " starts with zero");
    if (!D.dirs.includes(n.dir)) fail(label + " number uses " + n.dir + " not allowed at " + diffKey);
    const d = DIRS[n.dir];
    let spelled = "";
    for (let i = 0; i < n.value.length; i++) {
      spelled += grid[n.r + d[0] * i][n.c + d[1] * i];
    }
    if (spelled !== n.value) fail(label + " number " + n.value + " spells '" + spelled + "' in grid");
  }
}

let generated = 0;
for (const sz of Object.keys(NSearchGen.SIZES)) {
  for (const diff of Object.keys(NSearchGen.DIFFICULTY)) {
    for (let i = 0; i < 40; i++) {
      const p = NSearchGen.makeSearch(sz, diff);
      generated++;
      validate(p, sz, diff, sz + "/" + diff + " #" + i);
    }
  }
}

// batch uniqueness
let batchChecks = 0;
for (const sz of Object.keys(NSearchGen.SIZES)) {
  for (const diff of Object.keys(NSearchGen.DIFFICULTY)) {
    const batch = NSearchGen.makeBatch(2, sz, diff);
    batchChecks += 2;
    const sig = (p) => p.nums.map((n) => n.value + "@" + n.r + "," + n.c + "," + n.dir).sort().join("|");
    if (sig(batch[0]) === sig(batch[1])) fail(sz + "/" + diff + " batch had identical searches");
  }
}

console.log("Generated " + generated + " number searches");
console.log("Checked " + batchChecks + " searches across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
