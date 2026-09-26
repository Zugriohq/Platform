import type { CurrentEntryStatus } from "../types.js";

export type CurrentEntryReasonCode =
  | "NO_ENTRY_EVENT"
  | "QUOTE_UNAVAILABLE"
  | "QUOTE_STALE"
  | "ENTRY_EVENT_STALE"
  | "GEOMETRY_NO_LONGER_CURRENT"
  | "COST_BUDGET_FAILED"
  | "TARGET_RUNWAY_FAILED"
  | "CONTINUITY_FAILED"
  | "CURRENT";

export interface HistoricalEntryEventRef {
  readonly eventId: string;
  readonly confirmedAt: string;
  readonly sourceBarClosedAt: string;
}

export interface RecheckPredicateEvidence {
  readonly ok: boolean;
  readonly evidenceId: string;
  readonly knownAt: string;
  /**
   * Identity of the rule/provenance that produced this boolean. This module does
   * not choose or tune the threshold.
   */
  readonly provenanceId: string;
}

export interface CurrentQuoteEvidence {
  readonly status: "FRESH" | "STALE" | "UNAVAILABLE";
  readonly quoteAt: string | null;
  readonly evidenceId: string;
  readonly knownAt: string;
}

export interface CurrentEntryRecheckInput {
  readonly evaluatedAt: string;
  readonly quote: CurrentQuoteEvidence;
  readonly entryFreshness: RecheckPredicateEvidence;
  readonly geometryCurrent: RecheckPredicateEvidence;
  readonly costsWithinBudget: RecheckPredicateEvidence;
  readonly targetRunwayAvailable: RecheckPredicateEvidence;
  readonly continuityOk: RecheckPredicateEvidence;
}

export interface CurrentEntryRecheckResult {
  readonly status: CurrentEntryStatus;
  readonly reasons: readonly CurrentEntryReasonCode[];
  readonly originalEntryEventId: string | null;
  readonly originalConfirmedAt: string | null;
  readonly evaluatedAt: string;
  readonly evidenceIds: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function validateKnownAt(
  evidence: { readonly evidenceId: string; readonly knownAt: string },
  evaluatedAt: number,
): void {
  if (!evidence.evidenceId) throw new Error("recheck evidenceId must be non-empty");
  if (epoch(evidence.knownAt, "knownAt") > evaluatedAt) {
    throw new Error(`future evidence is not available at evaluation time: ${evidence.evidenceId}`);
  }
}

export function recheckCurrentEntry(
  entryEvent: HistoricalEntryEventRef | null,
  input: CurrentEntryRecheckInput,
): CurrentEntryRecheckResult {
  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");

  validateKnownAt(input.quote, evaluatedAt);
  validateKnownAt(input.entryFreshness, evaluatedAt);
  validateKnownAt(input.geometryCurrent, evaluatedAt);
  validateKnownAt(input.costsWithinBudget, evaluatedAt);
  validateKnownAt(input.targetRunwayAvailable, evaluatedAt);
  validateKnownAt(input.continuityOk, evaluatedAt);

  if (input.quote.quoteAt && epoch(input.quote.quoteAt, "quoteAt") > evaluatedAt) {
    throw new Error("quoteAt cannot be in the future relative to evaluatedAt");
  }

  if (!entryEvent) {
    return {
      status: "NOT_AVAILABLE",
      reasons: ["NO_ENTRY_EVENT"],
      originalEntryEventId: null,
      originalConfirmedAt: null,
      evaluatedAt: input.evaluatedAt,
      evidenceIds: [],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  epoch(entryEvent.confirmedAt, "entryEvent.confirmedAt");
  epoch(entryEvent.sourceBarClosedAt, "entryEvent.sourceBarClosedAt");

  const reasons: CurrentEntryReasonCode[] = [];

  if (input.quote.status === "UNAVAILABLE") reasons.push("QUOTE_UNAVAILABLE");
  if (input.quote.status === "STALE") reasons.push("QUOTE_STALE");
  if (!input.entryFreshness.ok) reasons.push("ENTRY_EVENT_STALE");
  if (!input.geometryCurrent.ok) reasons.push("GEOMETRY_NO_LONGER_CURRENT");
  if (!input.costsWithinBudget.ok) reasons.push("COST_BUDGET_FAILED");
  if (!input.targetRunwayAvailable.ok) reasons.push("TARGET_RUNWAY_FAILED");
  if (!input.continuityOk.ok) reasons.push("CONTINUITY_FAILED");

  const evidenceIds = [
    input.quote.evidenceId,
    input.entryFreshness.evidenceId,
    input.geometryCurrent.evidenceId,
    input.costsWithinBudget.evidenceId,
    input.targetRunwayAvailable.evidenceId,
    input.continuityOk.evidenceId,
  ];

  return {
    status: reasons.length === 0 ? "CURRENT" : "STALE",
    reasons: reasons.length === 0 ? ["CURRENT"] : reasons,
    originalEntryEventId: entryEvent.eventId,
    originalConfirmedAt: entryEvent.confirmedAt,
    evaluatedAt: input.evaluatedAt,
    evidenceIds,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
