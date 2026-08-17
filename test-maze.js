/* ============================================================
   Sanity test for the maze generator.
   Run with: node test-maze.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync("maze/js/maze.js", "utf8"), ctx, { filename: "maze/js/maze.js" });

const MazeGen = ctx.MazeGen;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

// independent solver: BFS over the maze (no walls between adjacent cells)
function solve(m) {
  const dirs = [[-1, 0, "n", "s"], [0, 1, "e", "w"], [1, 0, "s", "n"], [0, -1, "w", "e"]];
  const startKey = m.start.r + "," + m.start.c;
  const endKey = m.end.r + "," + m.end.c;
  const prev = {};
  const queue = [startKey];
  const seen = new Set([startKey]);
  while (queue.length) {
    const key = queue.shift();
    if (key === endKey) break;
    const [r, c] = key.split(",").map(Number);
    for (const [dr, dc, wall, opp] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= m.rows || nc < 0 || nc >= m.cols) continue;
      if (m.walls[r][c][wall] || m.walls[nr][nc][opp]) continue; // blocked
      const nk = nr + "," + nc;
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev[nk] = key;
      queue.push(nk);
    }
  }
  if (!seen.has(endKey)) return null;
  const path = [];
  let node = endKey;
  while (node !== undefined) {
    path.unshift(node);
    node = prev[node];
  }
  return path;
}

function validate(m, sizeKey, label) {
  const S = MazeGen.SIZES[sizeKey];
  if (m.rows !== S.rows || m.cols !== S.cols) {
    fail(label + " wrong dimensions");
    return;
  }
  // wall symmetry: every wall is shared
  for (let r = 0; r < m.rows; r++) {
    for (let c = 0; c < m.cols; c++) {
      const w = m.walls[r][c];
      if (w.e && c + 1 < m.cols && !m.walls[r][c + 1].w) {
        fail(label + " asymmetric wall e at " + r + "," + c);
      }
      if (w.s && r + 1 < m.rows && !m.walls[r + 1][c].n) {
        fail(label + " asymmetric wall s at " + r + "," + c);
      }
    }
  }
  // outer border intact
  for (let c = 0; c < m.cols; c++) {
    if (!m.walls[0][c].n) fail(label + " open top border at " + c);
    if (!m.walls[m.rows - 1][c].s) fail(label + " open bottom border at " + c);
  }
  for (let r = 0; r < m.rows; r++) {
    if (!m.walls[r][0].w) fail(label + " open left border at " + r);
    if (!m.walls[r][m.cols - 1].e) fail(label + " open right border at " + r);
  }
  // solution exists and is valid
  const path = solve(m);
  if (!path) fail(label + " no solution found");
  else {
    if (path[0] !== m.start.r + "," + m.start.c || path[path.length - 1] !== m.end.r + "," + m.end.c) {
      fail(label + " solution endpoints wrong");
    }
  }
}

const DIFFS = ["easy", "medium", "hard"];
let generated = 0;

// structural validation across every size x difficulty
for (const sz of Object.keys(MazeGen.SIZES)) {
  for (const diff of DIFFS) {
    for (let i = 0; i < 12; i++) {
      const m = MazeGen.makeMaze(sz, diff);
      generated++;
      validate(m, sz, sz + "/" + diff + " #" + i);
    }
  }
}

// difficulty ordering: the solution path should be shorter (share of
// cells) on Easy than on Hard, at every size
for (const sz of Object.keys(MazeGen.SIZES)) {
  const means = {};
  for (const diff of DIFFS) {
    let total = 0;
    for (let i = 0; i < 30; i++) {
      const m = MazeGen.makeMaze(sz, diff);
      total += m.solution.length / (m.rows * m.cols);
    }
    means[diff] = total / 30;
  }
  console.log(`  ${sz.padEnd(6)} easy ${means.easy.toFixed(2)}  medium ${means.medium.toFixed(2)}  hard ${means.hard.toFixed(2)}`);
  if (!(means.easy < means.medium && means.medium < means.hard)) {
    fail(sz + " difficulty ordering wrong: " + JSON.stringify(means));
  }
  if (means.easy > 0.5) fail(sz + " easy mean too high (" + means.easy.toFixed(2) + " > 0.5)");
  if (means.hard < 0.6) fail(sz + " hard mean too low (" + means.hard.toFixed(2) + " < 0.6)");
}

// batch uniqueness per difficulty
let batchChecks = 0;
for (const sz of Object.keys(MazeGen.SIZES)) {
  for (const diff of DIFFS) {
    const batch = MazeGen.makeBatch(2, sz, diff);
    batchChecks += 2;
    const sig = (m) => JSON.stringify(m.walls);
    if (sig(batch[0]) === sig(batch[1])) fail(sz + "/" + diff + " batch had identical mazes");
  }
}

console.log("Generated " + generated + " mazes");
console.log("Checked " + batchChecks + " mazes across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
