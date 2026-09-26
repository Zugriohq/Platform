#!/usr/bin/env bash
# End-to-end smoke test for a running private-alpha API.
#   ./smoke-test.sh                          # http://127.0.0.1:3000 (on the VM)
#   ./smoke-test.sh https://api.zugrio.xyz   # through Cloudflare Tunnel
# Needs curl and jq. Creates (idempotently) one validation case for a known fixture frame.
set -euo pipefail
base="${1:-http://127.0.0.1:${ZUGRIO_API_LOCAL_PORT:-3000}}"
expected_meta='{"authority":"NO_LIVE_CAPITAL","evidenceStatus":"VALIDATION_ONLY","liveCapitalAuthority":false,"liveData":false,"releaseChannel":"private-validation-alpha"}'

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
check_meta() { [ "$(jq -cS .meta <<<"$1")" = "$expected_meta" ] || fail "$2: unexpected meta $(jq -c .meta <<<"$1")"; }

health="$(curl -fsS "$base/health")" || fail "GET /health"
check_meta "$health" health
[ "$(jq -r .data.database <<<"$health")" = ok ] || fail "database not ok: $health"
echo "ok  /health ($(jq -r .data.persistence <<<"$health"))"

scenarios="$(curl -fsS "$base/v1/alpha/scenarios")" || fail "GET scenarios"
check_meta "$scenarios" scenarios
scenario_id="$(jq -r '.data[0].id' <<<"$scenarios")"
[ -n "$scenario_id" ] && [ "$scenario_id" != null ] || fail "no scenarios"
echo "ok  /v1/alpha/scenarios ($(jq '.data | length' <<<"$scenarios") scenarios)"

frame="$(curl -fsS "$base/v1/alpha/scenarios/$scenario_id/frames/0")" || fail "GET frame"
check_meta "$frame" frame
[ "$(jq -r .data.authority <<<"$frame")" = NO_LIVE_CAPITAL ] || fail "frame authority"
echo "ok  frame 0 state=$(jq -r .data.state <<<"$frame")"

created="$(curl -fsS -X POST "$base/v1/alpha/decision-cases" -H 'content-type: application/json' \
  -d "{\"scenarioId\":\"$scenario_id\",\"frameIndex\":0}")" || fail "POST decision-cases"
check_meta "$created" materialize
case_id="$(jq -r .data.decisionCase.id <<<"$created")"
echo "ok  POST decision-cases id=$case_id created=$(jq -r .data.created <<<"$created")"

fetched="$(curl -fsS "$base/v1/alpha/decision-cases/$case_id")" || fail "GET decision case"
check_meta "$fetched" reconstruct
[ "$(jq -r .data.consistentWithDecisionCore <<<"$fetched")" = true ] || fail "reconstruction inconsistent"
[ "$(jq '.data.events | length' <<<"$fetched")" -ge 1 ] || fail "empty ledger"
echo "ok  GET decision-cases/$case_id events=$(jq '.data.events | length' <<<"$fetched") consistent=true"
echo "SMOKE PASS $base"
