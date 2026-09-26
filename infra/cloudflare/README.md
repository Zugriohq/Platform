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
| Tunnel `zugrio-alpha-api` | **Not created.** The Cloudflare tooling available to the implementing agent covers Workers/KV/D1/R2/Hyperdrive only, so no tunnel or DNS change was made. |
| DNS `api.zugrio.xyz` | **Not created.** |
| `zugrio.xyz` apex / waitlist Pages | Untouched. |
| Workers `zugrio-email-assets`, `zugrio-brevo-sync` | Present; untouched (Brevo/email lane). |
| R2 | Not enabled on the account (API returns code 10042). The backup script keeps an R2 placeholder only. |

## Secrets (names only — never commit values)

| Name | Where it lives | Scope |
|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | `infra/oci/.env` on the VM (chmod 600) | Runs the `zugrio-alpha-api` connector only. |
| `CLOUDFLARE_API_TOKEN` | Operator workstation only, for the API path below | `Account › Cloudflare Tunnel › Edit` and `Zone › DNS › Edit` on `zugrio.xyz`. Revoke after setup. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` | Operator workstation | Identifiers, not secrets, but keep them out of public logs. |

## Create the tunnel in a disconnected state

Do this before (or independently of) the OCI VM. Until a connector runs, requests to
`api.zugrio.xyz` return Cloudflare error 1033. Nothing else on `zugrio.xyz` is affected.

**Pre-check (stop if it fails):** confirm no DNS record named `api` already exists
in the `zugrio.xyz` zone. If one exists, do not overwrite it; record it in the PR/issue
and decide explicitly.

### Option A — dashboard

1. Zero Trust → Networks → Tunnels → **Create a tunnel** → type **Cloudflared**.
2. Name: `zugrio-alpha-api`. Save.
3. On *Install and run connectors*, copy only the token string from the displayed
   command. Store it as `CLOUDFLARE_TUNNEL_TOKEN` in the VM's `infra/oci/.env`. Do not
   run the displayed install command. `cloudflared` runs in Docker.
4. *Public hostnames* → **Add a public hostname**:
   - Subdomain `api`, domain `zugrio.xyz`, path empty;
   - Service type `HTTP`, URL `api:3000`;
   - Leave TLS verification on (not applicable to plain HTTP inside the Docker network).
5. Save. Cloudflare creates the proxied CNAME `api → <tunnel-id>.cfargotunnel.com`.

### Option B — API (equivalent, scriptable)

```bash
# Operator workstation. Variables come from your shell/secret store, never from the repo.
api=https://api.cloudflare.com/client/v4
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")

# 1. Tunnel (remotely managed)
tunnel_id=$(curl -fsS "${auth[@]}" -X POST "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel" \
  -d '{"name":"zugrio-alpha-api","config_src":"cloudflare"}' | jq -r .result.id)

# 2. Ingress — identical to cloudflared-config.example.yml
curl -fsS "${auth[@]}" -X PUT "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/configurations" \
  -d '{"config":{"ingress":[{"hostname":"api.zugrio.xyz","service":"http://api:3000"},{"service":"http_status:404"}]}}'

# 3. DNS (only after the pre-check above)
curl -fsS "${auth[@]}" -X POST "$api/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
  -d "{\"type\":\"CNAME\",\"name\":\"api\",\"content\":\"$tunnel_id.cfargotunnel.com\",\"proxied\":true}"

# 4. Connector token: paste straight into the VM's .env; do not echo it into logs or tickets
curl -fsS "${auth[@]}" "$api/accounts/$CLOUDFLARE_ACCOUNT_ID/cfd_tunnel/$tunnel_id/token" | jq -r .result
```

## Final activation step (on the VM)

```bash
cd ~/Platform/infra/oci
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs --tail=50 cloudflared   # expect "Registered tunnel connection"
./smoke-test.sh https://api.zugrio.xyz
```

## Recommended edge hardening (not applied)

- A WAF rate-limiting rule on `api.zugrio.xyz` (e.g. `POST /v1/alpha/decision-cases`).
  The write set is already bounded: creation is idempotent per fixture frame, so
  at most one row per scenario frame can ever exist.
- Cloudflare Access with a service token, once the desktop has a place to hold one that
  is better than a value shipped inside the app bundle.

## Rotating or removing

- Rotate the connector token: Tunnels → `zugrio-alpha-api` → *Refresh token*, then update
  `.env` and `docker compose ... up -d cloudflared`.
- Remove: delete the `api` public hostname (this removes the CNAME), then delete the tunnel.
