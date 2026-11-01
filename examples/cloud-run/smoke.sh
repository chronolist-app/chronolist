#!/usr/bin/env bash
set -euo pipefail
origin=${1:?Supply the HTTPS origin}
[[ $origin =~ ^https://[a-zA-Z0-9.-]+$ ]] || exit 2
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
fetch() {
  curl --silent --show-error --fail --connect-timeout 10 --max-time 60 \
    --retry 3 --retry-delay 2 --retry-all-errors "$origin/$1" -o "$temp/$2"
}
fetch '' index
grep -q '<div id="root"' "$temp/index"
fetch config.js config
grep -q 'API_BASE_URL' "$temp/config"
# Forces Backend + Nginx + shared session DB access. Never print token/cookie.
fetch api/csrf csrf
jq -e '(.token | type == "string" and length > 0) and .headerName == "X-CSRF-TOKEN"' "$temp/csrf" >/dev/null
status=$(curl --silent --show-error --connect-timeout 10 --max-time 60 \
  -o /dev/null -w '%{http_code}' "$origin/api/todolist/getAll")
[[ $status == 401 ]] || { echo 'Expected unauthenticated API to return 401' >&2; exit 1; }
echo 'Frontend, runtime config, CSRF API and unauthenticated API checks passed.'
