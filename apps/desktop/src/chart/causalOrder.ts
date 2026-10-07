import type { EngineChartPrimitive } from "@zugrio/decision-core";

/**
 * Presentation ordering from engine-owned lineage only.
 *
 * Contract assumption (documented in projectMarketMapToChartScene): a primitive's
 * own engine fact is `sourceFactIds[0]`; the remaining ids are upstream facts.
 * Primitives with no sourceFactIds (fixture annotations, regime) own no fact and
 * take part in ordering only through knownAt / visibility / scale / id.
 *
 * A dependency edge A → B exists only when B's sourceFactIds names A's own fact.
 * Nothing is inferred from labels, concepts, prices or times.
 */

const VISIBILITY_RANK: Record<EngineChartPrimitive["visibility"], number> = { PRIMARY: 0, SECONDARY: 1, DETAIL: 2 };
const SCALE_RANK = { EXTERNAL: 0, INTERMEDIATE: 1, INTERNAL: 2 } as const;

export function ownFactId(primitive: EngineChartPrimitive): string | null {
  return primitive.sourceFactIds[0] ?? null;
}

/** Deterministic tie-break when lineage does not decide: knownAt, visibility, scale, primitiveId. */
export function comparePresentation(a: EngineChartPrimitive, b: EngineChartPrimitive): number {
  const byKnown = Date.parse(a.knownAt) - Date.parse(b.knownAt);
  if (byKnown !== 0) return byKnown;
  const byVisibility = VISIBILITY_RANK[a.visibility] - VISIBILITY_RANK[b.visibility];
  if (byVisibility !== 0) return byVisibility;
  const byScale = (a.scale === null ? 3 : SCALE_RANK[a.scale]) - (b.scale === null ? 3 : SCALE_RANK[b.scale]);
  if (byScale !== 0) return byScale;
  return a.primitiveId < b.primitiveId ? -1 : a.primitiveId > b.primitiveId ? 1 : 0;
}

/** primitiveId → primitiveIds of the in-scene primitives it names as upstream facts (sorted). */
export function lineageParents(primitives: readonly EngineChartPrimitive[]): ReadonlyMap<string, readonly string[]> {
  const ownerOf = new Map<string, string>();
  for (const primitive of primitives) {
    const own = ownFactId(primitive);
    if (own !== null) ownerOf.set(own, primitive.primitiveId);
  }
  const parents = new Map<string, readonly string[]>();
  for (const primitive of primitives) {
    const found = new Set<string>();
    for (const factId of primitive.sourceFactIds) {
      const owner = ownerOf.get(factId);
      if (owner !== undefined && owner !== primitive.primitiveId) found.add(owner);
    }
    parents.set(primitive.primitiveId, [...found].sort());
  }
  return parents;
}

export type CausalOrderResult =
  | { readonly ok: true; readonly order: readonly EngineChartPrimitive[]; readonly parents: ReadonlyMap<string, readonly string[]> }
  | { readonly ok: false; readonly cyclicPrimitiveIds: readonly string[] };

/**
 * Topological order over lineage edges (parents before children); ties resolved by
 * comparePresentation. Iterative (Kahn), so malformed cyclic lineage terminates and
 * is reported instead of recursing forever.
 */
export function causalOrder(primitives: readonly EngineChartPrimitive[]): CausalOrderResult {
  const parents = lineageParents(primitives);
  const byId = new Map(primitives.map(primitive => [primitive.primitiveId, primitive]));
  const children = new Map<string, string[]>();
  const pending = new Map<string, number>();
  for (const primitive of primitives) {
    const own = parents.get(primitive.primitiveId) ?? [];
    pending.set(primitive.primitiveId, own.length);
    for (const parent of own) {
      const list = children.get(parent) ?? [];
      list.push(primitive.primitiveId);
      children.set(parent, list);
    }
  }

  const ready = primitives.filter(primitive => pending.get(primitive.primitiveId) === 0).sort(comparePresentation);
  const order: EngineChartPrimitive[] = [];
  while (ready.length > 0) {
    const next = ready.shift()!;
    order.push(next);
    for (const childId of children.get(next.primitiveId) ?? []) {
      const remaining = (pending.get(childId) ?? 0) - 1;
      pending.set(childId, remaining);
      if (remaining === 0) insertSorted(ready, byId.get(childId)!);
    }
  }

  if (order.length !== primitives.length) {
    const placed = new Set(order.map(primitive => primitive.primitiveId));
    return {
      ok: false,
      cyclicPrimitiveIds: primitives.map(primitive => primitive.primitiveId).filter(id => !placed.has(id)).sort(),
    };
  }
  return { ok: true, order, parents };
}

function insertSorted(list: EngineChartPrimitive[], item: EngineChartPrimitive): void {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (comparePresentation(list[mid]!, item) <= 0) low = mid + 1;
    else high = mid;
  }
  list.splice(low, 0, item);
}
