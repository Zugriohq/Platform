export type StructuralState =
  | "STRUCTURAL_CANDIDATE"
  | "STRUCTURAL_WATCH"
  | "STRUCTURAL_READY"
  | "INVALIDATED";

export type StructuralLifecycle =
  | "CANDIDATE_IDENTIFIED"
  | "BREAK_CONFIRMED"
  | "RETEST_TOUCHED"
  | "RETEST_HELD"
  | "LIFECYCLE_CONFIRMED"
  | "INVALIDATED";

export type CurrentEntryStatus = "NOT_AVAILABLE" | "CURRENT" | "STALE";

export type EvidenceField = "lifecycle" | "entryEventObserved" | "currentEntryStatus";
export type EvidenceValue = StructuralLifecycle | CurrentEntryStatus | boolean;

export interface EvidenceSnapshot {
  readonly timestamp: string;
  readonly price: number;
  readonly lifecycle: StructuralLifecycle;
  readonly entryEventObserved: boolean;
  readonly currentEntryStatus: CurrentEntryStatus;
  readonly note: string;
}

export interface AlphaTradeBundle {
  readonly id: string;
  readonly version: string;
  readonly strategy: "Zugrio Core";
  readonly instrument: string;
  readonly market: "FX";
  readonly horizon: "Intraday";
  readonly evidenceStatus: "VALIDATION_ONLY";
}

export interface EvidenceChange {
  readonly field: EvidenceField;
  readonly from: EvidenceValue;
  readonly to: EvidenceValue;
}

export interface DecisionEvent {
  readonly timestamp: string;
  readonly state: StructuralState;
  readonly reason: string;
  readonly entryReason: string;
  readonly price: number;
  readonly changes: readonly EvidenceChange[];
}

export interface DecisionCase {
  readonly caseId: string;
  readonly bundle: AlphaTradeBundle;
  readonly current: EvidenceSnapshot;
  readonly state: StructuralState;
  readonly reason: string;
  readonly entryReason: string;
  readonly history: readonly DecisionEvent[];
  readonly authority: "NO_LIVE_CAPITAL";
  readonly authorityClass: "STRUCTURAL_ONLY";
  readonly modelScored: false;
}

export interface ReplayScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bundle: AlphaTradeBundle;
  readonly frames: readonly EvidenceSnapshot[];
}
