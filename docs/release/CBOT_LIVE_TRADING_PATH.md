# Zugrio cBot: the path to live trading

Status: **working tracker, not a gate record.** Created 2026-10-07. It changes no gate status, frozen decision or threshold.

The owner's direction (2026-10-07): stay on the governed path, and let what the cBot needs set the order of work so the path moves fast. Design: ADR-0008 (the cBot is the cTrader broker adapter, never a decision-maker).

## The rule that sets the order

The frozen spec says: "Promotion beyond OBSERVE requires Gate 6. **Executable capital FIRE requires Gate 8.**" Gate 4 is not authorised (`CURRENT-GATE.md`). So:

| cBot phase | What it does | Allowed when |
|---|---|---|
| 0. Display | Draws Zugrio setups, levels and invalidation on cTrader charts. **No orders.** | **Now** |
| 1. Boundary core | Envelope signature verification, the SB-1…SB-18 state machines, reconciliation and the risk-reducing kernel, all tested against fakes. **No order API calls.** | **Now** (ADR-0008, capital/safety impact) |
| EA. Demo validation instrument | **Built (PR #116).** Full auto on **demo accounts only**, `FullAccess`, running Zugrio's own decision-core under Jint. Collects decision and execution data. Carries no capital authority | **Now** (ADR-0009, owner decision 2026-10-07). It is not phase 2: it runs research parameters, not admitted policy, and its data is Gate-6 development material |
| 2. Demo execution | Places and manages orders on a cTrader **demo** account under signed manifests | **After Gate 4 is authorised** and the §17 Gate 4 tests pass |
| 3. Forward shadow/demo certification | Runs the frozen system unchanged on demo | Gate 8 ("then forward shadow/demo") |
| 4. Live | Real-money orders, admitted scopes only | **After Gate 8**, plus the owner's live-activation decision |

## Obstacles, in dependency order

| # | Obstacle | Unblocks | Who | Status |
|---|---|---|---|---|
| 1 | PR #67 (engine, API, desktop) reaches `main` | everything that builds on the engine | Owner: Cloudflare Pages setting (`docs/runbooks/PAGES_MONOREPO_BUILD_FIX.md`) | All other CI green; waiting on the owner |
| 2 | Gate 3 cleared (3.1–3.14) | Gate 4 | Claude builds; GPT reviews; owner signs | 3A frozen; 3.1 batch 1 awaiting review (#114) |
| 3 | **Gate 4 authorised** | phase 2 | **Owner decision + independent review** of a Gate 4 entry case | Not authorised. Claude prepares the entry case |
| 4 | Gate 4 built: 4.1–4.17 (provenance verdicts, State/Selection Policy admission, Execution Authority Manifest, Risk/Sizing, Position Management + kernel, Broker Execution Policy, Layer 4A/4M/4B, BrokerSafetySnapshot, SubmissionEnvelope, state machines, expiry/cancel) | phase 2 | Claude builds; review per item | Not started |
| 5 | Identity and device credentials (ADR-0007) | cBot ↔ Zugrio authentication | Claude; owner creates the Auth0 tenant | Designed |
| 6 | API deployed (`api.zugrio.xyz`, health, backups) | the cBot has something to talk to | Owner OCI/Cloudflare access; Claude | Not deployed (NXDOMAIN) |
| 7 | Live market data adapter (separate from execution) | decisions on live prices | Claude | Sources chosen (Dukascopy research history, Deriv synthetics); broker quotes via cTrader for execution only |
| 8 | Signing trust root and key custody (§7.1) | signed envelopes and manifests | Owner (custody), Claude (tooling) | Not started |
| 9 | Policy values: Broker Execution Policy thresholds, Risk/Sizing, `maxProtectionPendingInterval`, slippage and adverse-price guards | phases 2–4 | Measured in Gates 5A/7 where they are `[UNSET]`; **never picked to hit a date** | Not started |
| 10 | Gates 5, 5A, 6, 7: ledger instrumentation, data sufficiency and partition freeze, research, calibration and frozen policies | phases 3–4 | Claude + reviewer; owner supplies data access | Not started. TTI M1 exports (Feb–Aug 2026) exist in Drive and are a candidate corpus; Gate 5A decides whether they qualify |
| 11 | Gate 8 final certification + forward shadow/demo | phase 4 | Frozen system, untouched holdout | Not started |
| 12 | cTrader accounts: a demo account first; broker and live account later | phases 2–4 | Owner | Unknown |
| 13 | **Regulatory position for live trading**: own account vs. offering automated trading to others | phase 4 for anyone but the owner | **Owner + legal advice** | Not assessed. The build cut names "regulatory activation gates" for Semi-Auto |

## What runs in parallel now

- **Claude, now:**
  - cBot phase 0 (display), phase 1 (boundary core) and the demo EA (ADR-0009): built on PR #116;
  - analysing the EA's demo logs as they arrive (development data only);
  - the Gate 4 entry case document;
  - ADR-0007 P2a (identity);
  - Gate 3.1 batch 2 once GPT returns batch 1.
- **Owner, now:**
  - the Pages setting (unblocks #67);
  - revoke the exposed Cloudflare token;
  - open a cTrader **demo** account (a cent account if you want to test a $20-sized balance), install `ZugrioDemoEA.algo` from the PR #116 CI artefact and send back the `Documents/Zugrio/ea-demo` logs;
  - decide on legal advice for item 13.
- **The other chat** ("Accessing other code chats"): #89 then #91 (scanner), stacked on #67's branch. The scanner feeds the cBot's candidates.

## What does not move faster by building

Items 9–11 are evidence, not code. The demo EA's logs help design that evidence work, but they are not it: demo fills differ from live, and the parameters are research values. Shortening them would mean inventing thresholds or peeking at the holdout, which the frozen spec forbids. Engineering speed brings forward the date the evidence work can *start*, not the date it ends.
