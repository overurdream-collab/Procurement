# Agent-Native evaluation — runnable ALHARIR UI pilot

## Scope and result

This experiment is **not a deployment or installation of the complete Agent-Native framework**. It tests adopting the smallest reusable MIT-licensed presentation-only unit, an adapted dashboard layout algorithm from \`BuilderIO/agent-native/packages/toolkit/src/dashboard/dashboard-layout.ts\`. Attribution remains in \`public/agent-native-layout.js\`.

Why not the whole runtime? Upstream \`@agent-native/toolkit/dashboard\` is React-based and its toolkit package has extensive dependencies and peer requirements (\`@agent-native/core\`, React 19, charting, design-system adapters and others). Procurement is already a working Node.js + plain JS app. Migrating the whole app just for dashboard panels duplicates auth, database state, business actions and build infrastructure.

Upstream sources: [Agent-Native README](https://github.com/BuilderIO/agent-native), [Toolkit docs](https://www.agent-native.com/docs/agent-native-toolkit/), and [Dashboard components](https://www.agent-native.com/docs/components/).

## Pilot implementation (isolated from production home)

- \`/agent-native-pilot.html\`: premium Arabic RTL responsive dashboard **in the same protected Procurement service**. Deliberately separate route; existing \`/\` homepage is untouched.
- \`/agent-native-layout.js\`: adapted MIT geometry algorithm, no React, no packages installed.
- \`/agent-native-pilot.js\`: read-only adapter against existing **GET** /api/state, /api/daily-report?audience=management, /api/price-comparison. No duplicated quote calculation, new state storage or agent action.
- Interactive supplier-search shortcut; RFQ scope and 7/30/90-day activity filters; eight KPI cards; procurement funnel; verification donut; timestamp-grounded activity/quotation trend; linked RFQ cards.
- Dynamic data is bound to actual protected endpoints and synthetic demo data in Render; **no invented suppliers, quote totals, savings or activities**. Charts show empty-state when evidence is missing.
- Reuses existing Basic auth, server static route and hosting. Exposes no unauthenticated data.
- Independent CI test includes source provenance, balanced layout, matching report KPIs, per-request filters, empty trend, interval boundaries, unique read-only API list, mobile/RTL markers and 401/200 real HTTP protection.

## Decision and production boundary

The pilot proves a limited **eject/adapt presentation unit** reuse strategy. It does **not** establish compatibility with full React \`@agent-native/toolkit\` runtime, agent actions, PGlite/PostgreSQL, user roles or concurrent employees. Those remain untested and should not be claimed as adopted.

The existing authoritative Procurement services must remain the single source of truth. If user testing finds the pilot UI beneficial, incorporate its layout, filtering and visual design into the **single existing homepage**, and continue a separate professional reports page. Do **not** convert users to a second, parallel procurement app.

No direct main merge, payment, credential distribution, automated supplier emails, WeChat automation or handling of real commercial data in this proof-of-concept.

## Exit/acceptance checks

1. All 5 required CI workflows pass, including dedicated staging preview and security gate.
2. Protected route and assets return 401 anonymously and 200 with staging credentials.
3. Staging GET /api/state, /api/daily-report and /api/price-comparison totals match pilot KPIs.
4. RTL and iPhone responsive geometry works; 7/30/90-day timeline never invents missing history.
5. No new provider, full React runtime, DB migration or secrets required.
6. Render live health remains intact after optional dedicated-route preview deployment.

Status: pilot files and automated contract tests authored; acceptance depends on latest CI and Render checks.
