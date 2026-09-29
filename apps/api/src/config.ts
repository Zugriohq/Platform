export type PersistenceConfig =
  | { readonly kind: "postgres"; readonly databaseUrl: string }
  | { readonly kind: "memory" };

export interface ApiConfig {
  readonly host: string;
  readonly port: number;
  readonly persistence: PersistenceConfig;
  /** `"*"` or an explicit origin allow-list. The alpha API carries no credentials. */
  readonly corsOrigins: "*" | readonly string[];
  readonly jsonLogs: boolean;
}

export const API_VERSION = "0.1.0-alpha.1";

/**
 * Fails closed: without DATABASE_URL the API refuses to start unless in-memory
 * persistence is requested explicitly, so a misconfigured deployment can never
 * silently present non-durable storage as the persisted ledger.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env["PORT"] ?? "3000");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer between 0 and 65535");
  }

  const databaseUrl = env["DATABASE_URL"]?.trim();
  let persistence: PersistenceConfig;
  if (databaseUrl) {
    persistence = { kind: "postgres", databaseUrl };
  } else if (env["ZUGRIO_ALPHA_PERSISTENCE"] === "memory") {
    persistence = { kind: "memory" };
  } else {
    throw new Error(
      "DATABASE_URL is required. Set ZUGRIO_ALPHA_PERSISTENCE=memory only for local, non-durable development.",
    );
  }

  const cors = env["ZUGRIO_CORS_ORIGINS"]?.trim();
  const corsOrigins =
    !cors || cors === "*"
      ? "*"
      : cors.split(",").map((origin) => origin.trim()).filter((origin) => origin.length > 0);

  return {
    host: env["HOST"] ?? "0.0.0.0",
    port,
    persistence,
    corsOrigins,
    jsonLogs: env["ZUGRIO_LOG_FORMAT"] !== "pretty",
  };
}
