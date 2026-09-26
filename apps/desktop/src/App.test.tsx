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
import { alphaScenarios, buildDecisionCase, bundleIdentityKey, type ReplayScenario } from "@zugrio/decision-core";
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
