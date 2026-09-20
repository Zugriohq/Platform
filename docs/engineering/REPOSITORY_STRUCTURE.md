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
│   ├── state-authority/
│   ├── risk/
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
