# Zugrio Structural Break Classification Contract

Status: research/alpha. No live-capital authority.

## Principle

A raw market break and the label traders give that break are separate facts.

The engine first observes a **neutral structural break** against a level that was already knowable. A versioned strategy/profile may then classify that break as BOS, CHoCH, MSS, or leave it unclassified.

This avoids making one community's vocabulary a universal hidden rule.

## Neutral break event

The neutral event records:
- stable break identity bound to the immutable point-in-time bar evidence snapshot;
- UP/DOWN direction;
- CLOSE_BEYOND or TOUCH_BEYOND mode;
- broken level identity/concept/scale/timeframe;
- broken level price and observed price;
- source bar identity, its evidence identity, close time and knownAt;
- explicit level-state evidence identity;
- definition/provenance identity;
- source evidence identities.

The detector does not choose tolerance or which concepts can break in which direction. Those belong to the versioned break definition.

## Causality

- A level must be known before the break bar closes.
- For intrabar touch mode, it must also be known before the touch observation.
- A level cannot reuse the break bar's evidence.
- CLOSE_BEYOND requires a completed fresh bar.
- STALE/GAP bars cannot create a break.
- PATH/trendline geometry is not projected here; dynamic-line breaks need a separate versioned projection policy.
- Re-evaluating the same level/source bar/profile yields the same break ID.
- Every break requires an explicit level-state fact from a named policy.
- CONSUMED or INVALIDATED levels cannot create another fresh break event; a later structure level must have a new identity.

## Classification

Classification consumes:
- the neutral break;
- prior structural bias known before the break;
- the selected vocabulary/profile definition;
- optional displacement evidence when that profile requires it.

When displacement is required, it must carry the same direction as the raw break. A merely present but directionless displacement flag is insufficient.

Relation is computed only as:
- continuation;
- opposition;
- neutral.

The profile maps that relation/scale to BOS, CHoCH, MSS, or nothing.

CHoCH and MSS are deliberately not synonyms. The same opposing break can be CHoCH under one profile and remain unclassified under an MSS profile until its declared displacement requirement is met.

## Interface

Only classified engine facts enter the Market Map / EngineChartScene as BOS/CHoCH/MSS labels. The renderer may style and arrange them but does not infer them from candles or pixels.

All outputs remain RESEARCH_ONLY with authorityEffect NONE.


## Evidence roles

The raw break preserves the break-bar evidence ID separately from the flattened provenance list. This matters because prior structural bias may legitimately share older swing/level evidence, but it may **not** be manufactured from the break bar itself.

The classifier therefore rejects only circular break-bar bias evidence; it does not incorrectly reject legitimate shared historical context.


## Intrabar identity

`sourceBarId` identifies the candle slot. `sourceBarEvidenceId` identifies an immutable point-in-time observation of that slot.

For TOUCH_BEYOND research, two observations of the same forming candle can have different highs/lows. They therefore must not share one mutable break ID. Raw break identity includes the immutable bar evidence ID, so later intrabar observations append new facts instead of rewriting old ones.
