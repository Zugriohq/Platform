import { bundleIdentityKey } from "@zugrio/domain";
import type {
  ChartAnnotation,
  CurrentEntryStatus,
  DecisionCase,
  DecisionEvent,
  DecisionOutcome,
  EvidenceChange,
  EvidenceEvent,
  EvidenceKind,
  EvidenceProvenance,
  EvidenceSnapshot,
  EligibilityStatus,
  RegimeStatus,
  ReplayScenario,
  StructuralLifecycle,
  StructuralState,
} from "./types.js";

function epoch(iso: string): number {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) throw new Error(`invalid ISO timestamp: ${iso}`);
  return value;
}

function latest<T>(
  events: readonly EvidenceEvent[],
  kind: EvidenceKind,
  evaluatedAt: string,
  fallback: T,
): { value: T; evidenceId?: string; knownAt?: string } {
  const cutoff = epoch(evaluatedAt);
  const matching = events
    .filter((event) => event.kind === kind && epoch(event.knownAt) <= cutoff)
    .sort((a, b) => epoch(a.knownAt) - epoch(b.knownAt));

  const event = matching.at(-1);
  if (!event) return { value: fallback };
  return { value: event.value as T, evidenceId: event.id, knownAt: event.knownAt };
}

export function snapshotAt(scenario: ReplayScenario, evaluatedAt: string): EvidenceSnapshot {
  const eligibility = latest<EligibilityStatus>(scenario.evidence, "ELIGIBILITY", evaluatedAt, "INELIGIBLE");
  const lifecycle = latest<StructuralLifecycle | null>(scenario.evidence, "LIFECYCLE", evaluatedAt, null);
  const regime = latest<RegimeStatus>(scenario.evidence, "REGIME_STATUS", evaluatedAt, "UNAVAILABLE");
  const entry = latest<boolean>(scenario.evidence, "ENTRY_EVENT_OBSERVED", evaluatedAt, false);
  const currentEntry = latest<CurrentEntryStatus>(scenario.evidence, "CURRENT_ENTRY_STATUS", evaluatedAt, "NOT_AVAILABLE");
  const price = latest<number | null>(scenario.evidence, "PRICE", evaluatedAt, null);
  const note = latest<string>(scenario.evidence, "NOTE", evaluatedAt, "");

  const evidenceIds = [
    eligibility.evidenceId,
    lifecycle.evidenceId,
    regime.evidenceId,
    entry.evidenceId,
    currentEntry.evidenceId,
    price.evidenceId,
    note.evidenceId,
  ].filter((id): id is string => Boolean(id));

  const evidenceRefs: Partial<Record<EvidenceKind, EvidenceProvenance>> = {};
  const bind = (
    kind: EvidenceKind,
    resolved: { evidenceId?: string; knownAt?: string },
  ): void => {
    if (resolved.evidenceId && resolved.knownAt) {
      evidenceRefs[kind] = {
        evidenceId: resolved.evidenceId,
        knownAt: resolved.knownAt,
      };
    }
  };

  bind("ELIGIBILITY", eligibility);
  bind("LIFECYCLE", lifecycle);
  bind("REGIME_STATUS", regime);
  bind("ENTRY_EVENT_OBSERVED", entry);
  bind("CURRENT_ENTRY_STATUS", currentEntry);
  bind("PRICE", price);
  bind("NOTE", note);

  return {
    evaluatedAt,
    eligibility: eligibility.value,
    lifecycle: lifecycle.value,
    regimeStatus: regime.value,
    entryEventObserved: entry.value,
    currentEntryStatus: currentEntry.value,
    price: price.value,
    note: note.value,
    evidenceIds,
    evidenceRefs,
  };
}

function structuralState(snapshot: EvidenceSnapshot): { state: StructuralState | null; reason: string } {
  if (snapshot.eligibility !== "ELIGIBLE") {
    return { state: null, reason: `Layer-1 fixture eligibility is ${snapshot.eligibility}; no structural opportunity state is emitted.` };
  }
  if (snapshot.regimeStatus !== "AVAILABLE") {
    return { state: null, reason: "Point-in-time fixture regime is not available; structural progression fails closed." };
  }
  switch (snapshot.lifecycle) {
    case "LIFECYCLE_CONFIRMED":
      return {
        state: "STRUCTURAL_READY",
        reason: "Valid structure and trade geometry. No validated pWin/EV is available for this setup.",
      };
    case "BREAK_CONFIRMED":
    case "RETEST_TOUCHED":
    case "RETEST_HELD":
      return {
        state: "STRUCTURAL_WATCH",
        reason: "The structural lifecycle is active, but it is not yet structurally complete.",
      };
    case "CANDIDATE_IDENTIFIED":
      return {
        state: "STRUCTURAL_CANDIDATE",
        reason: "A structural candidate is identified; the frozen lifecycle has not yet confirmed the break.",
      };
    case null:
      return { state: null, reason: "Required point-in-time lifecycle evidence is unavailable." };
  }
}

function decisionOutcome(snapshot: EvidenceSnapshot): { outcome: DecisionOutcome; reason: string } {
  if (snapshot.eligibility !== "ELIGIBLE") {
    return { outcome: "PASS", reason: `PASS: fixture eligibility is ${snapshot.eligibility}.` };
  }
  if (snapshot.regimeStatus !== "AVAILABLE") {
    return { outcome: "PASS", reason: `PASS: point-in-time regime is ${snapshot.regimeStatus}.` };
  }
  if (snapshot.currentEntryStatus === "STALE") {
    return {
      outcome: "PASS",
      reason: "PASS: the historical fixture entry remains recorded, but current-entry conditions are stale. Structural state is preserved.",
    };
  }
  if (snapshot.entryEventObserved && snapshot.currentEntryStatus === "CURRENT") {
    return {
      outcome: "CURRENT_FIXTURE_ENTRY",
      reason: "A fixture entry event is current. It is not an admitted ENTRY_EVENT_CONFIRMED predicate and grants no trading permission.",
    };
  }
  return { outcome: "WAIT", reason: "No current fixture entry is available at this evaluation time." };
}

function evaluationId(scenario: ReplayScenario, evaluatedAt: string): string {
  return [
    scenario.caseId,
    scenario.id,
    scenario.version,
    bundleIdentityKey(scenario.bundle.identity),
    evaluatedAt,
  ].join("::");
}

function annotations(snapshot: EvidenceSnapshot): ChartAnnotation[] {
  const result: ChartAnnotation[] = [];
  const lifecycleEvidence = snapshot.evidenceRefs.LIFECYCLE;
  if (snapshot.lifecycle && lifecycleEvidence) {
    result.push({
      id: `annotation:${lifecycleEvidence.evidenceId}`,
      kind: "STRUCTURAL_LIFECYCLE",
      label: snapshot.lifecycle.replaceAll("_", " "),
      knownAt: lifecycleEvidence.knownAt,
      evidenceId: lifecycleEvidence.evidenceId,
    });
  }

  const entryEvidence = snapshot.evidenceRefs.CURRENT_ENTRY_STATUS;
  if (entryEvidence && snapshot.currentEntryStatus !== "NOT_AVAILABLE") {
    result.push({
      id: `annotation:${entryEvidence.evidenceId}`,
      kind: "ENTRY_STATUS",
      label: `ENTRY ${snapshot.currentEntryStatus}`,
      knownAt: entryEvidence.knownAt,
      evidenceId: entryEvidence.evidenceId,
    });
  }

  return result;
}

function changes(previous: EvidenceSnapshot | undefined, current: EvidenceSnapshot): EvidenceChange[] {
  if (!previous) return [];
  const fields: readonly EvidenceChange["field"][] = [
    "eligibility",
    "lifecycle",
    "regimeStatus",
    "entryEventObserved",
    "currentEntryStatus",
  ];
  return fields.flatMap((field) =>
    previous[field] === current[field]
      ? []
      : [{ field, from: previous[field], to: current[field] }],
  );
}

export function evaluateAt(scenario: ReplayScenario, evaluatedAt: string) {
  const current = snapshotAt(scenario, evaluatedAt);
  const state = structuralState(current);
  const result = decisionOutcome(current);
  const derivedAnnotations = annotations(current);
  return {
    evaluationId: evaluationId(scenario, evaluatedAt),
    current,
    structuralState: state.state,
    stateReason: state.reason,
    outcome: result.outcome,
    outcomeReason: result.reason,
    annotations: derivedAnnotations,
  } as const;
}

export function buildDecisionCase(scenario: ReplayScenario, frameIndex: number): DecisionCase {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= scenario.frames.length) {
    throw new RangeError("frameIndex is outside the replay scenario");
  }

  const history: DecisionEvent[] = [];
  let previous: EvidenceSnapshot | undefined;

  for (let index = 0; index <= frameIndex; index += 1) {
    const frame = scenario.frames[index];
    if (!frame) throw new Error("replay frame missing");
    const evaluation = evaluateAt(scenario, frame.evaluatedAt);
    const delta = changes(previous, evaluation.current);
    const isCurrentFrame = index === frameIndex;
    const previousEvent = history.at(-1);
    const materiallyChanged =
      delta.length > 0 ||
      previousEvent?.structuralState !== evaluation.structuralState ||
      previousEvent?.outcome !== evaluation.outcome;

    if (materiallyChanged || isCurrentFrame || history.length === 0) {
      history.push({
        evaluationId: evaluation.evaluationId,
        evaluatedAt: frame.evaluatedAt,
        structuralState: evaluation.structuralState,
        outcome: evaluation.outcome,
        stateReason: evaluation.stateReason,
        outcomeReason: evaluation.outcomeReason,
        changes: delta,
        annotationIds: evaluation.annotations.map((annotation) => annotation.id),
      });
    }
    previous = evaluation.current;
  }

  const frame = scenario.frames[frameIndex];
  if (!frame) throw new Error("current replay frame missing");
  const evaluation = evaluateAt(scenario, frame.evaluatedAt);

  return {
    caseId: scenario.caseId,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    evaluationId: evaluation.evaluationId,
    bundle: scenario.bundle,
    current: evaluation.current,
    structuralState: evaluation.structuralState,
    outcome: evaluation.outcome,
    stateReason: evaluation.stateReason,
    outcomeReason: evaluation.outcomeReason,
    annotations: evaluation.annotations,
    history,
    authority: "NO_LIVE_CAPITAL",
    authorityClass: "STRUCTURAL_ONLY",
    modelScored: false,
  };
}
