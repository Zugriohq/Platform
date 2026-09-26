/**
 * OpenAPI schemas for the alpha wire contract. They mirror
 * `@zugrio/alpha-api-contract`; `test/openapi.test.ts` keeps the committed
 * `openapi.json` in sync with these definitions.
 */
type Schema = Record<string, unknown>;

/**
 * Decision vocabulary is owned by @zugrio/decision-core and is intentionally not
 * enumerated here, so the API contract cannot drift from the deterministic authority.
 */
const state: Schema = { type: "string", description: "decision-core StructuralState" };

export const metaSchema: Schema = {
  type: "object",
  description: "Present on every alpha response. Values are fixed; clients must reject anything else.",
  required: ["releaseChannel", "liveData", "liveCapitalAuthority", "evidenceStatus", "authority"],
  properties: {
    releaseChannel: { type: "string", enum: ["private-validation-alpha"] },
    liveData: { type: "boolean", enum: [false] },
    liveCapitalAuthority: { type: "boolean", enum: [false] },
    evidenceStatus: { type: "string", enum: ["VALIDATION_ONLY"] },
    authority: { type: "string", enum: ["NO_LIVE_CAPITAL"] },
  },
};

const bundleSchema: Schema = {
  type: "object",
  required: ["id", "version", "strategy", "instrument", "market", "horizon", "evidenceStatus"],
  properties: {
    id: { type: "string" },
    version: { type: "string" },
    strategy: { type: "string" },
    instrument: { type: "string" },
    market: { type: "string" },
    horizon: { type: "string" },
    evidenceStatus: { type: "string", enum: ["VALIDATION_ONLY"] },
  },
};

const snapshotSchema: Schema = {
  type: "object",
  description: "decision-core EvidenceSnapshot (validation fixture frame).",
  required: ["timestamp", "price", "lifecycle", "entryEventObserved", "currentEntryStatus", "note"],
  properties: {
    timestamp: { type: "string", format: "date-time" },
    price: { type: "number" },
    lifecycle: { type: "string", description: "decision-core StructuralLifecycle" },
    entryEventObserved: { type: "boolean" },
    currentEntryStatus: { type: "string", description: "decision-core CurrentEntryStatus" },
    note: { type: "string" },
  },
};

const scenarioSummarySchema: Schema = {
  type: "object",
  required: ["id", "title", "description", "bundle", "frameCount"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    bundle: bundleSchema,
    frameCount: { type: "integer", minimum: 1 },
  },
};

const scenarioDetailSchema: Schema = {
  ...scenarioSummarySchema,
  required: [...(scenarioSummarySchema["required"] as string[]), "frames"],
  properties: {
    ...(scenarioSummarySchema["properties"] as Schema),
    frames: { type: "array", items: snapshotSchema },
  },
};

const decisionEventSchema: Schema = {
  type: "object",
  description: "decision-core DecisionEvent.",
  required: ["timestamp", "state", "reason", "entryReason", "price", "changes"],
  properties: {
    timestamp: { type: "string", format: "date-time" },
    state,
    reason: { type: "string" },
    entryReason: { type: "string" },
    price: { type: "number" },
    changes: {
      type: "array",
      items: {
        type: "object",
        required: ["field", "from", "to"],
        properties: { field: { type: "string" }, from: {}, to: {} },
      },
    },
  },
};

const authorityProperties: Schema = {
  authority: { type: "string", enum: ["NO_LIVE_CAPITAL"] },
  authorityClass: { type: "string", enum: ["STRUCTURAL_ONLY"] },
  modelScored: { type: "boolean", enum: [false] },
};

const projectionProperties: Schema = {
  caseId: { type: "string" },
  bundle: bundleSchema,
  current: snapshotSchema,
  state,
  reason: { type: "string" },
  entryReason: { type: "string" },
  ...authorityProperties,
};
const projectionRequired = ["caseId", "bundle", "current", "state", "reason", "entryReason", "authority", "authorityClass", "modelScored"];

const decisionCaseSchema: Schema = {
  type: "object",
  description: "Deterministic `@zugrio/decision-core` DecisionCase for one replay frame.",
  required: [...projectionRequired, "history"],
  properties: { ...projectionProperties, history: { type: "array", items: decisionEventSchema } },
};

const persistedCaseSchema: Schema = {
  type: "object",
  required: [
    "id",
    "decisionCoreCaseId",
    "scenarioId",
    "frameIndex",
    "bundle",
    "authority",
    "authorityClass",
    "modelScored",
    "projection",
    "events",
    "createdAt",
    "updatedAt",
    "consistentWithDecisionCore",
  ],
  properties: {
    id: { type: "string", format: "uuid" },
    decisionCoreCaseId: { type: "string" },
    scenarioId: { type: "string" },
    frameIndex: { type: "integer", minimum: 0 },
    bundle: bundleSchema,
    ...authorityProperties,
    projection: {
      type: "object",
      description: "decision-core DecisionCase for the persisted frame, without history (mutable read model).",
      required: projectionRequired,
      properties: projectionProperties,
    },
    events: {
      type: "array",
      description: "Append-only ledger ordered by sequence (ADR-0002).",
      items: {
        type: "object",
        required: ["sequence", "eventType", "occurredAt", "recordedAt", "event"],
        properties: {
          sequence: { type: "integer", minimum: 0 },
          eventType: { type: "string", enum: ["REPLAY_STATE_CLASSIFIED"] },
          occurredAt: { type: "string", format: "date-time" },
          recordedAt: { type: "string", format: "date-time" },
          event: decisionEventSchema,
        },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    consistentWithDecisionCore: {
      type: "boolean",
      description: "Whether re-running decision-core reproduces the stored projection and ledger.",
    },
  },
};

export function envelope(data: Schema): Schema {
  return { type: "object", required: ["meta", "data"], properties: { meta: metaSchema, data } };
}

export const schemas = {
  health: {
    type: "object",
    required: ["status", "service", "version", "persistence", "database"],
    properties: {
      status: { type: "string", enum: ["ok", "degraded"] },
      service: { type: "string", enum: ["zugrio-api"] },
      version: { type: "string" },
      persistence: { type: "string", enum: ["postgres", "memory"] },
      database: { type: "string", enum: ["ok", "unavailable"] },
    },
  },
  scenarioList: { type: "array", items: scenarioSummarySchema },
  scenarioDetail: scenarioDetailSchema,
  decisionCase: decisionCaseSchema,
  persistedCase: persistedCaseSchema,
  materializeResult: {
    type: "object",
    required: ["created", "decisionCase"],
    properties: {
      created: { type: "boolean", description: "false when an identical case already existed." },
      decisionCase: persistedCaseSchema,
    },
  },
  materializeRequest: {
    type: "object",
    additionalProperties: false,
    required: ["scenarioId", "frameIndex"],
    properties: {
      scenarioId: { type: "string", minLength: 1 },
      frameIndex: { type: "integer", minimum: 0 },
    },
  },
  error: {
    type: "object",
    properties: { statusCode: { type: "integer" }, message: {}, error: { type: "string" } },
  },
} satisfies Record<string, Schema>;
