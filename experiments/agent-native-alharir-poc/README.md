# ALHARIR × Agent-Native — isolated integration experiment

**Purpose:** evaluate the REAL upstream @agent-native/core package with ALHARIR procurement Shared Actions. The directory is deliberately isolated from the production `server.js`, Gmail OAuth, and `public/` of Procurement.

## Boundaries
- ALL RFQ, quotes and suppliers are synthetic (`.example` contacts).
- Zero credentials, no API keys, no actual emails, no payment operations and no production data access.
- Financial values are represented as integer cents. Ineligible EXW, mismatched, and incomplete offers cannot win.
- No migration or automatic production integration. Do NOT deploy publicly until auth, RBAC, approval gateway and source-data trust boundaries have been verified.
- Only two read-only Shared Actions are installed into Agent-Native. Approval/send remains a locally tested **simulation**, not an agent tool.

## Local deterministic test
`node --test tests/engine.test.mjs`

## Upstream framework integration
Node **24** + npm + pnpm/corepack + network access are required. Run:
`bash scripts/scaffold-and-build.sh`

The script creates a **new temporary directory**, uses the official `@agent-native/core@0.209.1` standalone `chat` starter, copies the two actions, shared engine and RTL Procurement route, installs dependencies and compiles a real Agent-Native app. It does not touch this repository's primary app. The `/procurement` route calls the same `compare-quotations` Shared Action as the agent.

## What counts as a pass
1. Deterministic Node tests pass.
2. Official scaffold and `pnpm build` pass on GitHub Actions.
3. Further browser/agent/authorization checks are **not** proven by compile alone; actual agent calls require separately configured model credentials and approvals.

## CI
`.github/workflows/agent-native-poc.yml` runs on this branch and relevant changes. The build job uses only GitHub Actions runner, without paid external services.

Upstream source: https://github.com/BuilderIO/agent-native (package version 0.209.1, API based on `defineAction`).
