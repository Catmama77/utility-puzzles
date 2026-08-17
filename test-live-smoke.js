/* ============================================================
   Live smoke test for the deployed site.

   Fetches every live game page (https://www.helpuhelpurself.com),
   pulls the page's real generator + app scripts from the live
   server, and drives the UI in the same DOM shim used by
   test-dom-all.js:

     - New Puzzle        -> a grid renders in the sheet container
     - New Puzzle again  -> a DIFFERENT puzzle renders (fresh gen)
     - Check             -> status text appears (games with a Check)
     - Show Answers      -> the rendered sheet changes

   Requires network access and the site to be deployed. Run:

     node test-live-smoke.js

   Every game must pass; exits non-zero on any failure.
   ============================================================ */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");

/* ---------- build the DOM shim from test-dom-all.js ---------- */

const domSrc = fs.readFileSync(path.join(__dirname, "test-dom-all.js"), "utf8");
const shimStart = domSrc.indexOf("const allEls = [];");
const shimEnd = domSrc.indexOf("const WORD_DATA");
if (shimStart < 0 || shimEnd < 0) {
  console.error("Could not extract the DOM shim from test-dom-all.js.");
  process.exit(1);
}
const shimPath = path.join(os.tmpdir(), "brainy-puzzles-live-shim.js");
fs.writeFileSync(
  shimPath,
  'const vm = require("vm");\n' +
    domSrc.slice(shimStart, shimEnd) +
    "\nmodule.exports = { allEls, buildDocument, makeContext, fireReady, fireClick, elText };\n"
);
const H = require(shimPath);
const { allEls, buildDocument, makeContext, fireReady, fireClick, elText } = H;
function resetDom() {
  allEls.length = 0;
}

const DOMAIN = "https://www.helpuhelpurself.com";
const GAMES = [
  "word-fill", "crossword", "number-fill", "sudoku", "wordoku", "bingo",
  "word-search", "word-scramble", "number-search", "word-wheel", "word-ladders",
  "code-breaker", "matching", "maze", "kakuro", "killer-sudoku", "cross-math",
  "cryptogram", "nonogram", "futoshiki", "skyscrapers", "calcudoku", "hidato",
  "slitherlink",
];

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
  return r.text();
}

/* Walk the sheet container's tree and build a signature that captures
   text, classes, input values, innerHTML strings and inline styles —
   the shim has no universal-selector support and games render walls
   (maze) and item text (matching) via styles / innerHTML. */
const WALK = "(function(){ var root = document.getElementById('sheets') || document.getElementById('cards'); " +
  "if (!root) return JSON.stringify({ n: 0, sig: '' }); var n = 0; var parts = []; " +
  "(function w(x){ if (!x) return; n++; parts.push(x.textContent || '', x.className || '', x.value || '', x.innerHTML || ''); " +
  "var sk = []; for (var k in x.style) { try { if (x.style[k]) sk.push(k + '=' + x.style[k]); } catch (e) {} } parts.push(sk.join(',')); " +
  "for (var i = 0; i < (x.children || []).length; i++) w(x.children[i]); })(root); " +
  "var sig = parts.join('|'); return JSON.stringify({ n: n, sig: sig.length > 100000 ? sig.slice(0, 100000) : sig }); })()";
const sheetsInfo = (ctx) => JSON.parse(vm.runInContext(WALK, ctx));

(async () => {
  let passed = 0;
  let failed = 0;
  const failures = [];
  for (const g of GAMES) {
    const problems = [];
    try {
      const pageUrl = DOMAIN + "/" + g + "/";
      const html = await fetchText(pageUrl);
      const ids = [...new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))];
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((s) => s.endsWith(".js") && !s.includes("site.js") && !s.includes("ads.js"));

      const code = [];
      for (const s of scripts) {
        const url = DOMAIN + (s.startsWith("/") ? s : "/" + g + "/" + s);
        code.push(await fetchText(url));
      }

      resetDom();
      const doc = buildDocument(ids);
      const ctx = makeContext(doc);
      code.forEach((c, i) => {
        try {
          vm.runInContext(c, ctx, { filename: g + "#" + i });
        } catch (e) {
          throw new Error("script error: " + e.message);
        }
      });
      fireReady(ctx, doc);

      // 1. generate
      fireClick(ctx, "new-btn");
      const info1 = sheetsInfo(ctx);
      if (info1.n <= 1) problems.push("new-btn rendered nothing in container");

      // 2. regenerate -> different puzzle
      const s1 = info1.sig;
      fireClick(ctx, "new-btn");
      const info2 = sheetsInfo(ctx);
      if (info2.n <= 1) problems.push("second new-btn rendered nothing");
      else if (s1 === info2.sig) problems.push("second new-btn produced identical puzzle");

      // 3. check (games that have a Check button)
      if (ids.includes("check-btn")) {
        fireClick(ctx, "check-btn");
        const st = elText(ctx, "document.getElementById('status')").trim();
        if (!st) problems.push("check-btn produced no status text");
      }

      // 4. answers (games that have a Show Answers button)
      if (ids.includes("answers-btn")) {
        const before = sheetsInfo(ctx).sig;
        fireClick(ctx, "answers-btn");
        const info3 = sheetsInfo(ctx);
        if (info3.sig === before) problems.push("answers-btn changed nothing");
      }
    } catch (e) {
      problems.push(e.message);
    }

    if (problems.length) {
      failed++;
      failures.push(g + ": " + problems.join("; "));
      console.log("FAIL  " + g + "  — " + problems.join("; "));
    } else {
      passed++;
      console.log("PASS  " + g);
    }
  }

  console.log("\n" + passed + "/" + (passed + failed) + " live games pass.");
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log("  " + f));
    process.exit(1);
  }
})();
