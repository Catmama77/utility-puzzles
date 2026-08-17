# UtilityPuzzles — printable puzzle generator sites

A static site (no backend, no database) with free printable puzzle generators,
built to be monetized with Google AdSense. Every puzzle is generated in the
visitor's browser and can be printed or saved as PDF, with an answer key.

**Current tools (17):**
- Word Fill-In (word fit) puzzles — 6 categories × 3 difficulty levels, printable with answers.
- Crossword maker — automatic grids with hand-written clues, across/down lists, answers option.
- Number Fill-In — number fit puzzles with fresh random numbers, 5 themes × 3 difficulty levels.
- Sudoku — 4×4 / 6×6 / 9×9 grids × 3 difficulty levels, on-screen solving, answers option.
- Wordoku — letter sudoku with themed letters, same sizes and levels as sudoku, up to 8 per sheet.
- Bingo cards — classic number bingo or themed word bingo, 3×3 / 4×4 / 5×5, up to 100 unique cards, caller's call sheet.
- Word search — themed word hunts in 8×8 / 10×10 / 12×12 grids, click-to-find on screen, printable with answers.
- Word scramble — unscramble-the-word worksheets, optional clues from the word database, printable with answers.
- Number search — hunt hidden numbers in a digit grid, 3 sizes × 3 difficulty levels, click-to-find on screen.
- Word wheel — Boggle-style: make themed words from nine letters, each using the center letter.
- Word ladders — change one letter at a time from start word to end word, three difficulty levels.
- Code breaker — decode themed words written in a Caesar cipher, optional clues.
- Matching & flashcards — word-to-clue matching worksheets or cut-out vocabulary flashcards.
- Maze — perfect mazes (exactly one solution path) in three sizes, print blank or with solution.
- Kakuro — cross-sum number logic puzzles in three sizes and three difficulty levels.
- Cryptogram — decode hidden themed sentences written in a letter-substitution cipher, three difficulty levels.
- Nonogram — picross picture-logic puzzles with unique solutions, three sizes and difficulty levels.

**Print-friendly bulk mode:** every generator has a "per page" selector. Print
up to **8 sudoku / wordoku** per sheet, up to **2 of the other puzzle types**
side by side, or **1–4 bingo cards** per 8½ × 11 page (up to 100 cards per
batch) — perfect for handing out to a whole class. "Print Answers" prints the
completed grids in the same layout.

**Uniqueness guarantee:** every puzzle in a batch is guaranteed distinct — no
matter how many puzzles you put on a page, each one is different (verified by
the test suites across all sixteen generators).

## Project layout

```
index.html            Hub page linking all tools (also the AdSense landing page)
js/word-data.js       Shared word + clue database (6 categories)
js/puzzle-core.js     Shared placement engine (grid layout, numbering)
js/ads.js             Central AdSense config + injection
css/style.css         Shared styles (print-friendly)
word-fill/            Word Fill-In tool
  js/words.js         Word bank derived from word-data.js
  js/puzzles.js       Fill-in generator (uses puzzle-core)
  js/app.js           Page UI
crossword/            Crossword tool
  js/crossword.js     Crossword generator (uses puzzle-core + word-data)
  js/app.js           Page UI
number-fill/          Number Fill-In tool
  js/numbers.js       Number generator (themes, uses puzzle-core)
  js/app.js           Page UI
sudoku/               Sudoku tool (standalone generator, no shared deps)
  js/sudoku.js        Sudoku generator (valid grids, unique solutions)
  js/app.js           Page UI (on-screen solving + check)
bingo/                Bingo card tool
  js/bingo.js         Bingo generator (numbers + themed words, call sheet)
  js/app.js           Page UI (card batches, tickable call sheet)
word-search/          Word search tool
  js/search.js        Word search generator (themed grids, 3 sizes × 3 levels)
  js/app.js           Page UI (click-to-find solving)
word-scramble/        Word scramble tool
  js/scramble.js      Word scramble generator (anagrams, optional clues)
  js/app.js           Page UI (on-screen solving + check)
wordoku/              Wordoku tool (reuses the sudoku engine + word-data)
  js/wordoku.js       Letter-sudoku generator
  js/app.js           Page UI
maze/                 Maze tool
  js/maze.js          Perfect-maze generator (recursive backtracker + solver)
  js/app.js           Page UI
matching/             Matching / flashcards tool
  js/matching.js      Worksheet generator (word + clue pairs)
  js/app.js           Page UI (click-to-pair solving)
word-ladders/         Word ladder tool
  js/ladders.js       Ladder generator (BFS over the merged word bank)
  js/app.js           Page UI (rung entry + check)
code-breaker/         Code breaker tool
  js/cipher.js        Caesar-cipher generator (themed words, optional clues)
  js/app.js           Page UI (decode + check)
word-wheel/           Word wheel tool
  js/wheel.js         Letter-wheel generator (maximizes buildable words)
  js/app.js           Page UI (word entry + checking)
number-search/        Number search tool
  js/nsearch.js       Number-find generator (digit grids)
  js/app.js           Page UI (click-to-find solving)
kakuro/               Kakuro tool
cryptogram/           Cryptogram tool
nonogram/             Nonogram (picross) tool
  js/crypto.js        Letter-substitution generator (themed sentences)
  js/app.js           Page UI (auto-fill decoding + check)
  js/kakuro.js        Cross-sum generator (run sums, unique fill)
  js/app.js           Page UI (digit entry + check, arrow nav)
articles/             SEO content hub + 14 original guides (each links to the tools)
about.html / contact.html / privacy.html / terms.html   Required AdSense pages
favicon.svg, robots.txt, sitemap.xml, feed.xml
build-seo.js      Auto-generates sitemap.xml + feed.xml from the file tree (run `node build-seo.js`)
.github/workflows/update-seo.yml   Regenerates sitemap/feed on every push and commits changes
test-generator.js     Node sanity test for the fill-in generator
test-crossword.js     Node sanity test for the crossword generator
test-numbers.js       Node sanity test for the number generator
test-sudoku.js        Node sanity test for the sudoku generator
test-bingo.js         Node sanity test for the bingo generator
test-search.js        Node sanity test for the word search generator
test-scramble.js      Node sanity test for the word scramble generator
test-wordoku.js       Node sanity test for the wordoku generator
test-maze.js          Node sanity test for the maze generator
test-matching.js      Node sanity test for the matching generator
test-ladders.js       Node sanity test for the word ladder generator
test-cipher.js        Node sanity test for the code breaker generator
test-wheel.js         Node sanity test for the word wheel generator
test-nsearch.js       Node sanity test for the number search generator
test-kakuro.js        Node sanity test for the kakuro generator
test-cryptogram.js    Node sanity test for the cryptogram generator
```

## Keeping sitemap.xml and the RSS feed up to date

`sitemap.xml` and `feed.xml` are **auto-generated — don't edit them by hand**.
`build-seo.js` walks the repo, finds every page, and writes both files, using
each file's last git commit date for `<lastmod>`/`<pubDate>` (newest articles
first in the feed).

- **Locally:** after adding a page, run `node build-seo.js` and commit the
  regenerated files.
- **Automatically:** the GitHub Action in `.github/workflows/update-seo.yml`
  runs `node build-seo.js` on every push to `main` and commits any changes
  itself (its commits carry `[skip ci]` so it never loops). After adding a
  tool or article you don't need to do anything — the sitemap and feed update
  themselves and Google re-reads `sitemap.xml` (already referenced from
  `robots.txt`) on its next crawl.

The feed is linked from every page's footer and from the `<head>` of the
homepage and `/articles/`.

## Try it locally

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

All sixteen generators are tested with `node test-generator.js`, `node test-crossword.js`,
`node test-numbers.js`, `node test-sudoku.js`, `node test-bingo.js`, `node test-search.js`,
`node test-scramble.js`, `node test-wordoku.js`, `node test-maze.js`, `node test-matching.js`,
`node test-ladders.js`, `node test-cipher.js`, `node test-wheel.js`, `node test-nsearch.js`
and `node test-kakuro.js` (verifying slot integrity, numbering, clues/themes, layout,
sudoku uniqueness, bingo column ranges and card variety, word-search placement, scramble
anagram integrity, wordoku letter grids, maze solvability, matching pair integrity, ladder
connectivity, cipher round-trips, wheel word counts, number-search placement, and kakuro
run sums).

## Deploy to GitHub Pages

1. Create a new **public** repo on GitHub (e.g. `utility-puzzles`).
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: word fill-in puzzle maker"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/utility-puzzles.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**.
4. Attach your domain:
   - In **Settings → Pages → Custom domain**, enter your subdomain, e.g. `puzzles.example.com`.
   - At your domain registrar / DNS provider, add a `CNAME` record: `puzzles` → `YOUR-USERNAME.github.io`.
   - Turn on **Enforce HTTPS** once the certificate issues (can take a few minutes).
5. The domain is already wired in: `sitemap.xml`, `robots.txt`, the contact email
   and the `CNAME` file all use `helpuhelpurself.com`. If you ever switch domain,
   update those files and the `CNAME` file.

### DNS records (name.com)

The site is served at `https://www.helpuhelpurself.com` (www-primary setup,
which needs only a CNAME record and gives HTTPS automatically):

| Type | Host | Answer |
|---|---|---|
| CNAME | www | Catmama77.github.io |

Optional — make the bare domain `helpuhelpurself.com` forward to `www`
using name.com's URL forwarding (or add these 4 A records with Host `@`
and GitHub will redirect the apex to `www` automatically):

| Type | Host | Answer |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

If you switch primary domains, update the `CNAME` file, `sitemap.xml` and
`robots.txt` to match.
6. Submit `https://your-domain/sitemap.xml` in Google Search Console and request indexing of `/` and all 15 tool pages (`/word-fill/`, `/crossword/`, `/number-fill/`, `/sudoku/`, `/wordoku/`, `/bingo/`, `/word-search/`, `/word-scramble/`, `/number-search/`, `/word-wheel/`, `/word-ladders/`, `/code-breaker/`, `/matching/`, `/maze/`, `/kakuro/`).

### Putting each tool on its own subdomain (the 3-subdomain plan)

GitHub Pages allows one custom domain per repo. If you want  `wordfill.example.com`, `crossword.example.com`, `numbers.example.com`
  or `sudoku.example.com`:

- Keep this repo as the hub (apex or `puzzles.example.com`).
- For each tool, copy its folder (plus `css/`, `js/ads.js`, the legal pages and
  `favicon.svg`) into its own repo, then repeat steps 2–4 with that subdomain.
  (`word-fill/` and `crossword/` also need `js/word-data.js` and
  `js/puzzle-core.js` copied; `number-fill/` only needs `js/puzzle-core.js`.)
- Adjust asset paths in the copied pages if you serve from a sub-path.

## Enabling AdSense

1. Put real content on the site first — this is the single biggest factor in
   approval. The pages, instructions and privacy/terms pages are already here;
   add more explanatory text over time.
2. Apply at https://adsense.google.com once the site is live. Approval is not
   automatic and can take days to weeks.
3. After approval, copy your publisher ID (`ca-pub-1234567890123456`) and paste
   it into `ADSENSE_CONFIG.client` in `js/ads.js`. Ads will then render
   automatically in the existing ad slots on every page.
4. Optional: replace the `data-ad-slot="0000000000"` placeholders with real ad
   unit IDs, or delete the manual slots and enable **Auto ads** in AdSense
   (with the loader script in `js/ads.js`, auto ads are all you need).

### AdSense approval checklist

- [ ] Site live on your own domain with HTTPS
- [ ] Privacy Policy, About, Contact and Terms pages (done — edit to match your details)
- [ ] Original content on every page (tools + instructions + 14 articles in `/articles/`)
- [ ] Working navigation and mobile-friendly layout
- [ ] Sitemap submitted in Search Console, pages indexed

Tip: keep adding articles over time. More original content per page and a growing
internal-link network are the strongest signals for both AdSense approval and
search traffic.

## Notes

- Puzzles are generated entirely client-side; no server, no cookies required
  for the tools themselves (only advertisers set cookies — see privacy.html).
- All word data is original/common-word content; nothing is copied from
  published puzzle books, which keeps the site compliant with AdSense policies.
- The word fill-in, crossword and number fill-in generators are pure logic built
  on the shared `js/puzzle-core.js` placement engine; the sudoku generator is
  standalone (full-grid generation + unique-solution removal).
