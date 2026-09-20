# Zugrio Platform

Private production monorepo for **Zugrio 1.0**.

Zugrio is being rebuilt on a clean production foundation while preserving the tested lineage of the existing research/prototype system. The governing migration rule is:

> **Freeze → extract → equivalence-test → cut over → delete legacy path.**

This repository is intended to be understandable and operable by a competent engineer **without access to ChatGPT or Claude conversation history**. Repository state, tests, ADRs, specifications, evidence, issues and pull requests are institutional memory; AI chat history is not.

## Current phase

**Engineering Foundation bootstrap.**

Gate 3 has been reported complete by the implementing agent, but its independent review/clearance evidence has not yet been imported into this repository. No Gate 4 implementation or semantic migration is authorized by this bootstrap.

The immediate objectives are to establish:
- engineering charter and source-of-truth rules;
- AI/human collaboration protocol;
- production stack and repository boundaries;
- product-operating model;
- current Gate/status record;
- ADR/PRD conventions;
- GitHub issue/branch/PR workflow;
- lineage location for Gate 0–3 evidence;
- a controlled migration path for the current landing page into Next.js/React.

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

See the engineering documents in this repository before implementing changes.

## Repository rule

Do not silently change capital-authority semantics, frozen architecture, or validated Gate behavior while migrating technology. Architecture migration and decision-semantic change must be separately reviewable.

## Founder role

The founder operates as **Founder / Product Lead / Technical Product Owner**, owning product intent, prioritization, PRDs, acceptance criteria, release scope and material risk decisions while developing sufficient technical fluency to challenge and govern the system.

---

**Repository:** `Zugriohq/Platform`  
**Visibility:** private
