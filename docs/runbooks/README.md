# Runbooks

Operational procedures belong here once the corresponding system exists.

Current runbooks:
- [`PRIVATE_ALPHA_OCI_DEPLOYMENT.md`](PRIVATE_ALPHA_OCI_DEPLOYMENT.md): private validation alpha API + PostgreSQL + Cloudflare Tunnel on OCI London (NO LIVE CAPITAL).
- [`CLOUDFLARE_PAGES_PREVIEW_CHECKS.md`](CLOUDFLARE_PAGES_PREVIEW_CHECKS.md): why the landing-site Pages check fails on product PRs, and the dashboard-only remediation.
- [`../release/PRIVATE_ALPHA_RC_NOTES.md`](../release/PRIVATE_ALPHA_RC_NOTES.md): private-alpha cloud RC notes and how to produce the Windows RC.

Expected future runbooks include:
- local development/bootstrap;
- staging deployment and rollback;
- production deployment and rollback;
- broker-connector incident handling;
- reconciliation/submission-unknown handling;
- credential/key rotation;
- degraded market-data handling;
- emergency risk-reduction operations.

A runbook is not complete until a competent engineer can execute it without AI-chat context.
