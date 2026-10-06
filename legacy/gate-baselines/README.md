# Gate Baselines

This directory preserves **cleared** historical Gate artifacts, hashes, manifests and fixture corpora required for lineage and behavioral-equivalence testing.

Rules:
- Do not treat a baseline as active production code.
- Do not overwrite cleared evidence in place.
- Import only artifacts whose identity/status has been independently reviewed.
- Superseded artifacts remain explicitly marked as superseded.
- A technology migration may consume baseline fixtures but may not reinterpret them to make a new implementation pass.

Gate 3 artifacts are not to be imported here until independent review confirms the clearance state and identity.

## Imported baselines

| Directory | Gate | Status |
|---|---|---|
| `gate3a/` | Gate 3A, authority-inventory evidence freeze | **Cleared**: independently confirmed 2026-10-06, scoped to the Gate 2.2 artifact `52dcdbcd…c178`. This does not mean Gate 3 as a whole is cleared. |
