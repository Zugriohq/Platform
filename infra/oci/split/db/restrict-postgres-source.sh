#!/usr/bin/env bash
# DB host firewall: only <allowed-source-cidr> may reach the published PostgreSQL port.
# Defence in depth behind the OCI subnet security list (the primary control).
#
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32            # apply now (idempotent)
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32 --persist  # also re-apply on every Docker start
#
# Docker DNATs published ports, so that traffic traverses FORWARD, not INPUT, and bypasses
# ordinary host rules. DOCKER-USER is Docker's hook for exactly this. --ctdir ORIGINAL
# limits the match to client->server packets, so PostgreSQL's replies are never dropped.
set -euo pipefail
src="${1:?usage: restrict-postgres-source.sh <allowed-source-cidr> [--persist]}"
port="${ZUGRIO_DB_PORT:-5432}"
[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
case "$src" in 0.0.0.0/0|::/0) echo "refusing to allow every source" >&2; exit 1 ;; esac

rule=(-p tcp -m conntrack --ctorigdstport "$port" --ctdir ORIGINAL ! -s "$src" -j DROP)
iptables -N DOCKER-USER 2>/dev/null || true
iptables -C DOCKER-USER "${rule[@]}" 2>/dev/null || iptables -I DOCKER-USER 1 "${rule[@]}"
echo "DOCKER-USER: tcp/$port dropped unless source is $src"

if [ "${2:-}" = "--persist" ]; then
  script="$(readlink -f "$0")"
  cat > /etc/systemd/system/zugrio-postgres-source.service <<UNIT
[Unit]
Description=Zugrio alpha: restrict PostgreSQL port $port to $src
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$script $src

[Install]
WantedBy=docker.service
UNIT
  systemctl daemon-reload
  systemctl enable zugrio-postgres-source.service
  echo "persisted: zugrio-postgres-source.service"
fi
