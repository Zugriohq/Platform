# Zugrio Contextual Pattern Ontology

Status: research/alpha contract. No live-capital authority.

## Core rule

A recognizable chart pattern is not automatically a trading edge.

Zugrio separates:

1. **Morphology** — what is visibly/deterministically present.
2. **Location** — where it occurs in structure/liquidity/imbalance.
3. **Sequence** — what happened immediately before it.
4. **Regime** — the market condition in which it occurs.
5. **Strategy relevance** — whether the selected strategy declares that concept/context relevant.
6. **Decision evidence** — whether later calibrated/admitted evidence says the setup has usable edge.

The first five can exist in the alpha/research engine. Step 6 is a later evidence/admission problem.

## Structure vocabulary

Zugrio keeps separate, versioned definitions for:
- BOS;
- CHoCH;
- MSS (market structure shift);
- internal, intermediate and external swing structure;
- ranges and range boundaries;
- anchored trendlines and channels;
- breakouts, retests and continuations.

CHoCH and MSS are not silently treated as synonyms. Different trading communities use them differently, so a MethodProfile must bind each label to an explicit definition/version.

## Liquidity / SMC vocabulary

The ontology can represent:
- equal highs/equal lows;
- liquidity sweep/reclaim;
- fakeout;
- inducement;
- displacement;
- FVG;
- order block;
- breaker block;
- mitigation block;
- mitigation.

Some are deterministic geometry, some require research-derived definitions, and some stay advisory until their definition is sufficiently precise.

## Classical chart patterns

The ontology includes:
- double top / double bottom;
- head-and-shoulders / inverse head-and-shoulders;
- rising / falling wedge;
- ascending / descending / symmetrical triangle;
- flag;
- pennant.

These remain research-derived pattern objects until a causal detector definition is frozen. A neckline/wedge/trendline drawn by the UI is never allowed to invent the pattern.

## Candlestick morphology

The engine can deterministically label configured morphology such as:
- doji;
- hammer;
- shooting star;
- bullish / bearish engulfing;
- inside / outside bar;
- morning / evening star;
- three white soldiers / three black crows.

Important: morphology is not interpretation.

A doji in the middle of noisy price is merely a doji. A doji at an external swing after a liquidity sweep in an exhaustion/mean-reverting context may become **strategy relevant**, but still has zero automatic trade authority.

Likewise:
- an engulfing candle is not automatically reversal;
- three strong candles are not automatically continuation;
- a head-and-shoulders is not automatically short;
- a falling wedge is not automatically long.

Context must be declared and evidenced.

## "Three Musketeers"

This is not a canonical Zugrio concept yet because the phrase is used inconsistently by traders. If it refers to a specific three-candle formation in the user's trading vocabulary, it must be mapped to an explicit deterministic definition before entering the ontology. The engine already has canonical three-white-soldiers / three-black-crows morphology.

## Trendlines

Trendlines are engine geometry, not freehand UI analysis.

Current research contract:
- anchors must already be confirmed pivots;
- anchor scale/timeframe must match;
- minimum anchor separation is versioned;
- the line itself has no support/resistance authority;
- later touch/hold/break/reclaim facts must be observed separately.

Future line-fitting/search algorithms may propose candidates, but proposal and confirmation remain separate.

## Context rules

A strategy can define contextual rules such as:

- Doji is relevant only at external swing/range boundary **and** after sweep/fakeout, in EXHAUSTION or MEAN_REVERTING regime.
- Breakout-and-go route is relevant only in BREAKOUT/EXPANSION with declared continuation predicates and extension budget.
- Sweep reversal route requires a sweep/reclaim at declared liquidity plus the strategy's reversal confirmation.
- FVG mitigation route requires a causal displacement/FVG source and current mitigation geometry.
- Range mean reversion requires a valid range boundary, not mid-range candlestick noise.

These are rule examples, not profitability claims.

## Interface consequences

The chart should make maturity visible:

- **deterministic facts** — normal structural/liquidity overlays;
- **research-derived patterns** — clearly labelled research overlays;
- **advisory-only patterns** — visually secondary and never mixed with authoritative setup geometry.

Every pattern must resolve to its engine fact ID, definition ID, source evidence IDs and knownAt timestamp.

No orphan H&S drawing. No freehand wedge becoming a signal. No doji icon pretending to mean reversal.
