"use strict";
const fs = require("fs");
const vm = require("vm");

const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync("js/word-data.js", "utf8"), ctx, { filename: "word-data.js" });
vm.runInContext(fs.readFileSync("cryptogram/js/crypto.js", "utf8"), ctx, { filename: "crypto.js" });

const G = ctx.CryptGen;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) pass++;
  else { fail++; console.log("FAIL: " + name); }
}

// structure + cipher integrity over many random puzzles
for (let t = 0; t < 500; t++) {
  const cat = ["animals", "foods", "sports", "countries", "jobs", "nature"][t % 6];
  const diff = ["easy", "medium", "hard"][t % 3];
  const p = G.makePuzzle(cat, diff);
  ok(p.title.indexOf("Cryptogram") === 0, "title prefixed (" + cat + "/" + diff + ")");
  ok(p.words.length >= 1, "has words");
  ok(p.plain === p.words.map(w => w.plain).join(" "), "plain matches words");
  ok(p.words.every(w => w.plain.length === w.cipher.length), "cipher same length as plain");
  ok(!/[^A-Z ]/.test(p.plain.replace(/[.,]/g, "")), "plain is letters and spaces");

  // mapping is bijective and deranged
  const ciph = p.mapping;
  const seen = {};
  for (let i = 0; i < 26; i++) {
    const pl = LETTERS[i];
    const c = ciph[pl];
    ok(c >= "A" && c <= "Z", "mapping letter valid");
    ok(c !== pl, "no letter maps to itself");
    ok(!seen[c], "cipher mapping is bijective (no duplicate target)");
    seen[c] = true;
  }

  // round-trip: decode the ciphertext with the inverse mapping -> plaintext
  const inv = {};
  for (let i = 0; i < 26; i++) inv[ciph[LETTERS[i]]] = LETTERS[i];
  const decoded = p.words.map(w => w.cipher.split("").map(ch =>
    ch >= "A" && ch <= "Z" ? inv[ch] : ch).join("")).join(" ");
  ok(decoded === p.plain, "round-trip decodes to plaintext");

  // reveals are correct and drawn from letters present in the plaintext
  const present = new Set(p.plain.replace(/[^A-Z]/g, ""));
  let expectCount = G.DIFFICULTY[diff].reveals;
  ok(Object.keys(p.reveals).length === expectCount, "reveal count matches difficulty");
  for (const c of Object.keys(p.reveals)) {
    ok(p.reveals[c] >= "A" && p.reveals[c] <= "Z", "reveal maps to a letter");
    ok(inv[c] === p.reveals[c], "reveal matches the cipher's inverse");
    ok(present.has(p.reveals[c]), "revealed letter appears in the sentence");
  }
}

// difficulty word-count caps
for (let t = 0; t < 200; t++) {
  const p = G.makePuzzle("nature", "easy");
  ok(p.words.length <= 9, "easy sentence at most 9 words");
  const m = G.makePuzzle("jobs", "medium");
  ok(m.words.length <= 12, "medium sentence at most 12 words");
}

// batch distinctness
for (let t = 0; t < 60; t++) {
  const batch = G.makeBatch(4, "animals", "easy");
  ok(batch.length === 4, "batch of 4");
  const sigs = new Set(batch.map(p => p.plain + "|" + p.words.map(w => w.cipher).join(" ")));
  ok(sigs.size === 4, "batch puzzles are distinct");
}
const big = G.makeBatch(2, "countries", "hard");
ok(big.length === 2 && big.every(p => p.difficulty === "hard"), "hard batch respects difficulty");

console.log(`cryptogram: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
