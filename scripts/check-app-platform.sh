#!/usr/bin/env bash
set -euo pipefail

origin=${1:?Usage: check-app-platform.sh ORIGIN}
response_dir=$(mktemp -d)
trap 'rm -rf "$response_dir"' EXIT

fetch() {
  curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    --retry 5 --retry-all-errors --retry-delay 2 --retry-max-time 90 \
    "$origin$1" --output "$response_dir/$2"
}

fetch / index.html
fetch /shipments shipments.html
cmp "$response_dir/index.html" "$response_dir/shipments.html"
grep -q 'id="root"' "$response_dir/index.html"
grep -q '/assets/' "$response_dir/index.html"
printf 'Frontend application shell and SPA deep link passed.\n'
