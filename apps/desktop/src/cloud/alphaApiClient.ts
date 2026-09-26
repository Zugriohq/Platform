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
  materializeDecisionCase(request: MaterializeDecisionCaseRequest): Promise<CloudResult<MaterializeDecisionCaseResult>>;
  getDecisionCase(caseId: string): Promise<CloudResult<PersistedDecisionCase>>;
}

export interface AlphaApiClientOptions {
  readonly baseUrl: string | undefined;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
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

  async function call<T>(path: string, init?: RequestInit): Promise<CloudResult<T>> {
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
    const envelope = body as { meta: unknown; data: T };
    if (!isAlphaResponseMeta(envelope.meta)) {
      return { status: "rejected", reason: "Response does not carry validation-only / NO_LIVE_CAPITAL metadata" };
    }
    return { status: "ok", source: "CLOUD", meta: envelope.meta, data: envelope.data, httpStatus: response.status };
  }

  return {
    baseUrl: resolved.ok ? resolved.url : undefined,
    health: () => call(ALPHA_API_PATHS.health()),
    listScenarios: () => call(ALPHA_API_PATHS.scenarios()),
    getScenario: (scenarioId) => call(ALPHA_API_PATHS.scenario(scenarioId)),
    getFrameDecisionCase: (scenarioId, frameIndex) => call(ALPHA_API_PATHS.frameDecisionCase(scenarioId, frameIndex)),
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
