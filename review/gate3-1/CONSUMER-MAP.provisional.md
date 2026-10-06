# Gate 3.1 — §14A consumer map (PROVISIONAL)

> **PROVISIONAL / NOT GOVERNING.** This is generated from the Gate 3A round-11 review candidate, which is not cleared. It asserts no classification: every row shows the scanner catalogue's provisional classification, and every §14C judgement is **PENDING** human sign-off. Regenerate it with `node tools/build-consumer-map.js`.

Source: artifact `52dcdbcdfddd…`, inventory `8f2db15840c2…` (round 11).

## Summary

- 47 semantic fields; 592 live consumer records.
- Provisional classification: LEGACY_REMOVE 31, HARD_STRUCTURAL_PREDICATE 9, ADVISORY_FEATURE 1, RAW_MODEL_FEATURE 5, RESEARCH_HEURISTIC 1.
- 9 candidate hard predicates need an HP-1/HP-2 decision. 22 fields have numeric thresholds in live consumers, which need HP-3 provenance.
- **Known gap:** Gate 3A inventories authority sinks only. §14A also requires trade-plan presentation and research-logging consumers; those are not yet in this map.

## What a reviewer decides per field

1. Is the provisional classification right under §14A/§14B? For example, is it truly a hard structural predicate, or does it move to the feature vector?
2. For a hard predicate: HP-1 (does failure mean invalidity independent of profitability?) and HP-2 (was the threshold set without outcome optimisation?).
3. HP-3: record each listed threshold's provenance. Do not invent it; an unknown provenance stays unknown, and per HP-6 the field moves downstream.

## Fields

| Field | Provisional class | Admission | Live consumers | Consumer categories | Thresholds | Sign-off |
|---|---|---|---:|---|---:|---|
| `BROKER_EXECUTION_ADMISSION` | LEGACY_REMOVE | NOT_APPLICABLE | 14 | broker or execution gate; fire and state progression; producer of the above | 0 | PENDING |
| `BROKER_ORDER_PAYLOAD` | LEGACY_REMOVE | NOT_APPLICABLE | 16 | broker or execution gate | 0 | PENDING |
| `BROKER_SUBMISSION` | LEGACY_REMOVE | NOT_APPLICABLE | 3 | broker or execution gate | 0 | PENDING |
| `CALIBRATION_PERMISSION` | LEGACY_REMOVE | NOT_APPLICABLE | 6 | broker or execution gate | 0 | PENDING |
| `CANONICAL_ATR_AVAILABLE` | HARD_STRUCTURAL_PREDICATE | ADMITTED | 33 | fire and state progression; producer of the above | 2 | PENDING |
| `CAUSAL_AGE` | LEGACY_REMOVE | NOT_APPLICABLE | 17 | fire and state progression; selection and watchlist ordering; producer of the above | 3 | PENDING |
| `DATA_ADVISORY_FEATURES` | ADVISORY_FEATURE | NOT_APPLICABLE | 0 | — | 0 | PENDING |
| `DATA_HEALTH_OK` | HARD_STRUCTURAL_PREDICATE | CANDIDATE_UNADMITTED | 27 | fire and state progression; broker or execution gate; producer of the above | 8 | PENDING |
| `DATA_HEALTH_REASONS` | LEGACY_REMOVE | NOT_APPLICABLE | 3 | fire and state progression | 0 | PENDING |
| `DUPLICATE_CONSUMED` | HARD_STRUCTURAL_PREDICATE | ADMITTED | 22 | selection and watchlist ordering; fire and state progression; broker or execution gate; producer of the above | 0 | PENDING |
| `ENTRY_EVENT_CONFIRMED` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 0 | — | 0 | PENDING |
| `ENTRY_EXTENSION` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 12 | entry grading and trade plan | 4 | PENDING |
| `EXECUTION_COOLDOWN` | LEGACY_REMOVE | NOT_APPLICABLE | 2 | fire and state progression; producer of the above | 0 | PENDING |
| `FAMILY_EXECUTION_PERMISSION` | LEGACY_REMOVE | NOT_APPLICABLE | 3 | fire and state progression; broker or execution gate | 0 | PENDING |
| `GEOMETRY_COMPLETE` | HARD_STRUCTURAL_PREDICATE | CANDIDATE_UNADMITTED | 4 | entry grading and trade plan | 2 | PENDING |
| `HTF_CONTEXT_QUALITY` | RAW_MODEL_FEATURE | CANDIDATE_UNADMITTED | 34 | fire and state progression; selection and watchlist ordering; opportunity score; broker or execution gate; producer of the above | 9 | PENDING |
| `LEGACY_EVAL_DIRECTION` | RAW_MODEL_FEATURE | NOT_APPLICABLE | 1 | producer of the above | 0 | PENDING |
| `LEGACY_EVAL_FAMILY_COUNTS` | RAW_MODEL_FEATURE | NOT_APPLICABLE | 0 | — | 0 | PENDING |
| `LEGACY_EVAL_PRIMARY_SETUP` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 4 | fire and state progression | 0 | PENDING |
| `LEGACY_EVAL_RISK_SCALE` | LEGACY_REMOVE | NOT_APPLICABLE | 1 | broker or execution gate | 0 | PENDING |
| `LEGACY_EVAL_SCORE` | RAW_MODEL_FEATURE | NOT_APPLICABLE | 6 | fire and state progression; producer of the above | 0 | PENDING |
| `LEGACY_EVAL_SPECIALIST` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 0 | — | 0 | PENDING |
| `LEGACY_EVAL_THESIS` | LEGACY_REMOVE | NOT_APPLICABLE | 0 | — | 0 | PENDING |
| `LEGACY_EXECUTION_PERMISSION_ASSERTION` | LEGACY_REMOVE | NOT_APPLICABLE | 2 | broker or execution gate | 0 | PENDING |
| `LIFECYCLE_RANK` | LEGACY_REMOVE | NOT_APPLICABLE | 3 | fire and state progression; selection and watchlist ordering | 0 | PENDING |
| `LIFECYCLE_STAGE` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 82 | fire and state progression; selection and watchlist ordering; broker or execution gate; producer of the above | 6 | PENDING |
| `MANUAL_RISK_REDUCTION` | LEGACY_REMOVE | NOT_APPLICABLE | 3 | broker or execution gate | 0 | PENDING |
| `MARKET_OPEN` | HARD_STRUCTURAL_PREDICATE | ADMITTED | 3 | fire and state progression; producer of the above | 1 | PENDING |
| `OPPORTUNITY_SCORE` | LEGACY_REMOVE | NOT_APPLICABLE | 17 | opportunity score; fire and state progression; producer of the above | 11 | PENDING |
| `OPPOSING_FIRE_CONFLICT` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 8 | fire and state progression; producer of the above | 2 | PENDING |
| `PLAN_BLOCKERS` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 11 | entry grading and trade plan; fire and state progression; producer of the above | 1 | PENDING |
| `PLAN_STATUS` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 2 | fire and state progression | 0 | PENDING |
| `POSITION_MANAGEMENT_GATE` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 8 | fire and state progression; broker or execution gate; producer of the above | 1 | PENDING |
| `PRICE_VALID` | HARD_STRUCTURAL_PREDICATE | ADMITTED | 19 | fire and state progression; entry grading and trade plan; producer of the above | 1 | PENDING |
| `PROFILE_SELECTION` | LEGACY_REMOVE | NOT_APPLICABLE | 27 | fire and state progression; selection and watchlist ordering; broker or execution gate; producer of the above | 1 | PENDING |
| `REGIME_QUALITY` | RAW_MODEL_FEATURE | CANDIDATE_UNADMITTED | 4 | fire and state progression; producer of the above | 0 | PENDING |
| `RESEARCH_CONTINUATION` | RESEARCH_HEURISTIC | NOT_APPLICABLE | 1 | producer of the above | 0 | PENDING |
| `REWARD_ECONOMIC_QUALITY` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 21 | entry grading and trade plan; producer of the above | 5 | PENDING |
| `RISK_REDUCING_DATA_BYPASS` | LEGACY_REMOVE | NOT_APPLICABLE | 1 | broker or execution gate | 0 | PENDING |
| `RISK_SCALE` | LEGACY_REMOVE | NOT_APPLICABLE | 18 | fire and state progression; broker or execution gate; producer of the above | 4 | PENDING |
| `SPECIALIST_GATE` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 32 | fire and state progression; broker or execution gate; producer of the above | 11 | PENDING |
| `STATE_RANK` | LEGACY_REMOVE | NOT_APPLICABLE | 20 | fire and state progression; selection and watchlist ordering; producer of the above | 3 | PENDING |
| `STOP_GEOMETRY` | HARD_STRUCTURAL_PREDICATE | CANDIDATE_UNADMITTED | 32 | entry grading and trade plan; broker or execution gate | 10 | PENDING |
| `TARGET_GEOMETRY` | HARD_STRUCTURAL_PREDICATE | CANDIDATE_UNADMITTED | 29 | entry grading and trade plan; selection and watchlist ordering; broker or execution gate | 2 | PENDING |
| `TICK_FRESHNESS` | HARD_STRUCTURAL_PREDICATE | CANDIDATE_UNADMITTED | 7 | fire and state progression; producer of the above | 4 | PENDING |
| `TRIGGER_FRESHNESS` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 34 | entry grading and trade plan; fire and state progression; opportunity score; selection and watchlist ordering; broker or execution gate; producer of the above | 10 | PENDING |
| `TRIGGER_QUALITY` | LEGACY_REMOVE | CANDIDATE_UNADMITTED | 0 | — | 0 | PENDING |

Each field's consumers, thresholds and destination are in `CONSUMER-MAP.provisional.json`.

