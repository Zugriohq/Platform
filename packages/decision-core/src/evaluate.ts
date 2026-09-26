import type {
  DecisionCase,
  DecisionEvent,
  EvidenceChange,
  EvidenceSnapshot,
  StructuralState,
  ReplayScenario,
} from "./types.js";

function classify(snapshot: EvidenceSnapshot): { state: StructuralState; reason: string } {
  switch (snapshot.lifecycle) {
    case "INVALIDATED":
      return {
        state: "INVALIDATED",
        reason: "The structural case is invalidated in this replay fixture.",
      };
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
  }
}

function entryReason(snapshot: EvidenceSnapshot): string {
  if (snapshot.lifecycle === "INVALIDATED") {
    return "No current entry: the structural case is invalidated.";
  }
  if (!snapshot.entryEventObserved) {
    return "No entry event is observed in this replay frame.";
  }
  if (snapshot.currentEntryStatus === "STALE") {
    return "The historical fixture entry remains recorded, but the current entry is stale. Structural state is preserved rather than rewritten.";
  }
  if (snapshot.currentEntryStatus === "CURRENT") {
    return "A fixture entry event is present and its current-entry conditions remain current. It is not an admitted ENTRY_EVENT_CONFIRMED predicate and grants no trading permission.";
  }
  return "Entry evidence is unavailable in this replay frame.";
}

function evidenceChanges(previous: EvidenceSnapshot | undefined, current: EvidenceSnapshot): EvidenceChange[] {
  if (!previous) return [];

  const changes: EvidenceChange[] = [];
  if (previous.lifecycle !== current.lifecycle) {
    changes.push({ field: "lifecycle", from: previous.lifecycle, to: current.lifecycle });
  }
  if (previous.entryEventObserved !== current.entryEventObserved) {
    changes.push({ field: "entryEventObserved", from: previous.entryEventObserved, to: current.entryEventObserved });
  }
  if (previous.currentEntryStatus !== current.currentEntryStatus) {
    changes.push({ field: "currentEntryStatus", from: previous.currentEntryStatus, to: current.currentEntryStatus });
  }
  return changes;
}

export function buildDecisionCase(scenario: ReplayScenario, frameIndex: number): DecisionCase {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= scenario.frames.length) {
    throw new RangeError("frameIndex is outside the replay scenario");
  }

  const history: DecisionEvent[] = [];
  let previousState: StructuralState | undefined;
  let previousSnapshot: EvidenceSnapshot | undefined;

  for (let index = 0; index <= frameIndex; index += 1) {
    const snapshot = scenario.frames[index];
    if (!snapshot) throw new Error("replay frame missing");

    const classified = classify(snapshot);
    const changes = evidenceChanges(previousSnapshot, snapshot);
    const isCurrentFrame = index === frameIndex;
    const stateChanged = classified.state !== previousState;
    const evidenceChanged = changes.length > 0;

    if (stateChanged || evidenceChanged || isCurrentFrame) {
      history.push({
        timestamp: snapshot.timestamp,
        state: classified.state,
        reason: classified.reason,
        entryReason: entryReason(snapshot),
        price: snapshot.price,
        changes,
      });
    }

    previousState = classified.state;
    previousSnapshot = snapshot;
  }

  const current = scenario.frames[frameIndex];
  if (!current) throw new Error("current replay frame missing");
  const classified = classify(current);

  return {
    caseId: `${scenario.id}:${current.timestamp}`,
    bundle: scenario.bundle,
    current,
    state: classified.state,
    reason: classified.reason,
    entryReason: entryReason(current),
    history,
    authority: "NO_LIVE_CAPITAL",
    authorityClass: "STRUCTURAL_ONLY",
    modelScored: false,
  };
}
