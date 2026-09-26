# Zugrio Market Map & Engine-to-Interface Contract

Status: research/alpha design contract. No live-capital authority.

## 1. Principle

Zugrio is not a migration of the TTI screen.

The engine owns **what the market map means**. The interface owns **how that meaning is rendered**.

The renderer may:
- choose layout;
- choose theme/CSS;
- toggle semantic layers;
- resolve label collisions;
- zoom/pan;
- summarize engine evidence.

The renderer may **not**:
- discover a swing;
- decide BOS vs CHoCH;
- infer a liquidity sweep;
- move an entry/stop/target;
- create a fakeout/mitigation/inducement label;
- reinterpret regime;
- promote a candidate.

Any on-chart object must be traceable to an engine fact/geometry/evidence identity.

## 2. Four quality targets

When product discussion uses "accuracy", separate four different engineering questions:

### Analysis fidelity
Did Zugrio use the correct, complete, point-in-time data and the correct strategy/regime context?

### Structural fidelity
Did Zugrio identify market structure without repainting, hindsight, stale candles, hidden timer changes or scale confusion?

### Entry fidelity
Did Zugrio select/compare the correct declared entry routes for the active strategy/regime and then recheck whether the entry is still currently obtainable?

### Exit fidelity
Did Zugrio preserve structural invalidation and credible objective geometry rather than moving targets/stops to make the plan look better?

None of these is a profitability or win-rate claim. Economic accuracy requires later calibration/holdout evidence.

## 3. Canonical market-map vocabulary

### Structure
- internal swing high/low;
- intermediate swing high/low;
- external swing high/low;
- BOS;
- CHoCH;
- MSS;
- range high/low;
- breakout;
- retest;
- continuation.

### Liquidity
- equal highs/equal lows;
- liquidity sweep/reclaim;
- fakeout;
- inducement.

### Imbalance / return-to-origin
- displacement;
- FVG;
- order block;
- mitigation.

### Advisory pattern families
- Elliott Wave and any similarly interpretive pattern stay advisory until a deterministic, causal specification and validation artifact exists.

This is deliberate. A visually compelling wave count must never become hidden authority.

## 4. Concept maturity

| Concept | Engine status now | Notes |
|---|---|---|
| Confirmed swing high/low | Deterministic fact | Explicit scale/window definition; causal right-side confirmation |
| Equal highs/lows | Deterministic fact | Explicit tolerance provenance required |
| Liquidity sweep | Deterministic geometry label | Penetration + close reclaim; never claims who traded or why |
| BOS / CHoCH / MSS | Research-derived | Requires frozen context/trend/break definitions |
| Displacement | Research-derived | Threshold/provenance required; no inherited TTI score |
| FVG | Deterministic geometry once definition frozen | Economic meaning is separate |
| Order block | Research-derived | Must bind to a causal displacement definition |
| Retest | Deterministic geometry/lifecycle once zone policy is frozen | Already protected by lifecycle observer |
| Continuation | Research-only route | Frozen v1.0.2 predicates; production remains disabled |
| Fakeout | Research-derived | Requires explicit break + reclaim chronology |
| Mitigation | Research-derived | Needs precise source-zone and return semantics |
| Inducement | Advisory/research pending | Do not use until deterministic definition is frozen |
| Elliott Wave | Advisory only | Displayable overlay; zero authority |

## 5. Strategy × regime is a lens, not a hidden score

A TradeBundle/strategy declares:

- compatible regimes;
- required structure concepts;
- optional context concepts;
- entry routes to observe;
- objective families to evaluate;
- invalidation policy reference.

Examples of route families Zugrio must be able to represent:

- breakout continuation ("breakout-and-go");
- breakout retest;
- BOS retest;
- CHoCH retest;
- liquidity-sweep reversal;
- fakeout reversal;
- FVG mitigation;
- trend continuation;
- range mean reversion;
- compression breakout watch.

The engine can observe multiple routes in parallel. It must not assume one is "best" merely because it has a name. Route superiority is a research question for Gate 5–8 evidence.

This directly prevents a TTI failure mode where making retest mandatory caused valid continuation research to disappear.

## 6. Entry and exit

### Entry

Entry is not one universal trigger.

For a given strategy/regime the engine should:

1. build the market map;
2. enumerate declared entry routes;
3. preserve all eligible/counterfactual routes;
4. bind each route to its own causal evidence and geometry;
5. recheck current quote, freshness, geometry, cost, target runway and continuity;
6. expose why each route is current, stale, blocked or still forming.

The interface should show the route, not merely "BUY"/"SELL".

### Exit

Exit geometry begins with the setup's frozen structural truth:

- structural invalidation;
- nearest credible structural objective;
- opposing liquidity;
- range boundary;
- imbalance boundary where declared;
- later, validated trailing/time-exit policy.

The engine must not move a target or stop because the current price has moved. Any dynamic management later belongs to the versioned Position Management Policy, not renderer logic.

## 7. On-chart information architecture

The main chart is the visual authority **for engine facts**, not an independent analyst.

Recommended semantic layers:

1. **Regime** — current canonical regime + timestamp/source.
2. **External structure** — major swings/range boundaries.
3. **Intermediate structure** — intermediate swings/events.
4. **Internal structure** — execution-scale swings/events.
5. **Liquidity** — EQH/EQL, sweeps, fakeouts, inducement (when defined).
6. **Imbalance** — FVG/order block/mitigation zones.
7. **Setup/lifecycle** — break, retest touch, retest hold, continuation hold, lifecycle confirm.
8. **Entry** — candidate/current/stale entry routes.
9. **Invalidation** — structural invalidation/frozen stop once available.
10. **Objectives** — T1/T2/T3 or research objective candidates.
11. **Advisory** — Elliott Wave and other non-authoritative overlays.

The UI can toggle these layers but cannot recalculate them.

## 8. What the trader should see

At any moment the interface should be able to answer:

- **What regime are we in?**
- **What strategy lens is active?**
- **What is the external/intermediate/internal structure?**
- **Which structural/liquidity/imbalance facts are present?**
- **Which setup route is forming?**
- **Which alternative routes were observed but not selected?**
- **What changed on this bar?**
- **Has a retest actually touched/held?**
- **Is a continuation route present?**
- **Is the historical entry still current?**
- **Why is the current entry stale/blocked?**
- **Where is structural invalidation?**
- **What are the credible objectives?**
- **Which concepts are advisory only?**

This is the product-level answer to "why did Zugrio miss this?" and "why is Zugrio showing this?"

## 9. Interface rule

Every visible analytical object should carry or resolve to:

- engine fact/geometry ID;
- definition/version ID;
- source evidence IDs;
- `knownAt`;
- structure scale;
- strategy lens;
- authority/maturity class.

No orphan arrows. No unexplained percentages. No renderer-owned analysis.
