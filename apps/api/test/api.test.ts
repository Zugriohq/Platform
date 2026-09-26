import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA_RESPONSE_META } from "@zugrio/alpha-api-contract";
import { alphaScenarios, buildDecisionCase, staleEntryScenario } from "@zugrio/decision-core";
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

  it("keeps PASS as a first-class outcome through the API", async () => {
    const { body } = await api.request(`/v1/alpha/scenarios/${staleEntryScenario.id}/frames/4`);
    expect(body.data.state).toBe("PASS");
    expect(body.data.authority).toBe("NO_LIVE_CAPITAL");
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
    const created = await api.request("/v1/alpha/decision-cases", postJson({ scenarioId: staleEntryScenario.id, frameIndex: 4 }));
    expect(created.status).toBe(201);
    expect(created.body.meta).toEqual(ALPHA_RESPONSE_META);
    const persisted = created.body.data.decisionCase;
    expect(created.body.data.created).toBe(true);
    expect(persisted.authority).toBe("NO_LIVE_CAPITAL");
    expect(persisted.projection.state).toBe("PASS");
    expect(persisted.consistentWithDecisionCore).toBe(true);

    const expected = buildDecisionCase(staleEntryScenario, 4);
    expect(persisted.decisionCoreCaseId).toBe(expected.caseId);
    expect(persisted.events.map((event: { state: string }) => event.state)).toEqual(expected.history.map((event) => event.state));
    expect(persisted.events.map((event: { sequence: number }) => event.sequence)).toEqual(expected.history.map((_, index) => index));

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
