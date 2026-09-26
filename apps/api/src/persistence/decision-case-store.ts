import type { AlphaTradeBundle, DecisionEvent } from "@zugrio/decision-core";
import type { DecisionCaseProjection, PersistedDecisionCase } from "@zugrio/alpha-api-contract";

export interface NewDecisionEvent {
  readonly sequence: number;
  /** ISO-8601 replay frame time of `event.timestamp`. */
  readonly occurredAt: string;
  /** Verbatim decision-core event. */
  readonly event: DecisionEvent;
}

export interface NewDecisionCase {
  readonly decisionCoreCaseId: string;
  readonly scenarioId: string;
  readonly frameIndex: number;
  readonly bundle: AlphaTradeBundle;
  /** Verbatim decision-core DecisionCase without history. */
  readonly projection: DecisionCaseProjection;
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
 *  - never update or delete an event once written;
 *  - store decision-core output verbatim, without interpreting it.
 */
export interface DecisionCaseStore {
  readonly kind: "postgres" | "memory";
  create(input: NewDecisionCase): Promise<CreateResult>;
  findById(id: string): Promise<StoredDecisionCase | undefined>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
