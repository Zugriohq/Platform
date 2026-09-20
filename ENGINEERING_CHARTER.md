# Zugrio Engineering Charter v1

## 1. Governing principle

Zugrio is built as if a competent senior engineer must take ownership tomorrow without access to ChatGPT or Claude conversation history. AI may accelerate implementation; AI memory is never institutional memory.

## 2. Source-of-truth precedence

1. Frozen architecture decisions and accepted ADRs.
2. Executable contracts and tests.
3. Current source code.
4. Accepted GitHub issues and pull-request descriptions.
5. Generated documentation.
6. AI chats and model memory — context only, never authority.

A conflict is resolved upward in this order. No agent silently edits governing architecture to make current code appear correct.

## 3. Greenfield shell, brownfield migration

Treat Zugrio 1.0 as a clean production foundation, but do not perform a big-bang rewrite. Preserve validated artifacts, hashes and Gate evidence as immutable lineage.

Migration rule:

> **Freeze → extract → equivalence-test → cut over → delete legacy path.**

Architectural migration and decision-semantic changes must remain separately reviewable.

## 4. Capital-path standard

Capital- and safety-critical code receives the strongest controls: deterministic contracts, versioned artifacts, unit/property/metamorphic tests, replay tests, targeted mutation tests, security review, explicit failure semantics and no direct AI merge to protected branches.

Capital-critical areas include decision core, provenance/state authority, risk/sizing, order construction, veto, position management, broker adapters and connector authentication.

## 5. Broker and market neutrality

Zugrio Core is broker-, venue- and asset-class-neutral. cTrader and MT5 are first execution endpoints, not product boundaries.

A Canonical Instrument Registry separates an underlying from the executable product and venue symbol. Related exposures are not interchangeable contracts.

## 6. MT5 infrastructure direction

Do not build a Zugrio-owned per-customer VPS fleet by default. MT5 local automation may use the customer desktop. Always-on MT5 automation should target a minimal Zugrio Connector EA running in customer-owned MetaTrader/broker virtual hosting, using signed short-lived intents and broker-side protection. Avoid central storage of retail MT5 master passwords where possible.

## 7. Human handoff requirement

Before production capital authority, a competent senior engineer with no access to development chats must be able to clone, boot, test, trace, diagnose, modify and deploy the system from repository documentation alone. Failure is a production-readiness defect.

## 8. AI governance

AI agents implement through issues, branches and pull requests. They do not share credentials, push directly to protected `main`, bypass failing tests, force-push shared branches, or silently alter frozen architecture.

Material design decisions become ADRs. Every AI-assisted PR records scope, tests, security/capital impact and unresolved uncertainty.

## 9. No investor-theatre engineering

Use conventional technology because it lowers operational and hiring risk, not because it looks sophisticated. Do not introduce Kubernetes, Kafka, microservices, multiple databases or extra languages without a measured requirement.
