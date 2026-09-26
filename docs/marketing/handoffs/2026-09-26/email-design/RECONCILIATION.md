# Revised welcome email reconciliation — 2026-09-26

Status: archived review candidate; not uploaded to Brevo and not sent. No templates, schedules, Cloudflare settings or subscriber records were changed during this handoff.

## Sources checked

- Live Brevo template read of IDs 10–18 on 2026-09-26.
- Repository baseline `edce5f1ffc549b251b31f595082634feb6071ea7` on `chore/engineering-foundation`.
- `docs/marketing/EMAIL_DESIGN_SYSTEM_V1.md`, `workers/brevo-lifecycle/README.md`, and `docs/brand/BRAND_ASSET_SOURCE_OF_TRUTH_STANDARD.md`.
- Local revised `zugrio-welcome-dark.html` and the founder's explicit preservation requirements.

## Template comparison

| Version | Observed status | Logo / graphics | First-name greeting | Exact team sign-off |
| --- | --- | --- | --- | --- |
| 10 — EA00 Brand OS v1 | Active; repository canonical welcome | Typed wordmark and OG-card PNG | Missing | Missing |
| 11–12 — EA01/EA02 Brand OS v1 | Active; repository identifies as duplicates | Typed wordmark; no image elements | Missing | Missing |
| 13–17 — EA01–EA05 Brand OS v1 | Active; repository canonical follow-ups | Typed wordmark; no image elements | Missing | Missing |
| 18 — Premium Curved Preview v1.1 | Inactive | Hosted SVG wordmark and OG-card PNG | Missing | Missing |
| Local revised candidate | Not uploaded; not sent | Official silver PNG wordmark and visible topography PNG | `Hi {{ contact.FIRSTNAME|default:"there" }},` | `The Zugrio team` |

Active status does not prove approval, use in automation, or delivery. The exact incorrect email reported by the founder is still unidentified. This read does not establish send history.

## Reconciliation decision

Preserve the local revised HTML and supporting brand assets without redesigning them. Publish them separately for review; do not replace canonical repository templates or Brevo templates 10–18. The candidate has no Brevo template ID; template 9's earlier test is not validation of this revision.

The explicit founder requirements preserve the actual logo, visible graphic, first-name fallback, and exact team sign-off. A missing name must render as `Hi there`; do not infer a name from an email address.

## Differences requiring a future design decision

The newer repository email standard calls for a curved 24–28px outer shell, rounded key-art surfaces, a newer palette, the EA00 lead `You're on the list.`, the thesis `The signal is only the beginning of the decision.`, and `strategy` rather than `method` in public copy. The archived local candidate uses a square outer shell, the earlier obsidian palette, `The reason stays with the trade.` as its hero, and `method` in body copy. These differences are recorded, not silently resolved or presented as production approval.

The canonical sequence is EA00=10, EA01=13, EA02=14, EA03=15, EA04=16, EA05=17. The lifecycle README also retains older 1–6 configuration examples; those examples must not be used as evidence of current production configuration. Runtime configuration was not verified in this handoff.

## Assets and validation limits

`brand-sources/official-wordmark.svg` and the PNG exports are archived source/derived assets; repository `brand/v1.0.0` remains the canonical logo authority. The topography export strengthens stroke visibility without changing the wordmark geometry. Existing image-host URLs in the HTML are preserved.

Browser preview scripts check image loading and horizontal overflow at 390px and 800px. The screenshots are browser evidence only. Brevo variable substitution, Gmail/Outlook rendering, delivery, unsubscribe behavior and sender-domain authentication are not proven by browser previews. No test email is authorized by this handoff task.

## Operational continuity

Earlier in this thread on 2026-09-26, Brevo list 2 reported 9 subscribers. A Cloudflare D1 read using the saved local login returned authentication error 10000, so current sync health remains unverified. That does not establish that the deployed Worker has failed. The last recorded successful sync remains 2026-09-25 06:45 UTC.

The contact-sync Worker and the newer lifecycle Worker are distinct: the former imports contacts; the latter contains email delivery logic. This PR neither invokes nor deploys either Worker.
