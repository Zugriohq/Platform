# Zugrio Gate 3A — Corrected Closure Package

This package repairs the rejected Gate 3A authority inventory without changing production authority code.

- scanned artifact: `52dcdbcdfdddbaabe24e72a722623ebcd8e678fbdff8e6fa134247752783c178`
- authority inventory: `8f2db15840c2d2d3e5e6d7c1432797af9a49167815e93f5d71d04f5ba6655eae`
- ATR sweep: `a704fe2b6c1198da3e18524ce471e480a056de515b94e04cb4aa7b4d63fc3616`
- **1005 authority sink records** / 920 live
- **47 classified semantic fields**
- **39 verdict-write sinks**
- **53 ATR bindings** / **96 ATR consumer statements**
- inventory defects: **0**
- permissive ATR capital branches: **0**

Read `evidence/GATE3A-FROZEN-MAP.md` first, then inspect `tools/gate3-authority-inventory.js` and `test/gate3a.test.js`.

## Run

```bash
node tools/gate3-authority-inventory.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-atr-sweep.js artifacts/Zugrio-1.0.0-gate2.2.html
node tools/gate3-generate-report.js
node --test test/gate3a.test.js
```

The dependency vocabulary (`tools/gate3-dependency-vocabulary.json`) is frozen from the clean artifact with `node tools/gate3-authority-inventory.js artifacts/Zugrio-1.0.0-gate2.2.html --freeze-vocabulary`, which refuses to run while any defect exists. Re-freezing is a reviewed act: its diff is the list of authority inputs being accepted.

The authority baseline (`tools/gate3-authority-baseline.json`) is frozen the same way with `--freeze-baseline`, under the same refusal rule. `node tools/gate3-substitution-battery.js` attacks it with accepted-dependency substitutions, deletions, threshold changes and reroutes; each case proves its own class membership (the vocabulary alone must not flag it) before the baseline must catch it.

The package includes the cleared Gate 2.2 artifact and Gate 2.1 dirty artifact so the mutation/non-vacuity evidence is self-contained.
