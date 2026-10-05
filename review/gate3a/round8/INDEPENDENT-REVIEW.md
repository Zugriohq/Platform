# Independent review of round 8 (GPT)

Recorded from the review relayed by the project owner (wording preserved, lightly reformatted into Markdown). It reviewed PR #111 at `e26365f`, the round-8 package (archive `67fc846f…1d59`). The response is `../round9`.

---

**Round 8 independent review: REJECTED FOR FREEZE**

I reviewed PR #111 at e26365f, including the Round 8 scanner, baseline logic, substitution battery, status/handoff, and the frozen Gate 3 scope.

The Round 8 remediation is materially better and it does close the exact Round 7 weakness I identified. The 46-case accepted-dependency battery is the right attack direction, and the fact that the vocabulary remained byte-identical is important.

However, I found a remaining real authority-coverage gap.

## Finding R8-01: top-level authority producers are not baseline-covered

The new baseline fingerprints every reachable authority sink, every function owning a reachable authority sink, and every `Object.assign` leaf inside those owners. But it does not fingerprint or otherwise baseline-bind top-level authority-producing state.

The producer closure explicitly handles global writes inside live functions. It does not establish an equivalent producer/baseline boundary for module/top-level assignments.

That matters because the scanner explicitly accepts UPPER_CASE constants and global configuration as legitimate dependencies. The Round 8 evidence itself contains authority producers such as `ASSET_PROFILES[k] || DEFAULT_PROFILE`, `TTI_PROFILE_ENGINE.SECONDS[...]`, `SIGNAL_STATES`, `ZUGRIO_ATR_*`, and other configuration/constants feeding live authority.

If a mutation changes an authority-bearing top-level object/value while leaving every authority function byte-for-byte unchanged: top-level authority data changes → same sink expressions → same sink dependencies → same authority-owner fingerprints → NO baseline drift. The vocabulary also does not catch it because the dependency is already accepted.

The artifact SHA catches that the artifact changed, but that is not equivalent to the Round 8 baseline proving that the authority surface changed. Round 8's stated purpose is to localise authority changes, and this class currently falls outside that boundary.

### Why this is a blocker

A change to `const ASSET_PROFILES = { EURUSD: {...}, XAUUSD: {...} }` — a profile's execution permission, direction, risk scaling, thresholds or instrument constraints — can alter a downstream authority decision without modifying the function containing the final `if`, state write, or broker payload. That violates the stronger Round 8 claim that the authority inventory is bound to the exact cleared decision surface.

## What I do accept

Accepted dependency substitution detection; deletion detection; threshold-literal change detection; reroute detection; order-field successor mapping; `Object.assign` leaf coverage; full consequence hashing rather than the old 360-character truncation; owner fingerprinting; canonicalisation with an explicit ASI test; non-vacuity against the Round 7 scanner; preservation of the vocabulary hash; explicit acknowledgement that semantic correctness remains Gate 3.1–3.3 work. I also agree that the scanner should not pretend to determine semantic correctness.

## Required Round 9 attack

Do not respond by merely adding a special test for `ASSET_PROFILES`. Generalise the closure.

Attack class — top-level producer substitution. For every top-level value that reaches a reachable authority dependency, mutate: (1) object property value; (2) object property presence/removal; (3) numeric threshold; (4) nested profile field; (5) array member; (6) constant value; (7) mapping/table entry; (8) default/fallback value; (9) enum/state mapping; (10) top-level function declaration/body if it is used by authority.

At least one mutation must preserve the exact consumer expression `ASSET_PROFILES[k]` while changing the contents of `ASSET_PROFILES`. The scanner must report the mutation at the producer boundary, not merely rely on the artifact SHA.

Required invariant: every authority-relevant producer reachable from a live sink must itself be bound to the frozen Gate 2.2 artifact — with a defined treatment for top-level constants, objects/tables, arrays, functions, and other module-scope mutable state. Do not blindly fingerprint the entire top-level script. Define the authority-relevant producer closure and freeze that.

Do not let this turn into an attempt to solve Gate 3.1 inside the scanner: inventory binding ≠ semantic correctness.

## Final disposition

Round 6 rejected; Round 7 rejected; Round 8 accepted-dependency attack: pass; Round 8 overall: rejected for freeze; remaining blocker: top-level authority producer binding. Gate 3A not cleared; Gate 3 not cleared; Gate 4 not authorized. Do not merge Round 8 as governed evidence.

Round 9 should be narrowly focused on top-level producer closure and authority-owner coverage, plus one adversarial test proving that a top-level authority table/value mutation cannot pass silently. After that, the next major question should be the actual §14A consumer map, rather than continuing to expand the scanner indefinitely.
