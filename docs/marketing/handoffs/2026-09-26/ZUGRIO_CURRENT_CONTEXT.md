# Zugrio continuity record
Updated: 2026-09-26. This is a dated snapshot, not proof of current remote state.

## User decisions
Use current official Zugrio branding and canonical logo, visible brand graphics, a refined dark Apple-like email style, personalization for each recipient, and the exact sign-off "The Zugrio team". Do not use Joba in the sign-off. Do not recreate the logo with text or AI.

## Email state
Template 9 was the earlier inactive dark editorial test. Brevo accepted one requested test to oluwajobaoluwaniyi@gmail.com on September 25 (HTTP 204); inbox delivery was not independently verified. That original version predates the user's branding corrections and is not the approved final.
The revised candidate is email-design/zugrio-welcome-dark.html. It includes official silver logo PNG, market-topography graphic, first-name greeting with fallback and team sign-off. It has NOT been uploaded as a revised Brevo template or sent. Browser previews at 390px and 800px were checked; this is not Gmail/Outlook delivery or rendering validation.
The user reports an incorrect email sent by another ChatGPT conversation. Exact send, template and error remain unidentified.
Brevo audit September 26: templates 10–17 active; template 18 "Zugrio EA00 — Premium Curved Preview v1.1" inactive. These were created outside this thread. Their active status is not evidence of user approval or sending. Template 18 used an SVG logo and lacked the requested first-name greeting and team sign-off when inspected. Campaign list was empty; that does not rule out transactional/test sends.
Do not overwrite these templates with the older candidate without reconciling the user's latest choices. No email was sent during this handoff work.

## Personalization
Candidate greeting: Hi {{ contact.FIRSTNAME|default:"there" }},
The waitlist sync currently imports email only; the waitlist does not collect first name. Use "Hi there" where name is absent; never infer names from addresses. Verified test contact first name is Oluwaniyi.

## Cloudflare and Brevo integration
Worker: zugrio-brevo-sync. Runs every five minutes. D1: zugrio-waitlist. Brevo target list: 2.
Last confirmed successful sync: 2026-09-25 06:45 UTC, eight eligible records. Not a current subscriber count.
Sync imports consent-eligible contacts and preserves Brevo suppression. It does not itself send emails or activate lifecycle campaigns.
Brevo API key is encrypted as a Cloudflare secret. Never copy credentials into context files or chat.
Code review: https://github.com/Zugriohq/Platform/pull/20
Branch: feat/brevo-waitlist-contact-sync. Last recorded commit: 5aa6bc7b0007fbe08b632754995215f81546bc4b. Recheck before changes.
Production site: https://zugrio.xyz
Production branch at last inspection: chore/engineering-foundation.

## Brand assets
Canonical source: private repository Zugriohq/Platform, brand/v1.0.0 and docs/brand/BRAND_ASSET_SOURCE_OF_TRUTH_STANDARD.md.
Palette: Obsidian #050508, Graphite #1A1A1A, Steel Silver #C8CCD0, Soft White #F5F5F7.
Published PNG logo: https://zugrio-email-assets.oludeon.workers.dev/zugrio-wordmark-silver-v1.png
Published email graphic: https://zugrio-email-assets.oludeon.workers.dev/zugrio-market-topography-email-v2.png
Graphic derives from official market-topography paths with stronger visibility. Logo geometry is unchanged.

## Required continuity workflow
Before Zugrio work, read this record and any newer project decisions, then inspect the current relevant service. State missing access rather than inventing state. Distinguish requirements, candidate designs, reviewed versions, deployed changes, test submissions and verified deliveries.
Before sending, resolve conflicting templates and confirm that the actual content and audience are covered by the user's authorization. Previous approval of a test is not approval to send a different version to the whole list.
After work, record dated changes, exact IDs/links, validation and next steps. Never assume another chat has read this desktop conversation.
Next: identify the incorrect email, reconcile templates 9–18 against current user decisions, then prepare one clearly identified branded personalized candidate for review and the requested Gmail test.

## Accessibility limitation
This file is saved locally outside read-only sources/. GitHub publishing was attempted but its connector returned Unknown tool. Local files do not establish that normal ChatGPT/mobile has this context. Copy this record into the ChatGPT project's shared sources; the assistant cannot directly write those sources with available tools.

