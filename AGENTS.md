# Agent Entry Point

All AI coding and review agents must first read:

1. `ENGINEERING_CHARTER.md`
2. `STACK.md`
3. current architecture specification and accepted ADRs
4. `CURRENT-GATE.md`
5. the assigned GitHub issue and acceptance criteria
6. relevant subdirectory instructions

Chat/session memory is supplementary only. Repository state is authoritative.

## Working rule

One issue = one bounded objective. One implementation owner at a time. A second agent reviews the diff rather than concurrently rewriting the same files.

Material learnings must end up in code, tests, ADRs, documentation or issue/PR history.
