# GitHub Governance

## Ownership

Production code lives under the **Zugriohq** GitHub Organization rather than depending on the founder's personal repository ownership.

The primary private monorepo is `Zugriohq/Platform`.

## Branches

- `main`: protected and releasable.
- `feat/*`, `fix/*`, `gate/*`, `docs/*`, `chore/*`: working branches.
- tags/releases bind build identity and evidence.

While the founder is the only human engineer, require PRs and CI/status checks but do not create an impossible external-human approval rule. When a senior engineer joins, require CODEOWNER review for capital-critical directories.

## Required CI for production PRs

As the codebase is introduced, required checks should include:
- dependency/lockfile integrity;
- typecheck;
- lint/format validation;
- unit/integration tests;
- architecture/conformance tests;
- dependency/security checks;
- capital-path fixture/replay suites when touched;
- reproducibility checks where relevant.

## Agent access

AI agents use their own GitHub App/integration identity or scoped token, never the founder's personal credentials. Grant minimum necessary repository permissions.

Prefer OIDC/federated deployment credentials over long-lived cloud secrets.

## Pull-request metadata

Every material PR should state:
- linked issue;
- purpose;
- changed authority surface;
- test evidence;
- security impact;
- capital-path impact;
- migration/rollback;
- AI assistance used;
- unresolved uncertainty;
- whether an ADR is required.
