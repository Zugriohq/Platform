import type {
  ResearchDataStatus,
  ResearchLifecycleObservation,
} from "./lifecycleObserver.js";

export type ResearchInvalidationMode = "CLOSE_BEYOND" | "TOUCH_BEYOND";

export interface ResearchRetestGeometry {
  readonly geometryId: string;
  readonly side: "BUY" | "SELL";
  readonly breakLevel: number;
  readonly retestZone: {
    readonly low: number;
    readonly high: number;
  };
  readonly invalidationLevel: number;
  /**
   * The observer does not choose this rule. It must come from the named,
   * versioned setup/profile contract.
   */
  readonly invalidationMode: ResearchInvalidationMode;
  readonly provenanceId: string;
}

export interface ResearchOhlcBar {
  readonly sourceBarId: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly dataStatus: ResearchDataStatus;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
}

function validateGeometry(geometry: ResearchRetestGeometry): void {
  assertFinite(geometry.breakLevel, "breakLevel");
  assertFinite(geometry.retestZone.low, "retestZone.low");
  assertFinite(geometry.retestZone.high, "retestZone.high");
  assertFinite(geometry.invalidationLevel, "invalidationLevel");
  if (geometry.retestZone.low > geometry.retestZone.high) {
    throw new Error("retestZone.low cannot exceed retestZone.high");
  }
  if (!geometry.geometryId || !geometry.provenanceId) {
    throw new Error("geometryId and provenanceId must be non-empty");
  }
}

function validateBar(bar: ResearchOhlcBar): void {
  for (const [label, value] of Object.entries({
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })) {
    assertFinite(value, label);
  }
  if (bar.low > bar.high) throw new Error("bar.low cannot exceed bar.high");
  if (bar.high < Math.max(bar.open, bar.close) || bar.low > Math.min(bar.open, bar.close)) {
    throw new Error("OHLC bar is internally inconsistent");
  }
}

export interface ExtractedRetestGeometryFacts {
  readonly touchedZone: boolean;
  readonly closedOnValidSideOfBreak: boolean;
  readonly invalidated: boolean;
  readonly observation: ResearchLifecycleObservation;
  readonly geometryId: string;
  readonly provenanceId: string;
  readonly authority: "RESEARCH_ONLY";
}

/**
 * Deterministic geometry-only extraction.
 *
 * It deliberately does not classify displacement quality, regime, pWin, EV,
 * rejection "strength", continuation budget, or FIRE. Zone/tolerance construction
 * happens upstream in the versioned setup contract.
 */
export function extractRetestGeometryFacts(
  geometry: ResearchRetestGeometry,
  bar: ResearchOhlcBar,
): ExtractedRetestGeometryFacts {
  validateGeometry(geometry);
  validateBar(bar);

  const touchedZone =
    bar.low <= geometry.retestZone.high &&
    bar.high >= geometry.retestZone.low;

  const closedOnValidSideOfBreak =
    geometry.side === "BUY"
      ? bar.close >= geometry.breakLevel
      : bar.close <= geometry.breakLevel;

  const invalidated =
    geometry.invalidationMode === "CLOSE_BEYOND"
      ? geometry.side === "BUY"
        ? bar.close < geometry.invalidationLevel
        : bar.close > geometry.invalidationLevel
      : geometry.side === "BUY"
        ? bar.low < geometry.invalidationLevel
        : bar.high > geometry.invalidationLevel;

  const retestHeld = touchedZone && closedOnValidSideOfBreak && !invalidated;

  return {
    touchedZone,
    closedOnValidSideOfBreak,
    invalidated,
    observation: {
      evidenceId: `geometry:${geometry.geometryId}:${bar.sourceBarId}`,
      sourceBarId: bar.sourceBarId,
      sourceClosedAt: bar.sourceClosedAt,
      knownAt: bar.knownAt,
      dataStatus: bar.dataStatus,
      retestTouched: touchedZone,
      retestHeld,
      invalidated,
    },
    geometryId: geometry.geometryId,
    provenanceId: geometry.provenanceId,
    authority: "RESEARCH_ONLY",
  };
}
