import type { ResearchLifecycleObservation } from "./lifecycleObserver.js";
import {
  validateResearchStructureBar,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
} from "./marketMap.js";
import type {
  ResearchBreakMode,
  ResearchStructuralBreakEvent,
} from "./structuralBreaks.js";

export type ResearchRetestHoldRule = "CLOSE_VALID_SIDE";
export type ResearchRetestHoldTiming =
  | "TOUCH_BAR_CLOSE_ALLOWED"
  | "LATER_BAR_REQUIRED";

export type ResearchRetestStatus =
  | "NO_RETEST"
  | "RETEST_TOUCHED"
  | "RETEST_HELD"
  | "RETEST_TOUCH_FAILED_HOLD";

export type ResearchRetestReason =
  | "BREAK_MODE_NOT_ELIGIBLE"
  | "BAR_NOT_AFTER_BREAK"
  | "BAR_USES_BREAK_EVIDENCE"
  | "BAR_NOT_CLOSED"
  | "DATA_STALE"
  | "DATA_GAP"
  | "TOUCH_ZONE_NOT_REACHED"
  | "TOUCH_OBSERVED"
  | "HOLD_PENDING_LATER_BAR"
  | "HOLD_VALID"
  | "HOLD_CLOSE_FAILED"
  | "MAX_PENETRATION_EXCEEDED";

export interface ResearchRetestDefinition {
  readonly definitionId: string;
  readonly eligibleBreakModes: readonly ResearchBreakMode[];
  /** Absolute price distance around the broken level that counts as a touch. */
  readonly touchTolerance: number;
  /** Absolute close allowance beyond the level while still counting as valid-side. */
  readonly holdTolerance: number;
  /** Maximum wick/body penetration beyond the broken level for a held retest. */
  readonly maximumPenetration: number;
  readonly holdRule: ResearchRetestHoldRule;
  readonly holdTiming: ResearchRetestHoldTiming;
}

export interface ResearchRetestEvidence {
  readonly retestId: string;
  readonly status: Exclude<ResearchRetestStatus, "NO_RETEST">;
  readonly breakId: string;
  readonly levelFactId: string;
  readonly direction: "UP" | "DOWN";
  readonly scale: ResearchStructuralBreakEvent["scale"];
  readonly timeframe: string;
  readonly levelPrice: number;
  readonly touchZone: {
    readonly low: number;
    readonly high: number;
  };
  readonly bar: {
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
  };
  readonly touchedOnThisBar: boolean;
  readonly held: boolean;
  readonly penetration: number;
  readonly penetrationWithinLimit: boolean;
  readonly priorTouchId: string | null;
  readonly sourceBarId: string;
  readonly sourceBarEvidenceId: string;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly definitionId: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly authorityEffect: "NONE";
}

export interface ResearchRetestAssessment {
  readonly status: ResearchRetestStatus;
  readonly retest: ResearchRetestEvidence | null;
  readonly fact: ResearchMarketStructureFact | null;
  readonly reasons: readonly ResearchRetestReason[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  }
  return parsed;
}

function validateDefinition(definition: ResearchRetestDefinition): void {
  if (!definition.definitionId) {
    throw new Error("retest definitionId must be non-empty");
  }
  if (definition.eligibleBreakModes.length === 0) {
    throw new Error("retest definition requires at least one eligible break mode");
  }
  if (new Set(definition.eligibleBreakModes).size !== definition.eligibleBreakModes.length) {
    throw new Error("retest definition repeats an eligible break mode");
  }
  for (const [label, value] of Object.entries({
    touchTolerance: definition.touchTolerance,
    holdTolerance: definition.holdTolerance,
    maximumPenetration: definition.maximumPenetration,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${label} must be finite and >= 0`);
    }
  }
  if (definition.holdRule !== "CLOSE_VALID_SIDE") {
    throw new Error("unsupported retest hold rule");
  }
}

function validateBreakEvent(event: ResearchStructuralBreakEvent): void {
  if (
    !event.breakId ||
    !event.levelFactId ||
    !event.timeframe ||
    !event.definitionId ||
    !event.sourceBarId ||
    !event.sourceBarEvidenceId ||
    !event.levelStateEvidenceId ||
    event.sourceEvidenceIds.length === 0
  ) {
    throw new Error("retest break event identity/provenance must be complete");
  }
  if (
    event.sourceBarEvidenceId === event.levelStateEvidenceId ||
    !event.sourceEvidenceIds.includes(event.sourceBarEvidenceId) ||
    !event.sourceEvidenceIds.includes(event.levelStateEvidenceId)
  ) {
    throw new Error("retest break provenance roles must be distinct and present");
  }
  if (!Number.isFinite(event.levelPrice) || !Number.isFinite(event.observedPrice)) {
    throw new Error("retest break prices must be finite");
  }
  const knownAt = epoch(event.knownAt, "breakEvent.knownAt");
  const sourceClosedAt = epoch(event.sourceClosedAt, "breakEvent.sourceClosedAt");
  if (event.mode === "CLOSE_BEYOND" && knownAt < sourceClosedAt) {
    throw new Error("close-based break cannot be known before source close");
  }
}

function noRetest(reason: ResearchRetestReason): ResearchRetestAssessment {
  return {
    status: "NO_RETEST",
    retest: null,
    fact: null,
    reasons: [reason],
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

function closeHolds(
  direction: "UP" | "DOWN",
  close: number,
  levelPrice: number,
  tolerance: number,
): boolean {
  return direction === "UP"
    ? close >= levelPrice - tolerance
    : close <= levelPrice + tolerance;
}

function penetrationFor(
  direction: "UP" | "DOWN",
  bar: ResearchStructureBar,
  levelPrice: number,
): number {
  return direction === "UP"
    ? Math.max(0, levelPrice - bar.low)
    : Math.max(0, bar.high - levelPrice);
}

function validatePriorTouch(
  priorTouch: ResearchRetestEvidence,
  breakEvent: ResearchStructuralBreakEvent,
  definition: ResearchRetestDefinition,
  bar: ResearchStructureBar,
): void {
  if (
    priorTouch.breakId !== breakEvent.breakId ||
    priorTouch.levelFactId !== breakEvent.levelFactId ||
    priorTouch.definitionId !== definition.definitionId
  ) {
    throw new Error("prior retest touch belongs to a different break/definition");
  }
  if (priorTouch.held) {
    throw new Error("prior retest touch is already held");
  }
  if (
    epoch(priorTouch.knownAt, "priorTouch.knownAt") >= epoch(bar.knownAt, "bar.knownAt") ||
    epoch(priorTouch.sourceClosedAt, "priorTouch.sourceClosedAt") >=
      epoch(bar.sourceClosedAt, "bar.sourceClosedAt")
  ) {
    throw new Error("prior retest touch must be strictly earlier than the current bar");
  }
}

/**
 * Derives retest state from immutable post-break OHLC evidence.
 *
 * No request-time clock participates in the decision, so an old bar cannot be
 * "renewed" merely because the caller evaluates it later.
 */
export function derivePostBreakRetest(input: {
  readonly breakEvent: ResearchStructuralBreakEvent;
  readonly bar: ResearchStructureBar;
  readonly definition: ResearchRetestDefinition;
  readonly priorTouch?: ResearchRetestEvidence | null;
}): ResearchRetestAssessment {
  const { breakEvent, bar, definition } = input;
  validateDefinition(definition);
  validateBreakEvent(breakEvent);
  validateResearchStructureBar(bar);

  if (!definition.eligibleBreakModes.includes(breakEvent.mode)) {
    return noRetest("BREAK_MODE_NOT_ELIGIBLE");
  }

  const breakKnownAt = epoch(breakEvent.knownAt, "breakEvent.knownAt");
  const breakSourceClosedAt = epoch(breakEvent.sourceClosedAt, "breakEvent.sourceClosedAt");
  const barKnownAt = epoch(bar.knownAt, "bar.knownAt");
  const barSourceClosedAt = epoch(bar.sourceClosedAt, "bar.sourceClosedAt");

  if (
    bar.sourceBarId === breakEvent.sourceBarId ||
    barSourceClosedAt <= breakSourceClosedAt ||
    barKnownAt <= breakKnownAt
  ) {
    return noRetest("BAR_NOT_AFTER_BREAK");
  }

  if (breakEvent.sourceEvidenceIds.includes(bar.evidenceId)) {
    return noRetest("BAR_USES_BREAK_EVIDENCE");
  }

  if (bar.dataStatus === "INCOMPLETE") {
    return noRetest("BAR_NOT_CLOSED");
  }
  if (bar.dataStatus === "STALE") {
    return noRetest("DATA_STALE");
  }
  if (bar.dataStatus === "GAP") {
    return noRetest("DATA_GAP");
  }

  const priorTouch = input.priorTouch ?? null;
  if (priorTouch) {
    validatePriorTouch(priorTouch, breakEvent, definition, bar);
  }

  const zoneLow = breakEvent.levelPrice - definition.touchTolerance;
  const zoneHigh = breakEvent.levelPrice + definition.touchTolerance;
  const touchedOnThisBar = bar.high >= zoneLow && bar.low <= zoneHigh;

  const usablePriorTouch =
    priorTouch !== null && priorTouch.penetrationWithinLimit;

  if (!touchedOnThisBar && !usablePriorTouch) {
    return noRetest("TOUCH_ZONE_NOT_REACHED");
  }

  const penetration = penetrationFor(breakEvent.direction, bar, breakEvent.levelPrice);
  const penetrationWithinLimit = penetration <= definition.maximumPenetration;

  const holdAllowed =
    definition.holdTiming === "TOUCH_BAR_CLOSE_ALLOWED"
      ? touchedOnThisBar || usablePriorTouch
      : usablePriorTouch;

  const closeValid =
    definition.holdRule === "CLOSE_VALID_SIDE" &&
    closeHolds(
      breakEvent.direction,
      bar.close,
      breakEvent.levelPrice,
      definition.holdTolerance,
    );

  const held = holdAllowed && closeValid && penetrationWithinLimit;

  let status: Exclude<ResearchRetestStatus, "NO_RETEST">;
  const reasons: ResearchRetestReason[] = [];

  if (held) {
    status = "RETEST_HELD";
    reasons.push("HOLD_VALID");
  } else if (
    touchedOnThisBar &&
    definition.holdTiming === "LATER_BAR_REQUIRED" &&
    !usablePriorTouch
  ) {
    status = "RETEST_TOUCHED";
    reasons.push("TOUCH_OBSERVED", "HOLD_PENDING_LATER_BAR");
  } else {
    status = "RETEST_TOUCH_FAILED_HOLD";
    if (touchedOnThisBar) reasons.push("TOUCH_OBSERVED");
    if (!penetrationWithinLimit) reasons.push("MAX_PENETRATION_EXCEEDED");
    if (!closeValid) reasons.push("HOLD_CLOSE_FAILED");
    if (
      definition.holdTiming === "LATER_BAR_REQUIRED" &&
      !usablePriorTouch
    ) {
      reasons.push("HOLD_PENDING_LATER_BAR");
    }
  }

  const retestId =
    `retest:${definition.definitionId}:${breakEvent.breakId}:${bar.sourceBarId}:${bar.evidenceId}:${priorTouch?.retestId ?? "direct"}`;

  const sourceEvidenceIds = [
    ...new Set([
      ...breakEvent.sourceEvidenceIds,
      ...(priorTouch?.sourceEvidenceIds ?? []),
      bar.evidenceId,
    ]),
  ];

  const retest: ResearchRetestEvidence = {
    retestId,
    status,
    breakId: breakEvent.breakId,
    levelFactId: breakEvent.levelFactId,
    direction: breakEvent.direction,
    scale: breakEvent.scale,
    timeframe: breakEvent.timeframe,
    levelPrice: breakEvent.levelPrice,
    touchZone: {
      low: zoneLow,
      high: zoneHigh,
    },
    bar: {
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    },
    touchedOnThisBar,
    held,
    penetration,
    penetrationWithinLimit,
    priorTouchId: priorTouch?.retestId ?? null,
    sourceBarId: bar.sourceBarId,
    sourceBarEvidenceId: bar.evidenceId,
    sourceClosedAt: bar.sourceClosedAt,
    knownAt: bar.knownAt,
    definitionId: definition.definitionId,
    sourceEvidenceIds,
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };

  const fact: ResearchMarketStructureFact = {
    factId: `retest-fact:${retestId}`,
    concept: "RETEST",
    maturity: "RESEARCH_DERIVED",
    scale: breakEvent.scale,
    timeframe: breakEvent.timeframe,
    side: breakEvent.direction === "UP" ? "BUY" : "SELL",
    knownAt: bar.knownAt,
    definitionId: definition.definitionId,
    sourceEvidenceIds,
    geometry: {
      type: "ZONE",
      low: zoneLow,
      high: zoneHigh,
      startAt: breakEvent.knownAt,
      endAt: bar.knownAt,
    },
    label:
      status === "RETEST_HELD"
        ? "RETEST HELD"
        : status === "RETEST_TOUCHED"
          ? "RETEST TOUCHED"
          : "RETEST TOUCH / HOLD FAILED",
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };

  return {
    status,
    retest,
    fact,
    reasons,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

/**
 * Deterministic bridge into the existing lifecycle state machine.
 * It never invents route confirmation, invalidation or expiry.
 */
export function retestAssessmentToLifecycleObservation(
  assessment: ResearchRetestAssessment,
): ResearchLifecycleObservation | null {
  const retest = assessment.retest;
  if (!retest) return null;

  return {
    evidenceId: retest.retestId,
    sourceBarId: retest.sourceBarId,
    sourceClosedAt: retest.sourceClosedAt,
    knownAt: retest.knownAt,
    dataStatus: "FRESH_COMPLETE",
    retestTouched: true,
    ...(retest.held ? { retestHeld: true } : {}),
  };
}
