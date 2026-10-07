// Renders scripts/og-card.html to public/brand/zugrio-og-card.png (1200x630).
// Needs a Chromium and playwright-core (not a project dependency):
//   PLAYWRIGHT_CHROMIUM=/path/to/chrome node scripts/build-og-card.mjs
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "public", "brand", "zugrio-og-card.png");

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
  args: ["--no-sandbox", "--allow-file-access-from-files"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(here, "og-card.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log("wrote", out);
