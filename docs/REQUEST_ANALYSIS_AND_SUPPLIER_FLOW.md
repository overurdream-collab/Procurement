# ALHARIR Procurement — Request analysis and supplier sourcing fix

## Status
Isolated implementation branch based on `feat/durable-storage-gmail-readonly`. This is **not deployed** and requires explicit approval for merging/deployment. Existing Render + Neon + Gmail production state is unchanged.

## Implementation
1. `GET /api/requests/:id/analysis` uses the original request record to return:
   - extracted (not invented) technical fields, quantity, FOB/currency, category
   - missing technical/commercial fields and quotation comparability conditions
   - supplier segment and one request-specific search query
   - live-search provider status, without making a provider request.
2. The Market Intelligence button now obtains this analysis before searching, shows missing requirements and filters the search query by the analyzed product type. It uses the **existing** `/api/market-intelligence/search` endpoint; no new provider or server has been created.
3. Request workspace shows the same read-only analysis alongside the established, evidence-based verified quote analysis.
4. Individual RFQ drafts show the entire recipient, subject and body and require a deliberate checkbox before opening the user's email client. This **does not send** mail, does not verify the address automatically and is not a server-side authorization for future sending.
5. Strict segregation: complete cold rooms must not be treated as standalone PIR panel orders merely because the room design mentions panels.

## Honest limitations
- The analyzer uses deterministic rules, **not** a connected LLM, and makes no claim of autonomous AI reasoning.
- Search **cannot return live companies** unless `MARKET_ENABLE_LIVE_SEARCH=true` and a preapproved search provider is configured privately. An absent provider returns an explicit status and manual source links, not invented leads.
- Supplier web listings, claimed emails and prices are unverified and require human validation. Market discovery cannot confirm factory identity from an index snippet.
- No new mail-sending ability is introduced. Production Gmail read-only remains enforced. No bulk send. Existing `/api/agent/run` is blocked by production access gate.
- Extraction of PDF/Excel offers, real model-backed analysis, supplier source verification, full employee RBAC and genuinely approved outbound Gmail remain separate work.
- No sensitive data, private credentials, external paid search, public deployment or schema migrations.

## Test evidence
GitHub Actions: [Procurement Request Analysis Tests](https://github.com/overurdream-collab/Procurement/actions/runs/39004884911)
- Node syntax, 9 analysis/API tests, 7 existing RFQ procurement tests, and 101 repository regression tests: **all passed**.
- Tests use local synthetic suppliers or mocked external search results, not real company contacts.
- Next acceptance milestone requires manual review of the UI on iPhone and a user-approved search provider/live deployment path.
