#!/usr/bin/env bash
# One-time setup so GitHub Actions can deploy the server on pushes to
# production-live (.github/workflows/deploy-server.yml), without storing any
# Google Cloud key in GitHub (Workload Identity Federation).
#
# Creates:
#   - service account github-deployer (build images, update Cloud Run, run the
#     schema migration job; nothing else)
#   - workload identity pool "github" + provider "github-oidc" that only accepts
#     tokens from x1o-Here/stuttgart on refs/heads/production-live
#
# Run once, signed in as a project owner:  bash apps/server/scripts/setup-github-deploy.sh
# Safe to re-run: "already exists" errors on the create steps can be ignored.
set -uo pipefail

P=stuttgart-cf43e
N=1086590307586
REPO=x1o-Here/stuttgart
SA=github-deployer@$P.iam.gserviceaccount.com

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$P"

gcloud iam service-accounts create github-deployer \
  --display-name="GitHub Actions deployer (production-live)" --project "$P"

for role in roles/cloudbuild.builds.editor roles/run.developer roles/logging.viewer roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$P" --member="serviceAccount:$SA" --role="$role" --condition=None -q >/dev/null \
    && echo "granted $role"
done

# Upload the build source.
gcloud storage buckets add-iam-policy-binding "gs://${P}_cloudbuild" \
  --member="serviceAccount:$SA" --role=roles/storage.objectAdmin -q >/dev/null && echo "granted source bucket"

# Cloud Build, Cloud Run and the migration job all run as the default compute SA.
gcloud iam service-accounts add-iam-policy-binding "$N-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" --role=roles/iam.serviceAccountUser --project "$P" -q >/dev/null && echo "granted actAs"

gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions" --project "$P"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$REPO' && assertion.ref=='refs/heads/production-live'" \
  --project "$P"

gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$N/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" \
  --project "$P" -q >/dev/null && echo "bound GitHub to $SA"

echo "Done. Pushes to production-live that touch the server now deploy it."
