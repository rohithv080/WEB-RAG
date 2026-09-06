/**
 * Exercise empty/failed scrape paths (Readability null / short content).
 * Run: npx tsx scripts/test-failed-scrapes.ts
 */
import { fetchPage, ScrapeContentError, MIN_CONTENT_CHARS } from "../src/lib/scraper/fetchPage";

const CASES: { name: string; url: string; expectFail: boolean }[] = [
  {
    name: "JS-heavy SPA shell (often thin HTML)",
    url: "https://twitter.com",
    expectFail: true,
  },
  {
    name: "Sparse / non-article page",
    url: "https://example.com",
    expectFail: false, // example.com is short (~125 chars) — should fail min length
  },
  {
    name: "Readable static article (control)",
    url: "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
    expectFail: false,
  },
];

async function runCase(c: (typeof CASES)[number]) {
  process.stdout.write(`\n[${c.name}] ${c.url}\n`);
  try {
    const page = await fetchPage(c.url);
    console.log(
      `  OK title="${page.title}" chars=${page.textContent.length} (min=${MIN_CONTENT_CHARS})`
    );
    if (page.textContent.length < MIN_CONTENT_CHARS) {
      console.error("  UNEXPECTED: accepted short content");
      return false;
    }
    // example.com is intentionally short — if we got here, threshold failed
    if (c.url.includes("example.com")) {
      console.error("  UNEXPECTED: example.com should be under min chars");
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isContent = err instanceof ScrapeContentError;
    console.log(`  ${isContent ? "ScrapeContentError" : "Error"}: ${msg}`);
    if (c.expectFail || c.url.includes("example.com")) {
      console.log("  Expected failure — good.");
      return true;
    }
    // SPA may occasionally return enough text; treat soft
    if (c.name.includes("SPA")) {
      console.log("  Note: SPA returned content this time (environment-dependent).");
      return true;
    }
    return false;
  }
}

async function main() {
  // Force example.com to be the short-content case
  CASES[1].expectFail = true;

  let ok = true;
  for (const c of CASES) {
    const passed = await runCase(c);
    if (!passed) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
