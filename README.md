# UtilityPuzzles — printable puzzle generator sites

A static site (no backend, no database) with free printable puzzle generators,
built to be monetized with Google AdSense. Every puzzle is generated in the
visitor's browser and can be printed or saved as PDF, with an answer key.

**Current tools:**
- Word Fill-In (word fit) puzzles — 6 categories × 3 difficulty levels, printable with answers.
- Crossword maker — automatic grids with hand-written clues, across/down lists, answers option.
- Number Fill-In — number fit puzzles with fresh random numbers, 5 themes × 3 difficulty levels.
- Sudoku — 4×4 / 6×6 / 9×9 grids × 3 difficulty levels, on-screen solving, answers option.
- Bingo cards — classic number bingo or themed word bingo, 3×3 / 4×4 / 5×5, up to 100 unique cards, caller's call sheet.

**Print-friendly bulk mode:** every generator has a "per page" selector. Print
up to **8 sudoku** (1/2/4/6/8 per sheet), up to **2 word fill-ins / crosswords /
number fill-ins** side by side, or **1–4 bingo cards** per 8½ × 11 page (up to
100 cards per batch) — perfect for handing out to a whole class. "Print
Answers" prints the completed grids in the same layout.

**Uniqueness guarantee:** every puzzle in a batch is guaranteed distinct — no
matter how many puzzles you put on a page, each one is different (verified by
the test suites across all five generators).

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
articles/             SEO content hub + 8 original guides (each links to the tools)
about.html / contact.html / privacy.html / terms.html   Required AdSense pages
favicon.svg, robots.txt, sitemap.xml
test-generator.js     Node sanity test for the fill-in generator
test-crossword.js     Node sanity test for the crossword generator
test-numbers.js       Node sanity test for the number generator
test-sudoku.js        Node sanity test for the sudoku generator
test-bingo.js         Node sanity test for the bingo generator
```

## Try it locally

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

All five generators are tested with `node test-generator.js`, `node test-crossword.js`,
`node test-numbers.js`, `node test-sudoku.js` and `node test-bingo.js` (verifying slot
integrity, numbering, clues/themes, layout, sudoku uniqueness, and bingo column ranges
and card variety).

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
6. Submit `https://your-domain/sitemap.xml` in Google Search Console and request indexing of `/`, `/word-fill/`, `/crossword/`, `/number-fill/`, `/sudoku/` and `/bingo/`.

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
- [ ] Original content on every page (tools + instructions + 8 articles in `/articles/`)
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
