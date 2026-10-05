# Independent review of round 7 (GPT)

Recorded from the review relayed by the project owner (wording preserved, lightly reformatted into Markdown). It was relayed from the reviewing
session and reviewed the round-7 package (archive `1f62988e…1d80`, PR #111). The
response is `../round8` (see its `CLAUDE-REVIEW-HANDOFF.md`, "Round 8", including
the points where round 8 disagrees).

---

**Round 7 independent review result: NOT CLEARED**

I would not approve Round 7 for Gate 3A freeze yet.

The remediation is materially stronger than Round 6. The discovery of 24/39 misses in Round 6 is exactly the kind of adversarial failure this process is supposed to expose, and Round 7 appears to close those tested classes.

But I found a deeper issue in the review logic that is more important than the 39/39 result.

## 1. The biggest remaining weakness: accepted-input substitution

The new frozen vocabulary fundamentally establishes:

> "This dependency has been seen before and is accepted in this owner/sink."

That is useful for novel dependency detection.

It does not by itself establish that the dependency is the correct dependency.

For example, suppose the legitimate authority path contains `if (candidate.riskFraction <= ...)` and `riskFraction` is in the frozen vocabulary. A mutation that changes it to `if (candidate.volatility <= ...)` could still pass if `volatility` is already an accepted vocabulary member for that owner/sink.

Likewise: `riskFraction → regimeScore`, `thresholdA → thresholdB`, `candidate.side → candidate.bias`, `profile.stopDistance → profile.targetDistance`.

The dependency is not new. The dependency is wrong.

That is a fundamentally different attack class.

The current claim "39/39 attacks caught" therefore proves: the scanner catches the 39 tested mutations. It does not yet prove: the scanner prevents an authority-changing substitution among already-authorised vocabulary entries.

## 2. The frozen vocabulary itself cannot be the final authority

The vocabulary is generated from the clean artifact itself. That is appropriate as a baseline inventory, but it means the scanner trusts the artifact's existing dependency relationships and freezes them.

If the underlying artifact already contains an incorrect but syntactically legitimate dependency, freezing the vocabulary does not discover that error.

This is particularly important because the frozen architecture requires every hard predicate to have threshold provenance and requires separation between Layer 1, state policy, candidate selection, inference, capital features and execution authority.

The scanner therefore needs to validate more than "Is this input known?" It needs to establish: "Is this exact input allowed at this exact authority decision, through this exact producer path, for this exact reason?" That is a stronger invariant.

## 3. BROKER_ORDER_PAYLOAD remains unresolved

Introducing `BROKER_ORDER_PAYLOAD` as `LEGACY_REMOVE` is defensible as an inventory bridge, but it should not become a permanent Gate 3 semantic field simply because the scanner needs somewhere to put these dependencies.

The frozen architecture deliberately separates entry construction and broker execution. Gate 4's `constructEntry()` has an explicit contract for side, size, entry type, stop, targets, account/broker identity, pinned snapshots and risk policy, and then downstream broker submission has its own authority boundary.

Therefore the review requirement should be: show exactly which current Gate 2.2 authority sink owns each order-payload dependency, and prove that the eventual Gate 4 boundary will replace the legacy classification rather than inherit it. Otherwise `LEGACY_REMOVE` risks becoming a permanent escape hatch.

## 4. UPPER_CASE and NOISE acceptance needs stronger proof

The fact that the clean artifact contains UPPER_CASE names and hundreds of member paths does not prove that every such dependency is semantically harmless.

The dangerous mutation is not `NEW_UNKNOWN_FIELD` — that is exactly what the vocabulary catches. The dangerous mutation is `KNOWN_ALLOWED_FIELD → KNOWN_ALLOWED_FIELD`, or `NOISE_FIELD → AUTHORITY_RELEVANT_FIELD` while retaining a syntactically accepted name.

This needs semantic mutation testing.

## 5. The narrowed Object.assign rule needs attack testing

Test mutations such as `Object.assign(target, { harmlessField: x })` versus `Object.assign(target, { riskFraction: maliciousValue })`, and `Object.assign(target, source)` where `source` itself contains an authority field. Then test `Object.assign(target, condition ? safe : unsafe)` and computed keys `target[dynamicKey] = authorityValue`.

The scanner must not merely recognize the guard. It must establish the complete provenance of every authority-bearing value reaching the mutated object.

## 6. Early-return coverage is directionally correct, but classification must not become laundering

Adding `return` and `break` as authority sinks is a good correction. But mapping all of them into existing catalogue fields is not automatically safe. For example, early return → `STATE_RANK` could conceal a predicate that actually represents a different authority concept.

The question is not "Can we fit this into an existing field?" It is "Does this exact predicate semantically belong to that existing field under the frozen architecture?"

The Gate 3 mandatory tests require hard predicates to have threshold provenance and require the resulting state semantics to resolve correctly. A convenient catalogue mapping cannot substitute for that proof.

## The test required before Round 7 can pass — Battery 8: Accepted-Dependency Substitution

Take every major authority sink and mutate it by replacing an accepted dependency with another dependency that is already present in the frozen vocabulary. At minimum:

1. hard predicate input substitution;
2. threshold substitution;
3. profile-field substitution;
4. strategy-state substitution;
5. risk/capital-feature substitution;
6. side/direction substitution;
7. entry/stop/target substitution;
8. lifecycle/state-rank substitution;
9. broker order payload substitution;
10. producer return-value substitution;
11. object-property substitution;
12. array/list element substitution;
13. function-argument substitution;
14. indirect alias substitution.

The injected dependency must deliberately be chosen from the already accepted vocabulary. Expected result: every authority-changing substitution must be detected. If the scanner says "No new vocabulary entry, therefore clean", that is a failure.

**Semantic deletion.** Also test the inverse: `if (riskOk && priceValid)` → `if (priceValid)`; `if (!blocked && eligible)` → `if (eligible)`. The scanner must detect that an existing authority dependency disappeared. A vocabulary freeze primarily catches addition. We also need protection against removal and replacement.

## What I accept from Round 7

Compound/logical assignment detection; mutation-based write detection; indirect dispatch handling; early-return/break coverage; arrow-function ownership correction; broker payload tracing; deterministic vocabulary freeze; reproducibility checks; clean-artifact scan; 65/65 tests; non-vacuity work on the mutation harness; performance recovery from 291 seconds to ~41 seconds.

But none of that resolves the accepted-dependency substitution problem.

## Decision

**Round 7: REJECTED FOR FREEZE.** Not because Round 7 is poor. It is because Round 7 has successfully demonstrated that Round 6 was insufficient, but its current proof standard still primarily establishes vocabulary novelty detection rather than complete semantic authority integrity.

Do not merge as governed. Do not declare Gate 3A frozen. Do not proceed to Gate 3.2 on the assumption that 3.1 is cleared.

Objective for round 8:

> Round 8 must attack accepted dependencies, not merely novel dependencies. For every major authority sink, substitute, remove, or reroute an already-frozen vocabulary dependency while preserving syntactic validity. The scanner must detect every authority-changing mutation. Prove this with non-vacuous mutation tests and a clean-artifact regression run. Do not add a new vocabulary entry merely to make a mutation detectable.

The frozen architecture says no gate clears by review alone, and Gate 3's mandatory tests include structural separation and authority-path properties beyond dependency inventory.

Independent status: Gate 3A NOT CLEARED; Gate 3 NOT CLEARED; Gate 4 NOT AUTHORIZED; Round 8 required, specifically semantic substitution/deletion/rerouting attacks.
