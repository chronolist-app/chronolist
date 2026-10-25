#!/bin/sh
set -eu

if [ -z "${API_BASE_URL:-}" ]; then
    echo >&2 'Missing API base URL setting: API_BASE_URL'
    exit 1
fi

# Validate the supported HTTP(S) URL form before starting the web server.
# jq also serializes the value so quotes in the path cannot break JavaScript.
if ! config=$(jq -cen --arg url "$API_BASE_URL" '
    def valid_host:
        if startswith("[") then
            ltrimstr("[") | rtrimstr("]")
            | . as $host
            | split(":") | map(select(length > 0)) as $groups
            | ($groups | all(test("^[0-9a-fA-F]{1,4}$")))
              and (if $host | contains("::") then
                  ($host | split("::") | length) == 2
                  and ($groups | length) < 8
                  and ($host | split("::") | all(
                      . == "" or test("^[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})*$")
                  ))
              else
                  ($host | split(":") | length) == 8
                  and ($groups | length) == 8
              end)
        elif test("^[0-9.]+$") then
            split(".")
            | length == 4 and all(
                test("^(0|[1-9][0-9]{0,2})$") and (tonumber <= 255)
            )
        else
            rtrimstr(".") | split(".")
            | all(test("^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"))
              and (last | test("^(?:[0-9]+|0[xX][0-9a-fA-F]+)$") | not)
        end;
    $url
    | capture("^(?<scheme>https?)://(?<host>\\[[0-9a-fA-F:]+\\]|[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)(?::(?<port>[0-9]+))?(?<path>/[^\\s\\\\?#]*)?\\z"; "i")
    | select(.port == null or ((.port | tonumber) >= 1 and (.port | tonumber) <= 65535))
    | select(.host | valid_host)
    | {API_BASE_URL: $url}
'); then
    echo >&2 'Invalid API base URL setting: API_BASE_URL. Expected an absolute HTTP(S) URL without credentials, query, fragment, whitespace or backslashes, and with a valid port.'
    exit 1
fi

config_path=/usr/share/nginx/html/config.js
temporary_path=$(mktemp "${config_path}.XXXXXX")
trap 'rm -f "$temporary_path"' EXIT HUP INT TERM
printf 'window.__APP_CONFIG__ = %s;\n' "$config" > "$temporary_path"
chmod 644 "$temporary_path"
mv "$temporary_path" "$config_path"
