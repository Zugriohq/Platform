import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { DecisionCaseStore } from "../src/persistence/decision-case-store.js";
import { MemoryDecisionCaseStore } from "../src/persistence/memory-decision-case-store.js";

export interface RunningApi {
  readonly app: INestApplication;
  readonly baseUrl: string;
  request(path: string, init?: RequestInit): Promise<{ status: number; body: any; headers: Headers }>;
  close(): Promise<void>;
}

export async function startApi(store: DecisionCaseStore = new MemoryDecisionCaseStore()): Promise<RunningApi> {
  const app = await createApp(loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory" }), { store, logger: false });
  await app.listen(0, "127.0.0.1");
  const baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  return {
    app,
    baseUrl,
    async request(path, init) {
      const response = await fetch(baseUrl + path, init);
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : undefined, headers: response.headers };
    },
    close: () => app.close(),
  };
}

export function postJson(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
