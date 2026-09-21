# Zugrio Product Surface Architecture v1

Status: design/product inventory for extensible UX architecture.  
Purpose: ensure the shell and information architecture can absorb the known product without redesigning navigation every time Zugrio matures.

## 1. Principle

Do not design navigation around only the features visible in today's prototype.

Design around durable user jobs and stable product domains.

Use:
- progressive disclosure;
- contextual actions;
- expandable navigation;
- global search/command access;
- saved views/layouts;
- role/account-aware surfaces.

Avoid a sidebar containing every feature.

## 2. Product domains

### A. Access and identity — V1 foundational

Surfaces:
- sign up;
- login;
- email verification;
- password/passkey/2FA flows as implemented;
- password reset;
- session/device management;
- logout;
- account recovery;
- invitation/early-access state;
- profile;
- security.

Future-compatible:
- organization/workspace membership;
- roles;
- trusted devices;
- SSO where needed.

### B. Home / Workspace — V1 foundational

Jobs:
- orient;
- resume;
- discover;
- inspect;
- decide;
- monitor.

Potential modules:
- active opportunities;
- current Decision Case;
- chart;
- current conditions;
- context;
- method;
- account/risk;
- positions;
- alerts requiring attention;
- broker/system status.

The shell should support saved workspace layouts without making free-form customization a V1 launch requirement.

### C. Markets / Discovery — V1 foundational

Features:
- market universe;
- FX;
- Gold;
- Synthetic Indices;
- search;
- filters;
- watchlists;
- favorites;
- opportunity scanner;
- market/session status;
- capability/coverage;
- quick compare;
- recently viewed.

Future:
- more markets/products;
- custom scanners;
- shared lists.

### D. Decision / Opportunity — V1 foundational

Features:
- opportunity summary;
- market scope;
- method;
- current conditions;
- supporting/conflicting evidence;
- entry economics;
- invalidation;
- freshness;
- decision state;
- current blocker;
- action availability;
- inspect/audit layers;
- original vs current delta;
- related events;
- capability state.

### E. Chart / Analysis — V1 foundational

Features:
- timeframes;
- market structure;
- supported overlays;
- entry/SL/targets;
- frozen/current geometry;
- context markers;
- execution markers;
- drawing/layer controls;
- fit/zoom;
- chart state recovery.

Future:
- linked charts;
- multi-chart layouts;
- pop-out windows;
- multi-monitor sync;
- strategy-specific overlays.

### F. Context / Calendar / News — V1 foundational

Features:
- economic calendar;
- event relevance;
- session;
- news;
- related-market facts;
- source;
- freshness;
- effect on current decision.

Future:
- personalized context feed;
- saved event filters;
- alert rules.

### G. Methods — V1 foundational

Features:
- method library;
- active/archive;
- versioning;
- applicability;
- setup families;
- entry models;
- required evidence;
- invalidation;
- permitted modes;
- change history.

Future:
- richer method builder;
- templates;
- import/export;
- shared/team methods only when governance exists.

### H. Automation / Authority — V1 foundational, activation gated

Features:
- Signal;
- Semi-Auto;
- Auto;
- Full Auto status;
- authority creation/edit/revoke;
- account binding;
- market/method scope;
- risk limits;
- expiry;
- activity;
- safety state.

Future:
- reusable mandate templates;
- team approvals;
- portfolio mandates.

### I. Orders / Positions / Execution — V1 foundational for connected trading

Features:
- prepared intent;
- approval;
- submitted/acknowledged/rejected/unknown;
- fills;
- positions;
- protective state;
- position management;
- close/reduce where permitted;
- reconciliation.

Future:
- richer order types;
- direct venue-specific capabilities;
- multi-account operations.

### J. Accounts / Risk — V1 foundational

Features:
- trading accounts;
- broker;
- balance/equity;
- exposure;
- open risk;
- configured limits;
- drawdown;
- prop-account constraints where verified;
- account health;
- account switcher.

Future:
- portfolio/account groups;
- capital allocation;
- team-level views.

### K. Journal / Decision History — V1 foundational

Features:
- all Decision Cases;
- entered/passed/expired/blocked/missed/overridden;
- filters;
- search;
- timeline;
- original reasons;
- current changes;
- execution;
- outcome;
- process adherence;
- annotations/notes if introduced;
- compare cases.

Future:
- cohort analysis;
- method adherence trends;
- advanced replay;
- exports;
- team review.

### L. Education / Academy — V1 shell, content staged

Purpose:
help users understand Zugrio and trading concepts relevant to using the product safely, without turning the product into a generic trading-course marketplace.

Potential surfaces:
- Getting Started;
- How Zugrio evaluates a case;
- Market family primers;
- Method/entry concepts;
- Reading current conditions;
- Understanding authority modes;
- Decision review;
- product walkthroughs;
- glossary;
- contextual "learn why" links;
- guided demo/sandbox.

Future:
- structured learning paths;
- assessments;
- certification/badges only if justified;
- expert/community content only with governance.

Design principle:
education should be contextually reachable from product objects, not only a detached academy page.

### M. Notifications / Inbox — V1 foundational

Classes:
- opportunity;
- decision changed;
- macro/context;
- risk/safety;
- execution;
- broker/connection;
- subscription/account;
- product/system.

Features:
- inbox;
- unread state;
- priority;
- action;
- channel preferences;
- quiet hours;
- push/email/desktop/mobile as supported.

Future:
- user-defined alert rules;
- notification digests.

### N. Product updates / Announcements — V1 shell

Features:
- What's New;
- release notes;
- important service announcements;
- new capability availability;
- migration notices;
- required-action notices.

Presentation:
- inbox/update center;
- optional lightweight modal/banner for genuinely important changes;
- never promotional interruption inside a time-sensitive trading action.

### O. Search / Command / Quick switch — V1 foundational

Search:
- instruments;
- methods;
- accounts;
- Decision Cases;
- settings;
- help;
- commands.

Command palette:
- navigate;
- open recent;
- switch account;
- switch workspace/layout;
- toggle supported chart layers;
- open method;
- search decisions;
- low-risk contextual actions.

Capital actions must still obey confirmations/authority and should not become dangerously easy via keyboard.

### P. Saved views / Workspace customization — V1 architecture, launch scope TBD

Features:
- saved workspace;
- density;
- visible modules;
- widths;
- pinned items;
- default market/account;
- restore previous session.

Guardrails:
- critical safety/authority/broker status cannot be hidden beyond safe reach.

Future:
- multiple layouts;
- templates;
- multi-window;
- multi-monitor sync.

### Q. Profile / Settings — V1 foundational

Groups:
- personal profile;
- appearance;
- accessibility;
- language/locale;
- timezone;
- default market/timeframe;
- notifications;
- security;
- devices/sessions;
- privacy/data;
- billing/subscription;
- downloads;
- broker connections;
- advanced/diagnostics.

Avoid a flat settings dump.

### R. Billing / Subscription — V1 foundational

Features:
- current plan;
- entitlement;
- payment method;
- invoices/receipts;
- renewal/cancel;
- early access/trial state;
- feature availability.

Critical rule:
entitlement must never look like execution authority.

### S. Connections / Integrations — V1 foundational

Features:
- cTrader;
- MT5;
- data providers;
- connection status;
- account binding;
- permissions;
- last sync;
- reconnect/disconnect;
- diagnostics.

Future:
- additional brokers/venues;
- export integrations;
- APIs/webhooks if offered.

### T. Help / Support / Diagnostics — V1 foundational

Features:
- help center;
- contextual help;
- support/contact;
- report issue;
- diagnostics bundle;
- connection troubleshooting;
- status/service health;
- legal/risk disclosures.

Future:
- guided support assistant;
- support ticket history.

### U. Readiness / Coverage — V1 foundational

Features:
- market/broker/mode availability;
- research-only;
- validation pending;
- early access;
- released;
- suspended;
- last verified/effective time;
- scope details.

Public and authenticated detail levels may differ.

### V. Labs / Experimental — optional V1 shell

Purpose:
isolate research/experimental capabilities from released product.

Features:
- explicit research label;
- opt-in;
- experiment description;
- known limitations;
- feedback.

No experimental feature gets capital authority by appearing in Labs.

### W. Reports / Export — V1 architecture, implementation staged

Potential:
- Decision Case export;
- journal report;
- account/risk report;
- method adherence report;
- CSV/PDF/shareable summary where safe.

Future:
- team reporting;
- scheduled reports.

### X. Team / Allocator — POST-V1 domain

Future:
- organization;
- members/roles;
- review queues;
- shared methods;
- mandate approval;
- account groups;
- audit;
- allocation/governance.

Do not expose empty institutional UI in V1.

## 3. Navigation architecture

Navigation should be layered, not exhaustive.

Recommended stable model:

### Primary work
- Workspace
- Markets
- Journal

### Control
- Accounts
- Methods
- Automation
- Connections

### Learn / discover
- Academy
- What's New

### System
- Search / Command
- Notifications / Inbox
- Help
- Profile menu → Settings, Security, Billing, Devices

Low-frequency items can live under a customizable More menu or command palette.

The exact shell may differ by desktop/web/mobile.

## 4. Modern expansion rule

A new feature should not require adding a permanent sidebar item by default.

Before creating navigation, ask:
1. Is this a new durable domain or a capability inside an existing domain?
2. Is it frequent enough for permanent navigation?
3. Can it be contextual?
4. Can it be searched/commanded?
5. Can it live in a secondary management surface?
6. Does it belong in notifications/updates/help instead of primary navigation?

## 5. Language architecture

Internal architecture and UI copy are separate layers.

### Internal terms may remain:
- Moment;
- Mandate;
- Memory;
- Decision Case;
- Capability Scope;
- Model Applicability Manifest.

### User-facing copy should be tested against familiar alternatives:
- Current conditions;
- Authority / Automation permissions;
- Decision history / Case history;
- Availability / Coverage;
- Model coverage / Intelligence available.

Rule:
> keep the five-M grammar as product architecture; do not force every internal noun into retail-facing navigation.

## 6. Feature-state completeness

Every major surface must design:
- first use;
- empty;
- loading;
- current;
- changed;
- stale;
- degraded;
- disconnected;
- unavailable;
- permission denied;
- research only;
- locked;
- error;
- recovered;
- archived.

## 7. Future-proof layout implications

The shell should support:
- contextual side sheets;
- drawers;
- peek panels;
- resizable modules;
- saved layouts;
- command palette;
- notification center;
- What's New;
- contextual education;
- multi-window/pop-out later;
- role-aware expansion later.

This is more scalable than reserving permanent columns for every future feature.
