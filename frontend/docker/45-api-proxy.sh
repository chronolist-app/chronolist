#!/bin/sh
set -eu

config_path=/etc/nginx/api-proxy.inc
if [ -z "${BACKEND_UPSTREAM:-}" ]; then
    cp /usr/local/share/chronolist/api-disabled.inc "$config_path"
    exit 0
fi

parse_origin() {
    parsed=$(printf '%s' "$1" | jq -Rse -f /usr/local/share/chronolist/http-url.jq) || return 1
    printf '%s' "$parsed" | jq -e 'select(.path == null or .path == "/")'
}

if ! upstream=$(parse_origin "$BACKEND_UPSTREAM"); then
    echo >&2 'Invalid BACKEND_UPSTREAM: expected an internal HTTP Origin without credentials, path, query or fragment'
    exit 1
fi
if ! upstream=$(printf '%s' "$upstream" | jq -er 'select(.scheme == "http") | .scheme + "://" + .host + (if .port then ":" + .port else "" end)'); then
    echo >&2 'Invalid BACKEND_UPSTREAM: the private sidecar must use HTTP'
    exit 1
fi
if ! public=$(parse_origin "${API_BASE_URL:-}"); then
    echo >&2 'API_BASE_URL must be the public Frontend Origin (without a path) when BACKEND_UPSTREAM is set'
    exit 1
fi
public_host=$(printf '%s' "$public" | jq -r '.host + (if .port then ":" + .port else "" end)')
public_scheme=$(printf '%s' "$public" | jq -r '.scheme')
public_port=$(printf '%s' "$public" | jq -r '.port // (if .scheme == "https" then "443" else "80" end)')

temporary_path=$(mktemp "${config_path}.XXXXXX")
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM
cat > "$temporary_path" <<NGINX
location ^~ /api/ {
    proxy_pass ${upstream};
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host ${public_host};
    proxy_set_header X-Forwarded-Host ${public_host};
    proxy_set_header X-Forwarded-Proto ${public_scheme};
    proxy_set_header X-Forwarded-Port ${public_port};
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header Forwarded "";
    proxy_set_header X-Forwarded-Prefix "";
    proxy_set_header X-Forwarded-Ssl "";
    proxy_intercept_errors off;
    proxy_redirect off;
}
NGINX
chmod 644 "$temporary_path"
mv "$temporary_path" "$config_path"
