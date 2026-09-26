# Agent Entry Point

All AI coding and review agents must first read:

1. `ENGINEERING_CHARTER.md`
2. `STACK.md`
3. `docs/product/PRODUCT_DIRECTION.md`
4. `docs/product/ZUGRIO_1_0_PRD.md`
5. `docs/architecture/SYSTEM_ARCHITECTURE_V1.md`
6. current frozen authority specification and accepted ADRs
7. `CURRENT-GATE.md`
8. the assigned GitHub issue and acceptance criteria
9. relevant subdirectory instructions

Chat/session memory is supplementary only. Repository state is authoritative.

## Working rule

One issue = one bounded objective. One implementation owner at a time. A second agent reviews the diff rather than concurrently rewriting the same files.

Material learnings must end up in code, tests, ADRs, documentation or issue/PR history.
