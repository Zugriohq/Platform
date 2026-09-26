import type { AlphaTradeBundle, EvidenceSnapshot, OpportunityState } from "@zugrio/decision-core";
import type { PersistedDecisionCase } from "@zugrio/alpha-api-contract";

export interface NewDecisionEvent {
  readonly sequence: number;
  readonly occurredAt: string;
  readonly state: OpportunityState;
  readonly reason: string;
  readonly price: number;
}

export interface NewDecisionCase {
  readonly decisionCoreCaseId: string;
  readonly scenarioId: string;
  readonly frameIndex: number;
  readonly bundle: AlphaTradeBundle;
  readonly projection: {
    readonly state: OpportunityState;
    readonly reason: string;
    readonly current: EvidenceSnapshot;
  };
  readonly events: readonly NewDecisionEvent[];
}

/** A persisted case exactly as stored; consistency with decision-core is judged by the service. */
export type StoredDecisionCase = Omit<PersistedDecisionCase, "consistentWithDecisionCore">;

export interface CreateResult {
  readonly created: boolean;
  readonly record: StoredDecisionCase;
}

/**
 * Persistence port for the alpha decision ledger (ADR-0002). Implementations must:
 *  - write a case and its full event history atomically;
 *  - be idempotent on (scenarioId, frameIndex, bundle id, bundle version);
 *  - never update or delete an event once written.
 */
export interface DecisionCaseStore {
  readonly kind: "postgres" | "memory";
  create(input: NewDecisionCase): Promise<CreateResult>;
  findById(id: string): Promise<StoredDecisionCase | undefined>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
