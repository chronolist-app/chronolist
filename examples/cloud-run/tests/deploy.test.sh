#!/usr/bin/env bash
# Exercises failure ordering without contacting Docker, GCP or the public service.
set -euo pipefail
source_root=$(cd "$(dirname "$0")/../../.." && pwd)
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
mkdir -p "$temp/repo/examples/cloud-run" "$temp/bin"
cp "$source_root/examples/cloud-run/"{deploy,smoke}.sh "$temp/repo/examples/cloud-run/"
export LOG="$temp/commands" FAIL_AT=none
export GCP_PROJECT_ID=test-project GCP_REGION=test-region ARTIFACT_REPOSITORY=test-images
export SERVICE_NAME=test-service FLYWAY_JOB_NAME=test-job PUBLIC_ORIGIN=https://public.example
export RELEASE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa RELEASE_ID=r123-1
cat > "$temp/bin/gcloud" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "$*" >> "$LOG"
if [[ $* == 'run services describe '* ]]; then
  if [[ -f "$LOG.staged" ]]; then
    printf '{"status":{"latestReadyRevisionName":"test-service-r123-1","traffic":[{"revisionName":"test-service-r123-1","tag":"r123-1","url":"https://candidate.example"}]}}'
  else
    printf '{"spec":{"template":{"spec":{"containers":[{"name":"frontend"},{"name":"backend"}]}}},"status":{"traffic":[{"revisionName":"previous","percent":100}]}}'
  fi
elif [[ $* == 'artifacts docker images describe '* ]]; then
  printf 'sha256:%064d\n' 1
elif [[ $* == 'run jobs execute '* ]]; then
  if [[ $FAIL_AT == migrate && $* == *'--args=migrate'* ]]; then exit 41; fi
  if [[ $FAIL_AT == validate && $* == *'--args=validate'* ]]; then exit 42; fi
  echo execution-id
elif [[ $* == 'run services update '* ]]; then
  [[ $FAIL_AT != deploy ]] || exit 43
  touch "$LOG.staged"
fi
MOCK
cat > "$temp/bin/docker" <<'MOCK'
#!/usr/bin/env bash
echo "docker $*" >> "$LOG"
[[ $FAIL_AT != push ]] || exit 44
MOCK
cat > "$temp/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -eu
echo "curl $*" >> "$LOG"
[[ $FAIL_AT != smoke ]] || exit 45
if [[ $FAIL_AT == public && $* == *https://public.example* ]]; then exit 46; fi
url= output=
while [[ $# -gt 0 ]]; do
  case $1 in
    -o) output=$2; shift 2 ;;
    https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
case $url in
  */api/csrf) printf '{"token":"synthetic","headerName":"X-CSRF-TOKEN"}' > "$output" ;;
  */config.js) echo 'window.__APP_CONFIG__ = {"API_BASE_URL":"https://public.example"};' > "$output" ;;
  */api/todolist/getAll) printf 401 ;;
  */) echo '<div id="root"></div>' > "$output" ;;
  *) exit 2 ;;
esac
MOCK
chmod +x "$temp/bin/"*
export PATH="$temp/bin:$PATH"
for scenario in push migrate validate deploy smoke public none; do
  export FAIL_AT=$scenario
  : > "$LOG"
  rm -f "$LOG.staged"
  status=0
  bash "$temp/repo/examples/cloud-run/deploy.sh" > "$temp/output" 2>&1 || status=$?
  if [[ $scenario == none ]]; then
    [[ $status == 0 ]] || { cat "$temp/output"; exit 1; }
    jq -e '.phase == "complete" and .previousRevision == "previous" and (.images | length == 3) and (.executions | length == 4)' "$temp/repo/release-record.json" >/dev/null
    grep -q -- '--to-revisions=test-service-r123-1=100' "$LOG"
    grep -q -- '--no-traffic' "$LOG"
    grep -q -- '--container=frontend.*--container=backend' "$LOG"
    grep -q -- 'run jobs update.*--image=.*flyway@sha256:' "$LOG"
  else
    [[ $status != 0 ]] || { echo "Expected failure: $scenario" >&2; exit 1; }
    case $scenario in
      push) if grep -q 'run jobs update' "$LOG"; then exit 1; fi ;;
      migrate|validate) if grep -q 'run services update ' "$LOG"; then exit 1; fi ;;
    esac
    if [[ $scenario != public ]]; then
      if grep -q -- '--to-revisions=' "$LOG"; then exit 1; fi
    else
      jq -e '.phase == "public-smoke" and .previousRevision == "previous"' "$temp/repo/release-record.json" >/dev/null
    fi
  fi
  echo "Passed: $scenario"
done
