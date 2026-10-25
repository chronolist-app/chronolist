#!/bin/sh
# Run inside the production image; see README.md for the Docker command.
set -eu

checks=0
log_path=$(mktemp)
trap 'rm -f "$log_path"' EXIT HUP INT TERM

expect_valid() {
    if ! API_BASE_URL="$1" /docker-entrypoint.sh nginx -t > "$log_path" 2>&1; then
        cat "$log_path" >&2
        echo >&2 "Expected valid API URL: $1"
        exit 1
    fi
    sed 's/^window.__APP_CONFIG__ = //; s/;$//' /usr/share/nginx/html/config.js \
        | jq -e --arg expected "$1" '.API_BASE_URL == $expected' > /dev/null
    checks=$((checks + 1))
}

expect_invalid() {
    if API_BASE_URL="$1" /docker-entrypoint.sh nginx -t > "$log_path" 2>&1; then
        echo >&2 "Expected invalid API URL: $1"
        exit 1
    fi
    grep -q 'API base URL setting' "$log_path"
    if grep -q 'configuration file .* test is successful' "$log_path"; then
        echo >&2 'Nginx was invoked despite invalid API configuration'
        exit 1
    fi
    checks=$((checks + 1))
}

for value in \
    'http://localhost:8080' \
    'https://api.example.com/backend/' \
    'https://example.com/a"b' \
    'HTTPS://example.com' \
    'http://127.0.0.1:8080' \
    'http://0.0.0.0' \
    'http://255.255.255.255' \
    'http://[::]' \
    'http://[::1]:8080' \
    'http://[2001:db8::1]' \
    'http://[1::]' \
    'http://[1:2:3:4:5:6:7::]' \
    'http://[::1:2:3:4:5:6:7]' \
    'http://[1:2:3:4:5:6:7:8]'; do
    expect_valid "$value"
done

for value in \
    '' ' ' '/api' 'invalid' \
    'ftp://example.com' \
    'https://user:pass@example.com' \
    'https://example.com?q=1' 'https://example.com#x' \
    'https://example.com?' 'https://example.com#' \
    'https://example.com:65536' 'https://example.com:0' \
    'https://example.com/a b' 'https://example.com\path' \
    'http://999.999.999.999' 'http://256.0.0.1' \
    'http://1.2.3' 'http://1.2.3.4.5' 'http://127.00.0.1' \
    'http://[::1:]' 'http://[1::2:]' 'http://[:1::2]' \
    'http://[:::]' 'http://[1::2::3]' 'http://[1:2]' \
    'http://[1:2:3:4:5:6:7:8:9]' \
    'http://[1:2:3:4:5:6:7::8]' 'http://[12345::1]' \
    'http://example..com' 'http://example.123' 'http://0xfffffffff'; do
    expect_invalid "$value"
done

expect_invalid "$(printf 'https://example.com\nX')"
trailing_newline=$(printf 'https://example.com\nX')
expect_invalid "${trailing_newline%X}"
if env -u API_BASE_URL /docker-entrypoint.sh nginx -t > "$log_path" 2>&1; then
    echo >&2 'Expected missing API_BASE_URL to prevent startup'
    exit 1
fi
grep -q 'Missing API base URL setting' "$log_path"
checks=$((checks + 1))
printf 'PASS: %s API configuration regression checks\n' "$checks"
