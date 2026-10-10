# ADR-0009: The cTrader EA as a demo-only, full-auto validation instrument

- **Status:** Accepted by the owner, 2026-10-07; §1–2 (demo-only) superseded by ADR-0010 on 2026-10-08. Independent review: requested. It applies to the EA only. The Windows product's rules are unchanged.
- **Date:** 2026-10-07
- **Decision owners:** Founder / Product Lead (decided); independent reviewer (to review)
- **Supersedes:** nothing. It narrows how ADR-0008's phases apply to the EA.
- **Related:** ADR-0008, `docs/release/CBOT_LIVE_TRADING_PATH.md`, PR #116, frozen Signal Authority Architecture v1.0.2

## Context

The owner wants the Zugrio cTrader EA (cBot) to trade automatically, with full access, **on demo accounts only**. The purpose is to watch Zugrio's decisions play out in real time and collect the data that shows what needs adjusting. In the owner's words: "we'll not be using a live account now … we'll be trying it on demo … collect that data for us to know what needs to be adjusted", and "we will keep the rules for the Windows version".

The frozen spec governs the *product's* capital authority:
- Gate 4 is not authorised (`CURRENT-GATE.md`);
- Full Auto is unavailable (Gate 4.17);
- "Executable capital FIRE requires Gate 8".

A demo account carries no capital. This ADR records how the owner's decision fits within those rules without changing them.

## Decision

1. **Scope:** the EA may run fully automatically, entering, managing and exiting, **only on cTrader demo accounts**. It runs with `AccessRights.FullAccess`.
2. **No capital authority.** The EA is a **research and validation instrument**, not the Zugrio product, and it carries no capital authority:
   - It refuses to start, and stops trading at once, if the account is live (`Account.IsLive`). The check is enforced in code and covered by a test.
   - No configuration, signal or remote message can lift the demo lock. Moving to a live account needs a new ADR, plus the product's Gates 4–8 or an explicit owner decision recorded the same way, after independent review.
3. **Same decisions as Zugrio.** The EA runs Zugrio's own `decision-core` code (compiled to JavaScript and executed in the cBot), not a re-implementation.
   - Candidates are enumerated from the engine's facts, and the engine judges each one.
   - When several are READY, they are ordered by the spec's unadmitted structural ranking (SEL-4: lifecycle state → setup priority → causal age).
   - Entry, stop and target come from the engine's frozen geometry (`entryReference`, `childInvalidation`, `objective`).
4. **Research parameters, labelled as such.** Entry-model, horizon and risk parameters are versioned research values, recorded in a config file whose hash is written into every decision record. They are **not validated thresholds**: `calibrationStatus: UNVALIDATED_RESEARCH`, as decision-core already declares. Changing them makes a new config version.
5. **Product safety rules still apply** to the EA's own execution:
   - the boundary state machine: no resend on unknown, one entry per event, the protection deadline, journal-based recovery;
   - classification by economic effect;
   - abort-only guards;
   - a local kill switch that never blocks a risk reduction.
6. **Data is development data.** Every decision, order, fill, protection event and exit is logged with the config hash and engine build hash. Demo results are Gate 6 *development* material, never a sealed holdout, and never presented as validated edge or performance (frozen spec, Gate 5A.6 spirit; no performance claims).
7. **The Windows product is unaffected.** Gate 4 for the product stays not authorised. `CURRENT-GATE.md` is unchanged. The desktop keeps Signal, then Semi-Auto under the gates.

## Consequences

- **Positive:** real-time behaviour data from the actual engine, months before product capital authority, with no money at risk.
- **Negative:** demo fills, spreads and slippage differ from live. Conclusions about live performance must wait for the gates.
- **Operational:** the owner runs the EA on a demo account in cTrader. cTrader must keep running it, on the owner's PC or another host the owner controls.

## Capital/safety impact

None. The demo lock is the safety boundary, and the tests must prove that the EA cannot trade a live account.

## Rollback

Stop the cBot, or delete this ADR and remove the execution module. The display indicator and boundary core are unaffected.
