#!/usr/bin/env bash
# Updates an EXISTING Cloud Run service and Flyway Job, preserving their settings.
set -euo pipefail
cd "$(dirname "$0")/../.."

for name in GCP_PROJECT_ID GCP_REGION ARTIFACT_REPOSITORY SERVICE_NAME FLYWAY_JOB_NAME PUBLIC_ORIGIN RELEASE_SHA RELEASE_ID; do
  [[ -n ${!name:-} ]] || { echo "Missing $name" >&2; exit 2; }
done
[[ $RELEASE_SHA =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ $RELEASE_ID =~ ^r[0-9]+-[0-9]+$ ]] || exit 2
[[ $SERVICE_NAME =~ ^[a-z][a-z0-9-]*$ && ${#SERVICE_NAME}+${#RELEASE_ID} -lt 63 ]] || exit 2
[[ $PUBLIC_ORIGIN =~ ^https://[a-zA-Z0-9.-]+$ ]] || exit 2
for tool in gcloud docker jq curl; do command -v "$tool" >/dev/null; done

common=(--project="$GCP_PROJECT_ID" --region="$GCP_REGION" --quiet)
image_root="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPOSITORY}"
revision="${SERVICE_NAME}-${RELEASE_ID}"
# Only status and container names are fetched; DB configuration is never exported.
service=$(gcloud run services describe "$SERVICE_NAME" "${common[@]}" \
  --format='json(status,spec.template.spec.containers.name)')
jq -e '[.spec.template.spec.containers[].name] | sort == ["backend","frontend"]' <<<"$service" >/dev/null
previous=$(jq -er '[.status.traffic[] | select(.percent > 0)] | if length == 1 and .[0].percent == 100 then .[0].revisionName else error("Expected one current revision at 100%") end' <<<"$service")
[[ -n $previous && $previous != null ]] || exit 2
jq -n --arg commit "$RELEASE_SHA" --arg previous "$previous" --arg candidate "$revision" \
  '{commit:$commit, previousRevision:$previous, candidateRevision:$candidate, phase:"publishing"}' > release-record.json
record() {
  jq --arg phase "$1" '.phase=$phase' release-record.json > release-record.json.tmp
  mv release-record.json.tmp release-record.json
}
# Print recovery information before any mutation, even if a later command fails.
echo "Previous revision: $previous; candidate revision: $revision"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf 'Commit: %s\n\nPrevious revision: %s\n\nCandidate revision: %s\n' "$RELEASE_SHA" "$previous" "$revision" >> "$GITHUB_STEP_SUMMARY"
fi
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
backend_image='' frontend_image='' flyway_image=''
for component in backend frontend flyway; do
  docker push "$image_root/$component:$RELEASE_SHA"
  digest=$(gcloud artifacts docker images describe "$image_root/$component:$RELEASE_SHA" \
    --project="$GCP_PROJECT_ID" --format='value(image_summary.digest)')
  [[ $digest =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'Invalid image digest' >&2; exit 1; }
  printf -v "${component}_image" '%s' "$image_root/$component@$digest"
  jq --arg component "$component" --arg image "$image_root/$component@$digest" \
    '.images[$component]=$image' release-record.json > release-record.json.tmp
  mv release-record.json.tmp release-record.json
done

record migration
# Existing Job supplies DB settings, execution identity and Secret references.
# Updating its image is essential: it must contain this release's migration SQL.
gcloud run jobs update "$FLYWAY_JOB_NAME" "${common[@]}" --image="$flyway_image" \
  --tasks=1 --parallelism=1 --max-retries=0 --task-timeout=10m --format='value(metadata.name)'
for action in info migrate validate info; do
  execution=$(gcloud run jobs execute "$FLYWAY_JOB_NAME" "${common[@]}" --args="$action" --wait --format='value(metadata.name)')
  jq --arg action "$action" --arg execution "$execution" \
    '.executions += [{action:$action,name:$execution}]' release-record.json > release-record.json.tmp
  mv release-record.json.tmp release-record.json
done

record staging
# One revision contains BOTH images. Keep current traffic until smoke succeeds.
gcloud run services update "$SERVICE_NAME" "${common[@]}" \
  --no-traffic --tag="$RELEASE_ID" --revision-suffix="$RELEASE_ID" \
  --format='value(status.latestReadyRevisionName)' \
  --container=frontend --image="$frontend_image" \
  --container=backend --image="$backend_image"
candidate=$(gcloud run services describe "$SERVICE_NAME" "${common[@]}" --format='json(status)')
[[ $(jq -r '.status.latestReadyRevisionName' <<<"$candidate") == "$revision" ]] || { echo 'Candidate not ready' >&2; exit 1; }
candidate_url=$(jq -er --arg tag "$RELEASE_ID" --arg revision "$revision" \
  '.status.traffic[] | select(.tag == $tag and .revisionName == $revision) | .url' <<<"$candidate")
record smoke
bash examples/cloud-run/smoke.sh "$candidate_url"

record switching
gcloud run services update-traffic "$SERVICE_NAME" "${common[@]}" --to-revisions="$revision=100" --format='value(status.url)'
record public-smoke
bash examples/cloud-run/smoke.sh "$PUBLIC_ORIGIN"
record cleanup
# Tags retain candidate URLs/resources. Remove only this run's tag after success.
gcloud run services update-traffic "$SERVICE_NAME" "${common[@]}" --remove-tags="$RELEASE_ID" --format='value(status.url)'
record complete
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf '\nDeployment complete. Both images are recorded in the release artifact.\n' >> "$GITHUB_STEP_SUMMARY"
fi
