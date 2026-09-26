import type { AlphaTradeBundle, ReplayScenario } from "./types.js";

const bundle: AlphaTradeBundle = {
  id: "core-alpha-fx-001",
  version: "0.1.0-alpha.2",
  strategy: "Zugrio Core",
  instrument: "EURUSD",
  market: "FX",
  horizon: "Intraday",
  evidenceStatus: "VALIDATION_ONLY",
};

export const staleEntryScenario: ReplayScenario = {
  id: "replay-eurusd-stale-entry",
  title: "Retest holds; the available entry later goes stale",
  description: "A deterministic validation fixture following the frozen structural lifecycle. It preserves the original structural case while current-entry conditions change.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T08:00:00Z", price:1.1762, lifecycle:"CANDIDATE_IDENTIFIED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"A structural candidate is identified." },
    { timestamp:"2026-09-24T08:05:00Z", price:1.1768, lifecycle:"BREAK_CONFIRMED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The break is confirmed in the replay fixture." },
    { timestamp:"2026-09-24T08:10:00Z", price:1.1765, lifecycle:"RETEST_TOUCHED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"Price touches the replay retest area. Touch alone does not complete the lifecycle." },
    { timestamp:"2026-09-24T08:12:00Z", price:1.1764, lifecycle:"RETEST_HELD", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The replay retest holds. No model conviction or execution permission is created." },
    { timestamp:"2026-09-24T08:15:00Z", price:1.1771, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The frozen structural lifecycle is complete. This is STRUCTURAL READY, not model-scored READY." },
    { timestamp:"2026-09-24T08:17:00Z", price:1.1772, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:true, currentEntryStatus:"CURRENT", note:"A fixture-only entry event is observed. It is not an admitted ENTRY_EVENT_CONFIRMED predicate." },
    { timestamp:"2026-09-24T08:20:00Z", price:1.1784, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:true, currentEntryStatus:"STALE", note:"The original structural case remains recorded, but the entry available now is stale." },
    { timestamp:"2026-09-24T08:25:00Z", price:1.1792, lifecycle:"INVALIDATED", entryEventObserved:true, currentEntryStatus:"STALE", note:"The structural case is invalidated." }
  ]
};

export const currentEntryScenario: ReplayScenario = {
  id: "replay-eurusd-current-entry",
  title: "Retest holds; current entry remains available",
  description: "A second deterministic fixture using the same frozen structural lifecycle, with a fixture entry event whose current-entry conditions remain current.",
  bundle,
  frames: [
    { timestamp:"2026-09-24T09:00:00Z", price:1.1758, lifecycle:"CANDIDATE_IDENTIFIED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"A structural candidate is identified." },
    { timestamp:"2026-09-24T09:05:00Z", price:1.1764, lifecycle:"BREAK_CONFIRMED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The break is confirmed in the replay fixture." },
    { timestamp:"2026-09-24T09:10:00Z", price:1.1761, lifecycle:"RETEST_TOUCHED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The replay retest area is touched." },
    { timestamp:"2026-09-24T09:12:00Z", price:1.1760, lifecycle:"RETEST_HELD", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The replay retest holds." },
    { timestamp:"2026-09-24T09:15:00Z", price:1.1769, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:false, currentEntryStatus:"NOT_AVAILABLE", note:"The frozen structural lifecycle is complete." },
    { timestamp:"2026-09-24T09:17:00Z", price:1.1770, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:true, currentEntryStatus:"CURRENT", note:"A fixture-only entry event is observed and current-entry conditions remain current." },
    { timestamp:"2026-09-24T09:20:00Z", price:1.1772, lifecycle:"LIFECYCLE_CONFIRMED", entryEventObserved:true, currentEntryStatus:"CURRENT", note:"The fixture current-entry condition remains current." }
  ]
};

export const alphaScenarios = [staleEntryScenario, currentEntryScenario] as const;
