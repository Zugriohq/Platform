import { describe, expect, it } from "vitest";
import { staleEntryScenario } from "@zugrio/decision-core";
import { DecisionCaseService } from "../src/alpha/decision-case.service.js";
import { ScenarioCatalog } from "../src/alpha/scenario-catalog.js";
import type { DecisionCaseStore, StoredDecisionCase } from "../src/persistence/decision-case-store.js";
import { MemoryDecisionCaseStore } from "../src/persistence/memory-decision-case-store.js";

/** Store wrapper that returns a tampered copy on read, to prove reconstruction never trusts storage blindly. */
function tampering(inner: DecisionCaseStore, mutate: (record: StoredDecisionCase) => StoredDecisionCase): DecisionCaseStore {
  return {
    kind: inner.kind,
    create: (input) => inner.create(input),
    findById: async (id) => {
      const record = await inner.findById(id);
      return record ? mutate(structuredClone(record)) : undefined;
    },
    ping: () => inner.ping(),
    close: () => inner.close(),
  };
}

async function materializeThenRead(mutate: (record: StoredDecisionCase) => StoredDecisionCase) {
  const service = new DecisionCaseService(new ScenarioCatalog(), tampering(new MemoryDecisionCaseStore(), mutate));
  const { decisionCase } = await service.materialize({ scenarioId: staleEntryScenario.id, frameIndex: 4 });
  expect(decisionCase.consistentWithDecisionCore).toBe(true);
  return service.reconstruct(decisionCase.id);
}

describe("DecisionCaseService reconstruction", () => {
  it("flags a stored projection that decision-core would not produce", async () => {
    const result = await materializeThenRead((record) => ({ ...record, projection: { ...record.projection, state: "TRIGGERED" } }));
    expect(result.consistentWithDecisionCore).toBe(false);
    expect(result.projection.state).toBe("TRIGGERED");
  });

  it("flags a rewritten ledger event", async () => {
    const result = await materializeThenRead((record) => ({
      ...record,
      events: record.events.map((event, index) => (index === 0 ? { ...event, reason: "rewritten in hindsight" } : event)),
    }));
    expect(result.consistentWithDecisionCore).toBe(false);
  });

  it("flags a truncated ledger", async () => {
    const result = await materializeThenRead((record) => ({ ...record, events: record.events.slice(1) }));
    expect(result.consistentWithDecisionCore).toBe(false);
  });

  it("flags a record whose bundle version no longer matches the fixture", async () => {
    const result = await materializeThenRead((record) => ({ ...record, bundle: { ...record.bundle, version: "0.0.0" } }));
    expect(result.consistentWithDecisionCore).toBe(false);
  });

  it("accepts JSON key reordering from PostgreSQL JSONB", async () => {
    const result = await materializeThenRead((record) => ({
      ...record,
      bundle: Object.fromEntries(Object.entries(record.bundle).reverse()) as typeof record.bundle,
    }));
    expect(result.consistentWithDecisionCore).toBe(true);
  });
});
