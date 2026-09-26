#!/usr/bin/env node
/**
 * Private-alpha cloud RC helpers (issue #71). Dependency-free; runs on Linux and Windows runners.
 *
 *   node scripts/release/rc.mjs validate-url <url>
 *   node scripts/release/rc.mjs verify-bundle <rendererDistDir> <url>
 *   node scripts/release/rc.mjs manifest --exe <path> --api <url> --out <dir> [--commit <sha>] [--run-url <url>]
 *
 * The authority fields in the manifest are fixed. They describe what this build is allowed
 * to claim and are cross-checked against @zugrio/alpha-api-contract in rc.test.mjs.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const RC_AUTHORITY = Object.freeze({
  releaseChannel: "private-validation-alpha",
  liveData: false,
  liveCapitalAuthority: false,
  authority: "NO_LIVE_CAPITAL",
  authorityClass: "STRUCTURAL_ONLY",
  modelScored: false,
});

/**
 * A cloud RC may only target a public HTTPS origin: no credentials, query, fragment or path.
 * Returns the normalized origin (no trailing slash) or throws with a reason.
 */
export function validateRcApiBaseUrl(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) throw new Error("API base URL is required for a cloud RC build");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`API base URL is not a valid URL: ${JSON.stringify(value)}`);
  }
  if (url.protocol !== "https:") throw new Error("API base URL must use https://");
  if (url.username || url.password) throw new Error("API base URL must not contain credentials");
  if (url.search || value.includes("?")) throw new Error("API base URL must not contain a query string");
  if (url.hash || value.includes("#")) throw new Error("API base URL must not contain a fragment");
  if (url.pathname !== "/") throw new Error("API base URL must be an origin without a path");
  if (!url.hostname.includes(".") || url.hostname === "localhost") {
    throw new Error("API base URL must be a public hostname");
  }
  return url.origin;
}

/** Proves the renderer bundle was built with this exact API base URL. */
export function verifyBundle(distDir, apiBaseUrl) {
  const assets = listFiles(resolve(distDir)).filter((file) => file.endsWith(".js"));
  if (assets.length === 0) throw new Error(`no JavaScript assets under ${distDir}`);
  const matches = assets.filter((file) => readFileSync(file, "utf8").includes(apiBaseUrl));
  if (matches.length === 0) {
    throw new Error(`renderer bundle does not contain ${apiBaseUrl}; refusing to label this build as cloud-configured`);
  }
  return matches;
}

export function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function buildManifest({ exePath, apiBaseUrl, commit, desktopVersion, buildTimestamp, runUrl }) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) throw new Error("a full 40-character git commit SHA is required");
  if (!desktopVersion) throw new Error("desktop version is required");
  const fileName = basename(exePath);
  return {
    schema: "zugrio.private-alpha-rc-manifest/v1",
    gitCommit: commit,
    desktopVersion,
    ...RC_AUTHORITY,
    apiBaseUrl: validateRcApiBaseUrl(apiBaseUrl),
    buildTimestamp,
    artifact: {
      fileName,
      bytes: statSync(exePath).size,
      sha256: sha256File(exePath),
      platform: "windows-x64",
      format: "electron-builder portable",
    },
    signing: {
      status: "UNSIGNED",
      note: "No code-signing certificate is applied. Windows SmartScreen will warn; verify the SHA-256 instead.",
    },
    ...(runUrl ? { workflowRun: runUrl } : {}),
  };
}

/** Writes <out>/<exe>.manifest.json and <out>/<exe>.sha256 (sha256sum format). */
export function writeReleaseFiles(outDir, manifest) {
  mkdirSync(outDir, { recursive: true });
  const base = join(outDir, manifest.artifact.fileName);
  writeFileSync(`${base}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(`${base}.sha256`, `${manifest.artifact.sha256}  ${manifest.artifact.fileName}\n`);
  return { manifestPath: `${base}.manifest.json`, checksumPath: `${base}.sha256` };
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case "validate-url":
      console.log(validateRcApiBaseUrl(args[0]));
      return;
    case "verify-bundle": {
      const matches = verifyBundle(args[0] ?? "", validateRcApiBaseUrl(args[1]));
      console.log(`bundle configured for ${args[1]} (${matches.length} asset(s))`);
      return;
    }
    case "manifest": {
      const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const desktopVersion = JSON.parse(readFileSync(join(repoRoot, "apps/desktop/package.json"), "utf8")).version;
      const exePath = option(args, "--exe");
      const outDir = option(args, "--out");
      if (!exePath || !outDir) throw new Error("--exe and --out are required");
      const manifest = buildManifest({
        exePath,
        apiBaseUrl: option(args, "--api"),
        commit: option(args, "--commit") ?? process.env.GITHUB_SHA,
        desktopVersion,
        buildTimestamp: new Date().toISOString(),
        runUrl: option(args, "--run-url"),
      });
      const written = writeReleaseFiles(outDir, manifest);
      console.log(JSON.stringify({ ...written, sha256: manifest.artifact.sha256 }, null, 2));
      return;
    }
    default:
      throw new Error(`unknown command ${JSON.stringify(command)}; expected validate-url | verify-bundle | manifest`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`rc: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
