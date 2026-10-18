#!/usr/bin/env bash
# Smoke test of a deployed frontend through the public URL.
# Usage: smoke-test.sh <base-url> <expected-commit-sha>
#
# Checks that the server serves this exact build (dist/version.txt, written by CI), that the
# app shell loads, and that a deep link falls back to index.html (client-side routing).
set -euo pipefail

BASE="${1:-}"
EXPECTED="${2:?expected commit SHA}"
if [ -z "$BASE" ]; then
  echo "::error::Base URL is empty. Set the repository variable DEV_BASE_URL / PROD_BASE_URL."
  exit 1
fi
BASE="${BASE%/}"

VERSION=""
for i in $(seq 1 24); do # up to 2 minutes (the first HTTPS certificate can take a moment)
  VERSION=$(curl -fsS --max-time 10 "$BASE/version.txt" 2>/dev/null | tr -d '[:space:]') || VERSION=""
  [ "$VERSION" = "$EXPECTED" ] && break
  echo "Attempt $i: version.txt is '${VERSION:-unreachable}', expected ${EXPECTED:0:7}"
  sleep 5
done
if [ "$VERSION" != "$EXPECTED" ]; then
  echo "::error::$BASE does not serve build ${EXPECTED:0:7}."
  exit 1
fi

for path in / /smoke-test/deep-link; do
  if ! curl -fsS --max-time 10 "$BASE$path" | grep -q 'id="root"'; then
    echo "::error::$BASE$path did not return the app shell (index.html with id=\"root\")."
    exit 1
  fi
done

echo "Smoke test OK: $BASE serves ${EXPECTED:0:7}"
