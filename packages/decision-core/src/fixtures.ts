import type { BundleIdentity } from "@zugrio/domain";
import type { AlphaTradeBundle, EvidenceEvent, ReplayFrame, ReplayScenario } from "./types.js";
import { createDerivedStructuralReplayScenario } from "./research/derivedStructuralReplay.js";

const identity: BundleIdentity = {
  methodProfile: { kind: "METHOD_PROFILE", id: "zugrio-core-fixture", version: "0.1.0-alpha.2" },
  tradeBundle: { kind: "TRADE_BUNDLE", id: "core-fx-intraday-fixture", version: "0.1.0-alpha.2" },
  regimeModel: { kind: "REGIME_MODEL", id: "fixture-regime", version: "0.1.0-alpha.2" },
  timeframeMap: { kind: "TIMEFRAME_MAP", id: "fixture-intraday-map", version: "0.1.0-alpha.2" },
  scope: {
    market: "FX",
    instrument: "EURUSD",
    horizon: "Intraday",
    admission: "NON_ADMITTED_FIXTURE",
    liveData: false,
    liveCapital: false,
  },
};

const bundle: AlphaTradeBundle = {
  identity,
  strategy: "Zugrio Core",
  evidenceStatus: "VALIDATION_ONLY",
  authoritySpecVersion: "1.0.2",
};

function event(id: string, kind: EvidenceEvent["kind"], knownAt: string, value: EvidenceEvent["value"]): EvidenceEvent {
  return { id, kind, knownAt, value, source: "REPLAY_FIXTURE" };
}

function frame(evaluatedAt: string): ReplayFrame {
  return { evaluatedAt };
}

export const staleEntryScenario: ReplayScenario = {
  id: "replay-eurusd-stale-entry",
  version: "0.1.0-alpha.2",
  caseId: "case-alpha-eurusd-stale-001",
  title: "Retest holds; the available entry later goes stale",
  description: "A deterministic point-in-time fixture following the frozen structural lifecycle while current-entry conditions change independently.",
  bundle,
  evidence: [
    event("eligibility-0800","ELIGIBILITY","2026-09-24T08:00:00Z","ELIGIBLE"),
    event("regime-0800","REGIME_STATUS","2026-09-24T08:00:00Z","AVAILABLE"),
    event("lifecycle-0800","LIFECYCLE","2026-09-24T08:00:00Z","CANDIDATE_IDENTIFIED"),
    event("price-0800","PRICE","2026-09-24T08:00:00Z",1.1762),
    event("note-0800","NOTE","2026-09-24T08:00:00Z","A structural candidate is identified."),
    event("lifecycle-0805","LIFECYCLE","2026-09-24T08:05:00Z","BREAK_CONFIRMED"),
    event("price-0805","PRICE","2026-09-24T08:05:00Z",1.1768),
    event("note-0805","NOTE","2026-09-24T08:05:00Z","The break is confirmed in the replay fixture."),
    event("lifecycle-0810","LIFECYCLE","2026-09-24T08:10:00Z","RETEST_TOUCHED"),
    event("price-0810","PRICE","2026-09-24T08:10:00Z",1.1765),
    event("note-0810","NOTE","2026-09-24T08:10:00Z","Price touches the replay retest area."),
    event("lifecycle-0812","LIFECYCLE","2026-09-24T08:12:00Z","RETEST_HELD"),
    event("price-0812","PRICE","2026-09-24T08:12:00Z",1.1764),
    event("note-0812","NOTE","2026-09-24T08:12:00Z","The replay retest holds. No model conviction or execution permission is created."),
    event("lifecycle-0815","LIFECYCLE","2026-09-24T08:15:00Z","LIFECYCLE_CONFIRMED"),
    event("price-0815","PRICE","2026-09-24T08:15:00Z",1.1771),
    event("note-0815","NOTE","2026-09-24T08:15:00Z","The frozen structural lifecycle is complete."),
    event("entry-event-0817","ENTRY_EVENT_OBSERVED","2026-09-24T08:17:00Z",true),
    event("entry-status-0817","CURRENT_ENTRY_STATUS","2026-09-24T08:17:00Z","CURRENT"),
    event("price-0817","PRICE","2026-09-24T08:17:00Z",1.1772),
    event("note-0817","NOTE","2026-09-24T08:17:00Z","A fixture-only entry event is observed. It is not an admitted ENTRY_EVENT_CONFIRMED predicate."),
    event("entry-status-0820","CURRENT_ENTRY_STATUS","2026-09-24T08:20:00Z","STALE"),
    event("price-0820","PRICE","2026-09-24T08:20:00Z",1.1784),
    event("note-0820","NOTE","2026-09-24T08:20:00Z","The original structural case remains recorded, but the currently available entry is stale."),
    event("eligibility-0825","ELIGIBILITY","2026-09-24T08:25:00Z","INVALIDATED"),
    event("price-0825","PRICE","2026-09-24T08:25:00Z",1.1792),
    event("note-0825","NOTE","2026-09-24T08:25:00Z","The structural case is invalidated.")
  ],
  frames: [
    frame("2026-09-24T08:00:00Z"),
    frame("2026-09-24T08:05:00Z"),
    frame("2026-09-24T08:10:00Z"),
    frame("2026-09-24T08:12:00Z"),
    frame("2026-09-24T08:15:00Z"),
    frame("2026-09-24T08:17:00Z"),
    frame("2026-09-24T08:20:00Z"),
    frame("2026-09-24T08:25:00Z")
  ]
};

export const currentEntryScenario: ReplayScenario = {
  id: "replay-eurusd-current-entry",
  version: "0.1.0-alpha.2",
  caseId: "case-alpha-eurusd-current-001",
  title: "Retest holds; current entry remains available",
  description: "A second deterministic point-in-time fixture using the same structural lifecycle while the fixture current-entry condition remains current.",
  bundle,
  evidence: [
    event("eligibility-0900","ELIGIBILITY","2026-09-24T09:00:00Z","ELIGIBLE"),
    event("regime-0900","REGIME_STATUS","2026-09-24T09:00:00Z","AVAILABLE"),
    event("lifecycle-0900","LIFECYCLE","2026-09-24T09:00:00Z","CANDIDATE_IDENTIFIED"),
    event("price-0900","PRICE","2026-09-24T09:00:00Z",1.1758),
    event("note-0900","NOTE","2026-09-24T09:00:00Z","A structural candidate is identified."),
    event("lifecycle-0905","LIFECYCLE","2026-09-24T09:05:00Z","BREAK_CONFIRMED"),
    event("price-0905","PRICE","2026-09-24T09:05:00Z",1.1764),
    event("lifecycle-0910","LIFECYCLE","2026-09-24T09:10:00Z","RETEST_TOUCHED"),
    event("price-0910","PRICE","2026-09-24T09:10:00Z",1.1761),
    event("lifecycle-0912","LIFECYCLE","2026-09-24T09:12:00Z","RETEST_HELD"),
    event("price-0912","PRICE","2026-09-24T09:12:00Z",1.1760),
    event("lifecycle-0915","LIFECYCLE","2026-09-24T09:15:00Z","LIFECYCLE_CONFIRMED"),
    event("price-0915","PRICE","2026-09-24T09:15:00Z",1.1769),
    event("entry-event-0917","ENTRY_EVENT_OBSERVED","2026-09-24T09:17:00Z",true),
    event("entry-status-0917","CURRENT_ENTRY_STATUS","2026-09-24T09:17:00Z","CURRENT"),
    event("price-0917","PRICE","2026-09-24T09:17:00Z",1.1770),
    event("note-0917","NOTE","2026-09-24T09:17:00Z","A fixture-only entry event is current."),
    event("price-0920","PRICE","2026-09-24T09:20:00Z",1.1772),
    event("note-0920","NOTE","2026-09-24T09:20:00Z","The fixture current-entry condition remains current.")
  ],
  frames: [
    frame("2026-09-24T09:00:00Z"),
    frame("2026-09-24T09:05:00Z"),
    frame("2026-09-24T09:10:00Z"),
    frame("2026-09-24T09:12:00Z"),
    frame("2026-09-24T09:15:00Z"),
    frame("2026-09-24T09:17:00Z"),
    frame("2026-09-24T09:20:00Z")
  ]
};

export const noSetupScenario: ReplayScenario = {
  id: "replay-eurusd-no-setup",
  version: "0.1.0-alpha.2",
  caseId: "case-alpha-eurusd-pass-001",
  title: "No qualifying structural setup",
  description: "A fail-closed fixture proving PASS is an outcome, not an opportunity state.",
  bundle,
  evidence: [
    event("eligibility-1000","ELIGIBILITY","2026-09-24T10:00:00Z","INELIGIBLE"),
    event("regime-1000","REGIME_STATUS","2026-09-24T10:00:00Z","AVAILABLE"),
    event("price-1000","PRICE","2026-09-24T10:00:00Z",1.1760),
    event("note-1000","NOTE","2026-09-24T10:00:00Z","Fixture evidence does not qualify a structural candidate.")
  ],
  frames: [frame("2026-09-24T10:00:00Z")]
};

export const regimeUnavailableScenario: ReplayScenario = {
  id: "replay-eurusd-regime-unavailable",
  version: "0.1.0-alpha.2",
  caseId: "case-alpha-eurusd-regime-pass-001",
  title: "Regime unavailable at evaluation time",
  description: "A fail-closed point-in-time fixture for unavailable regime evidence.",
  bundle,
  evidence: [
    event("eligibility-1100","ELIGIBILITY","2026-09-24T11:00:00Z","ELIGIBLE"),
    event("regime-1100","REGIME_STATUS","2026-09-24T11:00:00Z","UNAVAILABLE"),
    event("lifecycle-1100","LIFECYCLE","2026-09-24T11:00:00Z","CANDIDATE_IDENTIFIED"),
    event("price-1100","PRICE","2026-09-24T11:00:00Z",1.1760),
    event("note-1100","NOTE","2026-09-24T11:00:00Z","Required regime evidence is unavailable.")
  ],
  frames: [frame("2026-09-24T11:00:00Z")]
};

export const derivedStructuralScenario = createDerivedStructuralReplayScenario(bundle);

export const alphaScenarios = [
  derivedStructuralScenario,
  staleEntryScenario,
  currentEntryScenario,
  noSetupScenario,
  regimeUnavailableScenario,
] as const;
