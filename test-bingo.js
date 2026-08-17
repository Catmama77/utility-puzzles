/* ============================================================
   Sanity test for the bingo card generator.
   Run with: node test-bingo.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "bingo/js/bingo.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const BingoGen = ctx.BingoGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;

function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

let generated = 0;

for (const sz of Object.keys(BingoGen.SIZES)) {
  const S = BingoGen.SIZES[sz];
  const total = S.size * S.size;
  const center = Math.floor(S.size / 2) * S.size + Math.floor(S.size / 2);

  for (const free of [true, false]) {
    // number mode
    for (let i = 0; i < 30; i++) {
      const batch = BingoGen.makeCards("numbers", sz, "animals", 4, free);
      generated += 4;
      const label = "numbers/" + sz + "/free=" + free + " #" + i;
      for (const card of batch.cards) {
        const expectFree = free && S.freeCenter;
        if (card.cells.length !== total) fail(label + " wrong cell count");
        if (card.size !== S.size) fail(label + " wrong size");
        for (let k = 0; k < total; k++) {
          const cell = card.cells[k];
          if (expectFree && k === center) {
            if (!cell.free || cell.v !== "FREE") fail(label + " free center missing");
          } else {
            if (cell.free) fail(label + " unexpected free at " + k);
            const c = k % S.size;
            const range = S.ranges[c];
            const n = parseInt(cell.v, 10);
            if (n < range[0] || n > range[1]) fail(label + " number " + cell.v + " out of column range " + c);
          }
        }
        // no duplicate numbers in a column
        for (let c = 0; c < S.size; c++) {
          const col = [];
          for (let r = 0; r < S.size; r++) {
            const v = card.cells[r * S.size + c].v;
            if (v !== "FREE") col.push(v);
          }
          if (new Set(col).size !== col.length) fail(label + " duplicate in column " + c);
        }
      }
      // cards in a batch must not all be identical
      const sigs = new Set(batch.cards.map((c) => c.cells.map((x) => x.v).join(",")));
      if (sigs.size < 2) fail(label + " batch cards identical");
    }

    // word mode, every category
    for (const cat of Object.keys(WORD_DATA)) {
      for (let i = 0; i < 12; i++) {
        const batch = BingoGen.makeCards("words", sz, cat, 2, free);
        generated += 2;
        const label = "words/" + sz + "/" + cat + " #" + i;
        const expectFree = free && S.freeCenter;
        for (const card of batch.cards) {
          if (card.cells.length !== total) fail(label + " wrong cell count");
          const seen = new Set();
          for (let k = 0; k < total; k++) {
            const cell = card.cells[k];
            if (expectFree && k === center) {
              if (!cell.free || cell.v !== "FREE") fail(label + " free center missing");
              continue;
            }
            if (!WORD_DATA[cat][cell.v]) fail(label + " word " + cell.v + " not in category");
            if (seen.has(cell.v)) fail(label + " duplicate word " + cell.v + " on card");
            seen.add(cell.v);
          }
        }
      }
    }
  }

  // large batches: every card in the batch must be distinct
  for (const count of [24, 60, 100]) {
    const label = "large/" + sz + "/" + count;
    const batch = BingoGen.makeCards("numbers", sz, "animals", count, true);
    generated += count;
    const sigs = new Set(batch.cards.map((c) => c.cells.map((x) => x.v).join("|")));
    if (sigs.size !== count) fail(label + " duplicate cards in batch (" + sigs.size + " unique of " + count + ")");
    if (batch.cards.length !== count) fail(label + " wrong card count");
  }
  // large word batches stay distinct too
  const wbatch = BingoGen.makeCards("words", "5x5", "animals", 60, true);
  generated += 60;
  const wsigs = new Set(wbatch.cards.map((c) => c.cells.map((x) => x.v).join("|")));
  if (wsigs.size !== 60) fail("large words 60: " + wsigs.size + " unique of 60");

  // call sheet: numbers cover every value in the ranges
  const sheet = BingoGen.makeCards("numbers", sz, "animals", 1, true).callSheet;
  if (sheet.columns.length !== S.cols.length) fail(sz + " call sheet column count");
  sheet.columns.forEach((col, i) => {
    if (col.label !== S.cols[i]) fail(sz + " call sheet label " + col.label);
    if (col.items.length !== S.ranges[i][1] - S.ranges[i][0] + 1) fail(sz + " call sheet item count for " + col.label);
    for (const item of col.items) {
      const n = parseInt(item.split("-")[1], 10);
      if (n < S.ranges[i][0] || n > S.ranges[i][1]) fail(sz + " call sheet item out of range: " + item);
    }
  });

  // call sheet: word mode uses the whole category
  const wsheet = BingoGen.makeCards("words", sz, "animals", 1, true).callSheet;
  const wset = new Set(wsheet.columns[0].items);
  if (wset.size !== Object.keys(WORD_DATA.animals).length) {
    fail(sz + " word call sheet missing words");
  }
}

console.log("Generated " + generated + " bingo cards");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
