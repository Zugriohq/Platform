import type { AlphaTradeBundle, ReplayScenario } from "./types.js";

const bundle: AlphaTradeBundle = {
  id: "core-alpha-fx-001",
  version: "0.1.0-alpha.1",
  strategy: "Zugrio Core",
  instrument: "EURUSD",
  market: "FX",
  horizon: "Intraday",
  evidenceStatus: "VALIDATION_ONLY",
};

export const staleEntryScenario: ReplayScenario = {
  id: "replay-eurusd-stale-entry",
  title: "Retest qualifies, entry later goes stale",
  description: "A deterministic validation fixture showing that Zugrio can preserve a retest observation without treating it as permission, then recheck a later trigger against current conditions.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T08:00:00Z", price:1.1762, setupQualified:false, locationQualified:false, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Structure is forming." },
    { timestamp:"2026-09-24T08:05:00Z", price:1.1768, setupQualified:true, locationQualified:false, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Setup evidence appears." },
    { timestamp:"2026-09-24T08:10:00Z", price:1.1765, setupQualified:true, locationQualified:true, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Required location is reached; the case is ready for further entry evidence." },
    { timestamp:"2026-09-24T08:12:00Z", price:1.1764, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"A retest observation is recorded while the case remains READY. Retest alone is not permission." },
    { timestamp:"2026-09-24T08:15:00Z", price:1.1771, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"A separate entry trigger qualifies after the retest." },
    { timestamp:"2026-09-24T08:20:00Z", price:1.1784, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:true, currentConditionsValid:false, invalidated:false, note:"Price/economics moved. The historical trigger remains on record, but the current entry is now stale." },
    { timestamp:"2026-09-24T08:25:00Z", price:1.1792, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:true, currentConditionsValid:false, invalidated:true, note:"The replay case is now invalidated." }
  ]
};

export const validEntryScenario: ReplayScenario = {
  id: "replay-eurusd-current-entry",
  title: "Retest and trigger remain current",
  description: "A second deterministic fixture showing the same retest-to-trigger lifecycle when the current-condition recheck remains valid.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T09:00:00Z", price:1.1758, setupQualified:false, locationQualified:false, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Structure is forming." },
    { timestamp:"2026-09-24T09:05:00Z", price:1.1764, setupQualified:true, locationQualified:false, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Setup evidence appears." },
    { timestamp:"2026-09-24T09:10:00Z", price:1.1761, setupQualified:true, locationQualified:true, retestObserved:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Required location is reached." },
    { timestamp:"2026-09-24T09:12:00Z", price:1.1760, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"The retest is observed while the case remains READY." },
    { timestamp:"2026-09-24T09:15:00Z", price:1.1769, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"The separate trigger and current conditions qualify together." },
    { timestamp:"2026-09-24T09:20:00Z", price:1.1772, setupQualified:true, locationQualified:true, retestObserved:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"Current conditions still qualify." }
  ]
};

export const alphaScenarios = [staleEntryScenario, validEntryScenario] as const;
