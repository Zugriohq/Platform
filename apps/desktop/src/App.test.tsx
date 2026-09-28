// @vitest-environment jsdom
/**
 * App-level regression tests for the cloud / LOCAL REPLAY decision source (issue #71).
 *
 * The real App and the real alpha API client are used; only `fetch` is faked, so these
 * tests cover metadata validation, fail-closed rendering and the Record Case request
 * exactly as a cloud-configured build would exercise them.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ALPHA_RESPONSE_META } from "@zugrio/alpha-api-contract";
import { alphaScenarios, buildDecisionCase, buildReplayChartScene, bundleIdentityKey, type ReplayScenario } from "@zugrio/decision-core";
import { App } from "./App";
import { createAlphaApiClient } from "./cloud";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const API = "https://api.zugrio.test";
const CLOUD_MARK = "[cloud]";
const firstScenario = alphaScenarios[0] as ReplayScenario;

interface Call {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

type Route = (path: string, method: string, body: unknown) => { status: number; body: unknown } | undefined;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Cloud copies of the fixtures, marked so rendered text provably came from the API. */
function cloudScenario(scenario: ReplayScenario) {
  return { ...scenario, title: `${CLOUD_MARK} ${scenario.title}` };
}

function cloudDecision(scenario: ReplayScenario, frameIndex: number) {
  const decision = buildDecisionCase(scenario, frameIndex);
  return { ...decision, outcomeReason: `${CLOUD_MARK} ${decision.outcomeReason}` };
}

function summary(scenario: ReplayScenario) {
  const cloud = cloudScenario(scenario);
  return {
    id: cloud.id,
    version: cloud.version,
    caseId: cloud.caseId,
    title: cloud.title,
    description: cloud.description,
    bundle: cloud.bundle,
    bundleKey: bundleIdentityKey(cloud.bundle.identity),
    frameCount: cloud.frames.length,
  };
}

/** Well-behaved validation API; `override` can replace any route's answer. */
function cloudApi(override?: Route) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });

    const overridden = override?.(url.pathname, method, body);
    if (overridden) return json(overridden.status, overridden.body);

    const envelope = (data: unknown) => json(200, { meta: ALPHA_RESPONSE_META, data });
    if (url.pathname === "/v1/alpha/scenarios") return envelope(alphaScenarios.map(summary));

    const sceneMatch = /^\/v1\/alpha\/scenarios\/([^/]+)\/frames\/(\d+)\/chart-scene$/.exec(url.pathname);
    if (sceneMatch) {
      const scenario = alphaScenarios.find((item) => item.id === decodeURIComponent(sceneMatch[1] ?? ""));
      return scenario ? envelope(buildReplayChartScene(scenario, Number(sceneMatch[2]))) : json(404, { message: "not found" });
    }

    const frameMatch = /^\/v1\/alpha\/scenarios\/([^/]+)\/frames\/(\d+)$/.exec(url.pathname);
    if (frameMatch) {
      const scenario = alphaScenarios.find((item) => item.id === decodeURIComponent(frameMatch[1] ?? ""));
      return scenario ? envelope(cloudDecision(scenario, Number(frameMatch[2]))) : json(404, { message: "not found" });
    }

    const scenarioMatch = /^\/v1\/alpha\/scenarios\/([^/]+)$/.exec(url.pathname);
    if (scenarioMatch) {
      const scenario = alphaScenarios.find((item) => item.id === decodeURIComponent(scenarioMatch[1] ?? ""));
      return scenario
        ? envelope({ ...summary(scenario), evidence: scenario.evidence, frames: scenario.frames })
        : json(404, { message: "not found" });
    }

    if (url.pathname === "/v1/alpha/decision-cases" && method === "POST") {
      return json(201, {
        meta: ALPHA_RESPONSE_META,
        data: { created: true, decisionCase: { id: "11111111-2222-4333-8444-555555555555" } },
      });
    }
    return json(404, { message: `unexpected ${method} ${url.pathname}` });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

let root: Root | undefined;
let container: HTMLElement | undefined;

async function renderApp(client: ReturnType<typeof createAlphaApiClient>) {
  container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    root = createRoot(container!);
    root.render(<App apiClient={client} />);
  });
  return container;
}

function text(): string {
  return container?.textContent ?? "";
}

async function waitFor(predicate: () => boolean, label: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  throw new Error(`Timed out waiting for: ${label}\n--- rendered ---\n${text()}`);
}

function button(label: string): HTMLButtonElement {
  const found = [...(container?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`button "${label}" not found`);
  return found as HTMLButtonElement;
}

async function click(label: string) {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function heading(): string | undefined {
  return container?.querySelector(".workspace-head h1")?.textContent ?? undefined;
}

afterEach(async () => {
  await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("App decision source", () => {
  it("shows LOCAL REPLAY and never calls the network when no API URL is configured", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: undefined, fetch: api.fetchImpl }));

    expect(text()).toContain("LOCAL REPLAY");
    expect(text()).toContain("EXPLICIT LOCAL MODE");
    expect(text()).not.toContain("ZUGRIO CLOUD");
    expect(heading()).toBe(firstScenario.title);
    expect(text()).not.toContain("RECORD CASE");
    expect(api.calls).toHaveLength(0);
  });

  it("shows cloud unavailable and renders no local decision output when the network fails", async () => {
    const failing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: failing }));

    await waitFor(() => text().includes("Cloud decision data is unavailable."), "unavailable gate");
    expect(text()).toContain("ZUGRIO CLOUD");
    expect(text()).toContain("UNAVAILABLE");
    expect(text()).toContain("RETRY CLOUD");
    expect(text()).not.toContain("LOCAL REPLAY");
    expect(heading()).toBeUndefined();
    expect(text()).not.toContain(firstScenario.title);
    expect(text()).not.toContain("CURRENT STRUCTURAL STATE");
  });

  it("renders decision content from the cloud response", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));

    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    expect(text()).toContain("ZUGRIO CLOUD");
    expect(text()).toContain("READY");
    expect(heading()).toBe(`${CLOUD_MARK} ${firstScenario.title}`);
    expect(container?.querySelector(".lower-grid h2")?.textContent).toBe(
      `${CLOUD_MARK} ${buildDecisionCase(firstScenario, 0).outcomeReason}`,
    );
    expect(text()).not.toContain("LOCAL REPLAY");
    expect(api.calls.some((call) => call.path === `/v1/alpha/scenarios/${firstScenario.id}/frames/0`)).toBe(true);
    expect(api.calls.some((call) => call.path === `/v1/alpha/scenarios/${firstScenario.id}/frames/0/chart-scene`)).toBe(true);
  });

  it("renders engine-owned regime and eligible strategy routes without deriving them in the UI", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");

    expect(text()).toContain("CANONICAL REGIME");
    expect(text()).toContain("UNAVAILABLE");
    expect(text()).toContain("ELIGIBLE RESEARCH ROUTES");

    await click("NEXT");
    await click("NEXT");

    expect(text()).toContain("TRENDING");
    expect(text()).toContain("BOS RETEST");
    expect(text()).toContain("UNVALIDATED CANDIDATE SET");
    expect(text()).toContain("derived-alpha:canonical-regime:v2");
  });

  it("renders engine-owned liquidity sweep context from the cloud scene", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");

    for (let step = 0; step < 7; step += 1) await click("NEXT");

    expect(text()).toContain("HIGH SWEEP / RECLAIM");
    expect(api.calls.some((call) =>
      call.path === `/v1/alpha/scenarios/${firstScenario.id}/frames/7/chart-scene`
    )).toBe(true);
  });

  it("renders the engine-owned trendline break from the cloud scene", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");

    for (let step = 0; step < 19; step += 1) await click("NEXT");

    expect(text()).toContain("TRENDLINE SUPPORT");
    expect(text()).toContain("SUPPORT CLOSE BREAK");
    expect(api.calls.some((call) =>
      call.path === `/v1/alpha/scenarios/${firstScenario.id}/frames/19/chart-scene`
    )).toBe(true);
  });

  it("fails closed when the scenario list carries non-validation metadata", async () => {
    const api = cloudApi((path) =>
      path === "/v1/alpha/scenarios"
        ? { status: 200, body: { meta: { ...ALPHA_RESPONSE_META, liveCapitalAuthority: true }, data: alphaScenarios.map(summary) } }
        : undefined,
    );
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));

    await waitFor(() => text().includes("REJECTED"), "rejected status");
    expect(text()).toContain("validation-only / NO_LIVE_CAPITAL");
    expect(heading()).toBeUndefined();
    expect(text()).not.toContain("CURRENT STRUCTURAL STATE");
    expect(container?.querySelectorAll(".case-button")).toHaveLength(0);
  });

  it("fails closed when a chart scene carries non-validation metadata", async () => {
    const api = cloudApi((path) =>
      path.endsWith("/chart-scene") ? { status: 200, body: { meta: { ...ALPHA_RESPONSE_META, liveData: true }, data: {} } } : undefined,
    );
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));

    await waitFor(() => text().includes("REJECTED"), "rejected scene status");
    expect(heading()).toBeUndefined();
    expect(text()).not.toContain("CURRENT STRUCTURAL STATE");
  });

  it("fails closed when any frame decision carries non-validation metadata", async () => {
    const api = cloudApi((path) =>
      path.endsWith("/frames/1") ? { status: 200, body: { meta: { ...ALPHA_RESPONSE_META, liveData: true }, data: {} } } : undefined,
    );
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));

    await waitFor(() => text().includes("REJECTED"), "rejected status");
    expect(heading()).toBeUndefined();
    expect(text()).not.toContain("CURRENT STRUCTURAL STATE");
    expect(text()).not.toContain(CLOUD_MARK + " " + buildDecisionCase(firstScenario, 0).outcomeReason);
  });

  it("records the current case with only scenarioId and frameIndex and shows success", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");

    await click("NEXT");
    await click("RECORD CASE");
    await waitFor(() => text().includes("Decision Case recorded"), "record success");

    const posts = api.calls.filter((call) => call.method === "POST");
    expect(posts).toEqual([
      { method: "POST", path: "/v1/alpha/decision-cases", body: { scenarioId: firstScenario.id, frameIndex: 1 } },
    ]);
    expect(text()).toContain("11111111-2222-4333-8444-555555555555");
  });

  it("surfaces a Record Case failure without claiming the case was recorded", async () => {
    const api = cloudApi((path, method) =>
      path === "/v1/alpha/decision-cases" && method === "POST"
        ? { status: 400, body: { statusCode: 400, message: "frameIndex is outside the scenario" } }
        : undefined,
    );
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");

    await click("RECORD CASE");
    await waitFor(() => text().includes("Decision Case was not recorded"), "record failure");
    expect(text()).toContain("frameIndex is outside the scenario");
    expect(text()).not.toContain("Decision Case recorded");
  });
});

function drawnIds(): string[] {
  return [...(container?.querySelectorAll("[data-primitive-id]") ?? [])].map(item => item.getAttribute("data-primitive-id") ?? "");
}

function modeButton(mode: string): HTMLButtonElement {
  const found = [...(container?.querySelectorAll(".chart-modes button") ?? [])].find(item => item.textContent === mode);
  if (!found) throw new Error(`mode ${mode} not found`);
  return found as HTMLButtonElement;
}

async function chooseMode(mode: string) {
  await act(async () => { modeButton(mode).dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

async function goToFrame(index: number) {
  const input = container!.querySelector('input[aria-label="Replay frame"]') as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(index));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function expectedIds(frameIndex: number, visibility: readonly string[] = ["PRIMARY"]): string[] {
  return buildReplayChartScene(firstScenario, frameIndex).primitives
    .filter(item => item.layer !== "REGIME" && visibility.includes(item.visibility))
    .map(item => item.primitiveId)
    .sort();
}

describe("Engine chart (Lane C)", () => {
  it("1: CLEAN is the default mode and every mode control exposes its pressed state", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    expect(modeButton("CLEAN").getAttribute("aria-pressed")).toBe("true");
    for (const mode of ["EXPLAIN", "STRUCTURE", "RESEARCH"]) expect(modeButton(mode).getAttribute("aria-pressed")).toBe("false");
    await chooseMode("STRUCTURE");
    expect(modeButton("STRUCTURE").getAttribute("aria-pressed")).toBe("true");
    expect(modeButton("CLEAN").getAttribute("aria-pressed")).toBe("false");
  });

  it("4/2: STRUCTURE reveals engine SECONDARY facts hidden from CLEAN; CLEAN and EXPLAIN draw the same facts", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    await goToFrame(19);
    const clean = drawnIds().sort();
    expect(clean).toEqual(expectedIds(19));
    await chooseMode("EXPLAIN");
    expect(drawnIds().sort()).toEqual(clean);
    await chooseMode("STRUCTURE");
    expect(drawnIds().sort()).toEqual(expectedIds(19, ["PRIMARY", "SECONDARY"]));
    expect(drawnIds().length).toBeGreaterThan(clean.length);
  });

  it("5: RESEARCH exposes the selected fact's engine provenance and the scene authority", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    await goToFrame(19);
    await chooseMode("RESEARCH");
    const target = buildReplayChartScene(firstScenario, 19).primitives.find(item => item.concept === "TRENDLINE_BREAK")!;
    const row = [...container!.querySelectorAll(".fact-row")].find(item => item.querySelector("span")?.textContent === target.label)!;
    await act(async () => { row.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const detail = container!.querySelector(".inspect-detail")!.textContent!;
    expect(detail).toContain(target.primitiveId);
    expect(detail).toContain(target.knownAt);
    expect(detail).toContain("RESEARCH_DERIVED");
    for (const id of target.sourceFactIds) expect(detail).toContain(id);
    for (const id of target.sourceEvidenceIds) expect(detail).toContain(id);
    expect(container!.querySelector(".inspect-scene")!.textContent).toContain("RESEARCH_ONLY");
    expect(container!.querySelector(".inspect-scene")!.textContent).toContain("Live capital authorityfalse");
  });

  it("45-47: scrubbing back shows only that frame's facts; forward again reconstructs the later frame", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    await chooseMode("STRUCTURE");
    await goToFrame(19);
    const later = drawnIds().sort();
    await goToFrame(3);
    expect(drawnIds().sort()).toEqual(expectedIds(3, ["PRIMARY", "SECONDARY"]));
    for (const id of drawnIds()) expect(expectedIds(3, ["PRIMARY", "SECONDARY"])).toContain(id);
    await goToFrame(19);
    expect(drawnIds().sort()).toEqual(later);
  });

  it("changing chart mode makes no API call and records the same case", async () => {
    const api = cloudApi();
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    const before = api.calls.length;
    for (const mode of ["EXPLAIN", "STRUCTURE", "RESEARCH", "CLEAN"]) await chooseMode(mode);
    expect(api.calls.length).toBe(before);
    await chooseMode("RESEARCH");
    await click("NEXT");
    await click("RECORD CASE");
    await waitFor(() => text().includes("Decision Case recorded"), "record success");
    expect(api.calls.filter(call => call.method === "POST")).toEqual([
      { method: "POST", path: "/v1/alpha/decision-cases", body: { scenarioId: firstScenario.id, frameIndex: 1 } },
    ]);
  });

  it("24: a cloud scene for the wrong frame is rejected, not drawn as current", async () => {
    const api = cloudApi(path => {
      const match = /^\/v1\/alpha\/scenarios\/([^/]+)\/frames\/(\d+)\/chart-scene$/.exec(path);
      if (!match || Number(match[2]) !== 5) return undefined;
      return { status: 200, body: { meta: ALPHA_RESPONSE_META, data: buildReplayChartScene(firstScenario, 4) } };
    });
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    await goToFrame(4);
    expect(text()).not.toContain("CHART REJECTED");
    await goToFrame(5);
    expect(text()).toContain("CHART REJECTED");
    expect(text()).toContain("different frame");
    expect(drawnIds()).toEqual([]);
  });

  it("34/35: a duplicated cloud primitive is drawn once; a conflicting duplicate rejects the chart", async () => {
    const scene4 = buildReplayChartScene(firstScenario, 4);
    const first = scene4.primitives.find(item => item.visibility === "PRIMARY" && item.layer !== "REGIME")!;
    const api = cloudApi(path => {
      if (path.endsWith("/frames/4/chart-scene")) return { status: 200, body: { meta: ALPHA_RESPONSE_META, data: { ...scene4, primitives: [...scene4.primitives, first] } } };
      if (path.endsWith("/frames/5/chart-scene")) {
        const scene5 = buildReplayChartScene(firstScenario, 5);
        const clash = { ...scene5.primitives.find(item => item.layer !== "REGIME")!, label: "CONFLICTING COPY" };
        return { status: 200, body: { meta: ALPHA_RESPONSE_META, data: { ...scene5, primitives: [...scene5.primitives, clash] } } };
      }
      return undefined;
    });
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    await goToFrame(4);
    expect(drawnIds().filter(id => id === first.primitiveId)).toHaveLength(1);
    await goToFrame(5);
    expect(text()).toContain("CHART REJECTED");
    expect(text()).toContain("Conflicting chart primitives");
    expect(drawnIds()).toEqual([]);
  });

  it("the chart shows engine lifecycle values directly and no UI-derived RETEST verdict", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    expect(container!.querySelector(".chart-evidence")).toBeNull();
    expect([...container!.querySelectorAll(".evidence-row span")].map(item => item.textContent)).not.toContain("Retest");
  });

  it("keeps the private-alpha / no-live-capital boundary and no execution language", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE", "RESEARCH"]) {
      await chooseMode(mode);
      expect(text()).toContain("PRIVATE VALIDATION / ALPHA");
      expect(text()).toContain("NO LIVE CAPITAL");
      expect(text()).toContain("NOT LIVE DATA");
      // Only the Lane C surfaces; the existing footer legitimately disclaims FIRE/execution.
      const chartText = [...container!.querySelectorAll(".chart-head, .chart-shell, .research-inspector")]
        .map(item => item.textContent).join(" ");
      expect(chartText).not.toMatch(/TRADE NOW|BUY NOW|SELL NOW|EXECUTE|\bFIRE\b|PROBABILITY|WIN RATE|CONFIDENCE/i);
    }
  });
});


function delayedApi(delayFor: (path: string) => number) {
  const inner = cloudApi();
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const ms = delayFor(new URL(String(input)).pathname);
    if (ms > 0) await new Promise(resolve => setTimeout(resolve, ms));
    return inner.fetchImpl(input, init);
  }) as typeof fetch;
  return { fetchImpl, calls: inner.calls };
}

async function chooseScenario(index: number) {
  const buttons = container!.querySelectorAll(".case-button");
  await act(async () => { buttons[index]!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
}

async function settle(ms: number) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });
}

describe("Engine chart races (Lane C independent pass)", () => {
  const second = alphaScenarios[1] as ReplayScenario;
  const secondIds = (frameIndex: number) => buildReplayChartScene(second, frameIndex).primitives
    .filter(item => item.layer !== "REGIME" && item.visibility === "PRIMARY").map(item => item.primitiveId).sort();

  it("a slow scenario A load that resolves after switching to B never replaces B's chart", async () => {
    const api = delayedApi(path => path.includes(`/scenarios/${firstScenario.id}/frames`) ? 120 : 0);
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => (container?.querySelectorAll(".case-button").length ?? 0) > 1, "scenario list");
    await chooseScenario(1); // switch while A's frames are still in flight
    await waitFor(() => heading() === `${CLOUD_MARK} ${second.title}`, "scenario B rendered");
    await settle(300); // let A's late responses land
    expect(heading()).toBe(`${CLOUD_MARK} ${second.title}`);
    expect(drawnIds().sort()).toEqual(secondIds(0));
    expect(text()).not.toContain("CHART REJECTED");
  });

  it("frame responses arriving in reverse order are still bound to their own frames", async () => {
    const api = delayedApi(path => {
      const match = /\/frames\/(\d+)(\/chart-scene)?$/.exec(path);
      return match ? (25 - Number(match[1])) * 6 : 0;
    });
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    for (let frame = 0; frame < firstScenario.frames.length; frame += 1) {
      await goToFrame(frame);
      expect(text(), `frame ${frame}`).not.toContain("CHART REJECTED");
      expect(drawnIds().sort(), `frame ${frame}`).toEqual(expectedIds(frame));
    }
  });

  it("rapid random scrubbing always shows exactly the displayed frame's facts", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    for (const mode of ["STRUCTURE", "EXPLAIN"]) {
      await chooseMode(mode);
      let seed = 17;
      const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % firstScenario.frames.length; };
      for (let step = 0; step < 60; step += 1) {
        const frame = next();
        await goToFrame(frame);
        const visibility = mode === "STRUCTURE" ? ["PRIMARY", "SECONDARY"] : ["PRIMARY"];
        expect(drawnIds().sort(), `${mode} step ${step} frame ${frame}`).toEqual(expectedIds(frame, visibility));
        expect(container!.querySelectorAll(".callout-marker").length).toBeLessThanOrEqual(5);
      }
    }
  });

  it("several frame changes inside one React batch settle on the last frame only", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    const input = container!.querySelector('input[aria-label="Replay frame"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      for (const frame of [19, 2, 15, 7]) {
        setter.call(input, String(frame));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(drawnIds().sort()).toEqual(expectedIds(7));
  });

  it("a selected fact does not carry into a scenario or frame that lacks it", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    await goToFrame(19);
    await chooseMode("RESEARCH");
    const row = [...container!.querySelectorAll(".fact-row")].at(-1)!;
    await act(async () => { row.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container!.querySelector(".inspect-detail dl")).not.toBeNull();
    await goToFrame(0);
    expect(container!.querySelector(".inspect-detail")!.textContent).toContain("Select a fact");
    await chooseScenario(1);
    expect(container!.querySelector(".inspect-detail")!.textContent).toContain("Select a fact");
    expect(container!.querySelectorAll(".prim.is-selected")).toHaveLength(0);
  });
});

describe("Engine chart independent-review regressions", () => {
  it("REVIEW-1: a rejected scene does not feed the regime / route / strategy strip", async () => {
    const scene3 = buildReplayChartScene(firstScenario, 3);
    expect(scene3.regimeLabel).not.toBeNull();
    const clash = { ...scene3.primitives.find(item => item.layer !== "REGIME")!, label: "CONFLICT" };
    const api = cloudApi(path => path.endsWith("/frames/3/chart-scene")
      ? { status: 200, body: { meta: ALPHA_RESPONSE_META, data: { ...scene3, primitives: [...scene3.primitives, clash] } } }
      : undefined);
    await renderApp(createAlphaApiClient({ baseUrl: API, fetch: api.fetchImpl }));
    await waitFor(() => heading() !== undefined, "cloud decision rendered");
    await goToFrame(3);
    expect(text()).toContain("CHART REJECTED");
    const strip = container!.querySelector(".market-context")!.textContent!;
    expect(strip).not.toContain(scene3.regimeLabel!);
    expect(strip).not.toContain(scene3.regimeDefinitionId!);
    expect(strip).not.toContain(scene3.strategyId);
    expect(strip).toContain("SCENE REJECTED");
  });

  it("REVIEW-3: a RESEARCH selection is not emphasised after switching mode or frame", async () => {
    await renderApp(createAlphaApiClient({ baseUrl: undefined }));
    await goToFrame(19);
    await chooseMode("RESEARCH");
    const first = container!.querySelector(".fact-row")!;
    await act(async () => { first.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(container!.querySelectorAll(".prim.is-selected").length).toBeLessThanOrEqual(1);
    for (const mode of ["CLEAN", "EXPLAIN", "STRUCTURE"]) {
      await chooseMode(mode);
      expect(container!.querySelectorAll(".is-selected"), mode).toHaveLength(0);
    }
    await goToFrame(10);
    expect(container!.querySelectorAll(".is-selected")).toHaveLength(0);
  });
});

