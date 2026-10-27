#!/usr/bin/env bash
# Repository root or any other working directory can be used.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash backend/flyway/cloud-run-job.sh deploy|info|validate|migrate

Required for all commands:
  GCP_PROJECT_ID, GCP_REGION, FLYWAY_JOB_NAME
Additional variables for deploy:
  FLYWAY_IMAGE                 Artifact Registry image URI pinned to @sha256:...
  FLYWAY_SERVICE_ACCOUNT       Dedicated Job service account email
  FLYWAY_URL                   JDBC URL without credentials (ordinary environment variable)
  FLYWAY_USER                  Database username (ordinary environment variable)
  FLYWAY_PASSWORD_SECRET       Secret Manager secret-name:numeric-version

deploy creates/updates the Job with info as its default command; it does not run it.
info/validate/migrate execute the deployed image and wait for completion.
Do not run multiple executions against the same database concurrently.
EOF
}

action=${1:-}
case "$action" in
  -h|--help) usage; exit 0 ;;
  deploy|info|validate|migrate) ;;
  *) usage >&2; exit 2 ;;
esac
if [[ $# != 1 ]]; then usage >&2; exit 2; fi

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:?Set GCP_REGION}"
: "${FLYWAY_JOB_NAME:?Set FLYWAY_JOB_NAME}"

if [[ "$action" == deploy ]]; then
  : "${FLYWAY_IMAGE:?Set FLYWAY_IMAGE}"
  : "${FLYWAY_SERVICE_ACCOUNT:?Set FLYWAY_SERVICE_ACCOUNT}"
  : "${FLYWAY_URL:?Set FLYWAY_URL}"
  : "${FLYWAY_USER:?Set FLYWAY_USER}"
  # gcloud's default comma separator can occur in JDBC URLs. Use a custom
  # separator and reject it in values rather than silently splitting them.
  for name in FLYWAY_URL FLYWAY_USER; do
    if [[ ${!name} == *'|'* || ${!name} == *$'\n'* || ${!name} == *$'\r'* ]]; then
      echo "$name must not contain a pipe or newline." >&2
      exit 2
    fi
  done
  for name in FLYWAY_PASSWORD_SECRET; do
    if [[ ! ${!name:-} =~ ^[a-zA-Z0-9_-]+:[1-9][0-9]*$ ]]; then
      echo "$name must be a secret name and a numeric version (secret-name:1)." >&2
      exit 2
    fi
  done
  if [[ ! $FLYWAY_IMAGE =~ -docker\.pkg\.dev/.+@sha256:[a-f0-9]{64}$ ]]; then
    echo 'FLYWAY_IMAGE must be an Artifact Registry image URI pinned to a SHA-256 digest.' >&2
    exit 2
  fi
fi

command -v gcloud >/dev/null || { echo 'gcloud is required.' >&2; exit 127; }
common=(--project="$GCP_PROJECT_ID" --region="$GCP_REGION")
if [[ "$action" == deploy ]]; then
  gcloud run jobs deploy "$FLYWAY_JOB_NAME" "${common[@]}" \
    --image="$FLYWAY_IMAGE" \
    --service-account="$FLYWAY_SERVICE_ACCOUNT" \
    --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=10m \
    --cpu=1 --memory=512Mi \
    --args=info \
    --set-env-vars="^|^FLYWAY_URL=$FLYWAY_URL|FLYWAY_USER=$FLYWAY_USER" \
    --set-secrets="FLYWAY_PASSWORD=$FLYWAY_PASSWORD_SECRET"
else
  gcloud run jobs execute "$FLYWAY_JOB_NAME" "${common[@]}" \
    --args="$action" --wait
fi
