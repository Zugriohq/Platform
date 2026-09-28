import { describe, expect, it } from "vitest";
import { ALPHA_RESPONSE_META } from "@zugrio/alpha-api-contract";
import {
  DERIVED_STRUCTURAL_SCENARIO_ID,
  alphaScenarios,
  buildDecisionCase,
  buildReplayChartScene,
  staleEntryScenario,
} from "@zugrio/decision-core";
import { createAlphaApiClient, resolveApiBaseUrl } from "./alphaApiClient";

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(init ? { url, init } : { url });
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("resolveApiBaseUrl", () => {
  it("requires https except for loopback", () => {
    expect(resolveApiBaseUrl("https://api.zugrio.xyz/")).toEqual({ ok: true, url: "https://api.zugrio.xyz" });
    expect(resolveApiBaseUrl("http://127.0.0.1:3000")).toEqual({ ok: true, url: "http://127.0.0.1:3000" });
    expect(resolveApiBaseUrl("http://api.zugrio.xyz").ok).toBe(false);
    expect(resolveApiBaseUrl("https://user:pw@api.zugrio.xyz").ok).toBe(false);
    expect(resolveApiBaseUrl("not a url").ok).toBe(false);
    expect(resolveApiBaseUrl(undefined).ok).toBe(false);
  });
});

describe("createAlphaApiClient", () => {
  it("returns not-configured without calling the network when no base URL is set", async () => {
    const { impl, calls } = fakeFetch(() => json(200, {}));
    const client = createAlphaApiClient({ baseUrl: undefined, fetch: impl });
    expect(await client.health()).toMatchObject({ status: "not-configured" });
    expect(calls).toHaveLength(0);
  });

  it("returns typed decision-core cases from the cloud", async () => {
    const decision = JSON.parse(JSON.stringify(buildDecisionCase(staleEntryScenario, 4)));
    const { impl, calls } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: decision }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    const result = await client.getFrameDecisionCase(staleEntryScenario.id, 4);
    expect(result).toEqual({ status: "ok", source: "CLOUD", meta: ALPHA_RESPONSE_META, data: decision, httpStatus: 200 });
    expect(calls[0]?.url).toBe(`https://api.zugrio.xyz/v1/alpha/scenarios/${staleEntryScenario.id}/frames/4`);
  });

  it("rejects malformed decision payloads even when alpha metadata is valid", async () => {
    const decision = JSON.parse(JSON.stringify(buildDecisionCase(staleEntryScenario, 4)));
    decision.authority = "LIVE";
    const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: decision }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    expect(await client.getFrameDecisionCase(staleEntryScenario.id, 4)).toEqual({
      status: "rejected",
      reason: "Response payload does not satisfy the expected alpha contract",
    });
  });

  it("returns engine-owned chart scenes from the cloud", async () => {
    const scene = JSON.parse(JSON.stringify(buildReplayChartScene(staleEntryScenario, 4)));
    const { impl, calls } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    const result = await client.getFrameChartScene(staleEntryScenario.id, 4);
    expect(result).toEqual({ status: "ok", source: "CLOUD", meta: ALPHA_RESPONSE_META, data: scene, httpStatus: 200 });
    expect(calls[0]?.url).toBe(
      `https://api.zugrio.xyz/v1/alpha/scenarios/${staleEntryScenario.id}/frames/4/chart-scene`,
    );
  });

  it("accepts engine-owned liquidity and imbalance primitives without desktop-side inference", async () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID)!;
    const scene = JSON.parse(JSON.stringify(buildReplayChartScene(scenario, 7)));
    expect(scene.primitives.some((item: { concept: string }) => item.concept === "EQUAL_HIGHS")).toBe(true);
    expect(scene.primitives.some((item: { concept: string }) => item.concept === "LIQUIDITY_SWEEP")).toBe(true);
    expect(scene.primitives.some((item: { concept: string }) => item.concept === "FVG")).toBe(true);

    const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    const result = await client.getFrameChartScene(scenario.id, 7);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected cloud chart scene");
    expect(result.data.primitives.some(item =>
      item.concept === "LIQUIDITY_SWEEP" && item.layer === "LIQUIDITY"
    )).toBe(true);
    expect(result.data.primitives.some(item =>
      item.concept === "FVG" && item.layer === "IMBALANCE"
    )).toBe(true);
    expect(result.data.primitives.every(item => item.authorityEffect === "NONE")).toBe(true);
  });

  it("accepts engine-owned trendline paths and later break facts without fitting lines locally", async () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID)!;
    const scene = JSON.parse(JSON.stringify(buildReplayChartScene(scenario, 19)));
    expect(scene.primitives.some((item: { concept: string; geometry: { type: string } }) =>
      item.concept === "TRENDLINE_SUPPORT" && item.geometry.type === "PATH"
    )).toBe(true);
    expect(scene.primitives.some((item: { concept: string; label: string }) =>
      item.concept === "TRENDLINE_BREAK" && item.label === "SUPPORT CLOSE BREAK"
    )).toBe(true);

    const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    const result = await client.getFrameChartScene(scenario.id, 19);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected cloud chart scene");
    expect(result.data.primitives.some(item =>
      item.concept === "TRENDLINE_SUPPORT" &&
      item.layer === "STRUCTURE" &&
      item.geometry.type === "PATH"
    )).toBe(true);
    expect(result.data.primitives.some(item =>
      item.concept === "TRENDLINE_BREAK" && item.layer === "STRUCTURE"
    )).toBe(true);
    expect(result.data.primitives.every(item => item.authorityEffect === "NONE")).toBe(true);
  });

  it("rejects malformed chart primitives even when alpha metadata is valid", async () => {
    const scene = JSON.parse(JSON.stringify(buildReplayChartScene(staleEntryScenario, 4)));
    scene.primitives[0].authorityEffect = "ALLOW";
    const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    expect(await client.getFrameChartScene(staleEntryScenario.id, 4)).toEqual({
      status: "rejected",
      reason: "Response payload does not satisfy the expected alpha contract",
    });
  });

  it("rejects unsupported chart primitives and promoted trendline maturity", async () => {
    const scenario = alphaScenarios.find(item => item.id === DERIVED_STRUCTURAL_SCENARIO_ID)!;
    const base = JSON.parse(JSON.stringify(buildReplayChartScene(scenario, 19)));
    const rejected = {
      status: "rejected",
      reason: "Response payload does not satisfy the expected alpha contract",
    };
    const fetchScene = async (scene: unknown) => {
      const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
      return createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl })
        .getFrameChartScene(scenario.id, 19);
    };

    expect((await fetchScene(base)).status).toBe("ok");

    const unsupported = JSON.parse(JSON.stringify(base));
    unsupported.primitives[0].concept = "TRENDLINE_CHANNEL_WEDGE";
    expect(await fetchScene(unsupported)).toEqual(rejected);

    for (const concept of ["TRENDLINE_SUPPORT", "TRENDLINE_TOUCH", "TRENDLINE_PENETRATION", "TRENDLINE_BREAK"]) {
      const promoted = JSON.parse(JSON.stringify(base));
      const index = promoted.primitives.findIndex((item: { concept: string }) => item.concept === concept);
      if (index < 0) continue;
      expect(promoted.primitives[index].maturity).toBe("RESEARCH_DERIVED");
      promoted.primitives[index].maturity = "DETERMINISTIC_FACT";
      expect(await fetchScene(promoted)).toEqual(rejected);
    }
  });

  it("rejects malformed or causally impossible regime-route scene context", async () => {
    const base = JSON.parse(JSON.stringify(buildReplayChartScene(staleEntryScenario, 4)));

    const malformedRoute = JSON.parse(JSON.stringify(base));
    malformedRoute.routeContext = {
      status: "ROUTES_AVAILABLE",
      families: ["BOS_RETEST"],
      calibrationStatus: "UNVALIDATED_CANDIDATE_SET",
    };
    const routeFetch = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: malformedRoute }));
    const routeResult = await createAlphaApiClient({
      baseUrl: "https://api.zugrio.xyz",
      fetch: routeFetch.impl,
    }).getFrameChartScene(staleEntryScenario.id, 4);
    expect(routeResult.status).toBe("rejected");

    const partialRegime = JSON.parse(JSON.stringify(base));
    partialRegime.regimeLabel = "TRENDING";
    partialRegime.regimeEvidenceId = "regime-evidence";
    partialRegime.regimeDefinitionId = null;
    partialRegime.regimeKnownAt = base.evaluatedAt;
    const regimeFetch = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: partialRegime }));
    expect((await createAlphaApiClient({
      baseUrl: "https://api.zugrio.xyz",
      fetch: regimeFetch.impl,
    }).getFrameChartScene(staleEntryScenario.id, 4)).status).toBe("rejected");

    const futureRegime = JSON.parse(JSON.stringify(base));
    futureRegime.regimeLabel = "TRENDING";
    futureRegime.regimeEvidenceId = "regime-evidence";
    futureRegime.regimeDefinitionId = "regime-definition";
    futureRegime.regimeKnownAt = "2099-01-01T00:00:00Z";
    futureRegime.routeContext = {
      status: "NO_DECLARED_ROUTE",
      families: [],
      calibrationStatus: "UNVALIDATED_CANDIDATE_SET",
    };
    const futureFetch = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: futureRegime }));
    expect((await createAlphaApiClient({
      baseUrl: "https://api.zugrio.xyz",
      fetch: futureFetch.impl,
    }).getFrameChartScene(staleEntryScenario.id, 4)).status).toBe("rejected");
  });

  it("rejects chart primitives whose geometry arrives from the future", async () => {
    const scene = JSON.parse(JSON.stringify(buildReplayChartScene(staleEntryScenario, 4)));
    scene.primitives[0].geometry.time = "2099-01-01T00:00:00Z";
    const { impl } = fakeFetch(() => json(200, { meta: ALPHA_RESPONSE_META, data: scene }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    expect((await client.getFrameChartScene(staleEntryScenario.id, 4)).status).toBe("rejected");
  });

  it("posts only scenarioId and frameIndex", async () => {
    const { impl, calls } = fakeFetch(() => json(201, { meta: ALPHA_RESPONSE_META, data: { created: true } }));
    const client = createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl });
    const request = { scenarioId: staleEntryScenario.id, frameIndex: 2, authority: "LIVE" } as never;
    const result = await client.materializeDecisionCase(request);
    expect(result).toMatchObject({ status: "ok", httpStatus: 201 });
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ scenarioId: staleEntryScenario.id, frameIndex: 2 });
  });

  it("rejects responses that claim live data or capital authority", async () => {
    for (const meta of [
      { ...ALPHA_RESPONSE_META, liveCapitalAuthority: true },
      { ...ALPHA_RESPONSE_META, liveData: true },
      { ...ALPHA_RESPONSE_META, releaseChannel: "production" },
      undefined,
    ]) {
      const { impl } = fakeFetch(() => json(200, { meta, data: {} }));
      const result = await createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: impl }).listScenarios();
      expect(result.status).toBe("rejected");
    }
  });

  it("reports network failures, timeouts and 5xx as unavailable, 4xx as error", async () => {
    const down = fakeFetch(() => Promise.reject(new TypeError("fetch failed")));
    expect(await createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: down.impl }).health()).toMatchObject({
      status: "unavailable",
    });

    const slow = fakeFetch((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    expect(await createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: slow.impl, timeoutMs: 20 }).health()).toMatchObject({
      status: "unavailable",
      reason: "No response within 20 ms",
    });

    const degraded = fakeFetch(() => json(503, { meta: ALPHA_RESPONSE_META, data: { status: "degraded" } }));
    expect(await createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: degraded.impl }).health()).toMatchObject({
      status: "unavailable",
      httpStatus: 503,
    });

    const missing = fakeFetch(() => json(404, { statusCode: 404, message: "Scenario \"x\" not found" }));
    expect(await createAlphaApiClient({ baseUrl: "https://api.zugrio.xyz", fetch: missing.impl }).getScenario("x")).toEqual({
      status: "error",
      reason: "Scenario \"x\" not found",
      httpStatus: 404,
    });
  });
});
