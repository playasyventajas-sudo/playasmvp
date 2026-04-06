#!/usr/bin/env bash
# Deploy Firebase + push GitHub (executar na raiz do projeto: bash scripts/deploy-and-push.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== 1/2 Firebase (build + deploy) ==="
npm run deploy:playas

echo ""
echo "=== 2/2 GitHub (remote playasmvp, branch main) ==="
git push -u playasmvp main

echo ""
echo "Concluído."
