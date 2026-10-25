#!/bin/sh
# Run in an ephemeral production container, with this directory mounted at /tests.
set -eu
checks=0
log_path=$(mktemp)
trap 'rm -f "$log_path"' EXIT HUP INT TERM

valid() {
    if ! API_BASE_URL="$1" BACKEND_UPSTREAM="$2" /docker-entrypoint.sh nginx -t > "$log_path" 2>&1; then
        cat "$log_path" >&2
        exit 1
    fi
    grep -q 'proxy_pass http://127.0.0.1:8080;' /etc/nginx/api-proxy.inc
    grep -q 'proxy_set_header Forwarded "";' /etc/nginx/api-proxy.inc
    checks=$((checks + 1))
}

invalid() {
    if API_BASE_URL="$1" BACKEND_UPSTREAM="$2" /docker-entrypoint.sh nginx -t > "$log_path" 2>&1; then
        echo >&2 'Expected invalid proxy configuration to prevent startup'
        exit 1
    fi
    checks=$((checks + 1))
}

valid 'https://chronolist.example' 'http://127.0.0.1:8080'
grep -q 'proxy_set_header Host chronolist.example;' /etc/nginx/api-proxy.inc
grep -q 'proxy_set_header X-Forwarded-Proto https;' /etc/nginx/api-proxy.inc
grep -q 'proxy_set_header X-Forwarded-Port 443;' /etc/nginx/api-proxy.inc
valid 'http://localhost:18082/' 'http://127.0.0.1:8080/'
grep -q 'proxy_set_header Host localhost:18082;' /etc/nginx/api-proxy.inc
grep -q 'proxy_set_header X-Forwarded-Proto http;' /etc/nginx/api-proxy.inc
grep -q 'proxy_set_header X-Forwarded-Port 18082;' /etc/nginx/api-proxy.inc

for value in \
    'https://127.0.0.1:8080' \
    'http://user:pass@127.0.0.1:8080' \
    'http://127.0.0.1:8080/api' \
    'http://127.0.0.1:8080?q=1' \
    'http://127.0.0.1:8080#fragment' \
    'http://127.0.0.1:0' \
    'http://127.0.0.1:65536' \
    'http://999.999.999.999' \
    'http://[::1:]' \
    'http://localhost; include /tmp/evil;' \
    'http://localhost/$host'; do
    invalid 'https://chronolist.example' "$value"
done
invalid 'https://chronolist.example/backend/' 'http://127.0.0.1:8080'
invalid 'https://user:pass@chronolist.example' 'http://127.0.0.1:8080'
invalid 'https://chronolist.example?q=1' 'http://127.0.0.1:8080'
invalid 'https://chronolist.example#x' 'http://127.0.0.1:8080'

# Switching back to static-only mode must remove a previous proxy configuration.
API_BASE_URL='https://api.example.com/backend/' BACKEND_UPSTREAM='' /docker-entrypoint.sh nginx -t > "$log_path" 2>&1
grep -q 'API_PROXY_NOT_CONFIGURED' /etc/nginx/api-proxy.inc
if grep -q 'proxy_pass' /etc/nginx/api-proxy.inc; then
    echo >&2 'Old proxy configuration survived switching to static-only mode'
    exit 1
fi
checks=$((checks + 1))
printf 'PASS: %s API proxy configuration checks\n' "$checks"
