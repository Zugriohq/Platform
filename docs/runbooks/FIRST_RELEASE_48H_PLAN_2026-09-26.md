# Zugrio First Release — 48-Hour Critical Path

Date: 2026-09-26
Target window: **48 hours**
Status: **release-control runbook**

## 1. Release naming

The repository currently records Gate 3 independent clearance as pending and Gate 4 as not authorized.

Therefore the 48-hour target is:

> **Private Validation Release Candidate / Invited Alpha**

Do not publicly label it "Release 1 / Released" unless the formal product evidence, admission, authority and readiness gates required by the frozen Release 1 cut are actually cleared.

Speed does not override readiness truth.

---

## 2. Ship goal

Within 48 hours, produce a coherent invited build that can be put in front of a small controlled tester cohort with:
- stable landing/waitlist;
- functioning welcome email;
- coherent brand system;
- release-quality identity;
- one working product path appropriate to its actual readiness;
- explicit limitations;
- install/access path;
- feedback path;
- no unsupported live-capital claim.

---

## 3. Work split

### ChatGPT / direct connectors — do here
- brand operating system;
- voice/tone/terminology;
- landing-page source review and PRs;
- GitHub documentation/governance;
- Brevo account inspection;
- Brevo sender/list/template inspection;
- email template HTML;
- create/test Brevo templates;
- release copy;
- tester onboarding copy;
- release notes;
- PR review;
- CI review;
- public copy/readiness consistency;
- issue triage and acceptance criteria.

### ChatGPT Work — reserve for persistent browser/computer tasks
- authenticated Cloudflare dashboard audit;
- inspect/fix Pages production build settings/logs;
- D1 row inspection;
- Pages/Worker environment variables and secret-name verification;
- D1 binding verification;
- Turnstile hostname verification;
- custom-domain verification;
- authenticated DNS/domain-email setup;
- Brevo UI-only configuration not exposed by connector;
- final cross-browser/manual visual QA where persistent browser state helps;
- download/install walkthrough of the actual release candidate.

Do not spend Work quota on document drafting, GitHub edits, brand copy, email HTML or analysis that can be done directly.

---

## 4. T+0 to T+6 hours — brand + communication lock

Required:
- accept Brand Operating System v1.0;
- lock email design system;
- create EA00 production candidate;
- send EA00 test;
- confirm sender/list/template IDs;
- restore all public wording to current positioning lock;
- identify current Cloudflare Pages build failure cause.

Exit:
- one coherent public identity;
- one testable welcome email;
- no terminology drift.

---

## 5. T+6 to T+18 hours — release infrastructure

Work tasks:
- authenticate Cloudflare browser profile;
- inspect latest Pages failure;
- verify production branch/build root/output;
- verify D1 binding;
- verify Turnstile;
- verify Brevo env vars;
- point welcome template env to active approved EA00;
- verify lifecycle Worker configuration;
- verify custom domain;
- verify sender-domain DNS if ready.

Direct tasks:
- fix code/config issues discovered;
- create PRs;
- review logs;
- retest waitlist;
- test email lifecycle.

Exit:
- signup -> D1 -> Brevo -> EA00 confirmed end-to-end.

---

## 6. T+18 to T+30 hours — product release candidate

Use the frozen Release 1 build cut.

Do not add scope.

Priority:
1. deterministic Core case path;
2. evidence/replay;
3. Signal path;
4. only include Semi-Auto/cTrader if its exact scope is actually admitted and safe.

If the full three-market Release 1 admission criteria are not cleared:
ship the invited build under **Validation**, not Released.

Exit:
- reproducible install/build;
- known limitations;
- no critical blocker;
- evidence/status accurately represented.

---

## 7. T+30 to T+40 hours — QA + tester package

Test:
- Windows target machine;
- authentication;
- install/update path;
- primary workflow;
- error states;
- broker connection path if included;
- disconnect/revocation if included;
- no stale permissions;
- website/download links;
- email;
- mobile landing/waitlist;
- analytics/events where configured.

Prepare:
- invitation;
- release note;
- tester instructions;
- feedback form/channel;
- known-issues list;
- rollback instructions.

---

## 8. T+40 to T+48 hours — release gate

Founder release review:
- product works for the stated scope;
- readiness status is truthful;
- no unsupported automation/performance claim;
- brand is coherent;
- email works;
- production deploy is green;
- critical telemetry/logging exists;
- rollback path exists.

Then:
- invite first controlled cohort;
- observe;
- fix only release-critical issues;
- record evidence.

---

## 9. Current blockers already known

1. Cloudflare Pages bot reported a failed build on the latest headline PR.
2. D1 has not yet been directly inspected through an authenticated dashboard session.
3. Brevo has 9 contacts, but EA00–EA05 templates are inactive.
4. Current sender is Gmail, not a branded zugrio.xyz sender.
5. Current list is still named `Your first list`.
6. Formal repository gate status is not yet sufficient to call unverified capabilities Released.

---

## 10. Non-blockers

Do not delay invited validation for:
- perfect social campaign library;
- full mobile app;
- every future strategy;
- Auto/Full Auto;
- billing;
- elaborate brand merchandise;
- large content calendar;
- perfect investor deck.

Brand must be coherent. Product truth must be accurate. Scope must stay narrow.

