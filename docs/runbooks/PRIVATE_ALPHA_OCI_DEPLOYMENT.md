# Runbook — Private validation alpha on OCI London

Status: private validation / **NO LIVE CAPITAL**. This deploys the Zugrio API control
plane, `@zugrio/decision-core` (inside the API), PostgreSQL and `cloudflared` to one
Oracle Cloud VM. It grants no Gate 4 capital authority and does not change Gate 3 state.

```
Zugrio Desktop ─HTTPS─▶ api.zugrio.xyz ─Cloudflare Tunnel─▶ OCI VM (uk-london-1)
                                                             ├─ api (NestJS + decision-core)
                                                             ├─ postgres:16 (volume zugrio-alpha-pgdata)
                                                             └─ cloudflared (outbound only)
```

Repository files: `infra/oci/` (Compose, scripts, `.env.example`), `infra/cloudflare/`
(tunnel config and activation), `apps/api/Dockerfile`, `apps/api/prisma/` (schema and migrations).

## 1. OCI VM prerequisites

| Setting | Value |
|---|---|
| Region | UK South (London), `uk-london-1` (home region) |
| Shape | `VM.Standard.A1.Flex`, **2 OCPU / 12 GB** (Ampere, `aarch64`) |
| Image | Canonical Ubuntu 24.04 (aarch64) |
| Boot volume | 50 GB |
| Network | VCN subnet with outbound Internet (public IP or NAT gateway). cloudflared, apt, Docker Hub and npm need outbound HTTPS. |
| Ingress | **SSH (22/tcp) from your admin IP only**, or OCI Bastion. **No** 80/443/3000 ingress rule. |
| SSH | Key-based; password auth disabled (Ubuntu OCI default). |

OCI Ubuntu images ship restrictive host iptables (only 22 inbound). Leave them. Docker
publishes the API on `127.0.0.1` only.

## 2. Bootstrap the VM (once)

```bash
ssh ubuntu@<vm-ip>
git clone git@github.com:Zugriohq/Platform.git ~/Platform   # read-only deploy key recommended
cd ~/Platform && git checkout <release-branch-or-tag>
./infra/oci/bootstrap-ubuntu.sh        # Docker Engine + Compose plugin, /srv/zugrio/backups
exit                                   # re-login so the docker group applies
```

Verify: `docker version`, `docker compose version`, `uname -m` → `aarch64`.

## 3. Environment

```bash
cd ~/Platform/infra/oci
cp .env.example .env && chmod 600 .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
# Set CLOUDFLARE_TUNNEL_TOKEN only when activating the tunnel (section 6).
```

| Variable | Purpose | Secret? |
|---|---|---|
| `POSTGRES_PASSWORD` | DB password (hex, URL-safe) | **yes** |
| `POSTGRES_DB`, `POSTGRES_USER` | default `zugrio` | no |
| `ZUGRIO_API_IMAGE` | image tag to run (default `zugrio-api:local`) | no |
| `ZUGRIO_API_LOCAL_PORT` | loopback port for on-VM checks (default 3000) | no |
| `ZUGRIO_CORS_ORIGINS` | `*` or comma list | no |
| `CLOUDFLARE_TUNNEL_TOKEN` | tunnel connector | **yes** |
| `CLOUDFLARED_VERSION` | pinned connector version | no |
| `ZUGRIO_BACKUP_DIR` | pg_dump target (default `/srv/zugrio/backups`) | no |

Never paste secret values into GitHub, chat or tickets. Record secret **names** only.

## 4. First deploy

```bash
cd ~/Platform/infra/oci
export ZUGRIO_API_IMAGE=zugrio-api:$(git rev-parse --short HEAD)
sed -i "s/^ZUGRIO_API_IMAGE=.*/ZUGRIO_API_IMAGE=${ZUGRIO_API_IMAGE}/" .env
docker compose build api                 # native arm64 build on the VM (a few minutes)
docker compose up -d                     # postgres → migrate (one-shot) → api
docker compose ps -a                     # migrate: Exited (0); postgres, api: healthy
```

The `migrate` service runs `prisma migrate deploy`. It applies the schema and the
ADR-0002 database guards: append-only `decision_event`, immutable case identity and
`NO_LIVE_CAPITAL`-only authority.

## 5. Health verification

```bash
curl -fsS http://127.0.0.1:3000/health | jq      # data.status "ok", database "ok", persistence "postgres"
./smoke-test.sh                                   # scenarios, frame case, persist, reconstruct
docker compose logs --tail=50 api                 # JSON logs
```

The API must not be reachable on the VM's public IP: `curl -m 5 http://<vm-public-ip>:3000/health`
from outside must fail.

## 6. Cloudflare Tunnel startup

Create the tunnel and `api.zugrio.xyz` route as described in
`infra/cloudflare/README.md` (disconnected until a connector runs). Then:

```bash
nano .env                                          # set CLOUDFLARE_TUNNEL_TOKEN
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml logs --tail=50 cloudflared
./smoke-test.sh https://api.zugrio.xyz
```

For all later commands, use both files, e.g. `alias dc='docker compose -f docker-compose.yml -f docker-compose.tunnel.yml'`.

## 7. PostgreSQL data and backups

- Data: Docker named volume `zugrio-alpha-pgdata` (under `/var/lib/docker/volumes/` on the boot disk).
- Logical backups: `./backup-postgres.sh` writes `pg_dump --format=custom` files to
  `/srv/zugrio/backups` (mode 600, newest 14 kept). Schedule daily:

  ```bash
  ( crontab -l 2>/dev/null; echo '17 3 * * * cd $HOME/Platform/infra/oci && ./backup-postgres.sh >> /srv/zugrio/backups/backup.log 2>&1' ) | crontab -
  ```
- Off-site: **R2 placeholder.** R2 is not yet enabled on the Cloudflare account. Once a
  bucket and a scoped token are approved, copy each dump there (see the comment in
  `backup-postgres.sh`). Until then, backups live only on the VM's boot volume. Also
  enable OCI boot-volume backups as a second copy.
- Restore (into an empty database):

  ```bash
  docker compose stop api
  docker compose exec -T postgres pg_restore -U zugrio -d zugrio --clean --if-exists --no-owner < /srv/zugrio/backups/<file>.dump
  docker compose up -d api
  ```
  `--clean` drops the guarded tables and recreates them from the dump. That is permitted
  because DROP is not UPDATE/DELETE/TRUNCATE. Use it only for disaster recovery, never to
  "edit" history.

## 8. Updating and rollback

```bash
cd ~/Platform && git fetch && git checkout <new-ref>
cd infra/oci
new=zugrio-api:$(git rev-parse --short HEAD)
sed -i "s/^ZUGRIO_API_IMAGE=.*/ZUGRIO_API_IMAGE=${new}/" .env
./backup-postgres.sh                  # always back up before migrations
docker compose build api && docker compose up -d
./smoke-test.sh
```

**Rollback (application):** set `ZUGRIO_API_IMAGE` back to the previous tag (still in the
local image cache) and run `docker compose up -d api`. Migrations are forward-only.
An older image works against a newer schema only if the newer migration was additive.

**Rollback (schema):** restore the pre-deploy backup (section 7), then start the previous image.

**Stop serving publicly without touching data:** `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop cloudflared`.

## 9. Moving compute later without changing the public contract

The public contract is `https://api.zugrio.xyz` plus `apps/api/openapi.json`. Neither
depends on OCI.

1. Provision the new host and run sections 2–5 there.
2. Take a final backup on the old VM (`docker compose stop api` first so nothing writes)
   and restore it on the new host.
3. Start `cloudflared` on the new host with the **same** tunnel token. A tunnel accepts
   several connectors, so traffic now flows to both.
4. Stop `cloudflared` on the old VM. Traffic moves without any DNS change.

## 10. Known limitations (alpha)

- Single VM, single PostgreSQL instance, no replica. Recovery point = last backup.
- Images are built on the VM; there is no registry publishing yet (GHCR + OIDC is a follow-up).
- The API is unauthenticated. It serves validation fixtures, and its only write is idempotent
  per fixture frame, so the stored data set is bounded. See `infra/cloudflare/README.md`
  for recommended edge hardening.
- No live market data, broker connectivity or trade execution exists anywhere in this stack.
