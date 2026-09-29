#!/usr/bin/env bash
# 1 GB E2.1.Micro hosts: add a swap file so `docker compose build api` (pnpm install +
# TypeScript builds) does not get OOM-killed. Idempotent. Runtime memory is unaffected.
#   ./add-swap.sh          # 4 GiB at /swapfile
set -euo pipefail
size="${1:-4G}"
if swapon --show=NAME --noheadings | grep -qx /swapfile; then
  echo "swap already active:"; swapon --show; exit 0
fi
sudo fallocate -l "$size" /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/90-zugrio-swap.conf >/dev/null
sudo sysctl -q -p /etc/sysctl.d/90-zugrio-swap.conf
swapon --show; free -h
