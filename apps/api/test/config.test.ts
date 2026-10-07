import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("fails closed without DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL is required/);
  });

  it("uses postgres when DATABASE_URL is present, even if memory is also requested", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://u@h/db", ZUGRIO_ALPHA_PERSISTENCE: "memory" });
    expect(config.persistence).toEqual({ kind: "postgres", databaseUrl: "postgresql://u@h/db" });
  });

  it("only uses memory persistence when explicitly requested", () => {
    expect(loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory" }).persistence).toEqual({ kind: "memory" });
  });

  it("parses CORS origins and rejects invalid ports", () => {
    const config = loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory", ZUGRIO_CORS_ORIGINS: "https://a.example, null" });
    expect(config.corsOrigins).toEqual(["https://a.example", "null"]);
    expect(() => loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory", PORT: "http" })).toThrow(/PORT/);
  });
});
