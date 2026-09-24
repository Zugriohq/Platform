# Zugrio Positioning Inputs — 2026-09-24

Status: **current input constraints for the next positioning/headline pass**.  
Issue: #22.

This document is not the new positioning, headline or landing-page copy. It records product truths that the positioning work must respect.

## 1. Superseded copy material

The earlier `zugrio-copy-brief.md` is **superseded** and must not be used as a source of current public copy.

Reasons include:
- it uses **Method** as public language where current public language should use **strategy**;
- it treats "The chart is not the market" as the acquisition hero; current direction reserves that line for the later/closing brand signature rather than the acquisition hero;
- it implies Zugrio can apply a trader's named methodology "exactly as you would," which is incompatible with scope-specific, versioned strategy implementation and admission;
- it blurs user-declared plan conditions with Zugrio-admitted strategy qualification;
- it describes AI-like chart narration more broadly than the current deterministic chart-annotation boundary allows.

Any useful historical phrasing from that brief must be re-evaluated against current architecture before reuse.

## 2. Public strategy language

Use **strategy** in public-facing copy unless a specific internal/domain name must be shown.

Internal architecture may continue to use `MethodProfile` for domain compatibility.

Public copy must preserve these distinctions:
- **your plan condition occurred**;
- **a user-defined structured strategy condition occurred**;
- **Zugrio independently qualified/admitted a strategy signal**.

Those are not interchangeable claims.

## 3. Market lead for acquisition

### Decision

**Forex leads the acquisition narrative.**

Gold and Synthetic Indices remain parallel initial product tracks and must be visible from the first screen/page context.

Recommended positioning pattern:
- Hero narrative/examples: primarily Forex.
- Immediate scope line: **FX · Gold · Synthetic Indices**.
- Market section: explain that each market is separately scoped/validated and that logic/evidence does not transfer merely because charts look similar.

This is a marketing hierarchy, not a product-scope hierarchy.

Do not imply Gold or Synthetic Indices are future-only markets.

## 4. Launch strategy inventory

### Current launch decision

**Launch strategy count target: 1 admitted first-party strategy — Zugrio Core.**

**External strategies in the launch promise: 0.**

Zugrio Core may only be described as admitted/released if its evidence and StrategyAdmission gates have actually cleared. If they have not cleared at launch time, public copy must state the real readiness status rather than implying admission.

Position the initial product around **Zugrio Core as the single named first-party starting strategy**.

Current repository state does not define a second external strategy with a sufficiently explicit:
- MethodProfile/version;
- Entry Model contract;
- market/instrument/horizon scope;
- evidence bundle;
- StrategyAdmissionRecord;
- launch readiness/admission status.

Therefore public launch positioning must **not** promise broad "choose your strategy" support.

### What can still be truthfully positioned

- **Zugrio Core** — first-party starting strategy, subject to evidence/admission and release readiness.
- **Bring your own plan** — trader can declare/structure conditions, invalidation, risk, horizon and review adherence without Zugrio pretending the plan is independently validated.
- **User-defined structured strategies** — product direction supports structuring/evaluation over time, but existence/representation does not equal Zugrio admission.
- **Additional supported strategies** — future/expansion language only after an exact version has been implemented, evidenced and admitted for a stated scope.

Until another strategy clears those gates, do not market SMC, ICT, advanced price action, order flow or another named methodology as launch-supported simply because Zugrio intends to support multiple strategies architecturally.

## 5. Chart annotation boundary

Live chart annotation is a flagship experience only to the extent the underlying product state supports it.

Authoritative chart annotations must reflect deterministic/versioned:
- strategy conditions;
- Entry Model state;
- Decision Case state;
- provenance-bound market/context facts;
- decision geometry.

AI may explain those states separately. AI does not create the authoritative annotation state.

A phrase such as:
> break confirmed — awaiting retest

is valid only if the active strategy/Entry Model defines reconstructable conditions corresponding to "break confirmed" and "awaiting retest."

Do not market Zugrio as "narrating its thinking" if that implies free-form AI reasoning is being written onto the chart as trading evidence.

## 6. Positioning implications

The next positioning pass should not be built around:
- unrestricted methodology choice;
- generic "AI trading";
- a claim that Zugrio exactly reproduces any trader's personal methodology;
- equal-weight market storytelling in the hero;
- free-form AI chart narration;
- "The chart is not the market" as a preselected hero.

The positioning process should start from the full current product truth and may produce new language for:
- the core problem;
- category/descriptor;
- hero/headline;
- value hierarchy;
- market narrative;
- strategy narrative;
- product proof sequence.

## 7. Evidence discipline

If a capability is not implemented/admitted/released, public copy must use accurate developmental language.

No copy should imply:
- Zugrio Core is profitable or admitted before evidence clears;
- an external strategy is supported before its exact version/scope clears;
- user-authored strategy conditions are Zugrio-endorsed signals;
- chart annotation is AI-generated authority;
- non-custodial architecture determines regulatory status.
