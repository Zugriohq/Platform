import type { EngineChartPrimitive } from "@zugrio/decision-core";

export const CHART_MODES = ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const;
export type ChartMode = (typeof CHART_MODES)[number];

export const MAX_CALLOUTS = 5;

/**
 * An EXPLAIN callout. LINEAGE callouts are the newest fact and the in-scene
 * upstream facts the engine named for it; RECENT callouts are other recent
 * PRIMARY facts that are not in that ancestry. They are never presented as one chain.
 */
export interface Callout {
  readonly primitive: EngineChartPrimitive;
  readonly kind: "LINEAGE" | "RECENT";
}

export interface ChartSelection {
  /** Primitives drawn on the price field, in causal order. */
  readonly drawn: readonly EngineChartPrimitive[];
  /** Ids whose engine label is offered to the label layout (layout may still drop some). */
  readonly labelled: readonly string[];
  /** EXPLAIN only: at most MAX_CALLOUTS; LINEAGE (causal order) first, then RECENT (causal order). */
  readonly callouts: readonly Callout[];
  /** Presentation emphasis only; identity, geometry, knownAt and maturity are untouched. */
  readonly emphasis: ReadonlyMap<string, "CURRENT" | "HISTORICAL">;
  /** Engine facts that belong to context, not price geometry (e.g. REGIME). */
  readonly context: readonly EngineChartPrimitive[];
}

/**
 * The facts that explain "what changed". Seed: the most recent PRIMARY fact in
 * causal order. LINEAGE: the seed plus its in-scene ancestors, traced through any
 * engine sourceFactIds link (including SECONDARY/DETAIL facts) but emitting only
 * PRIMARY chartable ones, nearest first until the cap. RECENT: remaining slots
 * filled with the newest unrelated PRIMARY facts. A seed with no emitted
 * ancestors has no lineage to show, so it is RECENT too. Nothing is inferred.
 */
export function currentFacts(
  ordered: readonly EngineChartPrimitive[],
  parents: ReadonlyMap<string, readonly string[]>,
): readonly Callout[] {
  const primary = ordered.filter(primitive => primitive.layer !== "REGIME" && primitive.visibility === "PRIMARY");
  const seed = primary.at(-1);
  if (!seed) return [];
  const eligible = new Set(primary.map(primitive => primitive.primitiveId));
  const position = new Map(ordered.map((primitive, index) => [primitive.primitiveId, index]));

  const visited = new Set<string>([seed.primitiveId]);
  const queue = [seed.primitiveId];
  const ancestors: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const parent of parents.get(id) ?? []) {
      if (visited.has(parent)) continue;
      visited.add(parent);
      queue.push(parent);
      if (eligible.has(parent)) ancestors.push(parent);
    }
  }
  ancestors.sort((a, b) => position.get(b)! - position.get(a)!);
  const lineage = new Set<string>();
  if (ancestors.length > 0) {
    lineage.add(seed.primitiveId);
    for (const id of ancestors) {
      if (lineage.size >= MAX_CALLOUTS) break;
      lineage.add(id);
    }
  }
  const recent = new Set<string>();
  for (let index = primary.length - 1; index >= 0 && lineage.size + recent.size < MAX_CALLOUTS; index -= 1) {
    const id = primary[index]!.primitiveId;
    if (!lineage.has(id)) recent.add(id);
  }
  return [
    ...ordered.filter(primitive => lineage.has(primitive.primitiveId)).map(primitive => ({ primitive, kind: "LINEAGE" as const })),
    ...ordered.filter(primitive => recent.has(primitive.primitiveId)).map(primitive => ({ primitive, kind: "RECENT" as const })),
  ];
}

export function selectChartPrimitives(
  ordered: readonly EngineChartPrimitive[],
  parents: ReadonlyMap<string, readonly string[]>,
  mode: ChartMode,
): ChartSelection {
  const chartable = ordered.filter(primitive => primitive.layer !== "REGIME");
  const context = ordered.filter(primitive => primitive.layer === "REGIME");
  const current = currentFacts(ordered, parents);
  const currentIds = new Set(current.map(callout => callout.primitive.primitiveId));

  const drawn =
    mode === "CLEAN" || mode === "EXPLAIN"
      ? chartable.filter(primitive => primitive.visibility === "PRIMARY")
      : mode === "STRUCTURE"
        ? chartable.filter(primitive => primitive.visibility !== "DETAIL")
        : chartable;

  const emphasis = new Map<string, "CURRENT" | "HISTORICAL">(
    drawn.map(primitive => [primitive.primitiveId, currentIds.has(primitive.primitiveId) ? "CURRENT" : "HISTORICAL"]),
  );

  const labelled =
    mode === "CLEAN"
      ? drawn.filter(primitive => currentIds.has(primitive.primitiveId)).map(primitive => primitive.primitiveId)
      : mode === "STRUCTURE"
        ? [
            // Label priority for the layout: current facts, then newest-first history.
            ...drawn.filter(primitive => currentIds.has(primitive.primitiveId)),
            ...[...drawn].reverse().filter(primitive => !currentIds.has(primitive.primitiveId)),
          ].map(primitive => primitive.primitiveId)
        : [];

  return {
    drawn,
    labelled,
    callouts: mode === "EXPLAIN" ? current : [],
    emphasis,
    context,
  };
}
