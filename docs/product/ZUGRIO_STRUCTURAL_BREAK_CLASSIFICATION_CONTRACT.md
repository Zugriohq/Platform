# Zugrio Structural Break Classification Contract

Status: research/alpha. No live-capital authority.

## Principle

A raw market break and the label traders give that break are separate facts.

The engine first observes a **neutral structural break** against a level that was already knowable. A versioned strategy/profile may then classify that break as BOS, CHoCH, MSS, or leave it unclassified.

This avoids making one community's vocabulary a universal hidden rule.

## Neutral break event

The neutral event records:
- stable break identity;
- UP/DOWN direction;
- CLOSE_BEYOND or TOUCH_BEYOND mode;
- broken level identity/concept/scale/timeframe;
- broken level price and observed price;
- source bar identity, close time and knownAt;
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

## Classification

Classification consumes:
- the neutral break;
- prior structural bias known before the break;
- the selected vocabulary/profile definition;
- optional displacement evidence when that profile requires it.

Relation is computed only as:
- continuation;
- opposition;
- neutral.

The profile maps that relation/scale to BOS, CHoCH, MSS, or nothing.

CHoCH and MSS are deliberately not synonyms. The same opposing break can be CHoCH under one profile and remain unclassified under an MSS profile until its declared displacement requirement is met.

## Interface

Only classified engine facts enter the Market Map / EngineChartScene as BOS/CHoCH/MSS labels. The renderer may style and arrange them but does not infer them from candles or pixels.

All outputs remain RESEARCH_ONLY with authorityEffect NONE.
