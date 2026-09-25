import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const css = fs.readFileSync(path.join(root, "src/styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");

const failures = [];

function requireText(source, needle, message) {
  if (!source.includes(needle)) failures.push(message);
}

function forbidText(source, needle, message) {
  if (source.includes(needle)) failures.push(message);
}

requireText(css, "--max:1332px", "The landing page must keep the shared 1332px content rail.");
requireText(
  css,
  ".hero-headline-frame{grid-area:1/1;display:flex;flex-direction:column;align-items:center",
  "The hero headline must remain a deliberate centered two-line composition."
);
requireText(
  app,
  'const HERO_HEADLINE = ["Don’t trade the signal.", "Trade what’s still true."];',
  "The approved static hero claim changed or was removed."
);
requireText(
  app,
  'aria-expanded={menu}',
  "The mobile navigation button must expose its expanded state."
);
requireText(
  css,
  "font-size:clamp(31px,10.2vw,40px)",
  "The mobile hero must retain the tested fluid type scale for 320–420px widths."
);

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

if (failures.length) {
  console.error("\nVisual integrity check failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Visual integrity check passed.");
