import {
  validateResearchStructureBar,
  type MarketStructureConcept,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
  type StructureScale,
} from "./marketMap.js";

export type ResearchBreakMode = "CLOSE_BEYOND" | "TOUCH_BEYOND";
export type ResearchBreakDirection = "UP" | "DOWN";
export type ResearchStructuralBias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type ResearchBreakRelation = "CONTINUATION" | "OPPOSITION" | "NEUTRAL";
export type ResearchBreakClassification = "BOS" | "CHOCH" | "MSS";

export interface ResearchBreakLevelRule {
  readonly concept: MarketStructureConcept;
  readonly allowedDirections: readonly ResearchBreakDirection[];
  readonly allowedScales: readonly (StructureScale | null)[];
}

export interface ResearchStructuralBreakDefinition {
  readonly definitionId: string;
  readonly mode: ResearchBreakMode;
  /**
   * Absolute price tolerance owned by the versioned profile. The detector never
   * chooses or tunes this value.
   */
  readonly tolerance: number;
  readonly eligibleLevels: readonly ResearchBreakLevelRule[];
}

export type ResearchStructuralBreakReason =
  | "BREAK_OBSERVED"
  | "LEVEL_NOT_ELIGIBLE"
  | "LEVEL_GEOMETRY_UNSUPPORTED"
  | "LEVEL_NOT_KNOWABLE_YET"
  | "LEVEL_USES_BREAK_BAR_EVIDENCE"
  | "BAR_NOT_CLOSED_FOR_CLOSE_BREAK"
  | "DATA_STALE"
  | "DATA_GAP"
  | "NO_BREAK";

export interface ResearchStructuralBreakEvent {
  readonly breakId: string;
  readonly direction: ResearchBreakDirection;
  readonly mode: ResearchBreakMode;
  readonly levelFactId: string;
  readonly levelConcept: MarketStructureConcept;
  readonly scale: StructureScale | null;
  readonly timeframe: string;
  readonly levelPrice: number;
  readonly observedPrice: number;
  readonly sourceBarId: string;
  readonly sourceClosedAt: string;
  readonly knownAt: string;
  readonly definitionId: string;
  readonly sourceEvidenceIds: readonly string[];
  readonly authority: "RESEARCH_ONLY";
  readonly authorityEffect: "NONE";
}

export interface ResearchStructuralBreakAssessment {
  readonly status: "BREAK_OBSERVED" | "NO_BREAK";
  readonly events: readonly ResearchStructuralBreakEvent[];
  readonly reasons: readonly ResearchStructuralBreakReason[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

export interface ResearchStructuralBiasEvidence {
  readonly bias: ResearchStructuralBias;
  readonly evidenceId: string;
  readonly knownAt: string;
  readonly definitionId: string;
}

export interface ResearchDisplacementEvidence {
  readonly present: boolean;
  readonly direction: ResearchBreakDirection | null;
  readonly evidenceId: string;
  readonly knownAt: string;
  readonly definitionId: string;
}

export interface ResearchBreakClassificationRule {
  readonly relation: ResearchBreakRelation;
  readonly classification: ResearchBreakClassification;
  readonly eligibleScales: readonly (StructureScale | null)[];
  readonly requireDisplacement: boolean;
}

export interface ResearchBreakClassificationDefinition {
  readonly definitionId: string;
  readonly rules: readonly ResearchBreakClassificationRule[];
}

export type ResearchBreakClassificationReason =
  | "CLASSIFIED"
  | "NO_PROFILE_RULE"
  | "BIAS_NOT_PRIOR"
  | "BIAS_EVIDENCE_REUSED"
  | "DISPLACEMENT_REQUIRED"
  | "DISPLACEMENT_DIRECTION_MISMATCH"
  | "DISPLACEMENT_FROM_FUTURE";

export interface ResearchBreakClassificationResult {
  readonly status: "CLASSIFIED" | "UNCLASSIFIED_STRUCTURAL_BREAK";
  readonly relation: ResearchBreakRelation;
  readonly classification: ResearchBreakClassification | null;
  readonly fact: ResearchMarketStructureFact | null;
  readonly reasons: readonly ResearchBreakClassificationReason[];
  readonly authority: "RESEARCH_ONLY";
  readonly liveCapitalAuthority: false;
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function levelBoundaries(
  level: ResearchMarketStructureFact,
): { low: number; high: number } | null {
  switch (level.geometry.type) {
    case "POINT":
      return { low: level.geometry.price, high: level.geometry.price };
    case "LEVEL":
      return { low: level.geometry.price, high: level.geometry.price };
    case "ZONE":
      return { low: level.geometry.low, high: level.geometry.high };
    case "PATH":
      return null;
  }
}

function relationFor(
  bias: ResearchStructuralBias,
  direction: ResearchBreakDirection,
): ResearchBreakRelation {
  if (bias === "NEUTRAL") return "NEUTRAL";
  if (bias === "BULLISH") return direction === "UP" ? "CONTINUATION" : "OPPOSITION";
  return direction === "DOWN" ? "CONTINUATION" : "OPPOSITION";
}

function validateBreakDefinition(definition: ResearchStructuralBreakDefinition): void {
  if (!definition.definitionId) throw new Error("break definitionId must be non-empty");
  if (!Number.isFinite(definition.tolerance) || definition.tolerance < 0) {
    throw new Error("break tolerance must be finite and >= 0");
  }

  const seen = new Set<string>();
  for (const rule of definition.eligibleLevels) {
    if (rule.allowedDirections.length === 0) {
      throw new Error(`eligible level ${rule.concept} requires at least one break direction`);
    }
    if (rule.allowedScales.length === 0) {
      throw new Error(`eligible level ${rule.concept} requires at least one scale`);
    }
    const key = `${rule.concept}:${[...rule.allowedScales].sort().join(",")}`;
    if (seen.has(key)) throw new Error(`ambiguous duplicate level rule: ${key}`);
    seen.add(key);
  }
}

function validateClassificationDefinition(
  definition: ResearchBreakClassificationDefinition,
): void {
  if (!definition.definitionId) throw new Error("classification definitionId must be non-empty");
  const seen = new Set<string>();
  for (const rule of definition.rules) {
    if (rule.eligibleScales.length === 0) {
      throw new Error(`classification rule ${rule.relation} requires at least one scale`);
    }
    for (const scale of rule.eligibleScales) {
      const key = `${rule.relation}:${String(scale)}`;
      if (seen.has(key)) throw new Error(`ambiguous classification rule: ${key}`);
      seen.add(key);
    }
  }
}

/**
 * Detects a neutral structural break against an already-established market-map
 * level. It does not decide BOS/CHoCH/MSS.
 */
export function detectStructuralBreak(
  level: ResearchMarketStructureFact,
  bar: ResearchStructureBar,
  definition: ResearchStructuralBreakDefinition,
): ResearchStructuralBreakAssessment {
  validateBreakDefinition(definition);
  validateResearchStructureBar(bar);

  const eligibleRule = definition.eligibleLevels.find(rule =>
    rule.concept === level.concept && rule.allowedScales.includes(level.scale),
  );
  if (!eligibleRule) {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["LEVEL_NOT_ELIGIBLE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const bounds = levelBoundaries(level);
  if (!bounds) {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["LEVEL_GEOMETRY_UNSUPPORTED"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const levelKnownAt = epoch(level.knownAt, "level.knownAt");
  const barKnownAt = epoch(bar.knownAt, "bar.knownAt");
  const barClosedAt = epoch(bar.sourceClosedAt, "bar.sourceClosedAt");

  // The level must exist before the break bar closes, and before an intrabar
  // touch is observed. Equal timestamps are deliberately rejected to avoid
  // discovering the level and "breaking" it from the same close.
  if (levelKnownAt >= barClosedAt || levelKnownAt > barKnownAt) {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["LEVEL_NOT_KNOWABLE_YET"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (level.sourceEvidenceIds.includes(bar.evidenceId)) {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["LEVEL_USES_BREAK_BAR_EVIDENCE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  if (bar.dataStatus === "STALE") {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["DATA_STALE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }
  if (bar.dataStatus === "GAP") {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["DATA_GAP"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }
  if (definition.mode === "CLOSE_BEYOND" && bar.dataStatus !== "FRESH_COMPLETE") {
    return {
      status: "NO_BREAK",
      events: [],
      reasons: ["BAR_NOT_CLOSED_FOR_CLOSE_BREAK"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const upObserved =
    definition.mode === "CLOSE_BEYOND"
      ? bar.close > bounds.high + definition.tolerance
      : bar.high > bounds.high + definition.tolerance;

  const downObserved =
    definition.mode === "CLOSE_BEYOND"
      ? bar.close < bounds.low - definition.tolerance
      : bar.low < bounds.low - definition.tolerance;

  const events: ResearchStructuralBreakEvent[] = [];

  if (upObserved && eligibleRule.allowedDirections.includes("UP")) {
    events.push({
      breakId: `structural-break:${definition.definitionId}:${level.factId}:${bar.sourceBarId}:UP:${definition.mode}`,
      direction: "UP",
      mode: definition.mode,
      levelFactId: level.factId,
      levelConcept: level.concept,
      scale: level.scale,
      timeframe: level.timeframe,
      levelPrice: bounds.high,
      observedPrice: definition.mode === "CLOSE_BEYOND" ? bar.close : bar.high,
      sourceBarId: bar.sourceBarId,
      sourceClosedAt: bar.sourceClosedAt,
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [...new Set([...level.sourceEvidenceIds, bar.evidenceId])],
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE",
    });
  }

  if (downObserved && eligibleRule.allowedDirections.includes("DOWN")) {
    events.push({
      breakId: `structural-break:${definition.definitionId}:${level.factId}:${bar.sourceBarId}:DOWN:${definition.mode}`,
      direction: "DOWN",
      mode: definition.mode,
      levelFactId: level.factId,
      levelConcept: level.concept,
      scale: level.scale,
      timeframe: level.timeframe,
      levelPrice: bounds.low,
      observedPrice: definition.mode === "CLOSE_BEYOND" ? bar.close : bar.low,
      sourceBarId: bar.sourceBarId,
      sourceClosedAt: bar.sourceClosedAt,
      knownAt: bar.knownAt,
      definitionId: definition.definitionId,
      sourceEvidenceIds: [...new Set([...level.sourceEvidenceIds, bar.evidenceId])],
      authority: "RESEARCH_ONLY",
      authorityEffect: "NONE",
    });
  }

  return {
    status: events.length > 0 ? "BREAK_OBSERVED" : "NO_BREAK",
    events,
    reasons: events.length > 0 ? ["BREAK_OBSERVED"] : ["NO_BREAK"],
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}

/**
 * Applies a versioned vocabulary/profile to a neutral structural-break event.
 * The raw break remains valid even when this function returns UNCLASSIFIED.
 */
export function classifyStructuralBreak(input: {
  readonly breakEvent: ResearchStructuralBreakEvent;
  readonly priorBias: ResearchStructuralBiasEvidence;
  readonly displacement?: ResearchDisplacementEvidence | null;
  readonly evaluatedAt: string;
  readonly definition: ResearchBreakClassificationDefinition;
}): ResearchBreakClassificationResult {
  validateClassificationDefinition(input.definition);

  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");
  const breakKnownAt = epoch(input.breakEvent.knownAt, "breakEvent.knownAt");
  const biasKnownAt = epoch(input.priorBias.knownAt, "priorBias.knownAt");

  if (biasKnownAt >= breakKnownAt) {
    return {
      status: "UNCLASSIFIED_STRUCTURAL_BREAK",
      relation: relationFor(input.priorBias.bias, input.breakEvent.direction),
      classification: null,
      fact: null,
      reasons: ["BIAS_NOT_PRIOR"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }
  if (input.breakEvent.sourceEvidenceIds.includes(input.priorBias.evidenceId)) {
    return {
      status: "UNCLASSIFIED_STRUCTURAL_BREAK",
      relation: relationFor(input.priorBias.bias, input.breakEvent.direction),
      classification: null,
      fact: null,
      reasons: ["BIAS_EVIDENCE_REUSED"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const relation = relationFor(input.priorBias.bias, input.breakEvent.direction);
  const rule = input.definition.rules.find(candidate =>
    candidate.relation === relation &&
    candidate.eligibleScales.includes(input.breakEvent.scale),
  );

  if (!rule) {
    return {
      status: "UNCLASSIFIED_STRUCTURAL_BREAK",
      relation,
      classification: null,
      fact: null,
      reasons: ["NO_PROFILE_RULE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  let factKnownAt = breakKnownAt;
  const extraEvidenceIds = [input.priorBias.evidenceId];

  if (rule.requireDisplacement) {
    if (!input.displacement?.present) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation,
        classification: null,
        fact: null,
        reasons: ["DISPLACEMENT_REQUIRED"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false,
      };
    }

    const displacementKnownAt = epoch(input.displacement.knownAt, "displacement.knownAt");
    if (displacementKnownAt > evaluatedAt) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation,
        classification: null,
        fact: null,
        reasons: ["DISPLACEMENT_FROM_FUTURE"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false,
      };
    }
    if (
      input.displacement.direction !== null &&
      input.displacement.direction !== input.breakEvent.direction
    ) {
      return {
        status: "UNCLASSIFIED_STRUCTURAL_BREAK",
        relation,
        classification: null,
        fact: null,
        reasons: ["DISPLACEMENT_DIRECTION_MISMATCH"],
        authority: "RESEARCH_ONLY",
        liveCapitalAuthority: false,
      };
    }
    factKnownAt = Math.max(factKnownAt, displacementKnownAt);
    extraEvidenceIds.push(input.displacement.evidenceId);
  }

  if (factKnownAt > evaluatedAt) {
    return {
      status: "UNCLASSIFIED_STRUCTURAL_BREAK",
      relation,
      classification: null,
      fact: null,
      reasons: ["DISPLACEMENT_FROM_FUTURE"],
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
    };
  }

  const classification = rule.classification;
  const fact: ResearchMarketStructureFact = {
    factId: `structural-classification:${input.definition.definitionId}:${input.breakEvent.breakId}:${classification}`,
    concept: classification,
    maturity: "RESEARCH_DERIVED",
    scale: input.breakEvent.scale,
    timeframe: input.breakEvent.timeframe,
    side: input.breakEvent.direction === "UP" ? "BUY" : "SELL",
    knownAt: new Date(factKnownAt).toISOString(),
    definitionId: input.definition.definitionId,
    sourceEvidenceIds: [
      ...new Set([...input.breakEvent.sourceEvidenceIds, ...extraEvidenceIds]),
    ],
    geometry: {
      type: "LEVEL",
      price: input.breakEvent.levelPrice,
      startAt: input.breakEvent.sourceClosedAt,
    },
    label: `${String(input.breakEvent.scale ?? "UNSCALED")} ${classification} ${input.breakEvent.direction === "UP" ? "↑" : "↓"}`,
    authority: "RESEARCH_ONLY",
    authorityEffect: "NONE",
  };

  return {
    status: "CLASSIFIED",
    relation,
    classification,
    fact,
    reasons: ["CLASSIFIED"],
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
  };
}
