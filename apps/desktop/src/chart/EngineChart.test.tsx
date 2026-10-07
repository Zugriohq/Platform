// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { EngineChartPrimitive, EngineChartScene } from "@zugrio/decision-core";
import { EngineChart } from "./EngineChart";
import { buildScale } from "./geometry";
import type { ChartMode } from "./modes";
import { prepareSceneForRender } from "./sceneGuard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AT = "2026-09-24T10:00:00Z";
const t = (minute: number) => new Date(Date.UTC(2026, 8, 24, 9, 0, 0) + minute * 60_000).toISOString();

function prim(id: string, over: Partial<EngineChartPrimitive>): EngineChartPrimitive {
  return {
    primitiveId: `primitive:${id}`, layer: "STRUCTURE", concept: "SWING_HIGH", maturity: "DETERMINISTIC_FACT",
    scale: "EXTERNAL", label: id.toUpperCase(), knownAt: t(40), geometry: { type: "POINT", time: t(5), price: 1.1 },
    sourceFactIds: [id], sourceEvidenceIds: [`ev:${id}`], visibility: "PRIMARY", styleToken: "STRUCTURE_PRIMARY",
    authorityEffect: "NONE", ...over,
  };
}

// One fabricated primitive per concept/geometry the renderer must draw (tests 15-22).
const FACTS: EngineChartPrimitive[] = [
  prim("swing-high", { concept: "SWING_HIGH", geometry: { type: "POINT", time: t(5), price: 1.12 }, knownAt: t(6) }),
  prim("swing-low", { concept: "SWING_LOW", geometry: { type: "POINT", time: t(8), price: 1.1 }, knownAt: t(9) }),
  prim("bos", { concept: "BOS", maturity: "RESEARCH_DERIVED", label: "EXTERNAL BOS ↑", geometry: { type: "LEVEL", price: 1.12, startAt: t(5), endAt: t(15) }, knownAt: t(16), sourceFactIds: ["bos", "swing-high"] }),
  prim("choch", { concept: "CHOCH", maturity: "RESEARCH_DERIVED", geometry: { type: "LEVEL", price: 1.105 }, knownAt: t(17) }),
  prim("mss", { concept: "MSS", maturity: "RESEARCH_DERIVED", geometry: { type: "LEVEL", price: 1.108, startAt: t(18) }, knownAt: t(19) }),
  prim("eqh", { concept: "EQUAL_HIGHS", layer: "LIQUIDITY", styleToken: "LIQUIDITY", geometry: { type: "ZONE", low: 1.1195, high: 1.1205, startAt: t(5), endAt: t(20) }, knownAt: t(21) }),
  prim("eql", { concept: "EQUAL_LOWS", layer: "LIQUIDITY", styleToken: "LIQUIDITY", geometry: { type: "ZONE", low: 1.0995, high: 1.1003 }, knownAt: t(21) }),
  prim("sweep", { concept: "LIQUIDITY_SWEEP", layer: "LIQUIDITY", styleToken: "LIQUIDITY", geometry: { type: "POINT", time: t(22), price: 1.121 }, knownAt: t(23), sourceFactIds: ["sweep", "eqh"] }),
  prim("fvg", { concept: "FVG", layer: "IMBALANCE", styleToken: "IMBALANCE", visibility: "SECONDARY", geometry: { type: "ZONE", low: 1.109, high: 1.111, startAt: t(24) }, knownAt: t(25) }),
  prim("tl", { concept: "TRENDLINE_SUPPORT", maturity: "RESEARCH_DERIVED", label: "TRENDLINE SUPPORT", geometry: { type: "PATH", points: [{ time: t(8), price: 1.1 }, { time: t(16), price: 1.104 }, { time: t(24), price: 1.10805 }] }, knownAt: t(25), sourceFactIds: ["tl", "swing-low"] }),
  prim("touch", { concept: "TRENDLINE_TOUCH", maturity: "RESEARCH_DERIVED", geometry: { type: "POINT", time: t(28), price: 1.1098 }, knownAt: t(29), sourceFactIds: ["touch", "tl"] }),
  prim("pen", { concept: "TRENDLINE_PENETRATION", maturity: "RESEARCH_DERIVED", geometry: { type: "POINT", time: t(30), price: 1.111 }, knownAt: t(31), sourceFactIds: ["pen", "tl"] }),
  prim("break", { concept: "TRENDLINE_BREAK", maturity: "RESEARCH_DERIVED", label: "SUPPORT CLOSE BREAK", geometry: { type: "POINT", time: t(32), price: 1.112 }, knownAt: t(33), sourceFactIds: ["break", "tl"] }),
  prim("regime", { concept: "REGIME", layer: "REGIME", scale: null, sourceFactIds: [], label: "TRENDING", geometry: { type: "LEVEL", price: 0 }, knownAt: t(1) }),
];

const SCENE: EngineChartScene = {
  sceneId: "scene:fabricated", instrument: "EURUSD", timeframe: "M5", evaluatedAt: AT, strategyId: "s", strategyVersion: "1",
  regimeLabel: null, regimeEvidenceId: null, regimeDefinitionId: null, regimeKnownAt: null,
  regimeContext: { status: "UNAVAILABLE", measurementId: null, profileId: null, profileVersion: null, matchingRuleIds: [], reasons: [] },
  routeContext: { status: "UNAVAILABLE", families: [], calibrationStatus: null },
  primitives: FACTS, authority: "RESEARCH_ONLY", liveCapitalAuthority: false,
};
const TRACE = [{ time: t(0), price: 1.1 }, { time: t(30), price: 1.112 }, { time: t(60), price: 1.113 }];

let root: Root | undefined;
let container: HTMLElement | undefined;

async function render(mode: ChartMode, onSelect: (id: string) => void = () => {}, selectedId: string | null = null) {
  const prepared = prepareSceneForRender(SCENE, AT);
  if (!prepared.ok) throw new Error(prepared.reason);
  container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(<EngineChart prepared={prepared} trace={TRACE} mode={mode} selectedId={selectedId} onSelect={onSelect} />);
  });
  return container;
}

function node(id: string): Element | null {
  return container!.querySelector(`[data-primitive-id="primitive:${id}"]`);
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
});

describe("EngineChart rendering", () => {
  const scale = buildScale(TRACE, FACTS, AT)!;

  it("15-22: every supported concept renders from its engine primitive in STRUCTURE", async () => {
    await render("STRUCTURE");
    for (const concept of ["SWING_HIGH", "SWING_LOW", "BOS", "CHOCH", "MSS", "EQUAL_HIGHS", "EQUAL_LOWS", "LIQUIDITY_SWEEP", "FVG", "TRENDLINE_SUPPORT", "TRENDLINE_TOUCH", "TRENDLINE_PENETRATION", "TRENDLINE_BREAK"]) {
      expect(container!.querySelector(`[data-concept="${concept}"]`), concept).not.toBeNull();
    }
  });

  it("7: POINT renders at the supplied time/price", async () => {
    await render("STRUCTURE");
    const circle = node("swing-high")!.querySelector("circle")!;
    expect(Number(circle.getAttribute("cx"))).toBe(scale.x(t(5)));
    expect(Number(circle.getAttribute("cy"))).toBe(scale.y(1.12));
  });

  it("8/9: LEVEL renders at its price; bounded LEVEL respects start/end; unbounded spans the plot", async () => {
    await render("STRUCTURE");
    const bos = node("bos")!.querySelector("line")!;
    expect(Number(bos.getAttribute("y1"))).toBe(scale.y(1.12));
    expect(Number(bos.getAttribute("y2"))).toBe(scale.y(1.12));
    expect(Number(bos.getAttribute("x1"))).toBe(scale.x(t(5)));
    expect(Number(bos.getAttribute("x2"))).toBe(scale.x(t(15)));
    const choch = node("choch")!.querySelector("line")!;
    expect(Number(choch.getAttribute("y1"))).toBe(scale.y(1.105));
    expect(Number(choch.getAttribute("x1"))).toBe(scale.plot.left);
  });

  it("10/11: ZONE uses exact low/high and time bounds", async () => {
    await render("STRUCTURE");
    const rect = node("eqh")!.querySelector("rect")!;
    expect(Number(rect.getAttribute("y"))).toBe(scale.y(1.1205));
    expect(Number(rect.getAttribute("y")) + Number(rect.getAttribute("height"))).toBeCloseTo(scale.y(1.1195), 9);
    expect(Number(rect.getAttribute("x"))).toBe(scale.x(t(5)));
    expect(Number(rect.getAttribute("x")) + Number(rect.getAttribute("width"))).toBeCloseTo(scale.x(t(20)), 9);
  });

  it("12-14: trendline PATH is drawn through exactly the engine points, no extension, refit or kink", async () => {
    await render("STRUCTURE");
    const points = node("tl")!.querySelector("polyline")!.getAttribute("points")!.split(" ");
    expect(points).toEqual([
      `${scale.x(t(8))},${scale.y(1.1)}`,
      `${scale.x(t(16))},${scale.y(1.104)}`,
      `${scale.x(t(24))},${scale.y(1.10805)}`,
    ]);
  });

  it("43: the REGIME primitive is never drawn as a price level", async () => {
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"] as const) {
      await render(mode);
      expect(node("regime")).toBeNull();
      await act(async () => root?.unmount());
      container?.remove();
    }
  });

  it("CLEAN hides SECONDARY facts that STRUCTURE shows", async () => {
    await render("CLEAN");
    expect(node("fvg")).toBeNull();
    expect(node("bos")).not.toBeNull();
  });

  it("29: EXPLAIN shows at most five numbered callouts", async () => {
    await render("EXPLAIN");
    const markers = container!.querySelectorAll(".callout-marker");
    expect(markers.length).toBeGreaterThanOrEqual(3);
    expect(markers.length).toBeLessThanOrEqual(5);
    expect(container!.querySelectorAll(".callout-legend li").length).toBe(markers.length);
  });

  it("every drawn fact exposes its engine label accessibly, including when its visible label is collapsed", async () => {
    await render("CLEAN");
    expect(node("break")!.querySelector("title")!.textContent).toBe("SUPPORT CLOSE BREAK");
  });

  it("REVIEW-6: the SVG is an image outside RESEARCH and an interactive group inside it", async () => {
    await render("CLEAN");
    expect(container!.querySelector("svg")!.getAttribute("role")).toBe("img");
    await act(async () => root?.unmount());
    container?.remove();
    await render("RESEARCH");
    expect(container!.querySelector("svg")!.getAttribute("role")).toBe("group");
  });

  it("REVIEW-3: a selection is only drawn in RESEARCH", async () => {
    await render("CLEAN", () => {}, "primitive:swing-high");
    expect(container!.querySelectorAll(".is-selected")).toHaveLength(0);
    await act(async () => root?.unmount());
    container?.remove();
    await render("RESEARCH", () => {}, "primitive:swing-high");
    expect(node("swing-high")!.classList.contains("is-selected")).toBe(true);
  });

  it("REVIEW-2: EXPLAIN distinguishes lineage callouts from recent unlinked ones", async () => {
    await render("EXPLAIN");
    const lineage = [...container!.querySelectorAll('[data-callout-kind="LINEAGE"]')].map(item => item.getAttribute("data-label-for"));
    const recent = [...container!.querySelectorAll('[data-callout-kind="RECENT"]')].map(item => item.getAttribute("data-label-for"));
    // newest PRIMARY fact is the close break; its lineage in-scene is the trendline and the swing low
    expect(lineage).toEqual(["primitive:swing-low", "primitive:tl", "primitive:break"]);
    expect(recent.length).toBe(2);
    for (const id of recent) expect(lineage).not.toContain(id);
    expect(container!.querySelector(".callout-legend")!.textContent).toContain("NOT IN THIS LINEAGE");
  });

  it("RESEARCH makes facts keyboard-selectable; other modes are not tab stops", async () => {
    const selected: string[] = [];
    await render("RESEARCH", id => selected.push(id));
    const target = node("bos") as SVGGElement;
    expect(target.getAttribute("tabindex")).toBe("0");
    await act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(selected).toEqual(["primitive:bos"]);
    await act(async () => root?.unmount());
    container?.remove();
    await render("CLEAN");
    expect(node("bos")!.getAttribute("tabindex")).toBeNull();
  });
});
