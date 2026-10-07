// Builds dist/zugrio-engine.js (decision-core + bridge) for the cTrader EA.
// `--check` rebuilds in memory and fails if the committed bundle is stale.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "dist", "zugrio-engine.js");
const result = await build({
  entryPoints: [join(here, "src", "bridge.ts")],
  bundle: true, format: "iife", platform: "neutral", target: "es2020",
  mainFields: ["module", "main"], inject: [join(here, "src", "structured-clone-polyfill.js")],
  legalComments: "none", write: false, logLevel: "warning",
});
const code = result.outputFiles[0].text;
const sha = createHash("sha256").update(code).digest("hex");
if (process.argv.includes("--check")) {
  let committed = "";
  try { committed = readFileSync(out, "utf8"); } catch { /* missing */ }
  if (committed !== code) { console.error("dist/zugrio-engine.js is stale: run `pnpm --filter @zugrio/ctrader-engine-bridge build`"); process.exit(1); }
  console.log("zugrio-engine.js up to date, sha256 " + sha);
} else {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, code);
  writeFileSync(out + ".sha256", `${sha}  zugrio-engine.js\n`);
  console.log("wrote dist/zugrio-engine.js, sha256 " + sha);
}
