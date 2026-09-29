import { randomUUID } from "node:crypto";
import type { CreateResult, DecisionCaseStore, NewDecisionCase, StoredDecisionCase } from "./decision-case-store.js";

/** Non-durable store for local development and tests. Never selected implicitly. */
export class MemoryDecisionCaseStore implements DecisionCaseStore {
  readonly kind = "memory" as const;
  private readonly byId = new Map<string, StoredDecisionCase>();
  private readonly byIdentity = new Map<string, string>();

  async create(input: NewDecisionCase): Promise<CreateResult> {
    const identity = input.evaluationId;
    const existingId = this.byIdentity.get(identity);
    const existing = existingId ? this.byId.get(existingId) : undefined;
    if (existing) return { created: false, record: existing };

    const now = new Date().toISOString();
    const record: StoredDecisionCase = structuredClone({
      id: randomUUID(),
      evaluationId: input.evaluationId,
      decisionCoreCaseId: input.decisionCoreCaseId,
      scenarioId: input.scenarioId,
      scenarioVersion: input.scenarioVersion,
      frameIndex: input.frameIndex,
      evaluatedAt: input.evaluatedAt,
      bundle: input.bundle,
      bundleKey: input.bundleKey,
      authority: "NO_LIVE_CAPITAL" as const,
      authorityClass: "STRUCTURAL_ONLY" as const,
      modelScored: false as const,
      projection: input.projection,
      events: input.events.map((event) => ({
        ...event,
        eventType: "REPLAY_STATE_CLASSIFIED" as const,
        recordedAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    });
    this.byId.set(record.id, deepFreeze(record));
    this.byIdentity.set(identity, record.id);
    return { created: true, record };
  }

  async findById(id: string): Promise<StoredDecisionCase | undefined> {
    return this.byId.get(id);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
