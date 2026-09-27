import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const main = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
const chart = fs.readFileSync(path.join(root, "src/CandlestickChart.jsx"), "utf8");

const failures = [];

function requireText(source, needle, message) {
  if (!source.includes(needle)) failures.push(message);
}

function forbidText(source, needle, message) {
  if (source.includes(needle)) failures.push(message);
}

requireText(css, "--max:1332px", "The landing page must keep the shared 1332px content rail.");
requireText(css, "white-space:nowrap", "Headline lines must stay locked to one visual line each.");
requireText(css, "position:absolute", "Rolling headline frames must stay out of document flow to prevent layout shift.");
requireText(css, "height:1.98em", "Desktop rolling headline viewport must keep a fixed optical height.");
requireText(
  css,
  ".hero-headline-window",
  "The hero must retain its clipped rolling-headline viewport."
);
requireText(
  app,
  'const HERO_HEADLINES = [',
  "The rolling hero headline set was removed."
);
requireText(
  app,
  '["Don’t trade the signal.", "Trade what’s still true."]',
  "The primary Zugrio hero claim changed or was removed."
);
requireText(
  app,
  '["Markets change.", "Your decision should too."]',
  "The secondary rolling hero claim changed or was removed."
);
requireText(app, "HERO_HEADLINES.map((headline, index)", "Both hero headline states must remain permanently mounted in the fixed overlay viewport.");
requireText(
  app,
  "setHeadlineIndex((current) => (current + 1) % HERO_HEADLINES.length)",
  "The hero headline rotation logic was removed."
);
requireText(
  app,
  '<span>DECISION QUALITY / THE POINT</span>',
  "The Decision Quality conclusion lost its structured transition label."
);
requireText(
  css,
  ".dq-close>strong",
  "The Decision Quality closing statement lost its canonical conclusion styling."
);
requireText(
  app,
  'aria-expanded={menu}',
  "The mobile navigation button must expose its expanded state."
);
requireText(
  css,
  "font-size:clamp(31px,9.8vw,40px)",
  "The mobile hero must retain the tested fluid type scale for 320–420px widths."
);

forbidText(app, "if (prefersReduced || !introComplete)", "Reduced-motion may remove the roll animation, but it must not freeze the headline content.");
forbidText(css, "WHOLE-PAGE INTEGRATION PASS", "Do not restore the deprecated late integration override layer.");
forbidText(css, "max-width:1380px", "A 1380px content rail would reintroduce section-edge drift.");
forbidText(css, "max-width:1340px", "A 1340px content rail would reintroduce section-edge drift.");
forbidText(css, "font-size:39px;line-height:.96", "Do not force the mobile hero to a fixed 39px size; it overflows narrow phones.");
forbidText(css, ".waitlist-stage:before{width:24%", "Do not freeze the old Early Access sweep as a short bright edge fragment.");
forbidText(css, "--max:1220px", "The old 1220px content rail must not return.");
forbidText(css, ".hero-headline-frame{align-items:flex-start}", "The mobile hero must not switch to left alignment.");
forbidText(css, "closingSilverPass 13.5s", "The Closing Signature must not restore the perpetual silver sweep.");
forbidText(css, "earlyAccessEdgePass 8.5s", "Early Access must not restore the perpetual edge sweep.");
forbidText(css, "readinessSweep 8.2s", "Readiness must not restore its perpetual sweep.");
forbidText(css, "dqAuditSweep 7.4s", "Decision Quality must not restore its perpetual sweep.");

// ── Legibility, contrast and focus contract ────────────────────────────────
// Every literal px font size must sit at or above the published type floor, so
// micro-labels cannot drift back to 6–9px through a late override.
const TYPE_FLOOR_PX = 11;
const tooSmall = new Set();
for (const m of css.matchAll(/(?:^|[;{\s])font-size:\s*([\d.]+)px/g)) {
  if (parseFloat(m[1]) < TYPE_FLOOR_PX) tooSmall.add(m[1] + "px");
}
for (const m of css.matchAll(/(?:^|[;{\s])font:\s*(?:\d{3}\s+)?([\d.]+)px/g)) {
  if (parseFloat(m[1]) < TYPE_FLOOR_PX) tooSmall.add(m[1] + "px (font shorthand)");
}
if (tooSmall.size) {
  failures.push(`Text below the ${TYPE_FLOOR_PX}px floor: ${[...tooSmall].join(", ")}. Use var(--fs-label) or var(--fs-meta).`);
}

// Text colours must keep WCAG AA contrast (4.5:1) on the lightest dark surface used (#10141a).
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => {
  const h = hex.length === 3 ? [...hex].map((x) => x + x).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const lowContrast = new Set();
for (const m of css.matchAll(/(?:^|[;{\s])(?:color|fill):\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
  const hex = m[1];
  if (lum(hex) < 0.02) continue; // dark ink on a light control
  const selector = css.slice(css.lastIndexOf("}", m.index) + 1, css.lastIndexOf("{", m.index)).trim();
  if (/candle-body/.test(selector)) continue; // chart glyph, not text
  if (contrast(hex, "10141a") < 4.5) lowContrast.add("#" + hex);
}
if (lowContrast.size) {
  failures.push(`Text colours below 4.5:1 contrast: ${[...lowContrast].join(", ")}. Use --muted, --subtle or --state-muted.`);
}

requireText(css, "--fs-label:11px", "The 11px label token is the type floor for uppercase/tracked metadata.");
requireText(css, "--fs-meta:12px", "The 12px meta token is the type floor for running secondary text.");
requireText(css, "--ring:", "The shared focus-ring token was removed.");
requireText(css, ":focus-visible{outline:2px solid", "The global keyboard focus outline was removed.");
forbidText(css, "0 0 0 3px rgba(232,237,241,.0", "Do not restore the near-invisible 3px/5–9% focus halo.");
requireText(css, "max-width:1180px;margin:30px auto 24px", "The hero headline measure must stay wide enough for Inter's metrics.");
requireText(main, "@fontsource-variable/inter", "Inter must be bundled; the type system assumes its metrics.");
forbidText(chart, "const W = 820;", "The chart must draw in real pixels; a fixed 820px viewBox shrinks its labels on phones.");

if (failures.length) {
  console.error("\nVisual integrity check failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Visual integrity check passed.");
