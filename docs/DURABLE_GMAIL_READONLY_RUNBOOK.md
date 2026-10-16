# ALHARIR — Durable storage and Gmail read-only implementation
Status: **Neon Free project and empty tables have been created and SQL-tested. The Procurement app is NOT yet connected to Neon or real Gmail. Not production-ready.**

## Current infrastructure and decision

The existing Render Free web service stores synthetic demonstration data in ephemeral disk storage. Render Free PostgreSQL expires 30 days after creation and has no backups. Do not move real supplier correspondence to either. Owner-controlled Neon Free PostgreSQL is a potential zero-fee option, subject to current plan limits and account connection.

## Current Neon environment (created 2026-10-16)
- Organization: **Alharir**, Neon free plan.
- Project: **ALHARIR Procurement** (ID `autumn-term-62834759`).
- Region: **aws-eu-central-1 (Frankfurt)**.
- Default branch: `br-autumn-water-b9gzima9`.
- Database: `alharir_procurement`.
- Tables created: `alharir_state` and `alharir_secrets`, columns verified using information_schema.
- Initial state row (id=1, revision=0) created with empty requests, empty suppliers, empty quotes and empty Gmail replies.
- Actual database SQL transaction tested successfully with TEMP table create, write, update and read; TEMP table removed automatically.
- Confirmed business requests=0, quotes=0, messages=0, OAuth secrets=0 after the test. No real data imported.
- **No application DATABASE_URL is configured anywhere.** Do not copy it into the existing synthetic Render preview.
- No scheduled database backup/snapshot configured. Added `tools/db-backup.js` for owner-run AES-256-GCM encrypted export / verify without exporting OAuth secrets. Scheduling remains outstanding.

## Render Trial Connection Troubleshooting — 16 Oct 2026
A separate **Free Render service** has been created at:
- Dashboard: https://dashboard.render.com/web/srv-db944i59fdbs73eaip0g
- Service name: alharir-procurement-neon-trial
- Branch: feat/durable-storage-gmail-readonly (manual deploy, no auto deploy)
- Service status: **not live**. The most recent build passed 19/19 checks but startup reported `Persistent state startup failed: Invalid URL`. This is an invalid `DATABASE_URL` format, not an application test failure.

Safe owner-side remediation:
1. In Neon console, open the **ALHARIR Procurement** project. Select **render-integration-test** branch, **alharir_procurement** database and **alharir_trial_app** role; choose the pooled connection URI.
2. Copy only the entire single-line PostgreSQL URI, starting `postgresql://` and including its SSL parameters. Do **not** copy labels such as `Connection string details:` or `URI:`, quotes, Markdown formatting, spaces or line breaks.
3. Open **the new Render trial service > Environment** and replace the existing `DATABASE_URL` using the secret field. Never put its password in an issue/chat/commit.
4. The nonsecret Render checks are configured: `DATABASE_EXPECTED_ENDPOINT=ep-crimson-lake-b9bjhqpi`, `DATABASE_EXPECTED_ROLE=alharir_trial_app`, and `DATABASE_EXPECTED_NAME=alharir_procurement`. Both pooled and unpooled connection hostname variants for this same endpoint pass.
5. Deploy the development branch manually after updating the secret. Validate the authenticated `/api/storage/status` indicates `type: postgres` and `durable: true`.
6. Test a single explicitly fake purchase request and reload to prove DB persistence; do not import real vendor mail or enable Gmail in this trial.
7. The Neon default app role currently exposes CREATEROLE and CREATEDB flags despite table-specific rights. Tightening these directly was rejected by Neon (`permission denied to alter role`). This is **not acceptable for broad real-data production** until a genuinely least-privileged runtime identity is available and verified.

The persistent-store adapter now fails safely with `DATABASE_URL_invalid_format` for malformed strings, and explicitly rejects any mismatch in the expected branch endpoint, role and database. No credentials should appear in application logs.

## Implemented architecture

- persistent-store.js provides PostgreSQL-backed business JSON state with a monotonically increasing revision. Concurrent overwrites produce 409 conflict instead of silently losing an operator's changes.
- It initializes a blank procurement state, NEVER automatically copies data.json or stored demo data into business storage.
- Gmail OAuth credentials live encrypted (AES-256-GCM with authenticated associated data) in alharir_secrets, not in local Render disk. The secret encryption key is a separate private environment variable.
- The current Gmail client requests only the gmail.readonly permission. Production auto-send and autonomous agent actions are disabled.
- Mail metadata and original source timestamp are stored; production mail bodies are requested on demand and attachments streamed directly from Gmail, not archived to local Render storage.
- commercial-access.js enforces separate password-protected access for a non-demo deployment. This remains single-admin PILOT security, not staff RBAC.

## Required private configuration on a separate service

Configure these variables privately, never in GitHub or chat:
- PROCUREMENT_PRODUCTION=true
- STAGING_HOSTED=false
- STAGING_DEMO=false
- DATABASE_URL (owner's TLS-verified Neon Postgres connection string)
- OAUTH_ENCRYPTION_KEY (64 hexadecimal characters representing 32 random bytes)
- PRODUCTION_ACCESS_USER
- PRODUCTION_ACCESS_PASSWORD (24+ characters, separate from the demo password)
- PRODUCTION_READONLY_MAIL=true
- APP_BASE_URL (exact HTTPS base URL for the new protected service)
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from the owner's Google Cloud OAuth Web client
- NODE_ENV=production
- MARKET_ENABLE_LIVE_SEARCH=false until separately approved.

No paid service or new live instance is created from this branch.

## Google account owner tasks

1. Create or connect the company-controlled Neon project, obtain its Postgres connection string (keep it private).
2. In Google Cloud: configure the OAuth consent screen, enable Gmail API and create a Web application client. Redirect URI is the new production service's HTTPS origin followed by /api/gmail/callback.
3. Google Gmail API gmail.readonly is a RESTRICTED scope. Verification/security assessment rules may apply. Test-mode external OAuth refresh tokens can expire after 7 days. Confirm the intended compliance exception and production scope before relying on long-term access.
4. Sign into the protected production service personally, review and approve Google's Gmail read-only consent screen. The ChatGPT Gmail connection is NOT a Procurement OAuth authorization.
5. Check /api/storage/status and /api/gmail/status. Run one controlled /api/gmail/sync and verify the source date, supplier, RFQ match and a harmless PDF attachment opened from the system.
6. Review unmatched messages manually; never assume a product listing proves a supplier identity or assume a Gmail attachment is a verified offer.

## Backup and safety

- Never commit credentials, downloaded mail or backup files to GitHub.
- Google remains the source of email/attachments. Attachment retrieval depends on OAuth remaining valid.
- Owner-controlled encrypted backups must be scheduled and restore-tested to a second database before routine business usage.
- Full employee RBAC, write auditing, backup/restore verification and Google's restricted-scope compliance remain mandatory before broad production rollout.
- The existing synthetic Render demo must remain isolated and unchanged.

## Acceptance gates

Already implemented: PostgreSQL state revision control, AES-GCM OAuth vault, guarded HTTPS live mode, conservative mail storage and on-demand Gmail message retrieval.

Still outstanding: configure application credentials for the newly-created owner Neon project; verify application-driver live database round-trip; separate protected non-demo deployment; Google Cloud OAuth consent; real harmless message/attachment read test; backups/restore drill; employee RBAC.

Official documentation:
- https://render.com/docs/free
- https://neon.com/pricing
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/
