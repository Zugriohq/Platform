// TTI 5.16 APA, lifted verbatim from the owner's TTI HTML: Wilder atr, TTI_FOUNDATION_REFERENCE, APA_CONFIG .. buildPlan.
// referenceEntryRouteStudy is research output the decision never reads; it is stubbed out for speed (as in apa_replay.mjs).
import fs from "fs";
import crypto from "crypto";
export function loadAPA(html) {
  const src = fs.readFileSync(html, "utf8");
  const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to, a); if (a < 0 || b < 0) throw new Error("marker not found: " + from); return src.slice(a, b); };
  const code = [
    cut("function atr(ca,p=14){", "\n}\n") + "\n}\n",
    cut("const TTI_FOUNDATION_REFERENCE=Object.freeze({", "if(typeof globalThis!=='undefined')globalThis.TTI_FOUNDATION_REFERENCE"),
    cut("const APA_CONFIG = {", "/* APA reuses the canonical family router"),
  ].join("\n")
    .replace("function referenceEntryRouteStudy(apa,candles,timeframe='M5',cfg=APA_CONFIG){", "function referenceEntryRouteStudy(apa,candles,timeframe='M5',cfg=APA_CONFIG){return null;")
    .replace("if(typeof globalThis!=='undefined')globalThis.referenceEntryRouteStudy=referenceEntryRouteStudy;", "");
  const api = new Function(code + "\nreturn { analyseAPA, buildPlan, swings, APA_CONFIG };")();
  return { ...api, version: api.APA_CONFIG.version, htmlSha256: crypto.createHash("sha256").update(src).digest("hex") };
}
