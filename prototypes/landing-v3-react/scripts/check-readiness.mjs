import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED = new Set([
  "released",
  "early_access",
  "validation",
  "research_only",
  "planned",
  "locked",
]);

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const repoRoot = resolve(appRoot, "..", "..");
const sourcePath = resolve(repoRoot, "config", "capability-scope-manifest.v1.json");
const generatedPath = resolve(appRoot, "src", "generated", "capability-scope-manifest.json");
const srcRoot = resolve(appRoot, "src");

const canonical = JSON.parse(await readFile(sourcePath, "utf8"));
const generated = JSON.parse(await readFile(generatedPath, "utf8"));
const errors = [];

if (canonical.schema_version !== "1.0") {
  errors.push("Unsupported manifest schema_version: " + canonical.schema_version);
}

if (!Array.isArray(canonical.capabilities) || canonical.capabilities.length === 0) {
  errors.push("Manifest must contain at least one capability.");
}

const ids = new Set();
for (const capability of canonical.capabilities || []) {
  if (!capability.id) errors.push("Capability is missing id.");
  if (ids.has(capability.id)) errors.push("Duplicate capability id: " + capability.id);
  ids.add(capability.id);

  if (!ALLOWED.has(capability.status)) {
    errors.push("Invalid status for " + capability.id + ": " + capability.status);
  }
  if (!capability.public_name) {
    errors.push("Capability " + capability.id + " is missing public_name.");
  }
  if (!capability.scope) {
    errors.push("Capability " + capability.id + " is missing scope.");
  }
}

if (JSON.stringify(canonical) !== JSON.stringify(generated)) {
  errors.push("Generated landing manifest does not match canonical config/capability-scope-manifest.v1.json.");
}

async function filesUnder(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "generated") continue;
      out.push(...await filesUnder(full));
    } else if ([".js", ".jsx", ".ts", ".tsx"].includes(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = await filesUnder(srcRoot);
const capabilityTag = /<CapabilityStatus\s+capabilityId=["']([^"']+)["']/g;

for (const file of files) {
  const source = await readFile(file, "utf8");

  let match;
  while ((match = capabilityTag.exec(source)) !== null) {
    if (!ids.has(match[1])) {
      errors.push("Unknown capability id " + match[1] + " referenced by " + file.replace(appRoot + "/", ""));
    }
  }

  if (!file.endsWith("CapabilityStatus.jsx")) {
    const directStatusLiteral = /["'](Released|Early access|Validation|Research only|Planned|Locked)["']/g;
    if (directStatusLiteral.test(source)) {
      errors.push(
        "Direct public readiness label found in " + file.replace(appRoot + "/", "") +
        ". Capability status UI must render through CapabilityStatus/manifest data."
      );
    }
  }
}

if (errors.length) {
  console.error("\nReadiness manifest check failed:");
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}

console.log(
  "Readiness manifest check passed: " +
  canonical.capabilities.length +
  " capabilities, " +
  ids.size +
  " unique ids."
);
