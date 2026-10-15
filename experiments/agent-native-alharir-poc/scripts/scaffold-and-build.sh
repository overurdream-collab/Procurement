#!/usr/bin/env bash
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d)"
cd "$WORK_DIR"
echo "Scaffolding upstream Agent-Native chat template inside: $WORK_DIR"
npx --yes @agent-native/core@0.209.1 create alharir-native --standalone --template chat
cd alharir-native
mkdir -p src actions app/routes
cp "$HERE/src/procurement.mjs" src/procurement.mjs
cp "$HERE/actions/compare-quotations.ts" actions/compare-quotations.ts
cp "$HERE/actions/daily-report.ts" actions/daily-report.ts
cp "$HERE/app/routes/procurement.tsx" app/routes/procurement.tsx
corepack enable
pnpm install --no-frozen-lockfile
pnpm build
echo "Native framework build complete. No LLM/API credentials or Gmail were supplied."
