#!/bin/sh
# Fail closed unless a value is an RFC1918 IPv4 address (or, with cidr32, that exact host /32).
# This is intentionally narrow for the current OCI VCN deployment. It rejects public,
# loopback, link-local, wildcard and broad-subnet values.
set -eu
value="${1:-}"
mode="${2:-ip}"
fail() { echo "refusing non-private IPv4 ${mode}: ${value:-<empty>}" >&2; exit 64; }

case "$mode" in
  ip) ip="$value" ;;
  cidr32)
    case "$value" in */32) ip="${value%/32}" ;; *) fail ;; esac
    ;;
  *) echo "usage: validate-private-ip.sh <ipv4|ipv4/32> [ip|cidr32]" >&2; exit 64 ;;
esac

old_ifs="$IFS"; IFS=.; set -- $ip; IFS="$old_ifs"
[ "$#" -eq 4 ] || fail
for octet in "$@"; do
  case "$octet" in ''|*[!0-9]*) fail ;; esac
  [ "$octet" -le 255 ] 2>/dev/null || fail
done
a="$1"; b="$2"
private=0
[ "$a" -eq 10 ] && private=1
[ "$a" -eq 172 ] && [ "$b" -ge 16 ] && [ "$b" -le 31 ] && private=1
[ "$a" -eq 192 ] && [ "$b" -eq 168 ] && private=1
[ "$private" -eq 1 ] || fail
printf '%s\n' "$value"
