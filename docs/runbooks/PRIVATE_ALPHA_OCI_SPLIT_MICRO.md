# Runbook — Private validation alpha on two OCI Always Free micro VMs

Status: private validation / **NO LIVE CAPITAL**. Zero-cost fallback chosen by the founder
while London `VM.Standard.A1.Flex` capacity is exhausted and paid compute is not approved
(issue #68). It runs the **same API image, migrations, hardening, tunnel and smoke test** as
the single-VM runbook (`PRIVATE_ALPHA_OCI_DEPLOYMENT.md`); only the placement differs.

```
Zugrio Desktop ─HTTPS─▶ api.zugrio.xyz ─Cloudflare Tunnel─▶ zugrio-alpha-micro-api (E2.1.Micro, amd64)
                                                             ├─ api (NestJS + decision-core), 127.0.0.1:3000
                                                             └─ cloudflared (outbound only)
                                                                   │ VCN private address, tcp/5432
                                                                   ▼
                                                            zugrio-alpha-micro-db (E2.1.Micro, amd64)
                                                             └─ postgres:16 (volume zugrio-alpha-pgdata)
```

Repository files: `infra/oci/split/db/` (DB host), `infra/oci/split/api/` (API host),
`infra/oci/split/add-swap.sh`. `smoke-test.sh` and `backup-postgres.sh` are symlinks to the
shared scripts, so there is one implementation of each. CI job `compose-split-smoke` in
`.github/workflows/private-alpha.yml` runs this exact topology on every PR.

## Differences from the single-VM stack (and why)

| Single VM (A1) | Two micro VMs | Reason |
|---|---|---|
| `aarch64` | `x86_64` | E2.1.Micro is AMD. The image is multi-arch; CI builds and tests amd64. |
| Postgres on an internal Docker network | Postgres published on the DB VM's **private VCN IP** | It must cross hosts. |
| No DB port anywhere | tcp/5432 reachable **only from the API VM** | Enforced by the subnet security list **and** `restrict-postgres-source.sh`. |
| 12 GB RAM | 1 GB RAM each + 4 GiB swap | Swap supports the one-off build. Real-VM runtime viability must be measured before DNS activation. |
| DB traffic stays in one kernel | DB traffic crosses the VCN in plaintext (scram-sha-256 auth) | Same subnet, no public route. TLS between VMs is a follow-up. |

## 0. Network (OCI console, once)

OCI maps each VM's public IP onto its private IP, so binding Postgres to the private IP does
**not** by itself hide it. The subnet security list is the primary control:

- Ingress **tcp/5432** from `<api-vm-private-ip>/32` only (stateful). Nothing else on 5432.
- Ingress **tcp/22** from the admin source only (or OCI Bastion).
- **No** ingress rule for 80, 443 or 3000.
- Egress: all (apt, Docker Hub, npm, Cloudflare).

## 1. Both VMs

```bash
# Private repository: configure a read-only GitHub deploy key on the VM first.
# Never paste the private key into chat or an issue.
git clone git@github.com:Zugriohq/Platform.git ~/Platform
cd ~/Platform && git checkout release/private-validation-alpha-2026-09-28
git rev-parse HEAD                     # must equal the approved release SHA
./infra/oci/bootstrap-ubuntu.sh        # Docker Engine + Compose, /srv/zugrio/backups
./infra/oci/split/add-swap.sh          # 4 GiB swap file (idempotent)
exit                                   # re-login so the docker group applies
```

Verify: `docker version`, `docker compose version`, `uname -m` → `x86_64`, `free -h` shows swap.

## 2. DB VM (`zugrio-alpha-micro-db`)

```bash
cd ~/Platform/infra/oci/split/db
cp .env.example .env && chmod 600 .env
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
# Set ZUGRIO_DB_BIND_ADDR to the exact PRIVATE IP shown in the OCI instance/VNIC page.
# Do not derive it from hostname -I: Docker/extra interfaces make that ambiguous.
nano .env
../validate-private-ip.sh "$(grep '^ZUGRIO_DB_BIND_ADDR=' .env | cut -d= -f2-)" ip
docker compose up -d
docker compose ps                                   # postgres: healthy
docker compose port postgres 5432                   # <db-private-ip>:5432, never 0.0.0.0
sudo ./restrict-postgres-source.sh <api-vm-private-ip>/32 --persist
```

Transfer the password to the API VM without displaying it in chat or GitHub: copy it from
`.env` into a password manager, then into the API VM's `.env` (next step).

## 3. API VM (`zugrio-alpha-micro-api`)

```bash
cd ~/Platform/infra/oci/split/api
cp .env.example .env && chmod 600 .env
nano .env        # POSTGRES_PASSWORD = the DB VM value; ZUGRIO_DB_HOST = <db-vm-private-ip>
../validate-private-ip.sh "$(grep '^ZUGRIO_DB_HOST=' .env | cut -d= -f2-)" ip
sed -i "s/^ZUGRIO_API_IMAGE=.*/ZUGRIO_API_IMAGE=zugrio-api:$(git rev-parse --short HEAD)/" .env
docker compose build api                 # native amd64 build; slow on 1 GB, uses swap
docker compose up -d                     # migrate (one-shot) → api
docker compose ps -a                     # migrate: Exited (0); api: healthy
curl -fsS http://127.0.0.1:3000/health | jq
./smoke-test.sh
docker compose restart api && sleep 20 && ./smoke-test.sh     # expect created=false

# Resource gate on the real 1 GB host. Record this evidence before public activation.
free -h
docker stats --no-stream
docker inspect -f '{{.RestartCount}}' zugrio-alpha-api-1
sudo dmesg --ctime | grep -Ei 'out of memory|oom-kill|killed process' || true
# Stop if the API is restart-looping, the kernel reports OOM, or normal smoke traffic
# causes sustained memory pressure. Swap is not permission to accept an unstable runtime.
```

`migrate` needs the DB VM up. Start the DB VM first after any full outage.

## 4. Tunnel and public activation

Identical to `PRIVATE_ALPHA_OCI_DEPLOYMENT.md` section 6 and `infra/cloudflare/README.md`,
run from `~/Platform/infra/oci/split/api` with the overlay path adjusted:

```bash
docker compose -f docker-compose.yml -f ../../docker-compose.tunnel.yml up -d
docker compose -f docker-compose.yml -f ../../docker-compose.tunnel.yml logs --tail=50 cloudflared
```

Put `CLOUDFLARE_TUNNEL_TOKEN` in the **API VM's** `infra/oci/split/api/.env`. The ingress
target stays `http://api:3000`. DNS for `api.zugrio.xyz` only after the tunnel is healthy.

## 5. Backups (DB VM)

```bash
cd ~/Platform/infra/oci/split/db && ./backup-postgres.sh
( crontab -l 2>/dev/null; echo '17 3 * * * cd $HOME/Platform/infra/oci/split/db && ./backup-postgres.sh >> /srv/zugrio/backups/backup.log 2>&1' ) | crontab -
```

Backups live only on the DB VM's boot volume. R2 is not enabled, so there is **no off-site
copy**. Restore and rollback follow the single-VM runbook sections 7–8, run on the DB VM
(`docker compose stop api` on the API VM first).

## 6. Moving to A1 later

When A1 capacity appears, follow the single-VM runbook section 9: back up here, restore
into the A1 stack, start `cloudflared` there with the same token, stop it here. The public
contract (`https://api.zugrio.xyz`) and desktop builds do not change.

## Known limitations (in addition to the single-VM list)

- Two single points of failure instead of one; 1 GB RAM per host.
- Plaintext PostgreSQL protocol across the VCN (password auth, subnet-local, firewalled).
- The host firewall accepts only an RFC1918 API-VM `/32` and replaces the prior allowed
  source on re-run. OCI security-list ingress must be updated first if the API private IP changes.
- Real E2.1.Micro CPU/RAM performance remains an activation gate until measured on both VMs.