/**
 * OpenAPI schemas for the alpha wire contract (`@zugrio/alpha-api-contract`).
 *
 * Objects produced by `@zugrio/decision-core` / `@zugrio/domain` are described by their
 * identifying and authority fields only (with `additionalProperties: true`) and point
 * to the TypeScript source of truth. The decision vocabulary (structural states,
 * outcomes, lifecycle values) is deliberately not enumerated here, so this contract
 * cannot drift from the deterministic authority. Authority markers ARE pinned.
 * `test/openapi.test.ts` keeps the committed `openapi.json` in sync.
 */
type Schema = Record<string, unknown>;

function decisionCoreObject(typeName: string, required: string[], properties: Schema = {}): Schema {
  return {
    type: "object",
    description: `\`${typeName}\` from @zugrio/decision-core (packages/decision-core/src/types.ts).`,
    required,
    properties,
    additionalProperties: true,
  };
}

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

const authorityProperties: Schema = {
  authority: { type: "string", enum: ["NO_LIVE_CAPITAL"] },
  authorityClass: { type: "string", enum: ["STRUCTURAL_ONLY"] },
  modelScored: { type: "boolean", enum: [false] },
};

const bundleSchema = decisionCoreObject("AlphaTradeBundle", ["identity", "strategy", "evidenceStatus", "authoritySpecVersion"], {
  identity: {
    type: "object",
    description: "`BundleIdentity` from @zugrio/domain: versioned MethodProfile / TradeBundle / RegimeModel / TimeframeMap and fixture scope.",
    required: ["methodProfile", "tradeBundle", "regimeModel", "timeframeMap", "scope"],
    additionalProperties: true,
  },
  evidenceStatus: { type: "string", enum: ["VALIDATION_ONLY"] },
});

const decisionEventSchema = decisionCoreObject("DecisionEvent", [
  "evaluationId",
  "evaluatedAt",
  "structuralState",
  "outcome",
  "stateReason",
  "outcomeReason",
  "changes",
  "annotationIds",
], {
  evaluationId: { type: "string" },
  evaluatedAt: { type: "string", format: "date-time" },
  structuralState: { type: "string", nullable: true },
  outcome: { type: "string" },
});

const projectionRequired = [
  "caseId",
  "scenarioId",
  "scenarioVersion",
  "evaluationId",
  "bundle",
  "current",
  "structuralState",
  "outcome",
  "stateReason",
  "outcomeReason",
  "annotations",
  "authority",
  "authorityClass",
  "modelScored",
];
const projectionProperties: Schema = {
  caseId: { type: "string" },
  scenarioId: { type: "string" },
  scenarioVersion: { type: "string" },
  evaluationId: { type: "string" },
  bundle: bundleSchema,
  current: decisionCoreObject("EvidenceSnapshot", ["evaluatedAt", "evidenceIds", "evidenceRefs"]),
  structuralState: { type: "string", nullable: true, description: "decision-core StructuralState, or null" },
  outcome: { type: "string", description: "decision-core DecisionOutcome" },
  annotations: { type: "array", items: decisionCoreObject("ChartAnnotation", ["id", "kind", "knownAt", "evidenceId"]) },
  ...authorityProperties,
};

const decisionCaseSchema = decisionCoreObject("DecisionCase", [...projectionRequired, "history"], {
  ...projectionProperties,
  history: { type: "array", items: decisionEventSchema },
});

const scenarioSummarySchema: Schema = {
  type: "object",
  required: ["id", "version", "caseId", "title", "description", "bundle", "bundleKey", "frameCount"],
  properties: {
    id: { type: "string" },
    version: { type: "string" },
    caseId: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    bundle: bundleSchema,
    bundleKey: { type: "string", description: "@zugrio/domain bundleIdentityKey(bundle.identity)" },
    frameCount: { type: "integer", minimum: 1 },
  },
};

const scenarioDetailSchema: Schema = {
  ...scenarioSummarySchema,
  required: [...(scenarioSummarySchema["required"] as string[]), "evidence", "frames"],
  properties: {
    ...(scenarioSummarySchema["properties"] as Schema),
    evidence: {
      type: "array",
      items: decisionCoreObject("EvidenceEvent", ["id", "kind", "knownAt", "value", "source"], {
        knownAt: { type: "string", format: "date-time" },
      }),
    },
    frames: { type: "array", items: decisionCoreObject("ReplayFrame", ["evaluatedAt"]) },
  },
};

const persistedCaseSchema: Schema = {
  type: "object",
  required: [
    "id",
    "evaluationId",
    "decisionCoreCaseId",
    "scenarioId",
    "scenarioVersion",
    "frameIndex",
    "evaluatedAt",
    "bundle",
    "bundleKey",
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
    evaluationId: { type: "string", description: "decision-core evaluationId; idempotency key" },
    decisionCoreCaseId: { type: "string" },
    scenarioId: { type: "string" },
    scenarioVersion: { type: "string" },
    frameIndex: { type: "integer", minimum: 0 },
    evaluatedAt: { type: "string", format: "date-time" },
    bundle: bundleSchema,
    bundleKey: { type: "string" },
    ...authorityProperties,
    projection: {
      type: "object",
      description: "decision-core DecisionCase for the persisted frame, without history (mutable read model).",
      required: projectionRequired,
      properties: projectionProperties,
      additionalProperties: true,
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
  chartScene: decisionCoreObject("EngineChartScene", [
    "sceneId",
    "instrument",
    "timeframe",
    "evaluatedAt",
    "strategyId",
    "strategyVersion",
    "regimeLabel",
    "regimeEvidenceId",
    "regimeDefinitionId",
    "regimeKnownAt",
    "routeContext",
    "primitives",
    "authority",
    "liveCapitalAuthority",
  ], {
    strategyVersion: { type: "string" },
    regimeLabel: { type: "string", nullable: true },
    regimeEvidenceId: { type: "string", nullable: true },
    regimeDefinitionId: { type: "string", nullable: true },
    regimeKnownAt: { type: "string", format: "date-time", nullable: true },
    routeContext: {
      type: "object",
      required: ["status", "families", "calibrationStatus"],
      properties: {
        status: { type: "string", enum: ["UNAVAILABLE", "ROUTES_AVAILABLE", "NO_DECLARED_ROUTE"] },
        families: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "BREAKOUT_CONTINUATION",
              "BREAKOUT_RETEST",
              "BOS_RETEST",
              "CHOCH_RETEST",
              "MSS_RETEST",
              "LIQUIDITY_SWEEP_REVERSAL",
              "FAKEOUT_REVERSAL",
              "FVG_MITIGATION",
              "TREND_CONTINUATION",
              "RANGE_MEAN_REVERSION",
              "COMPRESSION_BREAKOUT_WATCH",
            ],
          },
        },
        calibrationStatus: {
          type: "string",
          enum: ["UNVALIDATED_CANDIDATE_SET"],
          nullable: true,
        },
      },
    },
    authority: { type: "string", enum: ["RESEARCH_ONLY"] },
    liveCapitalAuthority: { type: "boolean", enum: [false] },
    primitives: { type: "array", items: decisionCoreObject("EngineChartPrimitive", [
      "primitiveId",
      "layer",
      "concept",
      "maturity",
      "label",
      "knownAt",
      "geometry",
      "sourceFactIds",
      "sourceEvidenceIds",
      "visibility",
      "styleToken",
      "authorityEffect",
    ]) },
  }),
  persistedCase: persistedCaseSchema,
  materializeResult: {
    type: "object",
    required: ["created", "decisionCase"],
    properties: {
      created: { type: "boolean", description: "false when the same decision-core evaluation was already persisted." },
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
