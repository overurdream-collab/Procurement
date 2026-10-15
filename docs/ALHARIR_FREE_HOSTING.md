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
