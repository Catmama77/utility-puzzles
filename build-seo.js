#!/usr/bin/env node
/*
 * build-seo.js — auto-generates sitemap.xml and feed.xml from the site itself.
 *
 * No dependencies: plain Node. Run it after adding/removing pages:
 *     node build-seo.js
 *
 * What it does:
 *   - Walks the repo and finds every published page (tool index.html files,
 *     top-level pages, and articles).
 *   - Uses each file's last git commit date as <lastmod> (falls back to the
 *     file's mtime), so sitemap freshness updates by itself.
 *   - Keeps a stable priority scheme (home 1.0, tools 0.9, articles 0.6/0.7,
 *     legal pages 0.5) so the sitemap doesn't churn.
 *   - Writes an RSS 2.0 feed (feed.xml) with the articles, newest first,
 *     titles/descriptions pulled from each article's own <head>.
 *
 * A GitHub Action (see .github/workflows/update-seo.yml) runs this on every
 * push to main and commits any changes, so the sitemap and feed always
 * reflect the deployed site.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DOMAIN = "https://www.helpuhelpurself.com";
const SITE_NAME = "Brainy Puzzles";
const TOOL_ORDER = [
  "word-fill", "crossword", "number-fill", "sudoku", "bingo",
  "word-search", "word-scramble", "wordoku", "number-search",
  "word-wheel", "word-ladders", "code-breaker", "matching", "maze", "kakuro",
  "killer-sudoku", "cross-math", "cryptogram", "nonogram",
  "futoshiki", "skyscrapers", "calcudoku", "hidato", "slitherlink",
];
const LEGAL_PAGES = ["about.html", "contact.html", "privacy.html", "terms.html"];

function gitDate(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch (_) {
    /* git unavailable — fall through to mtime */
  }
  try {
    return new Date(fs.statSync(file).mtime).toISOString();
  } catch (_) {
    return new Date(0).toISOString();
  }
}

/** Collect every published page as { path (site-relative), file, priority, isArticle } */
function collectPages() {
  const pages = [];

  // Home page
  pages.push({ path: "/", file: "index.html", priority: "1.0" });

  // Tool pages (directory index.html files, in stable order)
  for (const dir of TOOL_ORDER) {
    const file = path.join(dir, "index.html");
    if (fs.existsSync(file)) {
      pages.push({ path: `/${dir}/`, file, priority: "0.9" });
      // secondary pages inside the tool folder (e.g. rules.html)
      const extras = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".html") && f !== "index.html")
        .sort();
      for (const e of extras) {
        pages.push({ path: `/${dir}/${e}`, file: path.join(dir, e), priority: "0.8" });
      }
    }
  }

  // Articles hub + articles
  const articlesIndex = path.join("articles", "index.html");
  if (fs.existsSync(articlesIndex)) {
    pages.push({ path: "/articles/", file: articlesIndex, priority: "0.7" });
  }
  const articles = fs
    .readdirSync("articles")
    .filter((f) => f.endsWith(".html") && f !== "index.html")
    .map((a) => ({ name: a, date: gitDate(path.join("articles", a)) }))
    .sort((x, y) => (x.date < y.date ? 1 : -1)); // newest first
  for (const a of articles) {
    pages.push({
      path: `/articles/${a.name}`,
      file: path.join("articles", a.name),
      priority: "0.6",
      isArticle: true,
    });
  }

  // Legal pages
  for (const p of LEGAL_PAGES) {
    if (fs.existsSync(p)) {
      pages.push({ path: `/${p}`, file: p, priority: "0.5" });
    }
  }

  return pages;
}

/* Cross-check the sitemap against what is actually on disk, so a page that
   gets added without a TOOL_ORDER entry (or any other drift) fails the build
   loudly instead of silently shipping a stale sitemap. Returns a list of
   problems (empty = everything covered). */
function verifyCoverage(pages) {
  const problems = [];
  const urls = new Set(pages.map((p) => DOMAIN + p.path));

  // Tools: any top-level directory with index.html + js/app.js is a published
  // tool page. Each one must be in TOOL_ORDER (else build-seo.js drops it from
  // the sitemap) and present in the generated URL list.
  const toolDirs = fs
    .readdirSync(".")
    .filter((d) => {
      try {
        return (
          fs.statSync(path.join(d, "index.html")).isFile() &&
          fs.statSync(path.join(d, "js", "app.js")).isFile()
        );
      } catch (_) {
        return false;
      }
    })
    .sort();
  for (const d of toolDirs) {
    if (!TOOL_ORDER.includes(d)) {
      problems.push("tool page exists but is missing from TOOL_ORDER: " + d + "/");
    }
    if (!urls.has(DOMAIN + "/" + d + "/")) {
      problems.push("tool page missing from sitemap: " + DOMAIN + "/" + d + "/");
    }
    // any subpage in a tool folder (rules.html etc.) must be in the sitemap
    const extras = fs
      .readdirSync(d)
      .filter((f) => f.endsWith(".html") && f !== "index.html");
    for (const e of extras) {
      if (!urls.has(DOMAIN + "/" + d + "/" + e)) {
        problems.push("tool subpage missing from sitemap: " + DOMAIN + "/" + d + "/" + e);
      }
    }
  }
  // Every TOOL_ORDER entry must also have a real page on disk — a stale entry
  // otherwise makes the sitemap silently drop a tool.
  for (const d of TOOL_ORDER) {
    if (!fs.existsSync(path.join(d, "index.html"))) {
      problems.push("TOOL_ORDER entry has no page on disk: " + d + "/");
    }
  }

  // Articles are auto-discovered, but confirm each one landed in the sitemap.
  const articles = fs
    .readdirSync("articles")
    .filter((f) => f.endsWith(".html") && f !== "index.html");
  for (const a of articles) {
    if (!urls.has(DOMAIN + "/articles/" + a)) {
      problems.push("article missing from sitemap: " + DOMAIN + "/articles/" + a);
    }
  }

  // Legal pages and the home page.
  for (const p of LEGAL_PAGES) {
    if (fs.existsSync(p) && !urls.has(DOMAIN + "/" + p)) {
      problems.push("page missing from sitemap: " + DOMAIN + "/" + p);
    }
  }
  if (!urls.has(DOMAIN + "/")) problems.push("home page missing from sitemap");

  return problems;
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSitemap(pages) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- Auto-generated by build-seo.js — do not edit by hand. -->`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];
  for (const p of pages) {
    const lastmod = gitDate(p.file).slice(0, 10); // YYYY-MM-DD
    lines.push(`  <url>`);
    lines.push(`    <loc>${DOMAIN}${p.path}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <priority>${p.priority}</priority>`);
    lines.push(`  </url>`);
  }
  lines.push(`</urlset>`, "");
  return lines.join("\n");
}

function rfc822(iso) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}

/** Pull <title> and <meta name="description"> out of an article file. */
function readHead(file) {
  const html = fs.readFileSync(file, "utf8");
  let title = "";
  const t = html.match(/<title>(.*?)<\/title>/s);
  if (t) title = t[1].replace(/\s*—\s*Brainy Puzzles\s*$/, "").trim();
  let desc = "";
  const d = html.match(/<meta name="description" content="([^"]*)"/);
  if (d) desc = d[1];
  return { title, desc };
}

function buildFeed(pages) {
  const articles = pages
    .filter((p) => p.isArticle)
    .map((p) => {
      const { title, desc } = readHead(p.file);
      return {
        title: title || path.basename(p.file, ".html").replace(/-/g, " "),
        link: `${DOMAIN}${p.path}`,
        desc: desc || "",
        date: gitDate(p.file),
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const newest = articles.length ? articles[0].date : new Date().toISOString();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- Auto-generated by build-seo.js — do not edit by hand. -->`,
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
    `  <channel>`,
    `    <title>${xmlEscape(SITE_NAME)} — Articles &amp; Guides</title>`,
    `    <link>${DOMAIN}/articles/</link>`,
    `    <description>Free printable puzzle generators with guides on how to play, rules, and classroom ideas.</description>`,
    `    <language>en-us</language>`,
    `    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`,
    `    <atom:link href="${DOMAIN}/feed.xml" rel="self" type="application/rss+xml"/>`,
  ];
  for (const a of articles) {
    lines.push(`    <item>`);
    lines.push(`      <title>${xmlEscape(a.title)}</title>`);
    lines.push(`      <link>${a.link}</link>`);
    lines.push(`      <guid>${a.link}</guid>`);
    lines.push(`      <pubDate>${rfc822(a.date)}</pubDate>`);
    if (a.desc) lines.push(`      <description>${xmlEscape(a.desc)}</description>`);
    lines.push(`    </item>`);
  }
  lines.push(`  </channel>`, `</rss>`, "");
  return lines.join("\n");
}

function main() {
  const pages = collectPages();

  if (process.argv.includes("--check")) {
    // Validate only — used by CI to fail the build on sitemap drift.
    const problems = verifyCoverage(pages);
    if (problems.length) {
      console.error("build-seo.js --check FAILED:");
      for (const p of problems) console.error("  - " + p);
      process.exit(1);
    }
    console.log(
      `build-seo.js --check: sitemap covers all ${pages.length} published pages.`
    );
    return;
  }

  fs.writeFileSync("sitemap.xml", buildSitemap(pages));
  fs.writeFileSync("feed.xml", buildFeed(pages));
  const articleCount = pages.filter((p) => p.isArticle).length;
  console.log(
    `build-seo.js: wrote sitemap.xml (${pages.length} URLs) and feed.xml (${articleCount} articles).`
  );
}

main();
