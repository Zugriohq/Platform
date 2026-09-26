/**
 * Wire contract between the Zugrio private-validation-alpha API (`apps/api`) and its
 * clients (`apps/desktop`). Decision semantics are NOT defined here: every decision
 * payload is a `@zugrio/decision-core` type, so the API and the desktop cannot drift
 * away from the single deterministic authority.
 */
import type {
  AlphaTradeBundle,
  DecisionCase,
  DecisionEvent,
  EvidenceSnapshot,
  StructuralState,
} from "@zugrio/decision-core";

export type { AlphaTradeBundle, DecisionCase, DecisionEvent, EvidenceSnapshot, StructuralState };

export const ALPHA_RELEASE_CHANNEL = "private-validation-alpha";

/** Attached to every alpha API response. None of these values is configurable. */
export const ALPHA_RESPONSE_META = Object.freeze({
  releaseChannel: ALPHA_RELEASE_CHANNEL,
  liveData: false,
  liveCapitalAuthority: false,
  evidenceStatus: "VALIDATION_ONLY",
  authority: "NO_LIVE_CAPITAL",
} as const);

export type AlphaResponseMeta = typeof ALPHA_RESPONSE_META;

export interface AlphaEnvelope<T> {
  readonly meta: AlphaResponseMeta;
  readonly data: T;
}

/**
 * Fail-closed check used by clients: anything that does not carry exactly the
 * validation-only / no-live-capital markers must not be rendered as a Zugrio result.
 */
export function isAlphaResponseMeta(value: unknown): value is AlphaResponseMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (Object.keys(ALPHA_RESPONSE_META) as (keyof AlphaResponseMeta)[]).every(
    (key) => meta[key] === ALPHA_RESPONSE_META[key],
  );
}

export interface HealthStatus {
  readonly status: "ok" | "degraded";
  readonly service: "zugrio-api";
  readonly version: string;
  readonly persistence: "postgres" | "memory";
  readonly database: "ok" | "unavailable";
}

export interface ScenarioSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bundle: AlphaTradeBundle;
  readonly frameCount: number;
}

export interface ScenarioDetail extends ScenarioSummary {
  readonly frames: readonly EvidenceSnapshot[];
}

export interface MaterializeDecisionCaseRequest {
  readonly scenarioId: string;
  readonly frameIndex: number;
}

/** Only event type the alpha ledger records: a decision-core replay classification. */
export type DecisionEventType = "REPLAY_STATE_CLASSIFIED";

/** One append-only ledger entry wrapping a verbatim decision-core `DecisionEvent`. */
export interface PersistedDecisionEvent {
  readonly sequence: number;
  readonly eventType: DecisionEventType;
  /** Replay frame time the event applies to (`event.timestamp`, normalized to ISO-8601). */
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly event: DecisionEvent;
}

/** Read projection: the decision-core `DecisionCase` for the persisted frame, without history. */
export type DecisionCaseProjection = Omit<DecisionCase, "history">;

export interface PersistedDecisionCase {
  /** Server-issued identity of the persisted case. */
  readonly id: string;
  /** Identity decision-core assigns to the same case (`scenarioId:frameTimestamp`). */
  readonly decisionCoreCaseId: string;
  readonly scenarioId: string;
  readonly frameIndex: number;
  readonly bundle: AlphaTradeBundle;
  readonly authority: "NO_LIVE_CAPITAL";
  readonly authorityClass: "STRUCTURAL_ONLY";
  readonly modelScored: false;
  readonly projection: DecisionCaseProjection;
  /** Append-only ledger, ordered by `sequence`. */
  readonly events: readonly PersistedDecisionEvent[];
  readonly createdAt: string;
  readonly updatedAt: string;
  /**
   * Whether re-running decision-core on the same scenario/frame reproduces the stored
   * projection and ledger. `false` means the stored record must not be trusted as a
   * current decision-core output (e.g. the fixture bundle changed since persistence).
   */
  readonly consistentWithDecisionCore: boolean;
}

export interface MaterializeDecisionCaseResult {
  /** `false` when an identical scenario/frame/bundle case already existed (idempotent). */
  readonly created: boolean;
  readonly decisionCase: PersistedDecisionCase;
}

export const ALPHA_API_PATHS = {
  health: () => "/health",
  scenarios: () => "/v1/alpha/scenarios",
  scenario: (scenarioId: string) => `/v1/alpha/scenarios/${encodeURIComponent(scenarioId)}`,
  frameDecisionCase: (scenarioId: string, frameIndex: number) =>
    `/v1/alpha/scenarios/${encodeURIComponent(scenarioId)}/frames/${frameIndex}`,
  decisionCases: () => "/v1/alpha/decision-cases",
  decisionCase: (caseId: string) => `/v1/alpha/decision-cases/${encodeURIComponent(caseId)}`,
} as const;
