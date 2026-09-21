# Claude Code — Zugrio Repository Instructions

Read `ENGINEERING_CHARTER.md`, `STACK.md`, `docs/product/PRODUCT_DIRECTION.md`, `docs/product/ZUGRIO_1_0_PRD.md`, `docs/architecture/SYSTEM_ARCHITECTURE_V1.md`, accepted ADRs, the frozen Signal Authority specification, `CURRENT-GATE.md`, and the assigned GitHub issue before making changes.

## Non-negotiable workflow

- Work on a branch and pull request; never push directly to protected `main`.
- Before implementation, restate the authority surfaces affected and the acceptance tests.
- Reproduce defects with failing tests before fixing them where practical.
- Run relevant tests after each material change and the full required suite before requesting merge.
- Never bypass a failing safety/architecture test to obtain green CI.
- If a requested change conflicts with a frozen decision or ADR, stop and surface the conflict rather than silently changing semantics.
- Record durable learnings in tests, ADRs, docs or issue/PR notes. Do not rely on session memory.

## Architecture hygiene

- Keep Decision Core pure and framework-free.
- Keep broker specifics behind the Broker Adapter Contract.
- Keep market-data adapters separate from execution adapters.
- Keep research Python isolated from production authority.
- Do not introduce a Zugrio-owned per-user MT5 VPS architecture.
- Do not invent capital-authoritative thresholds to complete an implementation.
- Do not combine architecture migration with decision-semantic changes in one opaque patch.

## AI handoff

Assume another competent engineer and another AI agent must understand every change from the repository alone. PRs must include rationale, evidence, risk, rollback and unresolved uncertainty.
