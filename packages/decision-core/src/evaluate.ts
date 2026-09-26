import type {
  DecisionCase,
  DecisionEvent,
  EvidenceChange,
  EvidenceField,
  EvidenceSnapshot,
  OpportunityState,
  ReplayScenario,
} from "./types.js";

const MATERIAL_FIELDS: readonly EvidenceField[] = [
  "setupQualified",
  "locationQualified",
  "retestObserved",
  "triggerQualified",
  "currentConditionsValid",
  "invalidated",
];

function classify(snapshot: EvidenceSnapshot): { state: OpportunityState; reason: string } {
  if (snapshot.invalidated) return { state: "PASS", reason: "The setup was invalidated before a valid current entry existed." };
  if (!snapshot.setupQualified) return { state: "FORMING", reason: "The setup is still forming." };
  if (!snapshot.locationQualified) return { state: "FORMING", reason: "Setup present; required location evidence is not yet satisfied." };
  if (!snapshot.triggerQualified) return { state: "READY", reason: "Setup and location qualify; the entry trigger is still pending." };
  if (!snapshot.currentConditionsValid) return { state: "PASS", reason: "The trigger occurred, but current conditions no longer support this entry." };
  return { state: "TRIGGERED", reason: "Setup, location, trigger and current conditions all qualify in this replay frame." };
}

function evidenceChanges(previous: EvidenceSnapshot | undefined, current: EvidenceSnapshot): EvidenceChange[] {
  if (!previous) return [];

  return MATERIAL_FIELDS.flatMap((field) => {
    const from = previous[field];
    const to = current[field];
    return from === to ? [] : [{ field, from, to }];
  });
}

export function buildDecisionCase(scenario: ReplayScenario, frameIndex: number): DecisionCase {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= scenario.frames.length) {
    throw new RangeError("frameIndex is outside the replay scenario");
  }

  const history: DecisionEvent[] = [];
  let previousState: OpportunityState | undefined;
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
    history,
    authority: "NO_LIVE_CAPITAL",
  };
}
