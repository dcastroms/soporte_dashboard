#!/usr/bin/env bash
set -euo pipefail
STAGE="${1:?usage: deploy-server.sh <qa|prod>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec serverless deploy --stage "$STAGE"
