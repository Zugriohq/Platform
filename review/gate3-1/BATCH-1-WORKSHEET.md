# Gate 3.1 — review batch 1 (PROVISIONAL)

> **PROVISIONAL / NOT GOVERNING.** This is evidence for §14A classification and the §14C hard-predicate tests. **It records no decision, proposes no classification and asserts no threshold provenance.** Each decision is left blank for the reviewer. Source comments are *clues* toward provenance, to be confirmed against a document, not provenance in themselves. Regenerate with `node tools/build-batch1.js`.

## Scope

23 fields: 9 candidate hard predicates and 22 fields with numeric thresholds in live consumers (the two sets overlap).

They carry 101 threshold sites and 258 literals:
- 17 sites sit in a P/L-, R:R- or score-shaped expression, which is an HP-2 risk;
- 26 sites have a source comment or table status nearby;
- 7 sites are numerical tolerances such as `1e-12`, which are probably not thresholds and are left for the reviewer to confirm.

## The questions per field

1. **Classification (§14A):** HARD_STRUCTURAL_PREDICATE, RAW_MODEL_FEATURE, RESEARCH_HEURISTIC or LEGACY_REMOVE. §14B "pWin and EV are the only continuous quantities permitted to gate state. … Ambiguity resolves toward the feature vector, never toward state authority."
2. **Hard predicates only:** §14C HP-1 "Its failure must mean structural invalidity, data invalidity, execution infeasibility or safety violation independently of profitability." §14C HP-2 "Its threshold must not have been chosen by optimizing outcomes. If historical P/L, win rate or expectancy set the value, it belongs downstream."
3. **Every threshold:** §14C HP-3 "Every predicate records threshold provenance in predicateClassifications." An unknown provenance stays unknown. §14C HP-6 "Failing HP-1 or HP-2 moves the field downstream. No partial credit."

Clauses that apply across the batch: §14C HP-4 "Presumed to pass: DATA_HEALTH_OK, GEOMETRY_COMPLETE." §14C HP-5 "Presumed model features until proven otherwise: REGIME_QUALITY_OK, HTF_GRADE_NOT_C, REWARD_GRADE_NOT_C, TRIGGER_GRADE_NOT_C." §13 ATR: "W is accepted only against … a decision-flip sensitivity test at every ATR-denominated threshold (1.10 range, 0.08 penetration, 0.80 extension, 0.15 stop buffer, 0.35 minimum stop)." Below W "every ATR-denominated decision fails closed." Preamble: "[UNSET] marks values that must still be measured and validated before capital authority."

## `CANONICAL_ATR_AVAILABLE`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Canonical Gate-2 ATR availability check.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / ADMITTED. **Catalogue threshold source:** W=200 canonical-history requirement frozen by Gate 2; failure is data insufficiency independent of profitability.
- **Intended destination:** Layer-1 data-validity predicate/reason code.
- **Live consumers:** 33, in these categories: fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `familyGate` | 3 | `recent[i].h-recent[i].l>Math.max(refAtr,av)*3` | ATR_DENOMINATED | — |
| `familyGate` | 3 | `recent.length<3\|\|!ZUGRIO_ATR_OK(av)` | ATR_DENOMINATED | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `CAUSAL_AGE`

*In batch because: thresholds in live consumers.*

- **Meaning:** knownAt/triggerAt recency currently used in selection.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / NOT_APPLICABLE. **Catalogue threshold source:** Deterministic tie-break semantics.
- **Intended destination:** Candidate Selection Policy final tie-break only after conviction/setup priority.
- **Live consumers:** 17, in these categories: fire and state progression; selection and watchlist ordering; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `familyGate` | 86400, 86400000 | `Math.floor(candidate.knownAt/86400)!==Math.floor(input.now/86400000)` | TIME_WINDOW | — |
| `mkStr` | 1e-10, 1e-10, 1e-10 | `{id:[k\|\|'GEN',timeframe,'SELL',type,knownAt,activeL.v].join('\|'),dir:'SELL',type,i,barOpenAt:+cur.t,knownAt…` | TIME_WINDOW; NUMERIC_EPSILON (tolerance, likely not a threshold) | [GATE-2.1] no break without canonical pre-break ATR |
| `mkStr` | 1e-10, 1e-10, 1e-10 | `{id:[k\|\|'GEN',timeframe,'BUY',type,knownAt,activeH.v].join('\|'),dir:'BUY',type,i,barOpenAt:+cur.t,knownAt,l…` | TIME_WINDOW; NUMERIC_EPSILON (tolerance, likely not a threshold) | [GATE-2.1] no break without canonical pre-break ATR |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `DATA_HEALTH_OK`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Composite feed/data-health verdict used by the live profile engine.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Current feedGate contains minimum-bar, age, continuity, ATR-availability and tick-recency thresholds. Those constituent thresholds must be recorded individually before §14C admission.
- **Intended destination:** Decompose into named Layer-1 data-validity predicates. Until constituent provenance is complete, DATA_HEALTH_OK is not admitted as 2B authority.
- **Live consumers:** 27, in these categories: fire and state progression; broker or execution gate; producer of the above
- **Specification:** §14C HP-4 "Presumed to pass: DATA_HEALTH_OK, GEOMETRY_COMPLETE."

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `feedGate` | 1000 | `now/1000-a.at(-1).t-g` | TIME_WINDOW | [GATE-2.2 G22-02] A frame is not AVAILABLE for ATR-dependent context until canonical ATR exists. |
| `feedGate` | 1.5 | `a[i].t-a[i-1].t<=g*1.5` | — | Only the active decision window is gating. An old repaired gap must not |
| `feedGate` | 24 | `a.length<24` | — | [GATE-2.2 G22-02] A frame is not AVAILABLE for ATR-dependent context until canonical ATR exists. |
| `feedGate` | 8 | `profile.id==='SWING'&&(map.W1\|\|[]).length<8` | — | [GATE-2.2 G22-03] Every frame whose directional/context semantics consume ATR must prove canonical ATR availability. |
| `feedGate` | 1000, 604800 | `profile.id==='SWING'&&map.W1?.length&&now/1000-map.W1.at(-1).end>604800` | TIME_WINDOW | [GATE-2.2 G22-03] Every frame whose directional/context semantics consume ATR must prove canonical ATR availability. |
| `feedGate` | 1.5, 120 | `age>Math.max(g*1.5,120)` | TIME_WINDOW | [GATE-2.2 G22-02] A frame is not AVAILABLE for ATR-dependent context until canonical ATR exists. |
| `recomputeFull` | 20 | `cls.length<20` | — | FULL PATH — runs once per CLOSED candle. All stateful feature updates live here. |
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `DUPLICATE_CONSUMED`

*In batch because: candidate hard predicate.*

- **Meaning:** Candidate/event has already been consumed/recorded.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / ADMITTED. **Catalogue threshold source:** Identity/idempotency safety condition; no outcome optimization.
- **Intended destination:** Identity/dedup safety predicate; final broker idempotency belongs Gate 4/Boundary.
- **Live consumers:** 22, in these categories: selection and watchlist ordering; fire and state progression; broker or execution gate; producer of the above

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______

## `ENTRY_EXTENSION`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current entry-extension thresholds relative to ATR/reference.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** 0.35 ATR and continuation-extension limits are reference policy values requiring provenance/validation.
- **Intended destination:** Dynamic execution/State Policy feature or Gate-4 veto as appropriate; not silently structural.
- **Live consumers:** 12, in these categories: entry grading and trade plan

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `plan` | 3, 3 | `dir==='BUY'?ext-Math.max(tick*3,av*bufferATR):ext+Math.max(tick*3,av*bufferATR)` | ATR_DENOMINATED | — |
| `plan` | 5, 0.2 | `risk<Math.max(tick*5,av*0.2)` | ATR_DENOMINATED | — |
| `plan` | 0.35 | `trigger&&Math.abs(entry-trigger.c)>av*0.35` | ATR_DENOMINATED; NAMED_IN_§13 | — |
| `plan` | 3 | `risk>av*3` | ATR_DENOMINATED | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `GEOMETRY_COMPLETE`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Proposed completeness/coherence predicate for frozen trade geometry.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Structural completeness concept is non-P/L, but the current plan object also mixes economics. Exact constituent definition still requires separation/provenance.
- **Intended destination:** Layer-1 named predicate only after structural-only definition is extracted from planner economics.
- **Live consumers:** 4, in these categories: entry grading and trade plan
- **Specification:** §14C HP-4 "Presumed to pass: DATA_HEALTH_OK, GEOMETRY_COMPLETE."

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `planTradeLevels` | 2.25 | `(TTI_GEOMETRY.maxStopATR&&TTI_GEOMETRY.maxStopATR[setupType])??2.25` | ATR_DENOMINATED | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |
| `planTradeLevels` | 0.20 | `(TTI_GEOMETRY.stopBufferATR&&TTI_GEOMETRY.stopBufferATR[setupType])??0.20` | ATR_DENOMINATED | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `HTF_CONTEXT_QUALITY`

*In batch because: thresholds in live consumers.*

- **Meaning:** Directional context quality: same/opposing votes and derived context.ok.
- **Provisional (scanner catalogue):** RAW_MODEL_FEATURE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Current same>=1 && opposing<2 rule has no recorded non-P/L derivation.
- **Intended destination:** Capital feature(s), not direct 2B gate. This is the semantic successor of HTF_GRADE_NOT_C unless later proven structural under §14C.
- **Live consumers:** 34, in these categories: fire and state progression; selection and watchlist ordering; opportunity score; broker or execution gate; producer of the above
- **Specification:** §14C HP-5 "Presumed model features until proven otherwise: REGIME_QUALITY_OK, HTF_GRADE_NOT_C, REWARD_GRADE_NOT_C, TRIGGER_GRADE_NOT_C."

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2 | `{votes,frames:profile.context,same,opposing:opp,ok:same>=1&&opp<2}` | — | — |
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `analyze` | 2 | `votes,frames:profile.context,same,opposing:opp,ok:same>=1&&opp<2` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `computeXTF` | 2 | `r.htfAvailable&&local!==0&&same>=1&&against<2&&!r.htfConflict` | — | A professional hierarchy does not demand that every timeframe prints the |
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `LIFECYCLE_STAGE`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current BREAK_CONFIRMED/RETEST_TOUCHED/RETEST_HELD/TRIGGERED lifecycle stage and its thresholds.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Stage transitions include 5-bar expiry and continuation/rejection thresholds that require provenance review.
- **Intended destination:** Replace with frozen Layer-1 lifecycle ending in LIFECYCLE_CONFIRMED; Layer 1 no longer emits TRIGGERED.
- **Live consumers:** 82, in these categories: fire and state progression; selection and watchlist ordering; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `analyze` | 4, 3 | `c=>c.stage==='TRIGGERED'&&c.triggerFresh?4:['RETEST_TOUCHED','RETEST_HELD'].includes(c.stage)?3:c.stage==='BRE…` | — | — |
| `buildStructureCandidates` | 3 | `all.filter(c=>![STRUCTURE_STAGE.INVALID,STRUCTURE_STAGE.EXPIRED].includes(c.stage)&&!(c.stage===STRUCTURE_STAG…` | — | STRUCTURE_STAGE — comment: Persistent setup lifecycle. Touch, hold and confirmation are separate causal events, so a normal two-candle break/retest/continuation |
| `lifecycle` | 0.65, 0.45 | `held&&directional&&location>=0.65&&(i===ti?Math.abs(b.c-b.o)/range>=0.45:(seed.dir==='BUY'?b.c>touch.h:b.c<tou…` | — | — |
| `lifecycle` | 5 | `i-ti>5` | — | — |
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `MARKET_OPEN`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Venue/session is open for the relevant market.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / ADMITTED. **Catalogue threshold source:** Market schedule/execution feasibility, independent of profitability.
- **Intended destination:** Execution-feasibility predicate/reason code; venue-specific adapter ultimately owns authoritative schedule.
- **Live consumers:** 3, in these categories: fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `scheduledFxClosure` | 1000 | `Object.fromEntries(nyClock.formatToParts(new Date(t*1000)).map(p=>[p.type,p.value]))` | — | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `OPPORTUNITY_SCORE`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current continuous score used by live/legacy presentation and some legacy/data-acquisition logic.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / NOT_APPLICABLE. **Catalogue threshold source:** Engineering weights/thresholds; not calibrated pWin/EV.
- **Intended destination:** Remove as authority. Selection uses conviction state→pWin→EV→setup priority→causal age; presentation may show non-authoritative diagnostics.
- **Live consumers:** 17, in these categories: opportunity score; fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `scoreAS` | 1.0, 1.5 | `Math.min(1.0,ai.score*1.5)` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |
| `scoreLQ` | 1.0, 0.07, 0.07, 0.08 | `Math.min(1.0,srS+fvgS+obS+swS+Math.max(pdhS,pdlS)+rnS*0.07+eqS+induce.score*0.07+chain.score*0.08)` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |
| `scoreLQ` | 0.20 | `sr.score*0.20` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |
| `scoreLQ` | 0.15 | `sweep.score*0.15` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |
| `scorePS` | 0.28, 0.5, 0.18 | `ms.bos?0.28*(1+Math.min(ms.bosConf,1)*0.5):ms.score*0.18` | PNL_OR_SCORE_SHAPED (HP-2 risk); TIME_WINDOW | — |
| `scorePS` | 0.10 | `fibV?fibV.score*0.10:0` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `OPPOSING_FIRE_CONFLICT`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current opposing-FIRE demotion based partly on context.same.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Legacy conflict policy.
- **Intended destination:** Execution exposure/conflict policy; candidate states remain individually preserved.
- **Live consumers:** 8, in these categories: fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 12 | `evaluated.slice(1,12).map(r=>({id:r.candidate.id,type:r.candidate.type,side:r.side,state:r.state,blockers:r.bl…` | — | — |
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `PLAN_BLOCKERS`

*In batch because: thresholds in live consumers.*

- **Meaning:** reasonTree.blockers/reasons array from current plan.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Mixed structural/economic thresholds.
- **Intended destination:** Split into named Layer-1 structural reason codes and Gate-4 economic veto reasons.
- **Live consumers:** 11, in these categories: entry grading and trade plan; fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `POSITION_MANAGEMENT_GATE`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current automated opposite-structure exit gate over managed positions.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Mixed lifecycle/context/specialist/freshness conditions.
- **Intended destination:** Versioned Position Management Policy plus emergency risk-reduction kernel; classify actual effect as RISK_REDUCING/RISK_INCREASING.
- **Live consumers:** 8, in these categories: fire and state progression; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `PRICE_VALID`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Executable analysis price must be finite and positive.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / ADMITTED. **Catalogue threshold source:** Numeric/domain validity only; no outcome optimization.
- **Intended destination:** Layer-1 data-validity predicate. Implementation note: the admitted predicate's live authority consumer is the inline finite/positive price check in analyze(). The separately named `priceValid` write in finalizeOutcome() is dispositioned LOGGING_OUTCOME_ONLY and is not this predicate's implementation; do not read the logging write as the predicate, and do not promote it to authority.
- **Live consumers:** 19, in these categories: fire and state progression; entry grading and trade plan; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `PROFILE_SELECTION`

*In batch because: thresholds in live consumers.*

- **Meaning:** Which user-selected/managed profile lanes are eligible to enter the live lane pool.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / NOT_APPLICABLE. **Catalogue threshold source:** User/product configuration, not signal quality.
- **Intended destination:** Candidate Selection Policy input/configuration. It may define lane scope but must not impersonate conviction.
- **Live consumers:** 27, in these categories: fire and state progression; selection and watchlist ordering; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `REWARD_ECONOMIC_QUALITY`

*In batch because: thresholds in live consumers.*

- **Meaning:** Gross R, net R, cost R and profile economics currently mixed into plan validity/state.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** minGrossR/minNetR/maxCostR are profile economic policy values, not structural validity.
- **Intended destination:** Remove from Layer-1/state eligibility. Economics move to ExecutionSnapshot + Gate-4 veto/policy; any model use is feature-only.
- **Live consumers:** 21, in these categories: entry grading and trade plan; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `computeTargets` | 1.0 | `(typeof TTI_GEOMETRY!=='undefined'&&TTI_GEOMETRY.readyMinTP1R)\|\|1.0` | PNL_OR_SCORE_SHAPED (HP-2 risk) | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |
| `computeTargets` | 1e-12 | `t1RR!=null&&t1RR>=readyMinTP1R-1e-12` | PNL_OR_SCORE_SHAPED (HP-2 risk); NUMERIC_EPSILON (tolerance, likely not a threshold) | — |
| `plan` | 1e-10 | `netR+1e-10<profile.minNetR` | PNL_OR_SCORE_SHAPED (HP-2 risk); NUMERIC_EPSILON (tolerance, likely not a threshold) | Round-trip allowance: spread + provisional slippage; fees remain unknown. |
| `plan` | 1e-10 | `grossR+1e-10<profile.minGrossR` | PNL_OR_SCORE_SHAPED (HP-2 risk); NUMERIC_EPSILON (tolerance, likely not a threshold) | Round-trip allowance: spread + provisional slippage; fees remain unknown. |
| `planTradeLevels` | 1.0, 1e-12 | `rr1>=(TTI_GEOMETRY.readyMinTP1R\|\|1.0)-1e-12` | PNL_OR_SCORE_SHAPED (HP-2 risk) | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `RISK_SCALE`

*In batch because: thresholds in live consumers.*

- **Meaning:** Profile/specialist risk scaling currently produced before canonical sizing.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / NOT_APPLICABLE. **Catalogue threshold source:** Sizing policy values; not Layer-1 validity.
- **Intended destination:** Gate-4 Risk/Sizing Policy only. No Layer-1 or conviction authority.
- **Live consumers:** 18, in these categories: fire and state progression; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `makeIntent` | .0025 | `(Number(state.status?.policy?.riskPerTradePct)\|\|.0025)*Math.min(1,riskScale)` | RISK_OR_SIZING | — |
| `makeIntent` | .0025 | `(Number(state.status?.policy?.riskPerTradePct)\|\|.0025)*Math.min(1,riskScale)` | RISK_OR_SIZING | — |
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `SPECIALIST_GATE`

*In batch because: thresholds in live consumers.*

- **Meaning:** Composite market-family specialist reasons/alignment/bias gate.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Mix of safety/data conditions and heuristic directional filters.
- **Intended destination:** Decompose per market family: safety/data predicates may pass §14C; heuristic terms become capital/advisory features.
- **Live consumers:** 32, in these categories: fire and state progression; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `familyGate` | .45, .3 | `tail ? .45 : .3` | — | — |
| `familyGate` | 8, 8, 8 | `a.length>=8&&(candidate.dir==='BUY'?a.at(-1).c>=a.at(-8).c:a.at(-1).c<=a.at(-8).c)` | — | — |
| `familyGate` | .5, .35 | `tail ? .5 : .35` | — | — |
| `familyGate` | 86400, 86400000 | `Math.floor(candidate.knownAt/86400)!==Math.floor(input.now/86400000)` | TIME_WINDOW | — |
| `familyGate` | 3 | `recent[i].h-recent[i].l>Math.max(refAtr,av)*3` | ATR_DENOMINATED | — |
| `familyGate` | 8, 8, 8 | `['M5','M15'].every(tf=>{const a=map[profile.id==='SWING'?(tf==='M5'?'H1':'H4'):tf]\|\|[];return a.length>=8&&(…` | — | — |
| `retestTolerance` | 0.28, 0.16, 0.22 | `tail?0.28:oneSec?0.16:0.22` | — | Persistent setup lifecycle. Touch, hold and confirmation are separate causal |
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |
| `updateGARCH` | 8 | `shock&&m>0?Math.sign(r)*8*m:r` | — | Winsorise an identified discontinuity in the diffusion variance state; |
| `updateSignalState` | 0.5 | `{modelId:family.modelId,thesisId:best.candidate?.id,direction:best.side,score:best.score,specialistQualified:b…` | PNL_OR_SCORE_SHAPED (HP-2 risk) | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `STATE_RANK`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current state-based ranking of lanes/candidates.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / NOT_APPLICABLE. **Catalogue threshold source:** Deterministic ranking policy.
- **Intended destination:** Candidate Selection Policy with version/hash; current ranking replaced by frozen §6.6 ordering.
- **Live consumers:** 20, in these categories: fire and state progression; selection and watchlist ordering; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `analyze` | 12 | `evaluated.slice(1,12).map(r=>({id:r.candidate.id,type:r.candidate.type,side:r.side,state:r.state,blockers:r.bl…` | — | — |
| `updateSignalState` | 15000 | `=='FIRE'){ if(now-(s.lastTickExchangeTime\|\|0)>15000){lane.state='WATCH'` | TIME_WINDOW | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `STOP_GEOMETRY`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Stop side/distance/volatility-floor/width checks.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Some checks are structural; ATR multipliers/limits require provenance separation from optimized policy.
- **Intended destination:** Structural stop-side/completeness may become Layer-1 predicates; economic width limits belong later unless independently safety-derived.
- **Live consumers:** 32, in these categories: entry grading and trade plan; broker or execution gate

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `computeTargets` | 1e-10 | `v=>v==null?null:Math.abs(v-entryIdeal)/Math.max(stopDist,1e-10)` | NUMERIC_EPSILON (tolerance, likely not a threshold) | — |
| `computeTargets` | 0.05, 1e-9, 1e-10 | `Math.max(stopDist*0.05,Math.abs(entryIdeal)*1e-9,1e-10)` | — | — |
| `plan` | 3, 3 | `dir==='BUY'?ext-Math.max(tick*3,av*bufferATR):ext+Math.max(tick*3,av*bufferATR)` | ATR_DENOMINATED | — |
| `plan` | 6 | `risk>0?(Math.max(0,spread)+tick*6)/risk:Infinity` | — | Round-trip allowance: spread + provisional slippage; fees remain unknown. |
| `plan` | 0.15 | `TTI_FOUNDATION_REFERENCE.stops.profileBufferATR\|\|0.15` | ATR_DENOMINATED; NAMED_IN_§13 | TTI_FOUNDATION_REFERENCE declares status 'RESEARCH_REFERENCE_NOT_CALIBRATED' — comment: capital authority requires a matching independently verified calibration |
| `plan` | 5, 0.2 | `risk<Math.max(tick*5,av*0.2)` | ATR_DENOMINATED | — |
| `plan` | 3 | `risk>av*3` | ATR_DENOMINATED | — |
| `planTradeLevels` | 2.25 | `(TTI_GEOMETRY.maxStopATR&&TTI_GEOMETRY.maxStopATR[setupType])??2.25` | ATR_DENOMINATED | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |
| `planTradeLevels` | 0.20 | `(TTI_GEOMETRY.stopBufferATR&&TTI_GEOMETRY.stopBufferATR[setupType])??0.20` | ATR_DENOMINATED | TTI_GEOMETRY — comment: contract operating on the shared market-state/event snapshot. |
| `planTradeLevels` | 1e-12 | `isFinite(stopATR)&&stopATR<=maxStopATR+1e-12` | ATR_DENOMINATED; NUMERIC_EPSILON (tolerance, likely not a threshold) | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `TARGET_GEOMETRY`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Existence/ordering of a credible target.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Structural target existence is non-P/L; target-selection policy is separately versioned.
- **Intended destination:** Layer-1 geometry completeness only after separation from minimum-R economics.
- **Live consumers:** 29, in these categories: entry grading and trade plan; selection and watchlist ordering; broker or execution gate

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `plan` | 2 | `a.length<2` | — | A crossed level ceases to be a pristine opposing obstacle. Keep only |
| `plan` | 0.35 | `trigger&&Math.abs(entry-trigger.c)>av*0.35` | ATR_DENOMINATED; NAMED_IN_§13 | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `TICK_FRESHNESS`

*In batch because: candidate hard predicate, thresholds in live consumers.*

- **Meaning:** Execution-tick recency checks.
- **Provisional (scanner catalogue):** HARD_STRUCTURAL_PREDICATE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** 15s and clock-skew values are execution/data-safety thresholds requiring recorded provenance.
- **Intended destination:** Named data/execution-safety predicate; Gate-4 final price freshness uses pinned snapshots.
- **Live consumers:** 7, in these categories: fire and state progression; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `checkSig` | 15000, 1000, 120, 1.5 | `now-(s.lastTickExchangeTime\|\|0)>15000\|\|now/1000-c.triggerAt>Math.min(120,TTI_PROFILE_ENGINE.SECONDS[lane.e…` | TIME_WINDOW | — |
| `feedGate` | 15000, 2000 | `!Number.isFinite(tickAt)\|\|now-tickAt>15000\|\|tickAt>now+2000` | TIME_WINDOW | veto all future setups. Weekend closure is accepted; weekday gaps are not. |
| `updateSignalState` | 15000 | `now-(s.lastTickExchangeTime\|\|0)>15000` | TIME_WINDOW | — |
| `updateSignalState` | 15000 | `=='FIRE'){ if(now-(s.lastTickExchangeTime\|\|0)>15000){lane.state='WATCH'` | TIME_WINDOW | — |

**Decision (reviewer):**
- Classification: ______
- HP-1 (failure means invalidity independent of profitability): yes / no — why: ______
- HP-2 (threshold not set by outcome optimisation): yes / no / unknown — why: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

## `TRIGGER_FRESHNESS`

*In batch because: thresholds in live consumers.*

- **Meaning:** Current triggerFresh/triggerAt recency gates.
- **Provisional (scanner catalogue):** LEGACY_REMOVE / CANDIDATE_UNADMITTED. **Catalogue threshold source:** Current max 120s / 1.5× execution timeframe rule has no recorded §14C provenance.
- **Intended destination:** Re-express as named freshness predicate only after provenance; FIRE freshness ultimately belongs to State Policy.
- **Live consumers:** 34, in these categories: entry grading and trade plan; fire and state progression; opportunity score; selection and watchlist ordering; broker or execution gate; producer of the above

| Owner | Literals | Expression | Flags | Source comment (clue only) |
|---|---|---|---|---|
| `analyze` | 2, 0.95, 0.4, 0.1, 0.15, 0.1, 1000, 120, 1.5 | `candidates.map(candidate=>{const result={...base,blockers:[]}; result.candidate=candidate;result.side=candidat…` | — | — |
| `analyze` | 4, 3 | `c=>c.stage==='TRIGGERED'&&c.triggerFresh?4:['RETEST_TOUCHED','RETEST_HELD'].includes(c.stage)?3:c.stage==='BRE…` | — | — |
| `analyze` | 1000, 120, 1.5 | `candidate.triggerFresh&&now/1000-candidate.triggerAt<=Math.min(120,SECONDS[execTf]*1.5)` | TIME_WINDOW | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `analyze` | 0.95, 0.4, 0.1, 0.15, 0.1 | `Math.min(0.95,0.4+same*0.1+(candidate.touchAt?0.15:0)+(candidate.triggerFresh?0.1:0))` | — | — |
| `checkSig` | 1000 | `c.triggerAt*1000` | TIME_WINDOW | Signal journal and broker portfolio are separate. A rejected paper event |
| `checkSig` | 15000, 1000, 120, 1.5 | `now-(s.lastTickExchangeTime\|\|0)>15000\|\|now/1000-c.triggerAt>Math.min(120,TTI_PROFILE_ENGINE.SECONDS[lane.e…` | TIME_WINDOW | — |
| `routeConfirmedReversal` | 1000, 120000 | `!candidate\|\|candidate.dir===position.side\|\|candidate.stage!=='TRIGGERED'\|\|!candidate.triggerFresh\|\|!la…` | — | — |
| `updateSignalState` | 1000, 120, 1.5 | `now/1000-lane.candidate.triggerAt>Math.min(120,TTI_PROFILE_ENGINE.SECONDS[lane.executionTf]*1.5)` | TIME_WINDOW | — |

**Decision (reviewer):**
- Classification: ______
- Threshold provenance: one line per row above (a document or measurement, or UNKNOWN. UNKNOWN is a valid finding, recorded as HP-2 NOT_ESTABLISHED; Gate 3.3 resolves it. HP-6 moves a field downstream only for failing HP-1 or HP-2.)

