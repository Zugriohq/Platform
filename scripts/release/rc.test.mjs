// node --test scripts/release/  (run after `pnpm build:packages`; imports the built contract)
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ALPHA_RESPONSE_META } from "../../packages/alpha-api-contract/dist/index.js";
import { RC_AUTHORITY, buildManifest, validateRcApiBaseUrl, verifyBundle, writeReleaseFiles } from "./rc.mjs";

const cli = fileURLToPath(new URL("./rc.mjs", import.meta.url));
const commit = "0123456789abcdef0123456789abcdef01234567";

test("accepts the intended production origin", () => {
  assert.equal(validateRcApiBaseUrl("https://api.zugrio.xyz"), "https://api.zugrio.xyz");
  assert.equal(validateRcApiBaseUrl(" https://api.zugrio.xyz/ "), "https://api.zugrio.xyz");
});

test("rejects missing, insecure, credentialed, query, fragment, path and local URLs", () => {
  for (const bad of [
    undefined,
    "",
    "   ",
    "api.zugrio.xyz",
    "http://api.zugrio.xyz",
    "https://user:pass@api.zugrio.xyz",
    "https://token@api.zugrio.xyz",
    "https://api.zugrio.xyz/?key=1",
    "https://api.zugrio.xyz?",
    "https://api.zugrio.xyz/#x",
    "https://api.zugrio.xyz#",
    "https://api.zugrio.xyz/v1",
    "https://localhost",
    "https://intranet",
    "ftp://api.zugrio.xyz",
  ]) {
    assert.throws(() => validateRcApiBaseUrl(bad), undefined, JSON.stringify(bad));
  }
});

test("CLI exits non-zero for an invalid URL and zero for a valid one", () => {
  assert.throws(() => execFileSync(process.execPath, [cli, "validate-url", "http://api.zugrio.xyz"], { stdio: "pipe" }));
  assert.throws(() => execFileSync(process.execPath, [cli, "validate-url"], { stdio: "pipe" }));
  assert.equal(execFileSync(process.execPath, [cli, "validate-url", "https://api.zugrio.xyz"]).toString().trim(), "https://api.zugrio.xyz");
});

test("manifest authority fields match the alpha API contract", () => {
  for (const key of ["releaseChannel", "liveData", "liveCapitalAuthority", "authority"]) {
    assert.equal(RC_AUTHORITY[key], ALPHA_RESPONSE_META[key], key);
  }
  assert.equal(RC_AUTHORITY.modelScored, false);
  assert.equal(RC_AUTHORITY.authorityClass, "STRUCTURAL_ONLY");
});

test("manifest and checksum describe the executable exactly and say UNSIGNED", () => {
  const dir = mkdtempSync(join(tmpdir(), "zugrio-rc-"));
  const exe = join(dir, "Zugrio-Private-Alpha-0.1.0-alpha.2-cloud-rc.exe");
  writeFileSync(exe, "not really an exe");
  const manifest = buildManifest({
    exePath: exe,
    apiBaseUrl: "https://api.zugrio.xyz",
    commit,
    desktopVersion: "0.1.0-alpha.2",
    buildTimestamp: "2026-09-26T12:00:00.000Z",
  });
  assert.deepEqual(manifest, {
      schema: "zugrio.private-alpha-rc-manifest/v1",
      gitCommit: commit,
      desktopVersion: "0.1.0-alpha.2",
      releaseChannel: "private-validation-alpha",
      liveData: false,
      liveCapitalAuthority: false,
      authority: "NO_LIVE_CAPITAL",
      authorityClass: "STRUCTURAL_ONLY",
      modelScored: false,
      apiBaseUrl: "https://api.zugrio.xyz",
      buildTimestamp: "2026-09-26T12:00:00.000Z",
      artifact: {
        fileName: "Zugrio-Private-Alpha-0.1.0-alpha.2-cloud-rc.exe",
        bytes: 17,
        sha256: createHash("sha256").update("not really an exe").digest("hex"),
        platform: "windows-x64",
        format: "electron-builder portable",
      },
      signing: manifest.signing,
  });
  assert.match(manifest.artifact.sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.signing.status, "UNSIGNED");

  const { manifestPath, checksumPath } = writeReleaseFiles(join(dir, "out"), manifest);
  assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), manifest);
  assert.equal(readFileSync(checksumPath, "utf8"), `${manifest.artifact.sha256}  ${manifest.artifact.fileName}\n`);
});

test("manifest refuses an invalid API URL or a missing commit", () => {
  const dir = mkdtempSync(join(tmpdir(), "zugrio-rc-"));
  const exe = join(dir, "app.exe");
  writeFileSync(exe, "x");
  const base = { exePath: exe, commit, desktopVersion: "1", buildTimestamp: "t" };
  assert.throws(() => buildManifest({ ...base, apiBaseUrl: "http://api.zugrio.xyz" }));
  assert.throws(() => buildManifest({ ...base, apiBaseUrl: "https://api.zugrio.xyz", commit: undefined }));
});

test("bundle verification requires the configured URL in the renderer assets", () => {
  const dir = mkdtempSync(join(tmpdir(), "zugrio-dist-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "index.js"), 'const base="https://api.zugrio.xyz";');
  assert.equal(verifyBundle(dir, "https://api.zugrio.xyz").length, 1);
  assert.throws(() => verifyBundle(dir, "https://api.other.example"));
});
