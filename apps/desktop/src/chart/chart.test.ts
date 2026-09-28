import { describe, expect, it } from "vitest";
import {
  alphaScenarios,
  buildDecisionCase,
  buildReplayChartScene,
  type EngineChartPrimitive,
  type EngineChartScene,
} from "@zugrio/decision-core";
import { causalOrder } from "./causalOrder";
import { anchorFor, buildScale, horizontalSpan, PLOT } from "./geometry";
import { DEFAULT_LAYOUT, layoutLabels } from "./layout";
import { MAX_CALLOUTS, selectChartPrimitives, type ChartMode } from "./modes";
import { prepareSceneForRender } from "./sceneGuard";

const AT = "2026-09-24T10:00:00Z";
const t = (minute: number) => new Date(Date.UTC(2026, 8, 24, 9, 0, 0) + minute * 60_000).toISOString();

function prim(id: string, over: Partial<EngineChartPrimitive> = {}): EngineChartPrimitive {
  return {
    primitiveId: `primitive:${id}`,
    layer: "STRUCTURE",
    concept: "SWING_HIGH",
    maturity: "DETERMINISTIC_FACT",
    scale: "EXTERNAL",
    label: id.toUpperCase(),
    knownAt: t(10),
    geometry: { type: "POINT", time: t(5), price: 1.1 },
    sourceFactIds: [id],
    sourceEvidenceIds: [`ev:${id}`],
    visibility: "PRIMARY",
    styleToken: "STRUCTURE_PRIMARY",
    authorityEffect: "NONE",
    ...over,
  };
}

function scene(primitives: readonly EngineChartPrimitive[], over: Partial<EngineChartScene> = {}): EngineChartScene {
  return {
    sceneId: "scene:test",
    instrument: "EURUSD",
    timeframe: "M5",
    evaluatedAt: AT,
    strategyId: "s",
    strategyVersion: "1",
    regimeLabel: null,
    regimeEvidenceId: null,
    regimeDefinitionId: null,
    regimeKnownAt: null,
    regimeContext: { status: "UNAVAILABLE", measurementId: null, profileId: null, profileVersion: null, matchingRuleIds: [], reasons: [] },
    routeContext: { status: "UNAVAILABLE", families: [], calibrationStatus: null },
    primitives,
    authority: "RESEARCH_ONLY",
    liveCapitalAuthority: false,
    ...over,
  };
}

function ready(primitives: readonly EngineChartPrimitive[], over: Partial<EngineChartScene> = {}) {
  const prepared = prepareSceneForRender(scene(primitives, over), over.evaluatedAt ?? AT);
  if (!prepared.ok) throw new Error(prepared.reason);
  return prepared;
}

function rejected(primitives: readonly EngineChartPrimitive[], over: Partial<EngineChartScene> = {}, frameAt = AT): string {
  const prepared = prepareSceneForRender(scene(primitives, over), frameAt);
  if (prepared.ok) throw new Error("expected the scene to be rejected");
  return prepared.reason;
}

/** Dense adversarial scene: 120 facts, many at identical coordinates, mixed geometry/visibility. */
function denseScene(): EngineChartPrimitive[] {
  const out: EngineChartPrimitive[] = [];
  const concepts = ["SWING_HIGH", "SWING_LOW", "BOS", "CHOCH", "MSS", "EQUAL_HIGHS", "LIQUIDITY_SWEEP", "FVG", "TRENDLINE_TOUCH"] as const;
  for (let index = 0; index < 120; index += 1) {
    const concept = concepts[index % concepts.length]!;
    const minute = index < 20 ? 30 : index % 50;
    const geometry: EngineChartPrimitive["geometry"] =
      index % 5 === 0 ? { type: "ZONE", low: 1.1 + (index % 7) * 1e-4, high: 1.1 + (index % 7) * 1e-4 + 2e-4, startAt: t(minute) }
        : index % 5 === 1 ? { type: "LEVEL", price: 1.1005, startAt: t(minute) }
          : { type: "POINT", time: t(minute), price: index < 20 ? 1.1 : 1.1 + (index % 13) * 1e-4 };
    out.push(prim(`dense-${String(index).padStart(3, "0")}`, {
      concept,
      maturity: concept === "TRENDLINE_TOUCH" ? "RESEARCH_DERIVED" : "DETERMINISTIC_FACT",
      label: `${concept.replaceAll("_", " ")} ${"WITH A VERY LONG ENGINE LABEL ".repeat(index % 3)}${index}`,
      // non-decreasing in index, so an upstream fact (index - 4) is never known after its child
      knownAt: t(50 + Math.floor(index / 12)),
      geometry,
      visibility: index % 3 === 0 ? "PRIMARY" : index % 3 === 1 ? "SECONDARY" : "DETAIL",
      sourceFactIds: index > 0 && index % 4 === 0 ? [`dense-${String(index).padStart(3, "0")}`, `dense-${String(index - 4).padStart(3, "0")}`] : [`dense-${String(index).padStart(3, "0")}`],
    }));
  }
  return out;
}

describe("scene guard (presentation boundary)", () => {
  it("accepts every real replay frame from decision-core, for the frame it belongs to", () => {
    for (const scenario of alphaScenarios) {
      scenario.frames.forEach((_, index) => {
        const prepared = prepareSceneForRender(buildReplayChartScene(scenario, index), buildDecisionCase(scenario, index).current.evaluatedAt);
        expect(prepared.ok, `${scenario.id}#${index}: ${prepared.ok ? "" : prepared.reason}`).toBe(true);
      });
    }
  });

  it("23: rejects a primitive known after the scene time", () => {
    expect(rejected([prim("a", { knownAt: t(61) })])).toMatch(/not known at the scene time/);
  });

  it("rejects geometry later than the primitive's knownAt", () => {
    expect(rejected([prim("a", { knownAt: t(10), geometry: { type: "POINT", time: t(11), price: 1.1 } })])).toMatch(/later than its knownAt/);
  });

  it("24: rejects a scene evaluated for a different frame", () => {
    expect(rejected([prim("a")], {}, t(59))).toMatch(/different frame/);
  });

  it("34: an exact duplicate primitive is drawn once", () => {
    const a = prim("a");
    const prepared = ready([a, { ...a }]);
    expect(prepared.primitives.map(item => item.primitiveId)).toEqual(["primitive:a"]);
  });

  it("35: conflicting primitives sharing an id fail closed", () => {
    expect(rejected([prim("a"), prim("a", { label: "OTHER" })])).toMatch(/Conflicting chart primitives/);
  });

  it("two distinct primitives claiming the same engine fact fail closed", () => {
    expect(rejected([prim("a"), prim("b", { sourceFactIds: ["a"] })])).toMatch(/claim engine fact/);
  });

  it("36: identical labels on different facts stay distinct", () => {
    const prepared = ready([prim("a", { label: "BOS" }), prim("b", { label: "BOS" })]);
    expect(prepared.primitives.map(item => item.primitiveId)).toEqual(["primitive:a", "primitive:b"]);
  });

  it("37: rejects an unsupported concept and unsupported geometry", () => {
    expect(rejected([prim("a", { concept: "RISING_CHANNEL_WEDGE" as never })])).toMatch(/Unsupported chart primitive concept/);
    expect(rejected([prim("a", { geometry: { type: "CIRCLE", x: 1 } as never })])).toMatch(/unsupported geometry/);
  });

  it("38: rejects promoted trendline maturity", () => {
    expect(rejected([prim("a", { concept: "TRENDLINE_BREAK", maturity: "DETERMINISTIC_FACT" })])).toMatch(/promoted maturity/);
  });

  it("39: rejects live-capital scene metadata and authority effects", () => {
    expect(rejected([prim("a")], { liveCapitalAuthority: true as never })).toMatch(/no-live-capital/);
    expect(rejected([prim("a", { authorityEffect: "ALLOW" as never })])).toMatch(/authority effect/);
  });

  it("rejects non-finite geometry, inverted zones and non-chronological paths", () => {
    expect(rejected([prim("a", { geometry: { type: "POINT", time: t(5), price: Number.NaN } })])).toMatch(/not finite/);
    expect(rejected([prim("a", { geometry: { type: "LEVEL", price: Number.POSITIVE_INFINITY } })])).toMatch(/not finite/);
    expect(rejected([prim("a", { geometry: { type: "ZONE", low: 2, high: 1 } })])).toMatch(/low exceeds high/);
    expect(rejected([prim("a", { geometry: { type: "PATH", points: [{ time: t(5), price: 1 }, { time: t(4), price: 1 }] } })])).toMatch(/chronological/);
    expect(rejected([prim("a", { geometry: { type: "PATH", points: [{ time: t(5), price: 1 }] } })])).toMatch(/two points/);
  });

  it("28: cyclic lineage is rejected deterministically without hanging", () => {
    const a = prim("a", { sourceFactIds: ["a", "b"] });
    const b = prim("b", { sourceFactIds: ["b", "a"] });
    const reason = rejected([a, b]);
    expect(reason).toMatch(/cyclic \(primitive:a, primitive:b\)/);
    expect(rejected([b, a])).toBe(reason);
  });

  it("rejects lineage where a fact depends on a fact known after it", () => {
    expect(rejected([prim("a", { knownAt: t(20) }), prim("b", { knownAt: t(15), sourceFactIds: ["b", "a"] })])).toMatch(/known after it/);
  });

  it("REVIEW-4: REGIME concept and REGIME layer must agree", () => {
    expect(rejected([prim("r", { concept: "REGIME", layer: "STRUCTURE", sourceFactIds: [], geometry: { type: "LEVEL", price: 0 } })])).toMatch(/REGIME/);
    expect(rejected([prim("x", { concept: "BOS", layer: "REGIME", maturity: "RESEARCH_DERIVED" })])).toMatch(/REGIME/);
  });

  it("REVIEW-5: malformed fields fail closed instead of crashing or reordering", () => {
    expect(rejected([prim("a", { sourceFactIds: undefined as never })])).toMatch(/sourceFactIds/);
    expect(rejected([prim("a", { sourceEvidenceIds: "ev" as never })])).toMatch(/sourceEvidenceIds/);
    expect(rejected([prim("a", { sourceFactIds: ["a", 7 as never] })])).toMatch(/sourceFactIds/);
    expect(rejected([prim("a", { scale: "GALACTIC" as never })])).toMatch(/scale/);
    expect(rejected([prim("a", { label: "" })])).toMatch(/label/);
    expect(rejected([prim("a", { label: 5 as never })])).toMatch(/label/);
    expect(rejected([prim("a", { maturity: "PROMOTED_XYZ" as never })])).toMatch(/maturity/);
    expect(rejected([prim("a", { knownAt: 12 as never })])).toMatch(/not known/);
    expect(rejected([prim("a", { primitiveId: 42 as never })])).toMatch(/no id/);
    expect(prepareSceneForRender({ ...scene([]), primitives: null as never }, AT).ok).toBe(false);
  });

  it("does not mutate the scene it validates", () => {
    const input = scene([prim("b", { knownAt: t(20) }), prim("a")]);
    const snapshot = JSON.stringify(input);
    prepareSceneForRender(input, AT);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("causal order from engine lineage", () => {
  it("25: children follow their named upstream facts regardless of input or knownAt order", () => {
    const pivot = prim("pivot", { knownAt: t(10) });
    const line = prim("line", { knownAt: t(20), sourceFactIds: ["line", "pivot"], concept: "TRENDLINE_SUPPORT", maturity: "RESEARCH_DERIVED" });
    const touch = prim("touch", { knownAt: t(20), sourceFactIds: ["touch", "line"], concept: "TRENDLINE_TOUCH", maturity: "RESEARCH_DERIVED", visibility: "PRIMARY" });
    for (const input of [[touch, line, pivot], [line, touch, pivot], [pivot, touch, line]]) {
      expect(ready(input).primitives.map(item => item.primitiveId)).toEqual(["primitive:pivot", "primitive:line", "primitive:touch"]);
    }
  });

  it("26: equal-knownAt unrelated facts order deterministically by visibility, scale, then id", () => {
    const facts = [
      prim("c", { visibility: "SECONDARY" }),
      prim("b", { scale: "INTERNAL" }),
      prim("a", { scale: "INTERNAL" }),
      prim("d"),
    ];
    const expected = ["primitive:d", "primitive:a", "primitive:b", "primitive:c"];
    expect(ready(facts).primitives.map(item => item.primitiveId)).toEqual(expected);
    expect(ready([...facts].reverse()).primitives.map(item => item.primitiveId)).toEqual(expected);
  });

  it("reordered sourceFactIds (own fact not first) fail closed instead of inventing lineage", () => {
    const pivot = prim("pivot");
    const reordered = prim("line", { sourceFactIds: ["pivot", "line"], knownAt: t(20) });
    expect(rejected([pivot, reordered])).toMatch(/claim engine fact pivot/);
  });

  it("27: missing upstream facts and label similarity never create lineage", () => {
    const orphan = prim("orphan", { sourceFactIds: ["orphan", "not-in-scene"], label: "PARENT" });
    const lookalike = prim("child", { label: "PARENT CHILD", knownAt: t(9) });
    const prepared = ready([orphan, lookalike]);
    expect(prepared.parents.get("primitive:orphan")).toEqual([]);
    expect(prepared.parents.get("primitive:child")).toEqual([]);
  });

  it("orders a 400-fact chain without recursion", () => {
    const chain = Array.from({ length: 400 }, (_, index) =>
      prim(`n${index}`, { sourceFactIds: index === 0 ? ["n0"] : [`n${index}`, `n${index - 1}`] }));
    const result = causalOrder([...chain].reverse());
    expect(result.ok && result.order.map(item => item.primitiveId)).toEqual(chain.map(item => item.primitiveId));
  });
});

describe("mode selection", () => {
  const facts = [
    prim("primary-old", { knownAt: t(2), geometry: { type: "POINT", time: t(1), price: 1.1 } }),
    prim("secondary", { visibility: "SECONDARY" }),
    prim("detail", { visibility: "DETAIL", maturity: "ADVISORY_ONLY", concept: "ELLIOTT_WAVE", layer: "ADVISORY", styleToken: "ADVISORY" }),
    prim("regime", { layer: "REGIME", concept: "REGIME", sourceFactIds: [], geometry: { type: "LEVEL", price: 0 } }),
    ...Array.from({ length: 7 }, (_, index) => prim(`p${index}`, { knownAt: t(20 + index) })),
  ];
  const prepared = ready(facts);
  const select = (mode: ChartMode) => selectChartPrimitives(prepared.primitives, prepared.parents, mode);

  it("2/4: CLEAN and EXPLAIN draw the same facts; STRUCTURE adds SECONDARY; RESEARCH adds DETAIL", () => {
    const ids = (mode: ChartMode) => select(mode).drawn.map(item => item.primitiveId);
    expect(ids("EXPLAIN")).toEqual(ids("CLEAN"));
    expect(ids("CLEAN")).not.toContain("primitive:secondary");
    expect(ids("STRUCTURE")).toContain("primitive:secondary");
    expect(ids("STRUCTURE")).not.toContain("primitive:detail");
    expect(ids("RESEARCH")).toContain("primitive:detail");
  });

  it("43: REGIME is context, never drawn as price geometry, in every mode", () => {
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const) {
      expect(select(mode).drawn.some(item => item.layer === "REGIME")).toBe(false);
      expect(select(mode).context.map(item => item.primitiveId)).toEqual(["primitive:regime"]);
    }
  });

  it("29: EXPLAIN never exceeds five callouts and they are in causal order", () => {
    const callouts = select("EXPLAIN").callouts;
    // No lineage among these facts: the five newest PRIMARY facts, all marked RECENT, oldest first.
    expect(callouts.map(item => [item.primitive.primitiveId, item.kind])).toEqual(
      ["p2", "p3", "p4", "p5", "p6"].map(id => [`primitive:${id}`, "RECENT"]),
    );
    expect(selectChartPrimitives(ready(denseScene()).primitives, ready(denseScene()).parents, "EXPLAIN").callouts.length).toBeLessThanOrEqual(MAX_CALLOUTS);
  });

  it("EXPLAIN prefers the newest fact's engine lineage over unrelated recent facts", () => {
    const base = prim("base", { knownAt: t(1), geometry: { type: "POINT", time: t(0), price: 1.1 } });
    const noise = Array.from({ length: 6 }, (_, index) => prim(`noise${index}`, { knownAt: t(10 + index) }));
    const leaf = prim("leaf", { knownAt: t(30), sourceFactIds: ["leaf", "base"] });
    const chosen = selectChartPrimitives(ready([base, ...noise, leaf]).primitives, ready([base, ...noise, leaf]).parents, "EXPLAIN").callouts;
    expect(chosen.filter(item => item.kind === "LINEAGE").map(item => item.primitive.primitiveId)).toEqual(["primitive:base", "primitive:leaf"]);
    expect(chosen.filter(item => item.kind === "RECENT").map(item => item.primitive.primitiveId)).toEqual(["primitive:noise3", "primitive:noise4", "primitive:noise5"]);
  });

  it("REVIEW-2: lineage is traced through non-PRIMARY links and never mixed with unrelated recent facts", () => {
    const a = prim("a", { knownAt: t(1), geometry: { type: "POINT", time: t(0), price: 1.1 } });
    const b = prim("b", { knownAt: t(2), visibility: "SECONDARY", sourceFactIds: ["b", "a"], geometry: { type: "POINT", time: t(1), price: 1.1 } });
    const unrelated = ["d", "e", "f", "g"].map((id, index) => prim(id, { knownAt: t(10 + index) }));
    const c = prim("c", { knownAt: t(30), sourceFactIds: ["c", "b"] });
    const scene = ready([a, b, ...unrelated, c]);
    const callouts = selectChartPrimitives(scene.primitives, scene.parents, "EXPLAIN").callouts;
    expect(callouts.map(item => [item.primitive.primitiveId, item.kind])).toEqual([
      ["primitive:a", "LINEAGE"], ["primitive:c", "LINEAGE"],
      ["primitive:e", "RECENT"], ["primitive:f", "RECENT"], ["primitive:g", "RECENT"],
    ]);
    // SECONDARY links are traversed but never drawn as EXPLAIN callouts
    expect(callouts.some(item => item.primitive.primitiveId === "primitive:b")).toBe(false);
  });

  it("44: history is de-emphasised, never removed; RESEARCH still exposes it", () => {
    const clean = select("CLEAN");
    expect(clean.emphasis.get("primitive:primary-old")).toBe("HISTORICAL");
    expect(clean.drawn.map(item => item.primitiveId)).toContain("primitive:primary-old");
    expect(select("RESEARCH").drawn.map(item => item.primitiveId)).toContain("primitive:primary-old");
  });

  it("6/32: selection is deterministic across runs and input order", () => {
    const again = ready([...facts].reverse());
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const) {
      const a = select(mode);
      const b = selectChartPrimitives(again.primitives, again.parents, mode);
      expect(b.drawn.map(item => item.primitiveId)).toEqual(a.drawn.map(item => item.primitiveId));
      expect(b.callouts.map(item => [item.primitive.primitiveId, item.kind])).toEqual(a.callouts.map(item => [item.primitive.primitiveId, item.kind]));
      expect(b.labelled).toEqual(a.labelled);
    }
  });

  it("3: selecting a mode does not mutate the prepared primitives", () => {
    const snapshot = JSON.stringify(prepared.primitives);
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const) select(mode);
    expect(JSON.stringify(prepared.primitives)).toBe(snapshot);
  });
});

describe("geometry mapping", () => {
  const trace = [{ time: t(0), price: 1.1 }, { time: t(60), price: 1.2 }];
  const scale = buildScale(trace, [], AT)!;

  it("7: POINT anchors at exactly its time and price", () => {
    const point = prim("p", { geometry: { type: "POINT", time: t(30), price: 1.15 } });
    expect(anchorFor(point, scale)).toEqual({ x: scale.x(t(30)), y: scale.y(1.15) });
  });

  it("8/9: LEVEL keeps its price; bounds respected; open ends run to the plot edge", () => {
    const bounded = horizontalSpan({ startAt: t(10), endAt: t(20) }, scale);
    expect(bounded).toEqual({ x1: scale.x(t(10)), x2: scale.x(t(20)) });
    expect(horizontalSpan({}, scale)).toEqual({ x1: PLOT.left, x2: PLOT.width - PLOT.right });
    const level = prim("l", { geometry: { type: "LEVEL", price: 1.137 } });
    expect(anchorFor(level, scale).y).toBe(scale.y(1.137));
  });

  it("10/11: ZONE uses exact low/high and time bounds", () => {
    const zone = prim("z", { geometry: { type: "ZONE", low: 1.13, high: 1.14, startAt: t(10), endAt: t(20) } });
    expect(anchorFor(zone, scale)).toEqual({ x: scale.x(t(20)), y: scale.y(1.14) });
  });

  it("12-14: PATH anchors at its own last point; the domain never extends past supplied points", () => {
    const path = prim("tl", {
      concept: "TRENDLINE_SUPPORT", maturity: "RESEARCH_DERIVED", knownAt: t(40),
      geometry: { type: "PATH", points: [{ time: t(10), price: 1.12 }, { time: t(20), price: 1.13 }, { time: t(30), price: 1.1405 }] },
    });
    const pathScale = buildScale([], [path], t(30))!;
    expect(anchorFor(path, pathScale)).toEqual({ x: pathScale.x(t(30)), y: pathScale.y(1.1405) });
    expect(pathScale.t1).toBe(Date.parse(t(30)));
  });

  it("43: REGIME's semantic price never enters the price domain", () => {
    const regime = prim("r", { layer: "REGIME", concept: "REGIME", sourceFactIds: [], geometry: { type: "LEVEL", price: 0 } });
    const withRegime = buildScale(trace, [regime], AT)!;
    expect(withRegime.p0).toBe(scale.p0);
    expect(withRegime.p1).toBe(scale.p1);
    expect(withRegime.p0).toBeGreaterThan(1);
  });

  it("handles flat, tiny and huge price ranges with finite coordinates", () => {
    for (const price of [1.1, 0.00000123, 68_000_000]) {
      const flat = buildScale([{ time: t(0), price }, { time: t(0), price }], [], t(0))!;
      expect(Number.isFinite(flat.y(price))).toBe(true);
      expect(Number.isFinite(flat.x(t(0)))).toBe(true);
      expect(flat.p1).toBeGreaterThan(flat.p0);
    }
    expect(buildScale([], [], AT)).toBeNull();
    // REVIEW (nit 9): finite but overflowing ranges must not leak NaN into the SVG
    expect(buildScale([{ time: t(0), price: -1e308 }, { time: t(1), price: 1e308 }], [], t(1))).toBeNull();
  });
});

describe("label and callout layout", () => {
  const bounds = { left: PLOT.left, top: PLOT.top, right: PLOT.width - PLOT.right, bottom: PLOT.height - PLOT.bottom };

  it("30/31: placed boxes stay in bounds and never overlap, even for 20 labels at one anchor", () => {
    const requests = Array.from({ length: 20 }, (_, index) => ({ id: `l${index}`, anchorX: 480, anchorY: 180, text: `LABEL ${index}` }));
    const boxes = layoutLabels(requests, bounds);
    const placed = boxes.filter(box => box.placed);
    expect(placed.length).toBeGreaterThan(5);
    for (const box of placed) {
      expect(box.x).toBeGreaterThanOrEqual(bounds.left);
      expect(box.y).toBeGreaterThanOrEqual(bounds.top);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.right);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.bottom);
    }
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i]!, b = placed[j]!;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it("REGRESSION (visual review): no placed label covers any other fact's anchor or callout marker", () => {
    const requests = Array.from({ length: 16 }, (_, index) => ({
      id: `a${index}`, anchorX: 700 + (index % 4) * 30, anchorY: 120 + Math.floor(index / 4) * 26, text: `ANCHORED FACT ${index}`,
    }));
    for (const clearance of [DEFAULT_LAYOUT.anchorClearance, 9.5]) {
      const boxes = layoutLabels(requests, bounds, { ...DEFAULT_LAYOUT, anchorClearance: clearance });
      for (const box of boxes.filter(item => item.placed)) {
        for (const anchor of requests) {
          const nearestX = Math.min(Math.max(anchor.anchorX, box.x), box.x + box.width);
          const nearestY = Math.min(Math.max(anchor.anchorY, box.y), box.y + box.height);
          const distance = Math.hypot(anchor.anchorX - nearestX, anchor.anchorY - nearestY);
          expect(distance, `${box.id} covers ${anchor.id}`).toBeGreaterThanOrEqual(clearance);
        }
      }
    }
  });

  it("REGRESSION (visual review): dense STRUCTURE labels are capped instead of stacking into a badge wall", () => {
    const prepared = ready(denseScene());
    const scale = buildScale([], prepared.primitives, AT)!;
    const selection = selectChartPrimitives(prepared.primitives, prepared.parents, "STRUCTURE");
    const boxes = layoutLabels(selection.labelled.map(id => {
      const item = prepared.primitives.find(primitive => primitive.primitiveId === id)!;
      const anchor = anchorFor(item, scale);
      return { id, anchorX: anchor.x, anchorY: anchor.y, text: item.label };
    }), bounds);
    expect(selection.labelled.length).toBeGreaterThan(40);
    expect(boxes.filter(box => box.placed).length).toBeLessThanOrEqual(12);
  });

  it("anchors at the plot corners still get in-bounds labels", () => {
    const corners = [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.left, bounds.bottom], [bounds.right, bounds.bottom]] as const;
    const boxes = layoutLabels(corners.map(([x, y], index) => ({ id: `c${index}`, anchorX: x, anchorY: y, text: "CORNER" })), bounds);
    expect(boxes.every(box => box.placed)).toBe(true);
  });

  it("32: identical input gives deep-equal layout", () => {
    const requests = denseScene().slice(0, 40).map((item, index) => ({ id: item.primitiveId, anchorX: 100 + (index % 9) * 3, anchorY: 150, text: item.label }));
    expect(layoutLabels(requests, bounds)).toEqual(layoutLabels(requests, bounds));
  });

  it("33: long labels are truncated with an ellipsis and bounded in width", () => {
    const [box] = layoutLabels([{ id: "x", anchorX: 300, anchorY: 150, text: "X".repeat(500) }], bounds);
    expect(box!.truncated).toBe(true);
    expect([...box!.text].length).toBe(DEFAULT_LAYOUT.maxChars);
    expect(box!.text.endsWith("…")).toBe(true);
    expect(box!.width).toBeLessThanOrEqual(bounds.right - bounds.left);
  });

  it("stops placing after the cap and reports the rest as not placed", () => {
    const requests = Array.from({ length: 60 }, (_, index) => ({ id: `r${index}`, anchorX: 50 + index * 13, anchorY: 60 + (index % 10) * 25, text: "R" }));
    const boxes = layoutLabels(requests, bounds, { ...DEFAULT_LAYOUT, maxPlaced: 7 });
    expect(boxes.filter(box => box.placed)).toHaveLength(7);
    expect(boxes).toHaveLength(60);
  });

  it("dense 120-fact scene: every mode selects, lays out and stays bounded", () => {
    const prepared = ready(denseScene());
    expect(prepared.primitives).toHaveLength(120);
    const scale = buildScale([], prepared.primitives, AT)!;
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const) {
      const selection = selectChartPrimitives(prepared.primitives, prepared.parents, mode);
      const requests = (mode === "EXPLAIN" ? selection.callouts.map(item => item.primitive) : selection.labelled.map(id => prepared.primitives.find(item => item.primitiveId === id)!))
        .map(item => ({ id: item.primitiveId, ...(({ x, y }) => ({ anchorX: x, anchorY: y }))(anchorFor(item, scale)), text: item.label }));
      const boxes = layoutLabels(requests, bounds);
      expect(boxes.filter(box => box.placed).length).toBeLessThanOrEqual(DEFAULT_LAYOUT.maxPlaced);
      if (mode === "EXPLAIN") expect(boxes.length).toBeLessThanOrEqual(MAX_CALLOUTS);
    }
  });
});
