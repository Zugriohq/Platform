import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA_RESPONSE_META } from "@zugrio/alpha-api-contract";
import {
  DERIVED_STRUCTURAL_SCENARIO_ID,
  alphaScenarios,
  buildDecisionCase,
  staleEntryScenario,
} from "@zugrio/decision-core";
import { postJson, startApi, type RunningApi } from "./helpers.js";

let api: RunningApi;
beforeAll(async () => {
  api = await startApi();
});
afterAll(async () => {
  await api.close();
});

describe("alpha API (memory persistence)", () => {
  it("reports health with validation-only metadata", async () => {
    const { status, body } = await api.request("/health");
    expect(status).toBe(200);
    expect(body.meta).toEqual(ALPHA_RESPONSE_META);
    expect(body.data).toMatchObject({ status: "ok", service: "zugrio-api", persistence: "memory", database: "ok" });
  });

  it("lists every decision-core replay scenario", async () => {
    const { status, body } = await api.request("/v1/alpha/scenarios");
    expect(status).toBe(200);
    expect(body.meta).toEqual(ALPHA_RESPONSE_META);
    expect(body.data.map((item: { id: string }) => item.id)).toEqual(alphaScenarios.map((scenario) => scenario.id));
    expect(body.data[0].frameCount).toBe(alphaScenarios[0].frames.length);
  });

  it("returns a scenario with its frames, 404 for unknown scenarios", async () => {
    const found = await api.request(`/v1/alpha/scenarios/${staleEntryScenario.id}`);
    expect(found.status).toBe(200);
    expect(found.body.data.frames).toEqual(JSON.parse(JSON.stringify(staleEntryScenario.frames)));
    expect(found.body.data.evidence).toEqual(JSON.parse(JSON.stringify(staleEntryScenario.evidence)));
    expect(found.body.data).toMatchObject({ version: staleEntryScenario.version, caseId: staleEntryScenario.caseId });
    expect((await api.request("/v1/alpha/scenarios/unknown")).status).toBe(404);
  });

  it("returns exactly the decision-core DecisionCase for every frame", async () => {
    for (const scenario of alphaScenarios) {
      for (let frame = 0; frame < scenario.frames.length; frame += 1) {
        const { status, body } = await api.request(`/v1/alpha/scenarios/${scenario.id}/frames/${frame}`);
        expect(status).toBe(200);
        expect(body.meta).toEqual(ALPHA_RESPONSE_META);
        expect(body.data).toEqual(JSON.parse(JSON.stringify(buildDecisionCase(scenario, frame))));
      }
    }
  });

  it("returns engine-derived BOS and retest primitives through the cloud chart-scene route", async () => {
    const before = await api.request(
      `/v1/alpha/scenarios/${DERIVED_STRUCTURAL_SCENARIO_ID}/frames/1/chart-scene`,
    );
    expect(before.status).toBe(200);
    expect(before.body.data.primitives.some((item: { concept: string }) => item.concept === "BOS")).toBe(false);

    const held = await api.request(
      `/v1/alpha/scenarios/${DERIVED_STRUCTURAL_SCENARIO_ID}/frames/4/chart-scene`,
    );
    expect(held.status).toBe(200);
    expect(held.body.meta).toEqual(ALPHA_RESPONSE_META);
    expect(held.body.data.primitives.some((item: { concept: string }) => item.concept === "BOS")).toBe(true);
    expect(held.body.data.primitives.some((item: { concept: string; label: string }) =>
      item.concept === "RETEST" && item.label === "RETEST HELD"
    )).toBe(true);
    expect(held.body.data).toMatchObject({
      authority: "RESEARCH_ONLY",
      liveCapitalAuthority: false,
      timeframe: "M5",
    });
  });

  it("returns PASS as an outcome while preserving structural readiness when the entry goes stale", async () => {
    const { body } = await api.request(`/v1/alpha/scenarios/${staleEntryScenario.id}/frames/6`);
    expect(body.data.structuralState).toBe("STRUCTURAL_READY");
    expect(body.data.outcome).toBe("PASS");
    expect(body.data.current.currentEntryStatus).toBe("STALE");
    expect(body.data).toMatchObject({ authority: "NO_LIVE_CAPITAL", authorityClass: "STRUCTURAL_ONLY", modelScored: false });
  });

  it("rejects malformed and out-of-range frame indexes", async () => {
    const base = `/v1/alpha/scenarios/${staleEntryScenario.id}/frames`;
    expect((await api.request(`${base}/-1`)).status).toBe(400);
    expect((await api.request(`${base}/1.5`)).status).toBe(400);
    expect((await api.request(`${base}/01`)).status).toBe(400);
    expect((await api.request(`${base}/abc`)).status).toBe(400);
    expect((await api.request(`${base}/${staleEntryScenario.frames.length}`)).status).toBe(404);
    expect((await api.request(`/v1/alpha/scenarios/unknown/frames/0`)).status).toBe(404);
  });

  it("persists a Decision Case and reconstructs it with history", async () => {
    const created = await api.request("/v1/alpha/decision-cases", postJson({ scenarioId: staleEntryScenario.id, frameIndex: 6 }));
    expect(created.status).toBe(201);
    expect(created.body.meta).toEqual(ALPHA_RESPONSE_META);
    const persisted = created.body.data.decisionCase;
    expect(created.body.data.created).toBe(true);
    expect(persisted).toMatchObject({ authority: "NO_LIVE_CAPITAL", authorityClass: "STRUCTURAL_ONLY", modelScored: false });
    expect(persisted.consistentWithDecisionCore).toBe(true);

    const { history, ...projection } = JSON.parse(JSON.stringify(buildDecisionCase(staleEntryScenario, 6)));
    expect(persisted.decisionCoreCaseId).toBe(projection.caseId);
    expect(persisted.projection).toEqual(projection);
    expect(persisted.events.map((entry: { event: unknown }) => entry.event)).toEqual(history);
    expect(persisted.events.map((entry: { sequence: number }) => entry.sequence)).toEqual(history.map((_: unknown, index: number) => index));

    const fetched = await api.request(`/v1/alpha/decision-cases/${persisted.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data).toEqual(persisted);
  });

  it("is idempotent per scenario frame", async () => {
    const first = await api.request("/v1/alpha/decision-cases", postJson({ scenarioId: staleEntryScenario.id, frameIndex: 2 }));
    const second = await api.request("/v1/alpha/decision-cases", postJson({ scenarioId: staleEntryScenario.id, frameIndex: 2 }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.created).toBe(false);
    expect(second.body.data.decisionCase.id).toBe(first.body.data.decisionCase.id);
  });

  it("rejects invalid materialization requests, including caller-supplied authority", async () => {
    const cases: unknown[] = [
      { scenarioId: "unknown", frameIndex: 0 },
      { scenarioId: staleEntryScenario.id, frameIndex: 99 },
      { scenarioId: staleEntryScenario.id, frameIndex: -1 },
      { scenarioId: staleEntryScenario.id, frameIndex: 1.5 },
      { scenarioId: staleEntryScenario.id, frameIndex: "1" },
      { scenarioId: staleEntryScenario.id },
      { scenarioId: staleEntryScenario.id, frameIndex: 1, authority: "LIVE_CAPITAL" },
      [staleEntryScenario.id, 1],
    ];
    for (const body of cases) {
      const response = await api.request("/v1/alpha/decision-cases", postJson(body));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("validates case ids", async () => {
    expect((await api.request("/v1/alpha/decision-cases/not-a-uuid")).status).toBe(400);
    expect((await api.request("/v1/alpha/decision-cases/00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("serves the OpenAPI document and CORS headers, without x-powered-by", async () => {
    const { status, body, headers } = await api.request("/openapi.json", { headers: { origin: "null" } });
    expect(status).toBe(200);
    expect(body.openapi).toMatch(/^3\./);
    expect(headers.get("access-control-allow-origin")).toBe("*");
    expect(headers.get("x-powered-by")).toBeNull();
  });
});

describe("health with an unreachable database", () => {
  it("returns 503 degraded within the connect timeout instead of hanging", async () => {
    const { PrismaDecisionCaseStore } = await import("../src/persistence/prisma-decision-case-store.js");
    // Port 9 (discard) on loopback: nothing listens, so the connection is refused.
    const unreachable = await startApi(new PrismaDecisionCaseStore("postgresql://zugrio:x@127.0.0.1:9/zugrio"));
    try {
      const started = Date.now();
      const { status, body } = await unreachable.request("/health");
      expect(status).toBe(503);
      expect(body.meta).toEqual(ALPHA_RESPONSE_META);
      expect(body.data).toMatchObject({ status: "degraded", database: "unavailable", persistence: "postgres" });
      expect(Date.now() - started).toBeLessThan(10_000);
    } finally {
      await unreachable.close();
    }
  });
});
