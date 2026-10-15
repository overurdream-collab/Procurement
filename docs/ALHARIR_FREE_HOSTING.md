# ALHARIR — Render Free staging launch (15 Oct 2026)

This staging branch prepares **two services in one Render account**, defined in [render.yaml](../render.yaml):

1. `alharir-public-site-preview` — static copy of the already-built ALHARIR sourcing website plus guide (no new content decisions).
2. `alharir-procurement-private-demo` — Node.js Procurement demo, accessible over HTTPS but *requires an administrator username and password on every private route*.

## Quick deploy

Open:

https://render.com/deploy?repo=https://github.com/overurdream-collab/Procurement/tree/alharir-free-hosting-poc

Review the two services and ensure the private web service uses **Free**. Supply `HOSTED_ACCESS_USER` and `HOSTED_ACCESS_PASSWORD` (minimum 16 characters) inside Render's secret input fields. Never paste these credentials in ChatGPT or commit them to GitHub. Do **not** approve a paid plan or add any payment method to enable extra usage.

After the services deploy, Render gives two different `onrender.com` HTTPS URLs. Open the static website URL in a normal browser. Open the private Procurement URL and verify browser basic authentication appears. A GET to `/api/state` without credentials must return **401**; `/health/live` intentionally returns only a generic health boolean.

## Important limitation / acceptance

**This is a protected synthetic-data demonstration only**, NOT a production business system:
- The hosted instance does **not** load the real `data.json` suppliers/quotes. It uses `staging-demo-data.json` copied to the temporary container filesystem.
- Email and follow-up sending integrations are disabled on the hosted demo.
- The temporary state will be **lost on sleep or redeploy**, which the Render Free service does automatically after inactivity. No business records should be entered until durable storage is configured.
- The hosted private app has **one administrator login** for evaluation, not employee-specific roles. Do not share this login as an employee authentication strategy. We must implement proper per-employee logins, roles and audit logging before enabling company use.
- Live sourcing search stays off (`MARKET_ENABLE_LIVE_SEARCH=false`) in the hosted demo. Test-only public indexed search is independently demonstrated in the existing GitHub Actions workflows.
- The Render service's URL may be discoverable, but access is password protected; it is **not a private network**. Never claim that the URL itself is private.
- Render Free spins down on idle and uses ephemeral storage. Review usage limits and set account spending controls. Render's free Postgres expires after 30 days; don't use it for lasting company data.

## After initial deployment

Only when the website renders, the staff login blocks anonymous access, and no commercial data is present should we consider this trial deployment successful. Production remains blocked pending verified durable storage, employee identities and permissions, security testing and user acceptance.

The existing GitHub Pages site remains unchanged. Note that GitHub Pages isn't licensed as free hosting for websites primarily conducting commercial transactions; move the public page to the Render static service when deployment is confirmed.

This branch is deliberately isolated from `main`. Neither public reports nor automatic syncing into the public website are enabled.


## Market Intelligence -> supplier shortlist -> RFQ (trial, 15 Oct 2026)

This is an integrated test workflow in the protected Procurement interface:
1. Open **Market Intelligence** and enter any product name. Real indexed listing discovery requires an explicitly enabled free search provider. Without one, no price or supplier result is invented.
2. Each source link is a **listing lead**, not proof of supplier company identity. Open the listing, identify the company yourself, and type its actual name.
3. Use **Search company website/email** on a selected lead. The backend searches indexed public contact pages when an API provider is configured. It returns candidate pages and emails with evidence URLs, always marked *not independently verified*. With no provider configured it offers manual search links instead.
4. Check only the suppliers you want to target (1–12 per draft); optionally enter a company email and its public evidence URL. Supplier contact data is not trusted until reviewed by a human.
5. Provide product details, technical specifications and quantity, then click **Create RFQ without sending**. This creates a request record and one supplier record for each selected company, preserving its source listing, official-site candidate, and contact-evidence link.
6. Open individual draft emails for manual review in the user's email client. The system never automatically sends messages or uses Gmail credentials in hosted demonstration mode.
7. Download a local JSON backup of the request, supplier shortlist, and drafts. The free staging instance uses **temporary demo storage**, reset on instance restart; do not use it as a permanent business database.

**Strict status semantics:** Search index metadata ≠ verified manufacturer, extracted email ≠ verified sales address, draft creation ≠ email sent, synthetic staging app ≠ durable operating system. We do not perform bulk unsolicited email sending or bypass CAPTCHA / login restrictions.

The new back-end endpoints are protected by the existing Basic authentication: POST /api/market-intelligence/search, POST /api/market-intelligence/contacts, POST /api/market-intelligence/convert, GET /api/requests/:id/outreach-drafts. Company research makes at most one additional search per selected candidate and obeys the free-search trial quota. Production rollout requires individual employee identities/roles, durable storage, and reviewed per-recipient outbound-mail approval.


## 16 Oct 2026 — Sidebar, verified quote comparison and executive daily reporting

The private demo now uses ONE right-hand sidebar for dashboard/daily reports, requests, Market Intelligence, suppliers, replies, price comparison, approvals, agent status, and Gmail status; request creation and workspace remain contextual actions. The duplicated top bar and redundant separate market search panels were removed from the rendered navigation. Mobile has a drawer with backdrop, desktop a visible sidebar.

**Quote comparison acceptance gates:** an offer is registered as received/pending evidence review; an operator must review the original document and explicitly attest before it is marked verified. The deterministic comparison requires the same RFQ, product description/comparison key and specification text, scope/category, currency, unit, quantity, MOQ and FOB port. EXW and unreviewed quotes remain excluded. A valid multi-supplier difference is labelled **bid spread, NOT realized savings**. Uploaded PDFs and Gmail attachments are not automatically parsed: staff must enter structured quotation lines from the original evidence.

**Daily reporting:** GET /api/daily-report?date=YYYY-MM-DD&requestId=&audience=management|buyer, with Sana'a business-day handling. Buyer reports omit internal activity and approval notes, individual quote IDs and detailed supplier offers. The private UI supports management/buyer scopes, full downloadable HTML, browser Print→Save as PDF, device share to WeChat when supported, and a compact Arabic WeChat-text brief with clipboard copy/text-file fallback. All shares are manual; no automatic messages are sent. GET /api/system-status gives truthful integration-readiness labels, including live search not configured, Gmail disabled in staging, ephemeral storage, and unavailable automatic WeChat/PDF ingestion.

**Tests:** GitHub Actions must pass business logic (including actual EXW exclusion), protected HTTP quote intake/verification and report responses, unique navigation links, buyer disclosure minimization, and WeChat brief formatting before deploying preview. The free Render preview remains **synthetic-data-only**. Do not use its temporary storage for genuine RFQs. Production prerequisites: durable storage, per-employee authorization and audit trail, source document attachment/integrity verification, optional actual search provider, and approved outbound mail workflow.
