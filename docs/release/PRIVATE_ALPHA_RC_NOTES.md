# Zugrio Private Validation Alpha: RC notes

Channel: `private-validation-alpha` · Desktop `0.1.0-alpha.2` · **NO LIVE CAPITAL**

## What this alpha proves

- `@zugrio/decision-core` deterministically classifies versioned, point-in-time replay
  fixtures into frozen structural states (`STRUCTURAL_CANDIDATE` / `STRUCTURAL_WATCH` /
  `STRUCTURAL_READY`). `PASS` is a decision **outcome**, not an opportunity state.
- A Decision Case keeps its reasoning: evidence changes, chart annotations bound to the
  evidence that produced them (`knownAt`), and an append-only history.
- The same decision-core output can be served by the Zugrio cloud API and persisted in
  PostgreSQL. The ledger is append-only and the database only accepts `NO_LIVE_CAPITAL`
  / `STRUCTURAL_ONLY` / `modelScored: false`.
- The Windows desktop shows where a decision came from. It never presents local output
  as cloud output.

## Cloud vs local replay

| Build | Header / banner | Decision source | When the API fails |
|---|---|---|---|
| Normal CI build (no API URL) | `LOCAL REPLAY` · `EXPLICIT LOCAL MODE` | decision-core bundled in the app | n/a, no network calls |
| Cloud RC (`*-cloud-rc.exe`) | `CLOUD VALIDATION` · `ZUGRIO CLOUD` + API URL | `https://api.zugrio.xyz` responses only | "Cloud decision data is unavailable" plus **RETRY CLOUD**. No local fallback. |

A cloud response is rendered only if it carries exactly
`private-validation-alpha / liveData:false / liveCapitalAuthority:false /
VALIDATION_ONLY / NO_LIVE_CAPITAL`. Anything else is **rejected** and nothing is shown.
**RECORD CASE** (cloud builds only) sends only `{ scenarioId, frameIndex }` and reports
whether the case was recorded, already recorded, or not recorded.

## Producing the cloud RC

1. Confirm `https://api.zugrio.xyz/health` returns `status: ok`
   (`infra/cloudflare/README.md`, Phase 3).
2. Actions → **Private alpha cloud RC (Windows)** → *Run workflow*, with
   `api_base_url = https://api.zugrio.xyz`. The workflow refuses URLs that are not
   HTTPS origins, and refuses to package unless the built renderer contains the URL.
3. Download artifact `zugrio-private-alpha-cloud-rc-<sha>`:
   - `Zugrio-Private-Alpha-<version>-cloud-rc.exe`
   - `….exe.sha256` (sha256sum format)
   - `….exe.manifest.json`: commit, version, channel, API URL, authority fields, build
     time, file name, size, SHA-256, signing status.
4. Verify before distributing: `sha256sum -c Zugrio-Private-Alpha-*-cloud-rc.exe.sha256`
   (Windows: `certutil -hashfile <exe> SHA256`).

## Known limitations

- **Unsigned.** The executable has no code-signing certificate. Windows SmartScreen will
  warn; testers should verify the SHA-256 from the manifest.
- **Fixtures only.** No live market data. Four validation replay scenarios.
- **The cloud RC depends on deployment.** It needs the Oracle Cloud (London) origin healthy
  and the Cloudflare Tunnel route for `api.zugrio.xyz` active. Until then, only the local
  replay build is usable.
- **Single-VM backend.** No replica. Off-site (R2) backups are not yet enabled.
- **Open API.** The API is unauthenticated. Writes are idempotent per fixture evaluation.
- **No auto-update.** Each RC is a new portable executable.

## Explicitly not in this alpha

No broker connection or execution, no cTrader trading scope, no Semi-Auto / Auto /
Full Auto, no `FIRE`, no model-scored readiness, no performance claims, no capital
authority. **Gate 3 remains uncleared** (`CURRENT-GATE.md`); this release is not Gate
evidence.
