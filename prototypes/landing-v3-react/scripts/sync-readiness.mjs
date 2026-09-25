import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(appRoot, "..", "..");
const sourcePath = resolve(repoRoot, "config", "capability-scope-manifest.v1.json");
const outputPath = resolve(appRoot, "src", "generated", "capability-scope-manifest.json");

const raw = await readFile(sourcePath, "utf8");
const manifest = JSON.parse(raw);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

console.log("Synced capability manifest: " + manifest.capabilities.length + " capabilities");
