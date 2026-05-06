#!/bin/bash
set -e

REGISTRY="${REGISTRY:-registry.k.pd.o}"
IMAGE_NAME="${IMAGE_NAME:-moviedb}"
TAG=$(date +%Y%m%d%H%M)
SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

IMAGE="${REGISTRY}/${IMAGE_NAME}:${TAG}"

echo "Building and pushing ${IMAGE}..."

docker buildx build --push --platform linux/amd64 -t "${IMAGE}" .

echo "Upgrading helm release..."
SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE}" \
  helm upgrade --install moviedb ./charts/moviedb \
  -f charts/moviedb/values.yaml \
  -f "secrets://charts/moviedb/values-secrets.yaml" \
  --set image.repository="${REGISTRY}/${IMAGE_NAME}",image.tag="${TAG}"

echo "Deployed ${IMAGE}"