# Market price discovery — evidence-first POC

Status: **offline tests passed; live provider not yet accepted**. This is not a production-verified sourcing agent.

## Goal and limitations
- Obtain *indicative*, non-binding wholesale prices from **indexed, public search snippets**, not direct scraping of Alibaba/1688/Taobao pages.
- Never bypass CAPTCHA, rate limits, logins, or platform restrictions.
- Preserve link, platform, currency, numeric price, and unit (when explicit).
- No benchmark if no explicit USD/unit evidence; never mix CNY, whole-project totals, piece and sqm prices.
- Even with a snippet-based benchmark, **technical comparability, MOQ, Incoterm, seller validity and actual price are not verified**. Review each URL before using results in a commercial decision.
- Indexed text can be stale or truncated, and sites can be missing from the search engine index.

## Current implementation
- market-price-core.js: explicit currency/unit extraction, URL-domain checks, conservative benchmark, generic product queries.
- market-index-search.js: provider adapter with Brave Search API when BRAVE_SEARCH_API_KEY is supplied, otherwise an existing Google Custom Search JSON API configuration. No keys means honest search-not-configured, not simulated "live".
- server.js: POST /api/requests/:requestId/market-scan; labels indicative results for review, uses max 3 provider requests per scan by default, caches each provider query in memory for 30 minutes (until process restart). The 1688 source is included among the first three targets. Provider errors and query-count information are returned.
- Existing localhost:8790 and localhost:8791 specialty proxy endpoints are untouched and must be tested independently. They are not guaranteed to be running.

## Zero-spend verification
Run using Node.js >=18:

    node --test test/market-price-core.test.js test/market-index-search.test.js

No API key, credit card, paid subscription or external web access is needed for these offline tests.

## Optional live search (requires separate user action)
For Brave, create a Brave Search API account, confirm its spend controls and obtain a Search API key, then set BRAVE_SEARCH_API_KEY in the server process environment. **Do not commit credentials**. Brave currently advertises $5 monthly credits; credit-card verification may still be required, so there is no claim that signup is frictionless or possible without financial information. See https://api-dashboard.search.brave.com/documentation/pricing and https://api-dashboard.search.brave.com/documentation/resources/help-feedback .

If you already have a valid Google Custom Search JSON API key and CSE ID, legacy GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID remain a temporary fallback. Google has announced that these integrations need transition by January 1, 2027: https://programmablesearchengine.googleblog.com/2026/01/updates-to-our-web-search-products.html . Do not acquire a new Google account/key as a long-term solution.

Optional MARKET_MAX_SEARCH_QUERIES accepts an integer from 1 to 6 (default 3). To eliminate surprise charges, configure provider-side hard spend limits as well; an application cap is not a provider billing guarantee. Do not expose the key to browsers.

## Real-world acceptance test (not done yet)
1. Select 5 dissimilar products and exact quantities/specifications from the user.
2. Run a real provider with its approved credentials and record API cost, elapsed time and per-platform coverage.
3. Confirm at least two independently sourced, relevant price observations for each test product (or document genuine unavailable-price cases).
4. Inspect product pages manually to validate price units, dimensions, quantity tiers and updated prices. Identify mismatches rather than hiding them.
5. Test retries/provider errors, empty results, and operation with exhausted quota.
6. Only after these pass: deploy and perform user acceptance, then consider merging to main.

**Security note:** The existing Procurement app is documented as local/development only; it needs separate authentication/session/secret hardening before public deployment. Do not use its current network endpoints as publicly exposed services.
