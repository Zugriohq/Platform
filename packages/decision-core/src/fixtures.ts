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
  title: "Signal becomes stale before action",
  description: "A deterministic product fixture showing why Zugrio rechecks current conditions instead of treating an earlier trigger as permanent permission.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T08:00:00Z", price:1.1762, setupQualified:false, locationQualified:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Structure is forming." },
    { timestamp:"2026-09-24T08:05:00Z", price:1.1768, setupQualified:true, locationQualified:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Setup evidence appears." },
    { timestamp:"2026-09-24T08:10:00Z", price:1.1765, setupQualified:true, locationQualified:true, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Required location is reached." },
    { timestamp:"2026-09-24T08:15:00Z", price:1.1771, setupQualified:true, locationQualified:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"Trigger qualifies in the replay." },
    { timestamp:"2026-09-24T08:20:00Z", price:1.1784, setupQualified:true, locationQualified:true, triggerQualified:true, currentConditionsValid:false, invalidated:false, note:"Price/economics moved; the prior trigger is stale." },
    { timestamp:"2026-09-24T08:25:00Z", price:1.1792, setupQualified:true, locationQualified:true, triggerQualified:true, currentConditionsValid:false, invalidated:true, note:"The replay case is now invalidated." }
  ]
};

export const validEntryScenario: ReplayScenario = {
  id: "replay-eurusd-current-entry",
  title: "Current conditions remain valid",
  description: "A second deterministic fixture showing the same case lifecycle when the trigger remains current.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T09:00:00Z", price:1.1758, setupQualified:false, locationQualified:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Structure is forming." },
    { timestamp:"2026-09-24T09:05:00Z", price:1.1764, setupQualified:true, locationQualified:false, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Setup evidence appears." },
    { timestamp:"2026-09-24T09:10:00Z", price:1.1761, setupQualified:true, locationQualified:true, triggerQualified:false, currentConditionsValid:true, invalidated:false, note:"Required location is reached." },
    { timestamp:"2026-09-24T09:15:00Z", price:1.1769, setupQualified:true, locationQualified:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"Trigger and current conditions qualify together." },
    { timestamp:"2026-09-24T09:20:00Z", price:1.1772, setupQualified:true, locationQualified:true, triggerQualified:true, currentConditionsValid:true, invalidated:false, note:"Current conditions still qualify." }
  ]
};

export const alphaScenarios = [staleEntryScenario, validEntryScenario] as const;
