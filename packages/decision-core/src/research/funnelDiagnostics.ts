import type { CurrentEntryRecheckResult } from "./currentEntryRecheck.js";
import type { ResearchLifecycleResult } from "./lifecycleObserver.js";
import type { TimeframeEvidenceAssessment } from "./timeframeEvidence.js";

export type ResearchFunnelStage =
  | "DATA_BLOCKED"
  | "NO_CANDIDATE"
  | "BREAK_CONFIRMED"
  | "RETEST_TOUCHED"
  | "RETEST_HELD"
  | "CONTINUATION_HELD"
  | "LIFECYCLE_CONFIRMED"
  | "ENTRY_NOT_AVAILABLE"
  | "ENTRY_STALE"
  | "ENTRY_CURRENT"
  | "TERMINAL";

export interface ResearchFunnelDiagnostic {
  readonly stage: ResearchFunnelStage;
  readonly candidateId: string | null;
  readonly summary: string;
  readonly blockers: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

/**
 * Diagnostic composition only. This function never changes a decision and never
 * promotes a candidate. Its job is to make scanner attrition visible.
 */
export function diagnoseResearchFunnel(input: {
  readonly timeframes: TimeframeEvidenceAssessment;
  readonly lifecycle: ResearchLifecycleResult | null;
  readonly currentEntry?: CurrentEntryRecheckResult | null;
}): ResearchFunnelDiagnostic {
  if (input.timeframes.status !== "AVAILABLE") {
    return {
      stage: "DATA_BLOCKED",
      candidateId: input.lifecycle?.candidateId ?? null,
      summary: "Required point-in-time timeframe evidence is unavailable.",
      blockers: input.timeframes.reasons.map(reason => `${reason.timeframe}:${reason.code}`),
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (!input.lifecycle) {
    return {
      stage: "NO_CANDIDATE",
      candidateId: null,
      summary: "No structural break candidate reached this diagnostic.",
      blockers: ["NO_STRUCTURAL_CANDIDATE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (input.lifecycle.terminal) {
    return {
      stage: "TERMINAL",
      candidateId: input.lifecycle.candidateId,
      summary: `Structural candidate terminated as ${input.lifecycle.terminal}.`,
      blockers: [input.lifecycle.terminal],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (input.lifecycle.lifecycle !== "LIFECYCLE_CONFIRMED") {
    const lastMeaningful = [...input.lifecycle.trace]
      .reverse()
      .find(event => event.reasonCode !== "NO_STRUCTURAL_CHANGE");

    const nonTerminalStage: ResearchFunnelStage =
      input.lifecycle.lifecycle === "BREAK_CONFIRMED"
        ? "BREAK_CONFIRMED"
        : input.lifecycle.lifecycle === "RETEST_TOUCHED"
          ? "RETEST_TOUCHED"
          : input.lifecycle.lifecycle === "RETEST_HELD"
            ? "RETEST_HELD"
            : "CONTINUATION_HELD";

    return {
      stage: nonTerminalStage,
      candidateId: input.lifecycle.candidateId,
      summary: `Structural lifecycle currently stops at ${input.lifecycle.lifecycle}.`,
      blockers: lastMeaningful ? [lastMeaningful.reasonCode] : [],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (!input.currentEntry || input.currentEntry.status === "NOT_AVAILABLE") {
    return {
      stage: "ENTRY_NOT_AVAILABLE",
      candidateId: input.lifecycle.candidateId,
      summary: "Lifecycle is confirmed, but no current entry event is available.",
      blockers: input.currentEntry?.reasons ?? ["NO_ENTRY_RECHECK"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (input.currentEntry.status === "STALE") {
    return {
      stage: "ENTRY_STALE",
      candidateId: input.lifecycle.candidateId,
      summary: "Historical entry evidence exists, but current conditions no longer qualify it as current.",
      blockers: input.currentEntry.reasons,
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  return {
    stage: "ENTRY_CURRENT",
    candidateId: input.lifecycle.candidateId,
    summary: "Lifecycle is confirmed and the research current-entry recheck is current.",
    blockers: [],
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
