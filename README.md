# Zugrio Platform

Private production monorepo for **Zugrio 1.0**.

Zugrio is moving onto a clean production foundation while preserving the tested lineage of the existing research/prototype system. The governing migration rule is:

> **Freeze → extract → equivalence-test → cut over → delete legacy path.**

This repository is intended to be understandable and operable by a competent engineer **without access to ChatGPT or Claude conversation history**. Repository state, tests, ADRs, specifications, evidence, issues and pull requests are institutional memory; AI chat history is not.

## Current phase

**Engineering Foundation checkpoint.**

Gate 3 has been reported complete by the implementing agent, but its independent review/clearance evidence has not yet been imported into this repository. Gate 4 is not authorized by this bootstrap.

Read these first:

1. [Engineering Charter](ENGINEERING_CHARTER.md)
2. [Production Stack](STACK.md)
3. [Current Gate Status](CURRENT-GATE.md)
4. [Product Direction](docs/product/PRODUCT_DIRECTION.md)
5. [Agent Instructions](AGENTS.md)
6. [Claude Instructions](CLAUDE.md)
7. [Repository Structure](docs/engineering/REPOSITORY_STRUCTURE.md)
8. [AI Collaboration Contract](docs/engineering/AI_COLLABORATION.md)
9. [GitHub Governance](docs/engineering/GITHUB_GOVERNANCE.md)

## Product scope

Zugrio 1.0 carries **forex, gold and synthetic indices in parallel**, while forex leads the public launch narrative. Entry logic is extensible and strategy-aware rather than limited to a short fixed list of entry patterns. Context includes properly sourced macroeconomic events, news, session state and related evidence. See [Product Direction](docs/product/PRODUCT_DIRECTION.md).

## Working production direction

- TypeScript-first production code.
- Next.js + React for public and authenticated web surfaces.
- Node.js + NestJS for the API/control plane.
- PostgreSQL as the primary transactional datastore.
- Electron + React for the initial desktop shell.
- Pure framework-free `@zugrio/decision-core`.
- Python isolated to research/modeling.
- cTrader and MT5 behind broker-neutral adapter contracts.
- No Kubernetes/Kafka/microservice complexity without measured need.

The current Work-produced landing page is preserved as a **migration-equivalence baseline**, not an approved permanent brand identity; see [Landing Page Migration](docs/engineering/LANDING_PAGE_MIGRATION.md).

## Repository rule

Do not silently change capital-authority semantics, frozen architecture, or validated Gate behavior while migrating technology. Architecture migration and decision-semantic change must be separately reviewable.

## Product operating model

The founder operates as **Founder / Product Lead / Technical Product Owner**, owning product intent, prioritization, PRDs, acceptance criteria, release scope and material risk decisions while developing sufficient technical fluency to challenge and govern the system.

See [Founder / Product Operating Model](docs/product/OPERATING_MODEL.md) and the [PRD template](docs/product/PRD-TEMPLATE.md).

## Public-build policy

Public content may support distribution, recruiting and customer discovery, but it must not expose sensitive implementation details or make unsupported trading-performance claims.

See [Public Build Policy](docs/product/PUBLIC_BUILD_POLICY.md).

## Evidence and diligence

Cleared Gate evidence belongs under [legacy/gate-baselines](legacy/gate-baselines/README.md). Technical-diligence material belongs under [docs/diligence](docs/diligence/README.md).

---

**Repository:** `Zugriohq/Platform`  
**Visibility:** private
