# Cloudflare Pages preview check on product PRs

Status: **diagnosed from repository evidence; the remediation requires Cloudflare dashboard
access.** Recorded 2026-09-26 for issue #71.

## Symptom

The external **Cloudflare Pages** check (Pages project `zugrio`, the `zugrio.xyz` landing
and waitlist) fails immediately on product PRs (#67, #70) that never touch the landing site.
It passes on landing PRs (e.g. #58) and docs-only PRs (e.g. #63, #65).

## Evidence

- The Pages project builds **every pushed branch** as a preview, per its Git integration.
  Nothing in this repository configures it: there is no `wrangler.toml` with
  `pages_build_output_dir` and no Pages workflow.
- Documented build settings (`prototypes/landing-v3-react/CLOUDFLARE_WAITLIST_SETUP.md`):
  root `prototypes/landing-v3-react`, command `npm run build`, output `dist`.
- Every failing branch contains the pnpm monorepo root added by the alpha work
  (`package.json` with `"packageManager": "pnpm@9.15.4"`, `pnpm-workspace.yaml`,
  `pnpm-lock.yaml`). Every passing branch (landing, docs, `main`) has **no** root
  `package.json`.
- Most likely cause: Pages' build image detects the workspace/package manager above the
  project root and fails at dependency install. This is **not verified**: the build log is
  only visible in the dashboard (the check's *Details* link).

## Remediation (dashboard, no production impact)

Workers & Pages → **zugrio** → Settings → **Builds** (Builds & deployments):

1. **First, read the failing build log** from the *Details* link on the PR check and record
   the error here. If it is not a dependency-install/package-manager error, stop and
   re-evaluate before changing settings.
2. **Branch deployment controls → Preview branches → Custom branches.**
   - Include: `*`
   - Exclude: `release/*`, `cloud/*`, `claude/*`, `codex/*`
   
   Production-branch deployments are unaffected. Excluded branches create no preview
   deployment and no check run.
3. **Build watch paths** (optional; also skips unrelated commits on landing branches):
   - Include: `prototypes/landing-v3-react/*`, `config/capability-scope-manifest.v1.json`.
     The landing prebuild reads that manifest (`scripts/sync-readiness.mjs`).
   - Exclude: none.
   
   Apply this only after confirming the production branch's latest deployment is
   current, because production builds are also skipped for commits outside these paths.

Do **not** change the production branch, root directory, build command, output directory,
Functions, D1 bindings or environment variables. Do **not** disable the project.

## Verification

- Push any commit to a `release/*` or `cloud/*` branch → no *Cloudflare Pages* check appears.
- Push a commit touching `prototypes/landing-v3-react/` on a landing branch → a preview
  build still runs and passes.
- `https://zugrio.xyz` and the waitlist behave as before (no production deployment is
  triggered by these setting changes).

## Rollback

Set Preview branches back to *All non-production branches* and clear Build watch paths.
