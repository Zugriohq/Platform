import type { EngineChartPrimitive } from "@zugrio/decision-core";

export const CHART_MODES = ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const;
export type ChartMode = (typeof CHART_MODES)[number];

export const MAX_CALLOUTS = 5;

export interface ChartSelection {
  /** Primitives drawn on the price field, in causal order. */
  readonly drawn: readonly EngineChartPrimitive[];
  /** Ids whose engine label is offered to the label layout (layout may still drop some). */
  readonly labelled: readonly string[];
  /** EXPLAIN only: at most MAX_CALLOUTS primitives, in causal order. */
  readonly callouts: readonly EngineChartPrimitive[];
  /** Presentation emphasis only; identity, geometry, knownAt and maturity are untouched. */
  readonly emphasis: ReadonlyMap<string, "CURRENT" | "HISTORICAL">;
  /** Engine facts that belong to context, not price geometry (e.g. REGIME). */
  readonly context: readonly EngineChartPrimitive[];
}

/**
 * The facts that explain "what changed": the most recent PRIMARY fact in causal
 * order, its in-scene lineage ancestors, then the next most recent PRIMARY facts,
 * capped at MAX_CALLOUTS and returned in causal order. Lineage comes only from
 * engine sourceFactIds (see causalOrder.ts); nothing is inferred.
 */
export function currentFacts(
  ordered: readonly EngineChartPrimitive[],
  parents: ReadonlyMap<string, readonly string[]>,
): readonly EngineChartPrimitive[] {
  const primary = ordered.filter(primitive => primitive.layer !== "REGIME" && primitive.visibility === "PRIMARY");
  const seed = primary.at(-1);
  if (!seed) return [];
  const eligible = new Set(primary.map(primitive => primitive.primitiveId));
  const position = new Map(ordered.map((primitive, index) => [primitive.primitiveId, index]));

  const chosen = new Set<string>([seed.primitiveId]);
  const queue = [seed.primitiveId];
  const ancestors: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const parent of parents.get(id) ?? []) {
      if (!eligible.has(parent) || chosen.has(parent) || ancestors.includes(parent)) continue;
      ancestors.push(parent);
      queue.push(parent);
    }
  }
  // Nearest ancestors first (latest in causal order), until the cap.
  ancestors.sort((a, b) => position.get(b)! - position.get(a)!);
  for (const id of ancestors) {
    if (chosen.size >= MAX_CALLOUTS) break;
    chosen.add(id);
  }
  for (let index = primary.length - 1; index >= 0 && chosen.size < MAX_CALLOUTS; index -= 1) {
    chosen.add(primary[index]!.primitiveId);
  }
  return ordered.filter(primitive => chosen.has(primitive.primitiveId));
}

export function selectChartPrimitives(
  ordered: readonly EngineChartPrimitive[],
  parents: ReadonlyMap<string, readonly string[]>,
  mode: ChartMode,
): ChartSelection {
  const chartable = ordered.filter(primitive => primitive.layer !== "REGIME");
  const context = ordered.filter(primitive => primitive.layer === "REGIME");
  const current = currentFacts(ordered, parents);
  const currentIds = new Set(current.map(primitive => primitive.primitiveId));

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
