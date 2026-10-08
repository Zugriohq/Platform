# ADR-0010: The cTrader EA trades live accounts, and runs from cTrader Mobile

- **Status:** Decided by the owner, 2026-10-08. Independent review: requested. It applies to the EA only. The Windows product's rules are unchanged.
- **Date:** 2026-10-08
- **Decision owners:** Founder / Product Lead (decided); independent reviewer (to review)
- **Supersedes:** ADR-0009 §1–2 (the demo-only lock). The rest of ADR-0009 still applies.
- **Related:** ADR-0008, ADR-0009, `apps/ctrader-cbot/README.md`, PR #116

## Context

ADR-0009 made the EA demo-only. It said moving to a live account needs a new ADR, plus the product's Gates 4–8 *or an explicit owner decision recorded the same way, after independent review*.

On 2026-10-08 the owner decided:
- **Live trading:** "grant all full access". Asked to confirm that this means live, real-money trading, the owner chose "Yes, live, no extra steps" over a version with an extra confirmation step.
- **Mobile:** "I should be able to use the full EA on cTrader Mobile".

Two facts about cTrader shape this ([cloud features](https://help.ctrader.com/ctrader-algo/documentation/cloud-features/), [cloud requirements](https://help.ctrader.com/ctrader-algo/documentation/cbots/cloud-requirements/)):
- cTrader Mobile runs no cBots on the phone. It starts and stops **cloud instances**, which run on cTrader's servers.
- The cloud does not run `FullAccess` cBots (cTrader staff, community forum; the docs are silent). It wipes files on every restart, sends no HTTP, and runs on Linux.

## Decision

1. **Live trading.** The EA trades the demo or live account it is started on. There is no confirmation phrase or separate build.
2. **Account binding.** At start the EA records the account number and type. `RequireBoundAccount()` runs before every order call and stops the robot if either changes. A test keeps order calls confined to `EaExecution.cs`, each directly after that check.
3. **Cloud-compatible.** The EA uses `AccessRights.None`, relative-path files and no HTTP. It prints every log record so the data survives the cloud wiping files.
4. **Restart safety without files:**
   - before entering, it checks the broker's own positions and history for the setup's deterministic label, so a restart cannot take the same setup twice;
   - on start, it closes any Zugrio position on its symbol that has no stop, through the risk-reducing gate;
   - it rebuilds today's loss baseline from trades closed today.
5. **Unchanged from ADR-0009:**
   - it runs Zugrio's own decision-core;
   - it uses SEL-4 ranking and the engine's geometry;
   - research parameters (`UNVALIDATED_RESEARCH`) are hashed into every record and every trade comment;
   - the boundary state machine, guards, protection deadline and daily kill switch still apply.

## Consequences

- **Real money at risk.** There is no validated edge. The parameters are untested research values, and the EA can lose the money in the account. Live results are development data, never a performance claim.
- **Product unaffected.** The product's Gate 4 is still not authorised, and `CURRENT-GATE.md` is unchanged. The Windows product keeps Signal, then Semi-Auto under the gates.
- **Unverified in cTrader:**
  - whether the Jint engine and ES256 signing are permitted under `AccessRights.None`. If not, the EA fails to start and prints why; it fails safe;
  - cloud log visibility.
- **Regulatory.** Trading the owner's own account only. Offering this to others is item 13 of `docs/release/CBOT_LIVE_TRADING_PATH.md`, which is not assessed.

## Capital/safety impact

**Yes.** The EA places real-money orders on a live account it is started on. The safety boundary is now the account binding, the stop on every trade, sizing caps, the daily loss kill switch, and the owner's choice of what to fund.

## Rollback

Stop the instance in cTrader, from any device. To restore demo-only, revert the PR #116 commit "cTrader EA: live trading by owner decision…" (ADR-0009's lock and tests return).
