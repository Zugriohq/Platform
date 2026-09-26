#!/usr/bin/env bash
# Usage: wait-for-healthy.sh <container> [timeout-seconds]
set -euo pipefail
container="$1"; timeout="${2:-120}"; waited=0
until [ "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null)" = healthy ]; do
  if [ "$waited" -ge "$timeout" ]; then
    echo "$container not healthy after ${timeout}s" >&2
    docker inspect -f '{{json .State}}' "$container" >&2 || true
    exit 1
  fi
  sleep 2; waited=$((waited + 2))
done
echo "$container healthy after ${waited}s"
