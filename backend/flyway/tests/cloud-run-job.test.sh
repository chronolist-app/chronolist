#!/usr/bin/env bash
# Offline argument/exit-code checks. Never calls the real gcloud or a database.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
script="$script_dir/../cloud-run-job.sh"
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
mkdir "$scratch/bin"
cat > "$scratch/bin/gcloud" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$GCLOUD_CAPTURE"
exit "${GCLOUD_TEST_EXIT:-0}"
EOF
chmod +x "$scratch/bin/gcloud"
export PATH="$scratch/bin:$PATH"
export GCLOUD_CAPTURE="$scratch/args"
export GCLOUD_TEST_EXIT=0
export GCP_PROJECT_ID=test-project GCP_REGION=asia-northeast1
export FLYWAY_JOB_NAME=test-flyway
export FLYWAY_SERVICE_ACCOUNT=flyway@test-project.iam.gserviceaccount.com
export FLYWAY_IMAGE="asia-northeast1-docker.pkg.dev/test-project/images/flyway@sha256:$(printf 'a%.0s' {1..64})"
export FLYWAY_URL='jdbc:mysql://db.invalid:4000/test?sslMode=VERIFY_IDENTITY&sessionVariables=a,b'
export FLYWAY_USER='test-user=one,two' FLYWAY_PASSWORD_SECRET=test-password:1
unset FLYWAY_URL_SECRET FLYWAY_USER_SECRET

assert_arg() {
  local arg
  while IFS= read -r arg; do
    [[ $arg != "$1" ]] || return 0
  done < "$GCLOUD_CAPTURE"
  echo "Missing expected argument: $1" >&2
  exit 1
}

expect_rejected() {
  local status=0
  rm -f -- "$GCLOUD_CAPTURE"
  "$@" > "$scratch/output" 2>&1 || status=$?
  if [[ $status == 0 || -e $GCLOUD_CAPTURE ]]; then
    echo 'Expected rejection before gcloud invocation.' >&2
    exit 1
  fi
}

bash "$script" deploy
assert_arg jobs
assert_arg deploy
assert_arg '--args=info'
assert_arg "--set-env-vars=^|^FLYWAY_URL=$FLYWAY_URL|FLYWAY_USER=$FLYWAY_USER"
assert_arg '--set-secrets=FLYWAY_PASSWORD=test-password:1'
assert_arg '--max-retries=0'
if [[ $(cat "$GCLOUD_CAPTURE") == *'--execute-now'* ]]; then
  echo 'deploy must not execute the Job.' >&2
  exit 1
fi

expect_rejected env -u FLYWAY_URL bash "$script" deploy
expect_rejected env -u FLYWAY_USER bash "$script" deploy
expect_rejected env -u FLYWAY_PASSWORD_SECRET bash "$script" deploy
expect_rejected env FLYWAY_URL='jdbc:mysql://db.invalid/test|FLYWAY_PASSWORD=oops' bash "$script" deploy
expect_rejected env FLYWAY_USER=$'test\nuser' bash "$script" deploy
expect_rejected env FLYWAY_URL=$'jdbc:mysql://db.invalid/test\r' bash "$script" deploy
expect_rejected env FLYWAY_PASSWORD_SECRET=test-password:latest bash "$script" deploy
expect_rejected env FLYWAY_IMAGE=asia-northeast1-docker.pkg.dev/test-project/images/flyway:latest bash "$script" deploy
expect_rejected bash "$script" clean
expect_rejected bash "$script" deploy unexpected

for action in info validate migrate; do
  env -u FLYWAY_URL -u FLYWAY_USER -u FLYWAY_PASSWORD_SECRET bash "$script" "$action"
  assert_arg execute
  assert_arg "--args=$action"
  assert_arg '--wait'
done

for action in deploy info validate migrate; do
  status=0
  GCLOUD_TEST_EXIT=23 bash "$script" "$action" || status=$?
  [[ $status == 23 ]] || { echo 'gcloud failure was not propagated.' >&2; exit 1; }
done

echo 'PASS: plain URL/user, password-only Secret, input rejection, execution waiting, failure propagation'
