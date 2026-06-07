#!/bin/bash
set -euo pipefail

SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE}" sops edit helm/values-secrets.yaml
