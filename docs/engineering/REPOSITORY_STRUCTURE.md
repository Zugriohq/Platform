# Repository Structure

Planned production monorepo:

```text
Platform/
├── apps/
│   ├── web/
│   ├── api/
│   └── desktop/
├── packages/
│   ├── decision-core/
│   ├── domain/
│   ├── candidate-contract/
│   ├── state-authority/
│   ├── market-intelligence/
│   ├── model-registry/
│   ├── strategy-contract/
│   ├── context-evidence/
│   ├── decision-ledger/
│   ├── risk/
│   ├── position-management/
│   ├── execution-contract/
│   ├── broker-contract/
│   ├── instrument-registry/
│   ├── market-data/
│   ├── schemas/
│   ├── ui/
│   └── shared/
├── connectors/
│   ├── ctrader/
│   └── mt5/
├── research/
├── db/
│   ├── schema/
│   └── migrations/
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── engineering/
│   ├── product/
│   ├── runbooks/
│   ├── threat-model/
│   └── diligence/
├── legacy/
│   └── gate-baselines/
├── test/
│   ├── fixtures/
│   ├── replay/
│   ├── integration/
│   └── e2e/
└── .github/
    ├── workflows/
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

`legacy/gate-baselines` is evidence, not active implementation. Cleared artifacts, hashes and fixture corpora live there when imported.

Do not create empty architecture for appearance. Directories should be introduced when they contain an adopted contract, implementation or evidence.


## Boundary intent

- `market-intelligence` owns specialist routing and admitted feature/inference orchestration, not capital execution.
- `model-registry` owns model applicability/admission metadata and artifact identities.
- `strategy-contract` owns versioned Method Profile and Entry Model contracts.
- `context-evidence` owns sourced macro/news/session/related-market facts and provenance.
- `decision-ledger` owns append-only Decision Case history and read projections.
- `candidate-contract` owns candidate/evidence boundary types.
- `position-management` remains distinct from initial entry construction and broker translation.

These are intended package boundaries. Do not create empty directories merely to satisfy the diagram.
