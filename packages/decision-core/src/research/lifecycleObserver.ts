import type { StructuralLifecycle } from "../types.js";

export type ResearchLifecycleRoute = "RETEST" | "CONTINUATION";
export type ResearchLifecycleTerminal = "INVALIDATED" | "EXPIRED";
export type ResearchObservedLifecycle = Exclude<StructuralLifecycle, "CANDIDATE_IDENTIFIED">;
export type ResearchDataStatus = "FRESH_COMPLETE" | "INCOMPLETE" | "STALE" | "GAP";

export type ResearchLifecycleReasonCode =
  | "BREAK_SEED_ACCEPTED"
  | "BREAK_BAR_CANNOT_CONFIRM"
  | "BAR_NOT_CLOSED"
  | "DATA_STALE"
  | "DATA_GAP"
  | "RETEST_TOUCHED"
  | "RETEST_HELD"
  | "CONTINUATION_ROUTE_DISABLED"
  | "CONTINUATION_HELD"
  | "CONFIRMATION_WITHOUT_HELD_ROUTE"
  | "LIFECYCLE_CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "TERMINAL_PRESERVED"
  | "NO_STRUCTURAL_CHANGE";

export interface ResearchBreakSeed {
  /**
   * Stable upstream identity. The observer never derives identity from rolling
   * candle indexes, array positions or scanner ordering.
   */
  readonly candidateId: string;
  readonly setupIdentity: string;
  readonly setupType: string;
  readonly side: "BUY" | "SELL";
  readonly breakEvidenceId: string;
  readonly breakSourceBarId: string;
  readonly breakSourceClosedAt: string;
  readonly breakKnownAt: string;
  /**
   * Frozen Gate-1 boundary: continuation reference is off unless explicitly
   * enabled for research capture. Enabling it does not create production authority.
   */
  readonly continuationReferenceEnabled: boolean;
}

export interface ResearchLifecycleObservation {
  readonly evidenceId: string;
  readonly sourceBarId: string;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly dataStatus: ResearchDataStatus;

  /** Named upstream structural facts. This observer does not invent their thresholds. */
  readonly retestTouched?: boolean;
  readonly retestHeld?: boolean;
  readonly continuationHeld?: boolean;
  /**
   * Explicit upstream statement that a held route completed its frozen lifecycle.
   * The observer only accepts it after the corresponding HELD state exists.
   */
  readonly confirmRoute?: ResearchLifecycleRoute | null;
  readonly invalidated?: boolean;
  /** No implicit candle-count timer exists here. Expiry must arrive explicitly. */
  readonly expired?: boolean;
}

export interface ResearchLifecycleTraceEvent {
  readonly evidenceId: string;
  readonly sourceBarId: string;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly action: "OBSERVE" | "ADVANCE" | "IGNORE" | "TERMINATE";
  readonly reasonCode: ResearchLifecycleReasonCode;
  readonly from: ResearchObservedLifecycle | ResearchLifecycleTerminal;
  readonly to: ResearchObservedLifecycle | ResearchLifecycleTerminal;
  readonly route: ResearchLifecycleRoute | null;
}

export interface ResearchLifecycleResult {
  readonly candidateId: string;
  readonly setupIdentity: string;
  readonly setupType: string;
  readonly side: "BUY" | "SELL";
  readonly lifecycle: ResearchObservedLifecycle | ResearchLifecycleTerminal;
  readonly terminal: ResearchLifecycleTerminal | null;
  readonly confirmedRoute: ResearchLifecycleRoute | null;
  readonly routeState: {
    readonly retest: "BREAK_CONFIRMED" | "RETEST_TOUCHED" | "RETEST_HELD";
    readonly continuation: "DISABLED" | "BREAK_CONFIRMED" | "CONTINUATION_HELD";
  };
  readonly trace: readonly ResearchLifecycleTraceEvent[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

export interface ResearchCandidateObservationSet {
  readonly seed: ResearchBreakSeed;
  readonly observations: readonly ResearchLifecycleObservation[];
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function lifecycleFromRouteState(
  terminal: ResearchLifecycleTerminal | null,
  confirmedRoute: ResearchLifecycleRoute | null,
  retest: "BREAK_CONFIRMED" | "RETEST_TOUCHED" | "RETEST_HELD",
  continuation: "DISABLED" | "BREAK_CONFIRMED" | "CONTINUATION_HELD",
): ResearchObservedLifecycle | ResearchLifecycleTerminal {
  if (terminal) return terminal;
  if (confirmedRoute) return "LIFECYCLE_CONFIRMED";
  if (retest === "RETEST_HELD") return "RETEST_HELD";
  if (continuation === "CONTINUATION_HELD") return "CONTINUATION_HELD";
  if (retest === "RETEST_TOUCHED") return "RETEST_TOUCHED";
  return "BREAK_CONFIRMED";
}

function orderedObservations(
  observations: readonly ResearchLifecycleObservation[],
): ResearchLifecycleObservation[] {
  const seen = new Set<string>();
  for (const item of observations) {
    if (!item.evidenceId) throw new Error("lifecycle observation evidenceId must be non-empty");
    if (seen.has(item.evidenceId)) {
      throw new Error(`duplicate lifecycle evidenceId: ${item.evidenceId}`);
    }
    seen.add(item.evidenceId);
    epoch(item.knownAt, "knownAt");
    epoch(item.sourceClosedAt, "sourceClosedAt");
  }

  return [...observations].sort((a, b) => {
    const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
    if (byKnownAt !== 0) return byKnownAt;
    const byClose = epoch(a.sourceClosedAt, "sourceClosedAt") - epoch(b.sourceClosedAt, "sourceClosedAt");
    if (byClose !== 0) return byClose;
    return a.evidenceId.localeCompare(b.evidenceId);
  });
}

export function observeStructuralLifecycle(
  seed: ResearchBreakSeed,
  observations: readonly ResearchLifecycleObservation[],
): ResearchLifecycleResult {
  if (!seed.candidateId) throw new Error("candidateId must be non-empty");
  if (!seed.setupIdentity) throw new Error("setupIdentity must be non-empty");

  const breakKnownAt = epoch(seed.breakKnownAt, "breakKnownAt");
  const breakSourceClosedAt = epoch(seed.breakSourceClosedAt, "breakSourceClosedAt");

  if (breakKnownAt < breakSourceClosedAt) {
    throw new Error("breakKnownAt cannot precede the source bar close");
  }

  let retest: "BREAK_CONFIRMED" | "RETEST_TOUCHED" | "RETEST_HELD" = "BREAK_CONFIRMED";
  let continuation: "DISABLED" | "BREAK_CONFIRMED" | "CONTINUATION_HELD" =
    seed.continuationReferenceEnabled ? "BREAK_CONFIRMED" : "DISABLED";
  let terminal: ResearchLifecycleTerminal | null = null;
  let confirmedRoute: ResearchLifecycleRoute | null = null;
  const trace: ResearchLifecycleTraceEvent[] = [];

  const current = () => lifecycleFromRouteState(terminal, confirmedRoute, retest, continuation);

  trace.push({
    evidenceId: seed.breakEvidenceId,
    sourceBarId: seed.breakSourceBarId,
    sourceClosedAt: seed.breakSourceClosedAt,
    knownAt: seed.breakKnownAt,
    action: "OBSERVE",
    reasonCode: "BREAK_SEED_ACCEPTED",
    from: "BREAK_CONFIRMED",
    to: "BREAK_CONFIRMED",
    route: null,
  });

  const push = (
    observation: ResearchLifecycleObservation,
    action: ResearchLifecycleTraceEvent["action"],
    reasonCode: ResearchLifecycleReasonCode,
    from: ResearchObservedLifecycle | ResearchLifecycleTerminal,
    to: ResearchObservedLifecycle | ResearchLifecycleTerminal,
    route: ResearchLifecycleRoute | null = null,
  ) => {
    trace.push({
      evidenceId: observation.evidenceId,
      sourceBarId: observation.sourceBarId,
      sourceClosedAt: observation.sourceClosedAt,
      knownAt: observation.knownAt,
      action,
      reasonCode,
      from,
      to,
      route,
    });
  };

  for (const observation of orderedObservations(observations)) {
    const before = current();

    if (terminal) {
      push(observation, "IGNORE", "TERMINAL_PRESERVED", before, before, confirmedRoute);
      continue;
    }

    const knownAt = epoch(observation.knownAt, "knownAt");
    const sourceClosedAt = epoch(observation.sourceClosedAt, "sourceClosedAt");

    /**
     * Critical legacy guard: a fresh request timestamp can never turn the original
     * break bar into a later retest/confirmation. Source-bar chronology, not request
     * time, controls this boundary.
     */
    if (knownAt <= breakKnownAt || sourceClosedAt <= breakSourceClosedAt) {
      push(observation, "IGNORE", "BREAK_BAR_CANNOT_CONFIRM", before, before);
      continue;
    }

    if (observation.expired) {
      terminal = "EXPIRED";
      push(observation, "TERMINATE", "EXPIRED", before, "EXPIRED");
      continue;
    }

    if (observation.dataStatus === "INCOMPLETE") {
      push(observation, "IGNORE", "BAR_NOT_CLOSED", before, before);
      continue;
    }
    if (observation.dataStatus === "STALE") {
      push(observation, "IGNORE", "DATA_STALE", before, before);
      continue;
    }
    if (observation.dataStatus === "GAP") {
      push(observation, "IGNORE", "DATA_GAP", before, before);
      continue;
    }

    if (observation.invalidated) {
      terminal = "INVALIDATED";
      push(observation, "TERMINATE", "INVALIDATED", before, "INVALIDATED");
      continue;
    }

    let changed = false;

    if (observation.retestTouched && retest === "BREAK_CONFIRMED") {
      const from = current();
      retest = "RETEST_TOUCHED";
      push(observation, "ADVANCE", "RETEST_TOUCHED", from, current(), "RETEST");
      changed = true;
    }

    if (observation.retestHeld && retest !== "RETEST_HELD") {
      if (retest === "RETEST_TOUCHED") {
        const from = current();
        retest = "RETEST_HELD";
        push(observation, "ADVANCE", "RETEST_HELD", from, current(), "RETEST");
        changed = true;
      } else {
        push(observation, "IGNORE", "CONFIRMATION_WITHOUT_HELD_ROUTE", current(), current(), "RETEST");
      }
    }

    if (observation.continuationHeld) {
      if (!seed.continuationReferenceEnabled) {
        push(observation, "IGNORE", "CONTINUATION_ROUTE_DISABLED", current(), current(), "CONTINUATION");
      } else if (continuation === "BREAK_CONFIRMED") {
        const from = current();
        continuation = "CONTINUATION_HELD";
        push(observation, "ADVANCE", "CONTINUATION_HELD", from, current(), "CONTINUATION");
        changed = true;
      }
    }

    if (observation.confirmRoute && !confirmedRoute) {
      const held =
        observation.confirmRoute === "RETEST"
          ? retest === "RETEST_HELD"
          : seed.continuationReferenceEnabled && continuation === "CONTINUATION_HELD";

      if (!held) {
        push(
          observation,
          "IGNORE",
          observation.confirmRoute === "CONTINUATION" && !seed.continuationReferenceEnabled
            ? "CONTINUATION_ROUTE_DISABLED"
            : "CONFIRMATION_WITHOUT_HELD_ROUTE",
          current(),
          current(),
          observation.confirmRoute,
        );
      } else {
        const from = current();
        confirmedRoute = observation.confirmRoute;
        push(observation, "ADVANCE", "LIFECYCLE_CONFIRMED", from, "LIFECYCLE_CONFIRMED", confirmedRoute);
        changed = true;
      }
    }

    if (!changed) {
      push(observation, "OBSERVE", "NO_STRUCTURAL_CHANGE", before, current(), null);
    }
  }

  return {
    candidateId: seed.candidateId,
    setupIdentity: seed.setupIdentity,
    setupType: seed.setupType,
    side: seed.side,
    lifecycle: current(),
    terminal,
    confirmedRoute,
    routeState: {
      retest,
      continuation,
    },
    trace,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

/**
 * Observe every distinct candidate. No "first candidate wins" shortcut exists here:
 * a failed candidate cannot suppress a separate valid candidate.
 */
export function observeCandidateSet(
  candidates: readonly ResearchCandidateObservationSet[],
): readonly ResearchLifecycleResult[] {
  const seen = new Set<string>();
  for (const item of candidates) {
    if (seen.has(item.seed.candidateId)) {
      throw new Error(`duplicate candidateId in observation set: ${item.seed.candidateId}`);
    }
    seen.add(item.seed.candidateId);
  }

  return candidates
    .map(({ seed, observations }) => observeStructuralLifecycle(seed, observations))
    .sort((a, b) => a.candidateId.localeCompare(b.candidateId));
}
