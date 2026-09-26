export type TimeframeEvidenceStatus =
  | "FRESH_COMPLETE"
  | "INCOMPLETE"
  | "STALE"
  | "GAP";

export type TimeframeEvidenceReasonCode =
  | "REQUIRED_TIMEFRAME_MISSING"
  | "REQUIRED_TIMEFRAME_INCOMPLETE"
  | "REQUIRED_TIMEFRAME_STALE"
  | "REQUIRED_TIMEFRAME_GAP";

export interface TimeframeEvidencePoint {
  readonly timeframe: string;
  readonly evidenceId: string;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly status: TimeframeEvidenceStatus;
}

export interface TimeframeEvidenceAssessment {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly evaluatedAt: string;
  readonly requiredTimeframes: readonly string[];
  readonly usedEvidenceIds: readonly string[];
  readonly reasons: readonly {
    readonly timeframe: string;
    readonly code: TimeframeEvidenceReasonCode;
  }[];
  readonly authority: "RESEARCH_ONLY";
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

/**
 * Checks only the timeframes declared by the profile/scope. Undeclared monthly,
 * weekly or lower-timeframe evidence can never become an accidental universal gate.
 */
export function assessRequiredTimeframes(
  evaluatedAtIso: string,
  requiredTimeframes: readonly string[],
  evidence: readonly TimeframeEvidencePoint[],
): TimeframeEvidenceAssessment {
  const evaluatedAt = epoch(evaluatedAtIso, "evaluatedAt");
  const required = [...new Set(requiredTimeframes)];

  if (required.some((timeframe) => !timeframe.trim())) {
    throw new Error("required timeframe names must be non-empty");
  }

  const reasons: { timeframe: string; code: TimeframeEvidenceReasonCode }[] = [];
  const usedEvidenceIds: string[] = [];
  const relevantEvidence = evidence.filter(point => required.includes(point.timeframe));
  const seenEvidenceIds = new Set<string>();

  for (const point of relevantEvidence) {
    if (!point.evidenceId) throw new Error("timeframe evidenceId must be non-empty");
    if (seenEvidenceIds.has(point.evidenceId)) {
      throw new Error(`duplicate timeframe evidenceId: ${point.evidenceId}`);
    }
    seenEvidenceIds.add(point.evidenceId);
    const sourceClosedAt = epoch(point.sourceClosedAt, "sourceClosedAt");
    const knownAt = epoch(point.knownAt, "knownAt");
    if (knownAt < sourceClosedAt) {
      throw new Error(`timeframe evidence cannot be known before source close: ${point.evidenceId}`);
    }
  }

  for (const timeframe of required) {
    const available = relevantEvidence
      .filter((point) => point.timeframe === timeframe && epoch(point.knownAt, "knownAt") <= evaluatedAt)
      .sort((a, b) => {
        const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
        if (byKnownAt !== 0) return byKnownAt;
        const bySourceClose = epoch(a.sourceClosedAt, "sourceClosedAt") - epoch(b.sourceClosedAt, "sourceClosedAt");
        if (bySourceClose !== 0) return bySourceClose;
        return a.evidenceId.localeCompare(b.evidenceId);
      })
      .at(-1);

    if (!available) {
      reasons.push({ timeframe, code: "REQUIRED_TIMEFRAME_MISSING" });
      continue;
    }

    usedEvidenceIds.push(available.evidenceId);

    switch (available.status) {
      case "FRESH_COMPLETE":
        break;
      case "INCOMPLETE":
        reasons.push({ timeframe, code: "REQUIRED_TIMEFRAME_INCOMPLETE" });
        break;
      case "STALE":
        reasons.push({ timeframe, code: "REQUIRED_TIMEFRAME_STALE" });
        break;
      case "GAP":
        reasons.push({ timeframe, code: "REQUIRED_TIMEFRAME_GAP" });
        break;
    }
  }

  return {
    status: reasons.length === 0 ? "AVAILABLE" : "UNAVAILABLE",
    evaluatedAt: evaluatedAtIso,
    requiredTimeframes: required,
    usedEvidenceIds,
    reasons,
    authority: "RESEARCH_ONLY",
  };
}
