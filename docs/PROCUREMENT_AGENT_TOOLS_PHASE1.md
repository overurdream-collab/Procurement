# ALHARIR Procurement — AI agent tools, phase one
This is a tool-only, **deterministic preview**. There is **NO model/LLM connection**, no real autonomous agent and no API spend.

## Reuses original Procurement code
- Request facts: existing request state (per request)
- Analysis: request-intelligence.js
- Supplier search planning: market-unified.js manualSearchLinks (NO live web calls)
- Linked suppliers: existing selectedSupplierIds/associatedRequestId, filtered to the request
- Price checks: procurement-reports.js priceAnalysis; rejects unverified/EXW/mismatched quotes
- Supplier outreach: market-leads.js outreachDrafts; returns unsent text requiring explicit review
- Report: procurement-reports.js dailyReport

Seven allowlisted read-only/preview tools, four fixed plans: overview, sourcing, quotations, full_review.
No Gmail, external search provider, create/approve/send/delete/award, background scheduler, database writes or Python/JS arbitrary execution.

## Security and activation
The authenticated HTTP endpoint GET /api/requests/:id/agent/preview?task=overview remains 404 unless private AGENT_TOOL_PREVIEW_ENABLED=true. Existing protected-service Basic Auth applies. Cache-Control is private, no-store. It is for **manual review** only.
There is a new preview control in the **existing** request workspace; it displays tool outputs as escaped plain text (not HTML) and provides no send button.
Run artifacts returned in HTTP response include a step-by-step trace; there is **no durable audit log yet**, which must be added before any write-capable agent.
No supplier email, market listing or text from a document may be treated as instructions for the agent. All candidate suppliers are unverified until inspected by an operator.

## Test
- node --test test/procurement-agent-tools.test.js test/procurement-agent-http.test.js
- npm test
- GitHub Actions verifies both. Local tests use synthetic database data and a locally started password-protected Node HTTP service.

## Deployment status and next phase
No Render or Neon changes; do not merge/deploy phase one without owner approval.
Stage two requires a user-approved model API provider, billing ceilings, actual model tool-calling schema validation, user RBAC, durable run audit, rate limits and explicit per-message approvals. This is intentionally not implemented as an AI model yet.
