import {
  RESEARCH_CONCEPT_MATURITIES,
  exceedsConceptMaturityCeiling,
  isEngineChartPrimitiveConcept,
  type EngineChartPrimitive,
  type EngineChartScene,
} from "@zugrio/decision-core";
import { causalOrder, ownFactId } from "./causalOrder";

/**
 * Presentation boundary. Every scene (cloud or explicit local replay) passes
 * through here before anything is drawn. A scene that is not trustworthy for the
 * displayed frame is rejected as a whole: nothing is silently filtered out and
 * drawn as though the rest were fine.
 */
export type RenderableScene =
  | {
      readonly ok: true;
      readonly scene: EngineChartScene;
      /** Engine primitives in causal (lineage, then presentation) order; exact duplicates collapsed. */
      readonly primitives: readonly EngineChartPrimitive[];
      readonly parents: ReadonlyMap<string, readonly string[]>;
    }
  | { readonly ok: false; readonly reason: string };

const LAYERS = new Set(["REGIME","STRUCTURE","LIQUIDITY","IMBALANCE","SETUP","PATTERN","ENTRY","INVALIDATION","OBJECTIVE","DIAGNOSTIC","ADVISORY"]);
const VISIBILITY = new Set(["PRIMARY","SECONDARY","DETAIL"]);
const SCALES = new Set(["INTERNAL","INTERMEDIATE","EXTERNAL"]);
const MATURITIES = new Set<string>(RESEARCH_CONCEPT_MATURITIES);
const STYLE_TOKENS = new Set(["STRUCTURE_PRIMARY","STRUCTURE_SECONDARY","LIQUIDITY","IMBALANCE","SETUP","PATTERN","ENTRY","ADVISORY"]);

function time(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates geometry and returns its latest time, or a reason string. */
function checkGeometry(primitive: EngineChartPrimitive): { latest: number | null } | string {
  const geometry = primitive.geometry as unknown as Record<string, unknown>;
  const optionalTime = (key: "startAt" | "endAt"): number | null | "bad" => {
    if (geometry[key] === undefined) return null;
    return time(geometry[key]) ?? "bad";
  };
  switch (geometry.type) {
    case "POINT": {
      const at = time(geometry.time);
      if (at === null || !finite(geometry.price)) return "POINT geometry is not finite";
      return { latest: at };
    }
    case "LEVEL":
    case "ZONE": {
      if (geometry.type === "LEVEL" && !finite(geometry.price)) return "LEVEL price is not finite";
      if (geometry.type === "ZONE") {
        if (!finite(geometry.low) || !finite(geometry.high)) return "ZONE bounds are not finite";
        if (geometry.low > geometry.high) return "ZONE low exceeds high";
      }
      const start = optionalTime("startAt");
      const end = optionalTime("endAt");
      if (start === "bad" || end === "bad") return `${String(geometry.type)} time bound is invalid`;
      if (start !== null && end !== null && start > end) return `${String(geometry.type)} starts after it ends`;
      return { latest: end ?? start };
    }
    case "PATH": {
      const points = geometry.points;
      if (!Array.isArray(points) || points.length < 2) return "PATH needs at least two points";
      let previous = -Infinity;
      for (const point of points as unknown[]) {
        const record = point as Record<string, unknown> | null;
        const at = time(record?.time);
        if (at === null || !finite(record?.price)) return "PATH point is not finite";
        if (at < previous) return "PATH points are not chronological";
        previous = at;
      }
      return { latest: previous };
    }
    default:
      return "unsupported geometry type";
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function prepareSceneForRender(
  scene: EngineChartScene | undefined,
  expectedEvaluatedAt: string | undefined,
): RenderableScene {
  if (!scene) return { ok: false, reason: "No engine chart scene is available for this frame." };
  if (scene.authority !== "RESEARCH_ONLY" || scene.liveCapitalAuthority !== false) {
    return { ok: false, reason: "Chart scene does not carry research-only / no-live-capital authority." };
  }
  const sceneTime = time(scene.evaluatedAt);
  const frameTime = time(expectedEvaluatedAt);
  if (sceneTime === null || frameTime === null || sceneTime !== frameTime) {
    return { ok: false, reason: "Chart scene was evaluated for a different frame than the one displayed." };
  }

  if (!Array.isArray(scene.primitives)) return { ok: false, reason: "Chart scene has no primitive list." };
  const byId = new Map<string, EngineChartPrimitive>();
  const signatureById = new Map<string, string>();
  for (const primitive of scene.primitives as readonly EngineChartPrimitive[]) {
    if (primitive === null || typeof primitive !== "object") return { ok: false, reason: "Chart primitive is not an object." };
    const id = primitive.primitiveId;
    if (typeof id !== "string" || id.length === 0) return { ok: false, reason: "Chart primitive has no id." };
    const signature = canonical(primitive);
    const seen = signatureById.get(id);
    if (seen !== undefined) {
      if (seen !== signature) return { ok: false, reason: `Conflicting chart primitives share id ${id}.` };
      continue; // exact duplicate: one identity, drawn once
    }
    if (!isEngineChartPrimitiveConcept(primitive.concept)) return { ok: false, reason: `Unsupported chart primitive concept ${String(primitive.concept)}.` };
    if (!LAYERS.has(primitive.layer)) return { ok: false, reason: `Unsupported chart layer on ${id}.` };
    // REGIME is context, never price geometry: the concept and the layer must agree.
    if ((primitive.concept === "REGIME") !== (primitive.layer === "REGIME")) {
      return { ok: false, reason: `Chart primitive ${id} mixes the REGIME concept and layer.` };
    }
    if (!MATURITIES.has(primitive.maturity)) return { ok: false, reason: `Unsupported maturity on ${id}.` };
    if (!(primitive.scale === null || SCALES.has(primitive.scale))) return { ok: false, reason: `Unsupported structure scale on ${id}.` };
    if (typeof primitive.label !== "string" || primitive.label.trim().length === 0) return { ok: false, reason: `Chart primitive ${id} has no label.` };
    if (!stringArray(primitive.sourceFactIds)) return { ok: false, reason: `Chart primitive ${id} has malformed sourceFactIds.` };
    if (!stringArray(primitive.sourceEvidenceIds)) return { ok: false, reason: `Chart primitive ${id} has malformed sourceEvidenceIds.` };
    if (!VISIBILITY.has(primitive.visibility)) return { ok: false, reason: `Unsupported visibility on ${id}.` };
    if (!STYLE_TOKENS.has(primitive.styleToken)) return { ok: false, reason: `Unsupported style token on ${id}.` };
    if (primitive.authorityEffect !== "NONE") return { ok: false, reason: `Chart primitive ${id} claims an authority effect.` };
    if (exceedsConceptMaturityCeiling(primitive.concept, primitive.maturity)) {
      return { ok: false, reason: `Chart primitive ${id} carries promoted maturity.` };
    }
    const knownAt = time(primitive.knownAt);
    if (knownAt === null || knownAt > sceneTime) return { ok: false, reason: `Chart primitive ${id} is not known at the scene time.` };
    const geometry = checkGeometry(primitive);
    if (typeof geometry === "string") return { ok: false, reason: `Chart primitive ${id}: ${geometry}.` };
    if (geometry.latest !== null && geometry.latest > knownAt) {
      return { ok: false, reason: `Chart primitive ${id} has geometry later than its knownAt.` };
    }
    byId.set(id, primitive);
    signatureById.set(id, signature);
  }

  const unique = [...byId.values()];
  const owners = new Map<string, string>();
  for (const primitive of unique) {
    const own = ownFactId(primitive);
    if (own === null) continue;
    const other = owners.get(own);
    if (other !== undefined) return { ok: false, reason: `Two chart primitives (${other}, ${primitive.primitiveId}) claim engine fact ${own}.` };
    owners.set(own, primitive.primitiveId);
  }

  const ordered = causalOrder(unique);
  if (!ordered.ok) {
    return { ok: false, reason: `Chart lineage is cyclic (${ordered.cyclicPrimitiveIds.join(", ")}).` };
  }
  for (const primitive of unique) {
    for (const parentId of ordered.parents.get(primitive.primitiveId) ?? []) {
      const parent = byId.get(parentId)!;
      if (Date.parse(parent.knownAt) > Date.parse(primitive.knownAt)) {
        return { ok: false, reason: `Chart primitive ${primitive.primitiveId} depends on a fact known after it.` };
      }
    }
  }
  return { ok: true, scene, primitives: ordered.order, parents: ordered.parents };
}
