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
- market-index-search.js: provider adapter prioritizing Tavily, then Serper, then Brave, then legacy Google CSE, but only if the live-search opt-in is set. No keys or an unset MARKET_ENABLE_LIVE_SEARCH flag means honest search-not-configured, not simulated "live".
- market-scan.js: testable indexed source collection and conservative benchmark rules; server.js exposes POST /api/requests/:requestId/market-scan; labels indicative results for review, uses max 3 provider requests per scan by default, caches each provider query in memory for 30 minutes (until process restart). The 1688 source is included among the first three targets. Provider errors and query-count information are returned.
- Existing localhost:8790 and localhost:8791 specialty proxy endpoints are untouched and must be tested independently. They are not guaranteed to be running.

## Zero-spend verification
Run using Node.js >=18:

    node --test test/market-price-core.test.js test/market-index-search.test.js test/market-scan.integration.test.js

No API key, credit card, paid subscription or external web access is needed for these offline tests. The integration test injects *simulated search-index responses*; it does not claim live marketplace access.

## Optional live search (requires separate user action)
Live search is **disabled by default even if credentials are present**. Activation needs MARKET_ENABLE_LIVE_SEARCH=true in the server environment and explicit owner approval. Do not enable until provider-side spend controls are set.

**Recommended $0 / no-card option:** Tavily Researcher advertises 1,000 API credits per month (basic search costs 1 credit) with no credit card. Register at https://app.tavily.com/ and set TAVILY_API_KEY in server environment (never in GitHub), plus MARKET_ENABLE_LIVE_SEARCH=true when authorized. Official references: https://tavily.com/pricing and https://docs.tavily.com/documentation/api-reference/endpoint/search .

**Alternative:** Serper advertises 2,500 free search queries at signup without a credit card; set SERPER_API_KEY instead. It uses public Google search indexing. See https://serper.dev/ . Trial results may differ in 1688 indexing and real-time freshness.

**Secondary option, needs a payment method for identity verification:** For Brave, create a Brave Search API account, confirm its spend controls and obtain a Search API key, then set BRAVE_SEARCH_API_KEY in the server process environment. **Do not commit credentials**. Brave currently advertises $5 monthly credits; credit-card verification may still be required, so there is no claim that signup is frictionless or possible without financial information. See https://api-dashboard.search.brave.com/documentation/pricing and https://api-dashboard.search.brave.com/documentation/resources/help-feedback .

If you already have a valid Google Custom Search JSON API key and CSE ID, legacy GOOGLE_CSE_API_KEY + GOOGLE_CSE_ID remain a temporary fallback. Google has announced that these integrations need transition by January 1, 2027: https://programmablesearchengine.googleblog.com/2026/01/updates-to-our-web-search-products.html . Do not acquire a new Google account/key as a long-term solution.

Optional MARKET_MAX_SEARCH_QUERIES accepts an integer from 1 to 6 (default 3). To eliminate surprise charges, configure provider-side hard spend limits as well; an application cap is not a provider billing guarantee. Do not expose the key to browsers.

## Real-world acceptance test (not done yet)
1. Select 5 dissimilar products and exact quantities/specifications from the user.
2. Run a real provider with its approved credentials (prefer Tavily or Serper free tiers) and record API credits, elapsed time and per-platform coverage.
3. Confirm at least two independently sourced, relevant price observations for each test product (or document genuine unavailable-price cases).
4. Inspect product pages manually to validate price units, dimensions, quantity tiers and updated prices. Identify mismatches rather than hiding them.
5. Test retries/provider errors, empty results, and operation with exhausted quota.
6. Only after these pass: deploy and perform user acceptance, then consider merging to main.

**Security note:** The existing Procurement app is documented as local/development only; it needs separate authentication/session/secret hardening before public deployment. Do not use its current network endpoints as publicly exposed services.

## October 15 real live no-card search experiment

The workflow `.github/workflows/live-market-search-probe.yml` started a local SearXNG instance on a GitHub-hosted runner and executed five *genuine* internet index searches from the Procurement code (not mock results). Job: https://github.com/overurdream-collab/Procurement/actions/runs/38766957324 . It returned 195 indexed links across five product categories and 2 matching marketplaces (Alibaba and Made-in-China), but just one source with an explicit USD unit price among the saved subset; some source snippets had other unverified currency/price formats. 1688 did not appear in accepted results. Therefore the finding is **real discovery works, multi-product benchmark does not yet meet acceptance**. The archive contains raw captured links and snippet-derived prices and is available from the workflow for seven days.

Following this experiment, a stricter product token/size/refrigerant relevance filter was added. Mismatched listing URLs may still be presented as unverified sources, but cannot contribute to the benchmark. Result lists were capped per provider search request, preventing inflated counts when an engine returns more than requested.

## No-card local SearXNG startup

Configure a private SearXNG Docker container binding port `8888` on `127.0.0.1` (never `0.0.0.0`), with `ops/searxng/settings.yml` mounted to `/etc/searxng/settings.yml`, a generated secret via `SEARXNG_SECRET`, and the official `searxng/searxng` image. Set in the Procurement server environment: `SEARXNG_URL=http://127.0.0.1:8888/`, `MARKET_ENABLE_LIVE_SEARCH=true`, `MARKET_MAX_SEARCH_QUERIES=3`. JSON must be enabled in the SearXNG settings. No provider key or credit card is required, though real hosting capacity and existing platform quotas may apply. Stop the SearXNG container when finished. Be aware SearXNG's upstream search engines can block/rate-limit even legitimate low-rate indexing queries.
