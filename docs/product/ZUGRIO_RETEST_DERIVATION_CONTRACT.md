# Zugrio Causal Retest Derivation Contract

Status: research/private-alpha. No live-capital authority.

## Principle

The lifecycle state machine must not decide that price "retested" a level.

A retest is derived first from immutable post-break OHLC evidence under a versioned profile. The resulting typed evidence may then advance the lifecycle observer.

## Profile-owned rules

A retest definition owns:
- eligible structural-break modes;
- absolute touch tolerance around the broken level;
- absolute close tolerance for valid-side holding;
- maximum allowed penetration;
- hold rule;
- whether the touch-bar close may confirm the hold or a strictly later bar is required.

The engine does not tune these values.

## Chronology

A retest bar must be strictly later than the structural break by source-close chronology and evidence knowledge time.

The original break bar cannot become its own retest after a later request. INCOMPLETE, STALE and GAP evidence cannot confirm a held retest.

## Touch and hold

For an UP break, the retest zone is the broken level ± touch tolerance. A completed later bar touches when its range intersects that zone. Valid-side holding means the close is at or above the profile's allowed boundary. DOWN breaks mirror the rule.

Maximum penetration is evaluated independently from the close. A bar can physically touch and recover by close while still failing the profile's penetration requirement.

## Hold timing

Two explicit profiles are supported:
- `TOUCH_BAR_CLOSE_ALLOWED`: the close of the touch bar may confirm the hold.
- `LATER_BAR_REQUIRED`: the touch bar can only establish `RETEST_TOUCHED`; a strictly later completed bar must confirm the hold.

This distinction is explicit so Zugrio does not impose one trading community's retest convention globally.

## Lifecycle bridge

The adapter emits only:
- `retestTouched:true`;
- and, for a held retest, `retestHeld:true`.

It never invents `confirmRoute`, invalidation, expiry or execution permission.

## Authority

Every output remains `RESEARCH_ONLY`, `liveCapitalAuthority:false` and `authorityEffect:NONE`.


## Identity and lineage

A retest chain has one immutable `touchAnchorEvidenceId`: the evidence snapshot that established the first usable touch. Later hold attempts reference that fixed anchor plus their own immutable bar evidence.

Retest IDs therefore stay bounded; they do not recursively embed the full preceding retest ID chain. `priorTouchId` remains an explicit immediate lineage pointer.

Before a prior touch can confirm a later hold, Zugrio verifies that its break identity, direction, scale, timeframe, level price, touch-zone geometry and evidence roles all match the current break/profile.
