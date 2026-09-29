#!/usr/bin/env bash
# DB host firewall: only <allowed-source-cidr> may reach PostgreSQL on this host's addresses.
# Defence in depth behind the OCI subnet security list (the primary control).
#
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32            # apply now (idempotent)
#   sudo ./restrict-postgres-source.sh 10.42.1.111/32 --persist  # also re-apply at every boot
#
# The rule sits in raw/PREROUTING, before Docker DNATs the published port. That makes it
# independent of Docker's firewall backend: with the nftables backend there is no
# DOCKER-USER chain, and a rule placed there would silently never match.
set -euo pipefail
src="${1:?usage: restrict-postgres-source.sh <allowed-source-cidr> [--persist]}"
port="${ZUGRIO_DB_PORT:-5432}"
[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
case "$src" in 0.0.0.0/0|::/0) echo "refusing to allow every source" >&2; exit 1 ;; esac

rule=(-p tcp --dport "$port" -m addrtype --dst-type LOCAL ! -s "$src" -j DROP)
iptables -t raw -C PREROUTING "${rule[@]}" 2>/dev/null || iptables -t raw -I PREROUTING 1 "${rule[@]}"
echo "raw/PREROUTING: tcp/$port to this host dropped unless source is $src"

if [ "${2:-}" = "--persist" ]; then
  script="$(readlink -f "$0")"
  cat > /etc/systemd/system/zugrio-postgres-source.service <<UNIT
[Unit]
Description=Zugrio alpha: restrict PostgreSQL port $port to $src
After=netfilter-persistent.service
Before=docker.service

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
