#!/bin/sh
# Container-side split-topology preflight. Reads secrets from environment without
# interpolating them into the container command line.
set -eu
role="${1:?usage: validate-split-env.sh <api|db>}"
script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

case "${POSTGRES_PASSWORD:-}" in
  ""|replace-*) echo "refusing empty/placeholder PostgreSQL password" >&2; exit 64 ;;
esac

case "$role" in
  api)
    "$script_dir/validate-private-ip.sh" "${ZUGRIO_DB_HOST:-}" ip >/dev/null
    ;;
  db)
    "$script_dir/validate-private-ip.sh" "${ZUGRIO_DB_BIND_ADDR:-}" ip >/dev/null
    ;;
  *)
    echo "usage: validate-split-env.sh <api|db>" >&2
    exit 64
    ;;
esac
echo "split $role environment preflight passed"
