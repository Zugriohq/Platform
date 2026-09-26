import {
  detectLiquiditySweep,
  identifyEqualLevelPair,
  type EqualLevelPairDefinition,
  type ResearchMarketStructureFact,
  type ResearchStructureBar,
  type SweepDefinition,
} from "./marketMap.js";

export interface ResearchEqualLiquidityDefinition extends EqualLevelPairDefinition {
  readonly pairing: "ADJACENT_CONFIRMED_PIVOTS";
}

function epoch(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid ISO timestamp: ${value}`);
  return parsed;
}

function pointTime(fact: ResearchMarketStructureFact): number {
  if (fact.geometry.type !== "POINT") {
    throw new Error(`liquidity pivot must use POINT geometry: ${fact.factId}`);
  }
  return epoch(fact.geometry.time, "pivot.geometry.time");
}

/**
 * Derives equal-liquidity zones from adjacent already-confirmed same-type pivots.
 * "Adjacent" is explicit policy here to avoid combinatorial hindsight pairing.
 */
export function deriveEqualLiquidityLevels(input: {
  readonly evaluatedAt: string;
  readonly pivots: readonly ResearchMarketStructureFact[];
  readonly definition: ResearchEqualLiquidityDefinition;
}): readonly ResearchMarketStructureFact[] {
  if (input.definition.pairing !== "ADJACENT_CONFIRMED_PIVOTS") {
    throw new Error("unsupported equal-liquidity pairing policy");
  }
  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");

  const usable = input.pivots
    .filter(fact =>
      (fact.concept === "SWING_HIGH" || fact.concept === "SWING_LOW") &&
      fact.geometry.type === "POINT" &&
      epoch(fact.knownAt, "fact.knownAt") <= evaluatedAt
    )
    .sort((a, b) => {
      const keyA = [a.timeframe, a.scale ?? "NONE", a.concept].join("|");
      const keyB = [b.timeframe, b.scale ?? "NONE", b.concept].join("|");
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      const byTime = pointTime(a) - pointTime(b);
      if (byTime !== 0) return byTime;
      return a.factId.localeCompare(b.factId);
    });

  const groups = new Map<string, ResearchMarketStructureFact[]>();
  for (const fact of usable) {
    const key = [fact.timeframe, fact.scale ?? "NONE", fact.concept].join("|");
    const group = groups.get(key) ?? [];
    group.push(fact);
    groups.set(key, group);
  }

  const result: ResearchMarketStructureFact[] = [];
  for (const group of groups.values()) {
    for (let index = 1; index < group.length; index += 1) {
      const first = group[index - 1];
      const second = group[index];
      if (!first || !second) continue;
      const equal = identifyEqualLevelPair(first, second, input.definition);
      if (equal) result.push(equal);
    }
  }

  return result.sort((a, b) => {
    const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
    if (byKnownAt !== 0) return byKnownAt;
    return a.factId.localeCompare(b.factId);
  });
}

/**
 * Observes sweep/reclaim facts only from bars knowable by evaluatedAt.
 * It intentionally does not consume the level or infer motive.
 */
export function deriveLiquiditySweeps(input: {
  readonly evaluatedAt: string;
  readonly levels: readonly ResearchMarketStructureFact[];
  readonly bars: readonly ResearchStructureBar[];
  readonly definition: SweepDefinition;
}): readonly ResearchMarketStructureFact[] {
  const evaluatedAt = epoch(input.evaluatedAt, "evaluatedAt");
  const levels = input.levels.filter(level =>
    epoch(level.knownAt, "level.knownAt") <= evaluatedAt
  );
  const bars = input.bars.filter(bar =>
    epoch(bar.knownAt, "bar.knownAt") <= evaluatedAt
  );

  const result: ResearchMarketStructureFact[] = [];
  const ids = new Set<string>();

  for (const level of levels) {
    for (const bar of bars) {
      const sweep = detectLiquiditySweep(level, bar, input.definition);
      if (!sweep || ids.has(sweep.factId)) continue;
      ids.add(sweep.factId);
      result.push(sweep);
    }
  }

  return result.sort((a, b) => {
    const byKnownAt = epoch(a.knownAt, "knownAt") - epoch(b.knownAt, "knownAt");
    if (byKnownAt !== 0) return byKnownAt;
    return a.factId.localeCompare(b.factId);
  });
}
