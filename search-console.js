#!/usr/bin/env node
/* ============================================================
   search-console.js — Search Console automation for Brainy Puzzles.

   Dependency-free (Node 18+ built-ins only: fetch, crypto, fs).

   IMPORTANT: Google's Indexing API can only be used for pages with
   JobPosting or BroadcastEvent structured data — it cannot index a
   puzzle site. There is also no API that clicks "Request Indexing"
   in the UI. What CAN be automated is:
     1. Submitting the sitemap  -> notifies Google of every URL at once
     2. URL Inspection          -> checks each page's crawl/index state
   This script does both, so new pages get inspected (and the sitemap
   re-submitted) automatically on every deploy.

   Credentials (never commit these):
     - Set SEARCH_CONSOLE_SA_JSON to the raw service-account JSON, or
     - Set GOOGLE_APPLICATION_CREDENTIALS to a file path, or
     - Pass --creds <path>.

   Usage:
     node search-console.js sitemap-submit [--site <property>]
     node search-console.js sitemap-list   [--site <property>]
     node search-console.js inspect <url> [<url> ...] [--site <property>]
     node search-console.js inspect-new [--base <git-ref>] [--site <property>]

   --site defaults to https://www.helpuhelpurself.com/  (the www
   property). If the Search Console property is sc-domain:... or the
   bare domain, pass --site accordingly.

   Setup (one-time, ~10 minutes):
     1. Enable the "Search Console API" in Google Cloud Console for a
        project (API Library -> Search Console API -> Enable).
     2. Create a service account (IAM -> Service Accounts -> Create),
        download the JSON key.
     3. In Search Console -> Settings -> Users and permissions, add the
        service account's email as a user (Full or Restricted).
     4. Add the JSON as a GitHub secret named SEARCH_CONSOLE_SA_JSON.
     The GitHub Action .github/workflows/search-console.yml then runs
     this on every push to main.
   ============================================================ */

"use strict";

const fs = require("fs");
const crypto = require("crypto");

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SITEMAPS_BASE = "https://www.googleapis.com/webmasters/v3";
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const SCOPE = "https://www.googleapis.com/auth/webmasters";
const DEFAULT_SITE = "https://www.helpuhelpurself.com/";
const DOMAIN = "https://www.helpuhelpurself.com";

/* ---------- tiny arg parsing ---------- */

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}
const command = args.find((a) => !a.startsWith("--"));
const site = flag("--site") || DEFAULT_SITE;
const credsPath = flag("--creds") || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
const baseRef = flag("--base");

/* ---------- credentials + OAuth2 (JWT bearer, no libraries) ---------- */

function b64u(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function loadCredentials() {
  if (process.env.SEARCH_CONSOLE_SA_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(process.env.SEARCH_CONSOLE_SA_JSON);
    } catch (e) {
      // Don't print the secret, but DO print the parse position + a hint:
      // it tells us whether the value is a partial paste or has stray text.
      const raw = process.env.SEARCH_CONSOLE_SA_JSON;
      const pos = /position (\d+)/.exec(e.message);
      const at = pos ? Number(pos[1]) : -1;
      // A real service-account key is ~2000+ chars; a short value means the
      // wrong thing was pasted. Show the start of the value (safe: it is not
      // the secret — it failed to parse) to identify what was pasted instead.
      const preview = JSON.stringify(raw.slice(0, 40));
      const hint = /Unexpected end of JSON input/.test(e.message)
        ? "value is truncated — it stops before the JSON is complete (length " + raw.length + "). Paste the ENTIRE contents of the key file."
        : at < 0
        ? "unrecognized parse error (" + e.message + "). value starts with " + preview + ". A service-account key is ~2000+ chars — a " + raw.length + "-char value is not the full key file."
        : at === 0
        ? "value does not start with { — it starts with " + preview + ". check for stray text before the JSON"
        : at >= raw.length - 1
        ? "value does not end with } — check for truncated or trailing text"
        : "parse stops partway through (len " + raw.length + ") — check for a partial paste or line breaks inside the JSON";
      throw new Error(
        "SEARCH_CONSOLE_SA_JSON is not valid JSON (parse error at position " + at + ", value length " + raw.length + "). " + hint
      );
    }
    const required = ["type", "project_id", "private_key", "client_email"];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length) {
      throw new Error("SEARCH_CONSOLE_SA_JSON is missing field(s): " + missing.join(", "));
    }
    if (parsed.type !== "service_account") {
      throw new Error("SEARCH_CONSOLE_SA_JSON type is \"" + parsed.type + "\" — expected \"service_account\" (is this the right key file?)");
    }
    if (typeof parsed.private_key !== "string" || !parsed.private_key.includes("PRIVATE KEY")) {
      throw new Error("SEARCH_CONSOLE_SA_JSON private_key does not look like a PEM key");
    }
    return parsed;
  }
  if (credsPath) {
    try {
      return JSON.parse(fs.readFileSync(credsPath, "utf8"));
    } catch (e) {
      throw new Error("Could not read credentials file " + credsPath + ": " + e.message);
    }
  }
  throw new Error(
    "No credentials found. Set SEARCH_CONSOLE_SA_JSON, set GOOGLE_APPLICATION_CREDENTIALS, or pass --creds <path>."
  );
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = header + "." + claims;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), crypto.createPrivateKey(sa.private_key));
  const jwt = signingInput + "." + b64u(signature);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" +
      encodeURIComponent(jwt),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error("OAuth token exchange failed: " + JSON.stringify(data));
  }
  return data.access_token;
}

async function apiCall(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  return { status: res.status, data };
}

/* ---------- commands ---------- */

async function sitemapSubmit(token, siteUrl) {
  // feedpath is the full sitemap URL (docs: "The URL of the sitemap to
  // add. For example: http://www.example.com/sitemap.xml"). A relative
  // "sitemap.xml" returns 400 "Could not process sitemap".
  const sitemapUrl = siteUrl.replace(/\/$/, "") + "/sitemap.xml";
  const u = SITEMAPS_BASE + "/sites/" + encodeURIComponent(siteUrl) + "/sitemaps/" + encodeURIComponent(sitemapUrl);
  const { status, data } = await apiCall(token, "PUT", u);
  if (status >= 200 && status < 300) {
    console.log("Sitemap submitted for " + siteUrl + " (HTTP " + status + ").");
    if (data && data.path) console.log("  path: " + data.path + " | lastSubmitted: " + data.lastSubmitted);
  } else {
    throw new Error("Sitemap submit failed (HTTP " + status + "): " + JSON.stringify(data));
  }
}

async function sitemapList(token, siteUrl) {
  const u = SITEMAPS_BASE + "/sites/" + encodeURIComponent(siteUrl) + "/sitemaps";
  const { status, data } = await apiCall(token, "GET", u);
  if (status !== 200) throw new Error("Sitemap list failed (HTTP " + status + "): " + JSON.stringify(data));
  const items = (data && data.sitemap) || [];
  if (!items.length) {
    console.log("No sitemaps submitted for " + siteUrl + ".");
    return;
  }
  console.log("Sitemaps for " + siteUrl + ":");
  const lines = [];
  for (const s of items) {
    const line = "  " + s.path + " | submitted: " + (s.lastSubmitted || "n/a") + " | errors: " + (s.errors || 0);
    console.log(line);
    lines.push(line.trim());
  }
  // Surface the status as an annotation so it shows in the run summary/API.
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("::notice::Sitemap status: " + lines.join(" ; "));
  }
}

function summarizeVerdict(inspectionResult) {
  const idx = inspectionResult.indexStatusResult || {};
  const parts = [
    "verdict: " + (inspectionResult.verdict || "n/a"),
    "coverage: " + (idx.coverageState || "n/a"),
    "indexing: " + (idx.indexingState || "n/a"),
    "pageFetch: " + (idx.pageFetchState || "n/a"),
    "robotsTxt: " + (idx.robotsTxtState || "n/a"),
    "lastCrawl: " + (idx.lastCrawlTime || "n/a"),
  ];
  if (idx.crawledAs) parts.push("crawledAs: " + idx.crawledAs);
  return parts.join(" | ");
}

async function inspectUrls(token, siteUrl, urls) {
  for (const url of urls) {
    const { status, data } = await apiCall(token, "POST", INSPECT_URL, {
      inspectionUrl: url,
      siteUrl,
    });
    if (status !== 200) {
      console.log("FAIL  " + url + "  (HTTP " + status + "): " + JSON.stringify(data));
      continue;
    }
    const r = data.inspectionResult || {};
    console.log((r.verdict === "PASS" ? "PASS  " : "INFO  ") + url + "  —  " + summarizeVerdict(r));
  }
}

function gitChangedHtmlUrls(base) {
  const { execFileSync } = require("child_process");
  let files;
  try {
    files = execFileSync("git", ["diff", "--name-only", base, "HEAD"], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith(".html"));
  } catch (e) {
    throw new Error("git diff failed: " + e.message);
  }
  const urls = [];
  for (const f of files) {
    if (f === "index.html") urls.push(DOMAIN + "/");
    else if (f.endsWith("/index.html")) urls.push(DOMAIN + "/" + f.replace(/\/index\.html$/, "/"));
    else urls.push(DOMAIN + "/" + f);
  }
  return urls;
}

/* ---------- main ---------- */

(async () => {
  if (!command) {
    console.log(
      "Usage:\n" +
        "  node search-console.js sitemap-submit [--site <property>]\n" +
        "  node search-console.js sitemap-list   [--site <property>]\n" +
        "  node search-console.js inspect <url> [<url> ...] [--site <property>]\n" +
        "  node search-console.js inspect-new [--base <git-ref>] [--site <property>]"
    );
    process.exit(1);
  }

  const sa = loadCredentials();
  const token = await getAccessToken(sa);

  if (command === "sitemap-submit") {
    await sitemapSubmit(token, site);
  } else if (command === "sitemap-list") {
    await sitemapList(token, site);
  } else if (command === "inspect") {
    const urls = args.filter((a) => a.startsWith("https://"));
    if (!urls.length) throw new Error("inspect needs at least one https:// URL");
    await inspectUrls(token, site, urls);
  } else if (command === "inspect-new") {
    if (!baseRef || /^0+$/.test(baseRef)) {
      console.log("No valid --base ref — skipping inspect-new (first push has nothing to diff against).");
    } else {
      const urls = gitChangedHtmlUrls(baseRef);
      if (!urls.length) {
        console.log("No HTML files changed since " + baseRef + " — nothing to inspect.");
      } else {
        console.log("Inspecting " + urls.length + " changed page(s) since " + baseRef + ":");
        await inspectUrls(token, site, urls);
      }
    }
  } else {
    throw new Error("Unknown command: " + command);
  }
})().then(() => {
  // Emit a notice so the run summary confirms what actually happened
  // (real API calls vs. skip) without needing the raw log.
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("::notice::search-console.js finished OK (exit 0)");
  }
}).catch((e) => {
  console.error("Error: " + e.message);
  // Emit a GitHub Actions workflow command too, so the failure reason
  // becomes a check-run annotation (visible in the API and the UI summary)
  // rather than only in the raw step log.
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log("::error::" + e.message.replace(/\n/g, "%0A"));
  }
  process.exit(1);
});
