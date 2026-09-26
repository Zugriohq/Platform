/**
 * Typed boundary between the desktop and the Zugrio private-validation-alpha API.
 *
 * Rules (issue #68):
 *  - the base URL comes from build config, never from a hard-coded default;
 *  - failures surface as explicit states; there is no silent fallback to local
 *    computation that could be mistaken for a cloud result;
 *  - a response is only accepted when it carries the exact validation-only /
 *    NO_LIVE_CAPITAL metadata; anything else is `rejected` (fail closed);
 *  - payload types are the shared contract, which re-exports `@zugrio/decision-core`.
 */
import {
  ALPHA_API_PATHS,
  isAlphaResponseMeta,
  type AlphaResponseMeta,
  type DecisionCase,
  type EngineChartScene,
  type HealthStatus,
  type MaterializeDecisionCaseRequest,
  type MaterializeDecisionCaseResult,
  type PersistedDecisionCase,
  type ScenarioDetail,
  type ScenarioSummary,
} from "@zugrio/alpha-api-contract";

export type CloudResult<T> =
  | { readonly status: "ok"; readonly source: "CLOUD"; readonly meta: AlphaResponseMeta; readonly data: T; readonly httpStatus: number }
  /** No usable API base URL was configured for this build. */
  | { readonly status: "not-configured"; readonly reason: string }
  /** Network failure, timeout or 5xx: the cloud is currently unavailable. */
  | { readonly status: "unavailable"; readonly reason: string; readonly httpStatus?: number }
  /** The API answered but refused the request (4xx). */
  | { readonly status: "error"; readonly reason: string; readonly httpStatus: number }
  /** The response did not satisfy the validation-only contract and must not be shown as a result. */
  | { readonly status: "rejected"; readonly reason: string };

export interface AlphaApiClient {
  readonly baseUrl: string | undefined;
  health(): Promise<CloudResult<HealthStatus>>;
  listScenarios(): Promise<CloudResult<ScenarioSummary[]>>;
  getScenario(scenarioId: string): Promise<CloudResult<ScenarioDetail>>;
  getFrameDecisionCase(scenarioId: string, frameIndex: number): Promise<CloudResult<DecisionCase>>;
  getFrameChartScene(scenarioId: string, frameIndex: number): Promise<CloudResult<EngineChartScene>>;
  materializeDecisionCase(request: MaterializeDecisionCaseRequest): Promise<CloudResult<MaterializeDecisionCaseResult>>;
  getDecisionCase(caseId: string): Promise<CloudResult<PersistedDecisionCase>>;
}

export interface AlphaApiClientOptions {
  readonly baseUrl: string | undefined;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}


type PayloadValidator<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isChartGeometry(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.type)) return false;
  switch (value.type) {
    case "POINT":
      return isIsoTime(value.time) && isFiniteNumber(value.price);
    case "LEVEL":
      return isFiniteNumber(value.price) &&
        (value.startAt === undefined || isIsoTime(value.startAt)) &&
        (value.endAt === undefined || isIsoTime(value.endAt));
    case "ZONE":
      return isFiniteNumber(value.low) &&
        isFiniteNumber(value.high) &&
        value.low <= value.high &&
        (value.startAt === undefined || isIsoTime(value.startAt)) &&
        (value.endAt === undefined || isIsoTime(value.endAt));
    case "PATH":
      return Array.isArray(value.points) &&
        value.points.length > 0 &&
        value.points.every(point =>
          isRecord(point) && isIsoTime(point.time) && isFiniteNumber(point.price),
        );
    default:
      return false;
  }
}

function latestGeometryTime(value: unknown): number | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "POINT" && isIsoTime(value.time)) return Date.parse(value.time);
  if (value.type === "PATH" && Array.isArray(value.points)) {
    const times = value.points
      .filter(isRecord)
      .map(point => point.time)
      .filter(isIsoTime)
      .map(Date.parse);
    return times.length > 0 ? Math.max(...times) : null;
  }
  return null;
}

function isEngineChartScenePayload(value: unknown): value is EngineChartScene {
  if (!isRecord(value)) return false;
  if (
    value.authority !== "RESEARCH_ONLY" ||
    value.liveCapitalAuthority !== false ||
    !isNonEmptyString(value.sceneId) ||
    !isNonEmptyString(value.instrument) ||
    !isNonEmptyString(value.timeframe) ||
    !isIsoTime(value.evaluatedAt) ||
    !isNonEmptyString(value.strategyId) ||
    !isNonEmptyString(value.strategyVersion) ||
    !(value.regimeLabel === null || typeof value.regimeLabel === "string") ||
    !(value.regimeEvidenceId === null || isNonEmptyString(value.regimeEvidenceId)) ||
    !(value.regimeDefinitionId === null || isNonEmptyString(value.regimeDefinitionId)) ||
    !(value.regimeKnownAt === null || isIsoTime(value.regimeKnownAt)) ||
    !isRecord(value.regimeContext) ||
    !isRecord(value.routeContext) ||
    !Array.isArray(value.primitives)
  ) {
    return false;
  }

  const sceneTime = Date.parse(value.evaluatedAt);
  const regimeStatuses = ["CLASSIFIED","UNCERTAIN","UNAVAILABLE"] as const;
  if (
    !oneOf(value.regimeContext.status, regimeStatuses) ||
    !(value.regimeContext.measurementId === null || isNonEmptyString(value.regimeContext.measurementId)) ||
    !(value.regimeContext.profileId === null || isNonEmptyString(value.regimeContext.profileId)) ||
    !(value.regimeContext.profileVersion === null || isNonEmptyString(value.regimeContext.profileVersion)) ||
    !isStringArray(value.regimeContext.matchingRuleIds) ||
    !isStringArray(value.regimeContext.reasons)
  ) {
    return false;
  }

  const routeStatuses = ["UNAVAILABLE","ROUTES_AVAILABLE","NO_DECLARED_ROUTE"] as const;
  const routeFamilies = [
    "BREAKOUT_CONTINUATION","BREAKOUT_RETEST","BOS_RETEST","CHOCH_RETEST","MSS_RETEST",
    "LIQUIDITY_SWEEP_REVERSAL","FAKEOUT_REVERSAL","FVG_MITIGATION","TREND_CONTINUATION",
    "RANGE_MEAN_REVERSION","COMPRESSION_BREAKOUT_WATCH",
  ] as const;

  if (
    !oneOf(value.routeContext.status, routeStatuses) ||
    !Array.isArray(value.routeContext.families) ||
    !value.routeContext.families.every(family => oneOf(family, routeFamilies)) ||
    !(value.routeContext.calibrationStatus === null ||
      value.routeContext.calibrationStatus === "UNVALIDATED_CANDIDATE_SET")
  ) {
    return false;
  }

  const hasRegime = value.regimeLabel !== null;
  const hasCompleteRegimeProvenance =
    value.regimeEvidenceId !== null &&
    value.regimeDefinitionId !== null &&
    value.regimeKnownAt !== null;
  if (hasRegime !== hasCompleteRegimeProvenance) return false;
  if (value.regimeKnownAt !== null && Date.parse(value.regimeKnownAt) > sceneTime) return false;

  if (value.regimeContext.status === "CLASSIFIED") {
    if (
      !hasRegime ||
      !isNonEmptyString(value.regimeContext.measurementId) ||
      !isNonEmptyString(value.regimeContext.profileId) ||
      !isNonEmptyString(value.regimeContext.profileVersion) ||
      value.regimeContext.matchingRuleIds.length !== 1
    ) return false;
  } else {
    if (hasRegime) return false;
    if (value.regimeContext.status === "UNCERTAIN") {
      if (
        !isNonEmptyString(value.regimeContext.measurementId) ||
        !isNonEmptyString(value.regimeContext.profileId) ||
        !isNonEmptyString(value.regimeContext.profileVersion)
      ) return false;
    }
  }

  if (!hasRegime) {
    if (
      value.routeContext.status !== "UNAVAILABLE" ||
      value.routeContext.families.length !== 0 ||
      value.routeContext.calibrationStatus !== null
    ) return false;
  } else if (value.routeContext.status === "ROUTES_AVAILABLE") {
    if (
      value.routeContext.families.length === 0 ||
      value.routeContext.calibrationStatus !== "UNVALIDATED_CANDIDATE_SET"
    ) return false;
  } else if (value.routeContext.status === "NO_DECLARED_ROUTE") {
    if (
      value.routeContext.families.length !== 0 ||
      value.routeContext.calibrationStatus !== "UNVALIDATED_CANDIDATE_SET"
    ) return false;
  }

  const layers = ["REGIME","STRUCTURE","LIQUIDITY","IMBALANCE","SETUP","PATTERN","ENTRY","INVALIDATION","OBJECTIVE","DIAGNOSTIC","ADVISORY"] as const;
  const maturities = ["DETERMINISTIC_FACT","MORPHOLOGY_ONLY","RESEARCH_DERIVED","ADVISORY_ONLY"] as const;
  const scales = ["INTERNAL","INTERMEDIATE","EXTERNAL"] as const;
  const visibility = ["PRIMARY","SECONDARY","DETAIL"] as const;
  const styleTokens = ["STRUCTURE_PRIMARY","STRUCTURE_SECONDARY","LIQUIDITY","IMBALANCE","SETUP","PATTERN","ENTRY","ADVISORY"] as const;

  return value.primitives.every(primitive => {
    if (!isRecord(primitive)) return false;
    if (
      !isNonEmptyString(primitive.primitiveId) ||
      !oneOf(primitive.layer, layers) ||
      !isNonEmptyString(primitive.concept) ||
      !oneOf(primitive.maturity, maturities) ||
      !(primitive.scale === null || oneOf(primitive.scale, scales)) ||
      !isNonEmptyString(primitive.label) ||
      !isIsoTime(primitive.knownAt) ||
      !isChartGeometry(primitive.geometry) ||
      !isStringArray(primitive.sourceFactIds) ||
      !isStringArray(primitive.sourceEvidenceIds) ||
      !oneOf(primitive.visibility, visibility) ||
      !oneOf(primitive.styleToken, styleTokens) ||
      primitive.authorityEffect !== "NONE"
    ) {
      return false;
    }

    const knownAt = Date.parse(primitive.knownAt);
    if (knownAt > sceneTime) return false;
    const geometryTime = latestGeometryTime(primitive.geometry);
    if (geometryTime !== null && geometryTime > knownAt) return false;
    return true;
  });
}

function isDecisionCasePayload(value: unknown): value is DecisionCase {
  if (!isRecord(value)) return false;
  if (
    value.authority !== "NO_LIVE_CAPITAL" ||
    value.authorityClass !== "STRUCTURAL_ONLY" ||
    value.modelScored !== false ||
    !isNonEmptyString(value.caseId) ||
    !isNonEmptyString(value.scenarioId) ||
    !isNonEmptyString(value.scenarioVersion) ||
    !isNonEmptyString(value.evaluationId) ||
    !isRecord(value.bundle) ||
    value.bundle.evidenceStatus !== "VALIDATION_ONLY" ||
    value.bundle.authoritySpecVersion !== "1.0.2" ||
    !isRecord(value.current) ||
    !isIsoTime(value.current.evaluatedAt) ||
    !Array.isArray(value.annotations) ||
    !Array.isArray(value.history)
  ) {
    return false;
  }

  const structuralStates = ["STRUCTURAL_CANDIDATE","STRUCTURAL_WATCH","STRUCTURAL_READY"] as const;
  const lifecycles = ["CANDIDATE_IDENTIFIED","BREAK_CONFIRMED","RETEST_TOUCHED","RETEST_HELD","CONTINUATION_HELD","LIFECYCLE_CONFIRMED"] as const;
  const entryStates = ["NOT_AVAILABLE","CURRENT","STALE"] as const;
  const outcomes = ["WAIT","PASS","CURRENT_FIXTURE_ENTRY"] as const;

  if (!(value.structuralState === null || oneOf(value.structuralState, structuralStates))) return false;
  if (!oneOf(value.outcome, outcomes)) return false;
  if (!(value.current.lifecycle === null || oneOf(value.current.lifecycle, lifecycles))) return false;
  if (!oneOf(value.current.currentEntryStatus, entryStates)) return false;
  if (!(value.current.price === null || isFiniteNumber(value.current.price))) return false;

  return value.annotations.every(annotation =>
    isRecord(annotation) &&
    isNonEmptyString(annotation.id) &&
    oneOf(annotation.kind, ["STRUCTURAL_LIFECYCLE","ENTRY_STATUS"] as const) &&
    isNonEmptyString(annotation.label) &&
    isIsoTime(annotation.knownAt) &&
    isNonEmptyString(annotation.evidenceId),
  );
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** HTTPS only, except plain HTTP to loopback for local development. */
export function resolveApiBaseUrl(raw: string | undefined): { ok: true; url: string } | { ok: false; reason: string } {
  const value = raw?.trim();
  if (!value) return { ok: false, reason: "VITE_ZUGRIO_API_BASE_URL is not set for this build" };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "VITE_ZUGRIO_API_BASE_URL is not a valid URL" };
  }
  const secure = url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname));
  if (!secure) return { ok: false, reason: "The API base URL must use https (http is allowed for localhost only)" };
  if (url.username || url.password || url.search || url.hash) {
    return { ok: false, reason: "The API base URL must not contain credentials, a query or a fragment" };
  }
  return { ok: true, url: url.toString().replace(/\/+$/, "") };
}

export function createAlphaApiClient(options: AlphaApiClientOptions): AlphaApiClient {
  const resolved = resolveApiBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function call<T>(
    path: string,
    init?: RequestInit,
    validateData?: PayloadValidator<T>,
  ): Promise<CloudResult<T>> {
    if (!resolved.ok) return { status: "not-configured", reason: resolved.reason };

    let response: Response;
    try {
      response = await fetchImpl(resolved.url + path, {
        ...init,
        headers: { accept: "application/json", ...(init?.body ? { "content-type": "application/json" } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      return { status: "unavailable", reason: timedOut ? `No response within ${timeoutMs} ms` : "Network request failed" };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (response.status >= 500) {
      return { status: "unavailable", reason: messageOf(body) ?? `Server error ${response.status}`, httpStatus: response.status };
    }
    if (!response.ok) {
      return { status: "error", reason: messageOf(body) ?? `Request failed with ${response.status}`, httpStatus: response.status };
    }
    if (typeof body !== "object" || body === null || !("data" in body) || !("meta" in body)) {
      return { status: "rejected", reason: "Response is not an alpha API envelope" };
    }
    const envelope = body as { meta: unknown; data: unknown };
    if (!isAlphaResponseMeta(envelope.meta)) {
      return { status: "rejected", reason: "Response does not carry validation-only / NO_LIVE_CAPITAL metadata" };
    }
    if (validateData && !validateData(envelope.data)) {
      return { status: "rejected", reason: "Response payload does not satisfy the expected alpha contract" };
    }
    return {
      status: "ok",
      source: "CLOUD",
      meta: envelope.meta,
      data: envelope.data as T,
      httpStatus: response.status,
    };
  }

  return {
    baseUrl: resolved.ok ? resolved.url : undefined,
    health: () => call(ALPHA_API_PATHS.health()),
    listScenarios: () => call(ALPHA_API_PATHS.scenarios()),
    getScenario: (scenarioId) => call(ALPHA_API_PATHS.scenario(scenarioId)),
    getFrameDecisionCase: (scenarioId, frameIndex) =>
      call(ALPHA_API_PATHS.frameDecisionCase(scenarioId, frameIndex), undefined, isDecisionCasePayload),
    getFrameChartScene: (scenarioId, frameIndex) =>
      call(ALPHA_API_PATHS.frameChartScene(scenarioId, frameIndex), undefined, isEngineChartScenePayload),
    materializeDecisionCase: (request) =>
      call(ALPHA_API_PATHS.decisionCases(), {
        method: "POST",
        body: JSON.stringify({ scenarioId: request.scenarioId, frameIndex: request.frameIndex }),
      }),
    getDecisionCase: (caseId) => call(ALPHA_API_PATHS.decisionCase(caseId)),
  };
}

function messageOf(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("message" in body)) return undefined;
  const message = (body as { message: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter((item) => typeof item === "string").join("; ") || undefined;
  return undefined;
}
