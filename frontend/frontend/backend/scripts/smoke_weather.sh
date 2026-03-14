#!/usr/bin/env bash
set -euo pipefail
API_URL="${API_URL:-http://127.0.0.1:8000}"
TOKEN="${TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "TOKEN required" >&2
  exit 1
fi

payload() {
  local mode="$1"
  printf '{"address":"123 Main St","city":"Tampa","state":"FL","zip_code":"33602","peril_mode":"%s","window_days":365}' "$mode"
}

echo "Health (optional)"
curl -sS "$API_URL/health" || true
echo

echo "Discover wind"
curl -sS -X POST "$API_URL/api/weather/dol/discover"   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"   -d "$(payload wind)" | head -c 600
echo

echo "Discover hail"
curl -sS -X POST "$API_URL/api/weather/dol/discover"   -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json"   -d "$(payload hail)" | head -c 600
echo

echo "SMOKE OK"
