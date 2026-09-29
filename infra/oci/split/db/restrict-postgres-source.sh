#!/usr/bin/env bash
# DB host firewall: only one private API-VM /32 may reach PostgreSQL on this host.
# Defence in depth behind the OCI subnet security list (the primary control).
#
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32            # apply now (idempotent)
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32 --persist  # also re-apply at every boot
#
# A dedicated raw/PREROUTING chain runs before Docker DNAT. Unlike DOCKER-USER it is
# present with both Docker iptables and nftables backends. Re-running replaces the
# previous allowed source instead of accumulating contradictory stale rules.
set -euo pipefail
src="${1:?usage: restrict-postgres-source.sh <private-api-ip/32> [--persist]}"
port="${ZUGRIO_DB_PORT:-5432}"
[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/../validate-private-ip.sh" "$src" cidr32 >/dev/null

chain="ZUGRIO_PG_GUARD"
jump=(-p tcp --dport "$port" -m addrtype --dst-type LOCAL -m comment --comment zugrio-postgres-guard -j "$chain")

iptables -t raw -N "$chain" 2>/dev/null || true
iptables -t raw -C PREROUTING "${jump[@]}" 2>/dev/null || iptables -t raw -I PREROUTING 1 "${jump[@]}"
iptables -t raw -F "$chain"
iptables -t raw -A "$chain" -s "$src" -j RETURN
iptables -t raw -A "$chain" -j DROP

echo "raw/$chain: tcp/$port to this host allowed only from $src"

if [ "${2:-}" = "--persist" ]; then
  script="$(readlink -f "$0")"
  cat > /etc/systemd/system/zugrio-postgres-source.service <<UNIT
[Unit]
Description=Zugrio alpha: restrict PostgreSQL port $port to $src
Before=docker.service
After=network-pre.target
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$script $src

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable zugrio-postgres-source.service
  echo "persisted: zugrio-postgres-source.service"
fi
