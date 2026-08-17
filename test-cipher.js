/* ============================================================
   Sanity test for the code breaker (Caesar) generator.
   Run with: node test-cipher.js
   ============================================================ */

const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({ console });
for (const f of ["js/word-data.js", "code-breaker/js/cipher.js"]) {
  vm.runInContext(fs.readFileSync(f, "utf8"), ctx, { filename: f });
}

const CipherGen = ctx.CipherGen;
const WORD_DATA = ctx.WORD_DATA;

let failures = 0;
function fail(msg) {
  failures++;
  console.error("  FAIL: " + msg);
}

function decode(encoded, shift) {
  let out = "";
  for (let i = 0; i < encoded.length; i++) {
    const code = ((encoded.charCodeAt(i) - 65 - shift) % 26 + 26) % 26;
    out += String.fromCharCode(65 + code);
  }
  return out;
}

function validate(c, category, difficulty, label) {
  const D = CipherGen.DIFFICULTY[difficulty];
  if (c.shift !== D.shift) fail(label + " wrong shift for difficulty");
  const seen = new Set();
  for (const w of c.words) {
    if (seen.has(w.word)) fail(label + " duplicate word " + w.word);
    seen.add(w.word);
    if (!WORD_DATA[category] || !WORD_DATA[category][w.word]) fail(label + " word " + w.word + " not in bank");
    if (w.word.length < D.minLen || w.word.length > D.maxLen) fail(label + " word " + w.word + " out of range");
    if (decode(w.encoded, c.shift) !== w.word) {
      fail(label + " encoded '" + w.encoded + "' does not decode to " + w.word + " with shift " + c.shift);
    }
    if (c.withClues && (!w.clue || w.clue !== WORD_DATA[category][w.word])) fail(label + " clue wrong for " + w.word);
    if (!c.withClues && w.clue !== null) fail(label + " clue present when disabled");
  }
}

let generated = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(CipherGen.DIFFICULTY)) {
    for (const clues of [false, true]) {
      for (let i = 0; i < 40; i++) {
        const c = CipherGen.makeCode(cat, diff, 0, clues);
        generated++;
        validate(c, cat, diff, cat + "/" + diff + "/clues=" + clues + " #" + i);
      }
    }
  }
}

// batch uniqueness
let batchChecks = 0;
for (const cat of Object.keys(WORD_DATA)) {
  for (const diff of Object.keys(CipherGen.DIFFICULTY)) {
    const batch = CipherGen.makeBatch(2, cat, diff, false);
    batchChecks += 2;
    const sig = (c) => c.words.map((w) => w.word).sort().join("|");
    if (sig(batch[0]) === sig(batch[1])) fail(cat + "/" + diff + " batch had identical codes");
  }
}

console.log("Generated " + generated + " code breaker sets");
console.log("Checked " + batchChecks + " code sets across 2-per-page batches (all distinct)");

if (failures) {
  console.error("\n" + failures + " failure(s)");
  process.exit(1);
} else {
  console.log("\nAll checks passed ✔");
}
