// Regenerates the committed OpenAPI contract: `pnpm --filter @zugrio/api openapi:write`.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp, createOpenApiDocument } from "./app.js";
import { loadConfig } from "./config.js";

const app = await createApp(loadConfig({ ZUGRIO_ALPHA_PERSISTENCE: "memory" }), { logger: false });
await app.init();
const target = fileURLToPath(new URL("../openapi.json", import.meta.url));
writeFileSync(target, `${JSON.stringify(createOpenApiDocument(app), null, 2)}\n`);
await app.close();
console.log(`wrote ${target}`);
