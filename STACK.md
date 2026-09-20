# Zugrio 1.0 Production Stack

Status: **working production direction**. Changes require an ADR when they alter a material architectural boundary.

## Primary language/runtime

- TypeScript in strict mode.
- Node.js current supported LTS.
- ES modules.
- `pnpm` workspaces in a monorepo.

## Applications

- Public and authenticated web: **Next.js + React + TypeScript**.
- Desktop: **Electron + React + TypeScript** for the first production shell.
- API/control plane: **NestJS + TypeScript**, with explicit modules and OpenAPI contracts.

Marketing pages should default to static/server rendering. Client React is used only where interaction requires it.

## Core packages

- `@zugrio/decision-core`: pure deterministic TypeScript. No UI, network, database or broker dependencies.
- `@zugrio/domain`: canonical types and invariants.
- `@zugrio/state-authority`: state/provenance contracts.
- `@zugrio/risk`: immutable risk contracts and sizing logic.
- `@zugrio/execution-contract`: broker-neutral intent/reconciliation types.
- `@zugrio/instrument-registry`: underlying/product/venue mappings.
- `@zugrio/market-data`: normalized market-data contracts.
- `@zugrio/broker-contract`: adapter interface.

## Broker/connectors

- cTrader through an adapter over cTrader Open API/OAuth.
- MT5 through an isolated MQL5 Connector EA plus Zugrio cloud adapter.
- Future brokers/exchanges implement the same broker adapter contract.

Market-data adapters remain separate from execution adapters.

## Data

- PostgreSQL as primary transactional database.
- Prisma initially for schema/migrations.
- Object storage for immutable artifacts, model files, large reports and evidence bundles.
- No Redis/message broker by default.

## Research/modeling

- Python isolated under `research/` for research, backtests, calibration and model development.
- Research code may not leak ad-hoc authority logic into production paths.

## Quality/security

- Vitest for TypeScript unit/integration tests.
- Playwright for web/E2E.
- fast-check for property/metamorphic tests.
- Testcontainers for PostgreSQL integration.
- Stryker selectively for capital-critical mutation testing.
- TypeScript strict checks plus lint/format enforcement.
- GitHub Actions CI.
- CodeQL/dependency/secret scanning where available.
- Structured JSON logging and OpenTelemetry-compatible tracing.

## Deployment

- Docker for reproducible services/local integration.
- Managed platform/container deployment initially.
- No Kubernetes until operational evidence requires it.
- Prefer GitHub Actions OIDC/federated deployment credentials over long-lived cloud secrets.
