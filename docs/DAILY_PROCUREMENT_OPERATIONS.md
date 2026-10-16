# ALHARIR Procurement — Daily Executive Dashboard & Bid-Leveling Release

## 1. Single RTL sidebar

The private app now has one navigation panel: daily dashboard/reports, requests, market intelligence, suppliers, replies, verified price comparisons, approvals, agent/safety, and mail connection. Creating a request and opening its workspace are actions rather than duplicate service pages. The former horizontal toolbar, mobile bottom bar, duplicated supplier-distribution cards in Market Intelligence, and legacy comparison/report rendering are no longer used.

On iPhone: tap **☰ القائمة** to open the drawer, then choose the service.

## 2. Real (deterministic) quotations comparison

Read endpoint: `GET /api/price-comparison?requestId=...`.

Quote ingestion: `POST /api/quotes/structured`. This stores a received quote as **not verified** until the operator reviews original evidence. Manual confirmation: `POST /api/quotes/:id/verify`, requiring an explicit note; recorded in activity log. Legacy arbitrary `POST /api/quotes` is disabled to prevent false "Verified Quote" records.

The engine requires *two different verified supplier quotations* with equal request, category, product specification or deliberate matching product key, price unit, currency, quantity, and **FOB port**, with positive unit prices. Missing/EXW/CIF/unverified or incomplete cold room technical metrics cannot enter a comparable benchmark. MOQ remains a separate constraint and is included in grouping if numeric. A price spread is never labeled achieved savings or purchase approval.

Current repository sample: one Emaar quote, 100/150mm PIR, USD 28.50 and USD 36.50 per m², EXW Samail — **excluded** from FOB comparisons. No price ranking is inferred from this quote alone.

## 3. Daily brief for management and buyers

Endpoints: `GET /api/daily-report?date=YYYY-MM-DD&audience=management|buyer&requestId=...`, `GET /api/system-status`.

Daily figures count actual request/quote/activity entries, by Sana'a (Asia/Aden) day. Sections include request pipeline, supplier count, verified quotations, comparable quote groups, daily achievements, risks, missing technical/commercial fields, priorities, and supported price-spread analysis.

Buyer mode omits internal activity text, approval details and supplier email addresses; both outputs need human review before sharing.

Dashboard actions: HTML download, print/save as PDF in the browser, native file sharing on eligible iPhone browsers (including WeChat if installed and available in share sheet). The app **does not auto-send WeChat reports** and **does not publish internal reports to the public ALHARIR site**.

## 4. Demo and integration limits

The Render Free staging service uses synthetic data with ephemeral storage, single-admin Basic Authentication, and does not operate on authentic business records. Gmail live-sync and sending are disabled in the hosted demo. Live product search requires an opted-in provider; PDF quote extraction is not yet automated. Every one of these appears with an explicit status in the daily dashboard.

**Do not accept as a production purchase system** until durable DB, per-employee access and approval signatures, secure uploads, controlled outbound mail, quote evidence review and real user-acceptance testing are complete.

## 5. Acceptance evidence

Dedicated tests: `test/procurement-reports.test.js`, `test/daily-dashboard-http.test.js` and existing sourcing/market/security tests. They use synthetic or mocked data; they establish deterministic math and UI/API wiring, not a live emailed supplier quotation or WeChat message.
