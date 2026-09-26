import type { BundleIdentity } from "@zugrio/domain";

export type EligibilityStatus = "ELIGIBLE" | "INELIGIBLE" | "INVALIDATED";

export type StructuralState =
  | "STRUCTURAL_CANDIDATE"
  | "STRUCTURAL_WATCH"
  | "STRUCTURAL_READY";

export type StructuralLifecycle =
  | "CANDIDATE_IDENTIFIED"
  | "BREAK_CONFIRMED"
  | "RETEST_TOUCHED"
  | "RETEST_HELD"
  | "LIFECYCLE_CONFIRMED";

export type RegimeStatus = "AVAILABLE" | "UNAVAILABLE" | "UNCERTAIN";
export type CurrentEntryStatus = "NOT_AVAILABLE" | "CURRENT" | "STALE";
export type DecisionOutcome = "WAIT" | "PASS" | "CURRENT_FIXTURE_ENTRY";

export type EvidenceKind =
  | "ELIGIBILITY"
  | "LIFECYCLE"
  | "REGIME_STATUS"
  | "ENTRY_EVENT_OBSERVED"
  | "CURRENT_ENTRY_STATUS"
  | "PRICE"
  | "NOTE";

export type EvidenceValue =
  | EligibilityStatus
  | StructuralLifecycle
  | RegimeStatus
  | CurrentEntryStatus
  | boolean
  | number
  | string;

export interface EvidenceEvent {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly knownAt: string;
  readonly value: EvidenceValue;
  readonly source: "REPLAY_FIXTURE";
}

export interface ReplayFrame {
  readonly evaluatedAt: string;
}

export interface AlphaTradeBundle {
  readonly identity: BundleIdentity;
  readonly strategy: "Zugrio Core";
  readonly evidenceStatus: "VALIDATION_ONLY";
  readonly authoritySpecVersion: "1.0.2";
}

export interface EvidenceProvenance {
  readonly evidenceId: string;
  readonly knownAt: string;
}

export interface EvidenceSnapshot {
  readonly evaluatedAt: string;
  readonly eligibility: EligibilityStatus;
  readonly lifecycle: StructuralLifecycle | null;
  readonly regimeStatus: RegimeStatus;
  readonly entryEventObserved: boolean;
  readonly currentEntryStatus: CurrentEntryStatus;
  readonly price: number | null;
  readonly note: string;
  readonly evidenceIds: readonly string[];
  readonly evidenceRefs: Readonly<Partial<Record<EvidenceKind, EvidenceProvenance>>>;
}

export interface EvidenceChange {
  readonly field:
    | "eligibility"
    | "lifecycle"
    | "regimeStatus"
    | "entryEventObserved"
    | "currentEntryStatus";
  readonly from: EvidenceValue | null;
  readonly to: EvidenceValue | null;
}

export interface ChartAnnotation {
  readonly id: string;
  readonly kind: "STRUCTURAL_LIFECYCLE" | "ENTRY_STATUS";
  readonly label: string;
  readonly knownAt: string;
  readonly evidenceId: string;
}

export interface DecisionEvent {
  readonly evaluationId: string;
  readonly evaluatedAt: string;
  readonly structuralState: StructuralState | null;
  readonly outcome: DecisionOutcome;
  readonly stateReason: string;
  readonly outcomeReason: string;
  readonly changes: readonly EvidenceChange[];
  readonly annotationIds: readonly string[];
}

export interface DecisionCase {
  readonly caseId: string;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly evaluationId: string;
  readonly bundle: AlphaTradeBundle;
  readonly current: EvidenceSnapshot;
  readonly structuralState: StructuralState | null;
  readonly outcome: DecisionOutcome;
  readonly stateReason: string;
  readonly outcomeReason: string;
  readonly annotations: readonly ChartAnnotation[];
  readonly history: readonly DecisionEvent[];
  readonly authority: "NO_LIVE_CAPITAL";
  readonly authorityClass: "STRUCTURAL_ONLY";
  readonly modelScored: false;
}

export interface ReplayScenario {
  readonly id: string;
  readonly version: string;
  readonly caseId: string;
  readonly title: string;
  readonly description: string;
  readonly bundle: AlphaTradeBundle;
  readonly evidence: readonly EvidenceEvent[];
  readonly frames: readonly ReplayFrame[];
}
