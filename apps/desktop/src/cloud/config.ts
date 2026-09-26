/// <reference types="vite/client" />
import { createAlphaApiClient, type AlphaApiClient } from "./alphaApiClient";

/**
 * Label any UI must show when it renders decision-core output computed inside the
 * desktop process rather than returned by the cloud API.
 */
export const LOCAL_REPLAY_LABEL = "LOCAL REPLAY";

/** Build-time API base URL, e.g. `VITE_ZUGRIO_API_BASE_URL=https://api.zugrio.xyz pnpm build`. */
export function configuredApiBaseUrl(): string | undefined {
  return import.meta.env.VITE_ZUGRIO_API_BASE_URL;
}

export function createConfiguredAlphaApiClient(): AlphaApiClient {
  return createAlphaApiClient({ baseUrl: configuredApiBaseUrl() });
}
