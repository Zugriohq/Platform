import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createApp, createOpenApiDocument } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const committed = JSON.parse(readFileSync(new URL("../openapi.json", import.meta.url), "utf8"));

describe("OpenAPI contract", () => {
  it("matches the committed openapi.json (run `pnpm --filter @zugrio/api openapi:write` after API changes)", async () => {
    const app = await createApp(loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory" }), { logger: false });
    await app.init();
    try {
      expect(JSON.parse(JSON.stringify(createOpenApiDocument(app)))).toEqual(committed);
    } finally {
      await app.close();
    }
  });

  it("documents every required endpoint", () => {
    expect(Object.keys(committed.paths).sort()).toEqual([
      "/health",
      "/v1/alpha/decision-cases",
      "/v1/alpha/decision-cases/{caseId}",
      "/v1/alpha/engine-validation/scenarios",
      "/v1/alpha/engine-validation/scenarios/{scenarioId}/frames/{frameIndex}",
      "/v1/alpha/scenarios",
      "/v1/alpha/scenarios/{scenarioId}",
      "/v1/alpha/scenarios/{scenarioId}/frames/{frameIndex}",
      "/v1/alpha/scenarios/{scenarioId}/frames/{frameIndex}/chart-scene",
    ]);
  });
});

