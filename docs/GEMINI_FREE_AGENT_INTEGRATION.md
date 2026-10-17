# ALHARIR — Gemini Free API (synthetic-only tool calling)

## Goal
Connect a **real tool-calling LLM** to the existing Procurement seven-tool registry **without paid API billing, production supplier data, new Render services, or sending mail**.

**Pinned model:** `gemini-3.1-flash-lite` (Google Gemini API, free tier shown on Google's pricing page as of 2026-10-17). The code never accepts an arbitrary model ID. Google's free-tier API content **may be used to improve their products**, so the integration is strictly **synthetic-data-only**. Do **not** connect this free tier to ALHARIR's private supplier quotes, credentials, emails, personal messages or business negotiations.

Docs: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite
Pricing: https://ai.google.dev/gemini-api/docs/pricing
Regions: https://ai.google.dev/gemini-api/docs/available-regions
API key: https://aistudio.google.com/apikey

## Security activation (local synthetic demo only)
Prerequisites: create/verify a Google AI Studio API key **in a Free Tier project with billing not enabled**. Never paste the key into ChatGPT, GitHub, logs or front-end. Gemini free tier is not guaranteed for a paid/billing-enabled project; verify the project tier yourself.

Existing protected demo setup remains mandatory (not production):
```
STAGING_HOSTED=true
STAGING_DEMO=true
HOSTED_ACCESS_USER=<test user>
HOSTED_ACCESS_PASSWORD=<strong demo password>
AGENT_GEMINI_FREE_ENABLED=true
GEMINI_API_KEY=<the key, private environment only>
```
The bridge **refuses to run** if `PROCUREMENT_PRODUCTION=true`, if synthetic-demo mode is off, if the explicit toggle is missing, or if the key is absent. Do not set any of these variables on the production Render service. No production deployment has been initiated.

Use the existing request workspace (synthetic data only): choose **تحليل الطلب**, **خطة الموردين**, or **فحص العروض**, then click the Gemini button. The endpoint is an authenticated `POST /api/requests/:id/agent/free-ai` requiring an explicit action header, a fixed task ID (no free-form business text), and the existing protected test login.

Only seven read-only / preview tools exist. The model may choose among them, but cannot send mail, browse, write database data, issue purchase awards, approve suppliers or call arbitrary URLs. The adapter supports Gemini 3 thought signatures and API function response IDs. Unknown names and scopes fail closed.

## Hard application budgets
Up to **4 model API calls** / user action, **6 tool invocations**, and **25 seconds** per model execution; **15 actions/day and 2 actions/minute per Node process** (in-memory limits reset on restarts). The code does not retry a 429. **This is not a reliable billing cap:** project Free Tier/no-billing must be confirmed in AI Studio and Gemini's own quotas; in-memory limits are not durable.

## Tests and current state
- `node --test test/procurement-gemini-free.test.js test/procurement-gemini-http.test.js`
- `npm test` for the complete repository regression.
- All test responses from Gemini are **mocked**, so these demonstrate correct outgoing REST/function-calling structure, tool execution, safety boundaries and HTTP access—not a real call to Google or actual API key validation.
- The code is intentionally on a separate GitHub branch/PR. It is **not merged, not deployed** and **not yet connected to a real Google API key**.
