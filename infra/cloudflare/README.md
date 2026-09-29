# Cloudflare Tunnel — `api.zugrio.xyz` (private validation alpha)

The alpha API runs on a private OCI VM. Public traffic reaches it only through a
**remotely-managed Cloudflare Tunnel**: `cloudflared` on the VM dials out to Cloudflare,
so no inbound API port is opened on the VM or in the OCI network.

```
Desktop ──HTTPS──▶ api.zugrio.xyz (Cloudflare edge, proxied CNAME)
                         │
                         ▼  tunnel (outbound from VM)
                 cloudflared ──http──▶ api:3000 (Docker network `edge`)
```

## Current state (recorded 2026-09-26)

| Item | State |
|---|---|
| Tunnel `zugrio-alpha-api` | **Not created.** The Cloudflare connector available to the implementing agent covers Workers/KV/D1/R2/Hyperdrive/docs only, and no Cloudflare API token was provided, so the tunnel could not be created. Phase 1 below is the exact procedure. |
| DNS `api.zugrio.xyz` | **Deliberately not created.** Phase 3 only. |
| `zugrio.xyz` apex, Pages project `zugrio`, waitlist | Untouched. |
| Workers `zugrio-email-assets`, `zugrio-brevo-sync` | Present; untouched (Brevo/email lane). |
| R2 | Not enabled on the account (API returns code 10042). The backup script keeps an R2 placeholder only. |

## Secrets (names only — never commit values)

| Name | Where it lives | Scope |
|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | `infra/oci/.env` on the VM (chmod 600) | Runs the `zugrio-alpha-api` connector only. |
| `CLOUDFLARE_API_TOKEN` | Operator workstation only | Phase 1: `Account › Cloudflare Tunnel › Edit`. Phase 3 additionally: `Zone › DNS › Edit` on `zugrio.xyz`. Revoke after use. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` | Operator workstation | Identifiers, not secrets; keep them out of public logs. |

## Activation sequence

No public Zugrio hostname may point at an origin that is not serving. Three phases:

```
Phase 1 (now)        tunnel + ingress config exist, no DNS  → nothing public changes
Phase 2 (OCI VM)     API + Postgres healthy, cloudflared connected → tunnel HEALTHY, still no DNS
Phase 3 (activate)   create proxied CNAME api → <tunnel-id>.cfargotunnel.com → verify /health
```

The ingress rule in Phase 1 names `api.zugrio.xyz`, but a hostname receives traffic only
once a DNS record routes it to the tunnel. Until Phase 3, the name does not resolve, and
creating the tunnel is non-destructive.

### Phase 1: create the tunnel (no DNS)

Use the API. In the dashboard, adding a *public hostname* / *published application
route* to a tunnel **also creates the DNS record**, which is the Phase 3 action. Dashboard
users must create the tunnel and stop before that step.

```bash
# Operator workstation. Variables come from your shell or secret store, never from the repo.
api=https://api.cloudflare.com/client/v4
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

# 1a. Refuse to continue if a tunnel with this name already exists (do not replace it).
curl -fsS "${auth[@]}" "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel?name=zugrio-alpha-api&is_deleted=false" \
  | jq -e '.result | length == 0' >/dev/null || { echo "tunnel exists; stop and review"; exit 1; }

# 1b. Remotely-managed tunnel.
tunnel_id=$(curl -fsS "${auth[@]}" -X POST "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel" \
  -d '{"name":"zugrio-alpha-api","config_src":"cloudflare"}' | jq -r .result.id)
echo "tunnel id: $tunnel_id"            # not a secret; record it in issue #68

# 1c. Ingress, identical to cloudflared-config.example.yml. Creates no DNS record.
curl -fsS "${auth[@]}" -X PUT "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/configurations" \
  -d '{"config":{"ingress":[{"hostname":"api.zugrio.xyz","service":"http://api:3000"},{"service":"http_status:404"}]}}'

# 1d. Connector token. Put it straight into the VM's infra/oci/.env as CLOUDFLARE_TUNNEL_TOKEN
#     (or a password manager). Never paste it into GitHub, chat or tickets.
curl -fsS "${auth[@]}" "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/token" | jq -r .result
```

Expected result: the tunnel shows as *Inactive* with 0 connectors. The `zugrio.xyz` zone
is unchanged.

### Phase 2: connect the origin (still no DNS)

Prerequisite: `docs/runbooks/PRIVATE_ALPHA_OCI_DEPLOYMENT.md` sections 1–5 are done and
`./smoke-test.sh` passes on the VM against `http://127.0.0.1:3000`.

```bash
cd ~/Platform/infra/oci
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs --tail=50 cloudflared   # expect "Registered tunnel connection"
```

Confirm the tunnel is healthy before touching DNS:

```bash
curl -fsS "${auth[@]}" "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id" \
  | jq -e '.result.status == "healthy" and (.result.connections | length) > 0'
```

### Phase 3: activate `api.zugrio.xyz` (the only public change)

Run this only when Phase 2 passes.

```bash
# 3a. Pre-check: the name must not exist. If it does, STOP. Do not overwrite production DNS.
curl -fsS "${auth[@]}" "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records?name=api.zugrio.xyz" \
  | jq -e '.result | length == 0' >/dev/null || { echo "api.zugrio.xyz already exists; stop"; exit 1; }

# 3b. The single activation step: proxied CNAME to the tunnel.
curl -fsS "${auth[@]}" -X POST "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -d "{\"type\":\"CNAME\",\"name\":\"api\",\"content\":\"$tunnel_id.cfargotunnel.com\",\"proxied\":true,\"comment\":\"Zugrio private-alpha API via tunnel zugrio-alpha-api (issue #68)\"}"

# 3c. Verify from outside the VM.
curl -fsS https://api.zugrio.xyz/health | jq -e '.data.status == "ok" and .meta.liveCapitalAuthority == false'
./smoke-test.sh https://api.zugrio.xyz        # from a machine with the repo checked out
```

The equivalent dashboard action: Tunnels → `zugrio-alpha-api` → *Public hostname* → add
`api` / `zugrio.xyz` → `HTTP` `api:3000`.

After activation, desktop builds can target the cloud API with
`VITE_ZUGRIO_API_BASE_URL=https://api.zugrio.xyz`.

**Deactivate** (keeps the tunnel and data): delete the `api` DNS record, or stop
`cloudflared` on the VM.

## Recommended edge hardening (not applied)

- A WAF rate-limiting rule on `api.zugrio.xyz` (e.g. `POST /v1/alpha/decision-cases`).
  The write set is already bounded: creation is idempotent per fixture frame, so
  at most one row per scenario frame can ever exist.
- Cloudflare Access with a service token, once the desktop has a place to hold one that
  is better than a value shipped inside the app bundle.

## Rotating or removing

- Rotate the connector token: Tunnels → `zugrio-alpha-api` → *Refresh token*, then update
  `.env` and `docker compose ... up -d cloudflared`.
- Remove: delete the `api` DNS record / public hostname first, then delete the tunnel.
