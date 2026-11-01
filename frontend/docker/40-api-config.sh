#!/bin/sh
set -eu

if [ -z "${API_BASE_URL:-}" ]; then
    echo >&2 'Missing API base URL setting: API_BASE_URL'
    exit 1
fi

# Validate the supported HTTP(S) URL form before starting the web server.
# jq also serializes the value so quotes in the path cannot break JavaScript.
if ! printf '%s' "$API_BASE_URL" | jq -Rse -f /usr/local/share/chronolist/http-url.jq > /dev/null; then
    echo >&2 'Invalid API base URL setting: API_BASE_URL. Expected an absolute HTTP(S) URL without credentials, query, fragment, whitespace or backslashes, and with a valid port.'
    exit 1
fi

config=$(jq -cn --arg url "$API_BASE_URL" '{API_BASE_URL: $url}')

config_path=/usr/share/nginx/html/config.js
temporary_path=$(mktemp "${config_path}.XXXXXX")
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM
printf 'window.__APP_CONFIG__ = %s;\n' "$config" > "$temporary_path"
chmod 644 "$temporary_path"
mv "$temporary_path" "$config_path"
