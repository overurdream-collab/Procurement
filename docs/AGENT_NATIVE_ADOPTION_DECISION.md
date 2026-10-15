# ALHARIR Procurement — Agent-Native adoption decision (16 Oct 2026)

## Decision: controlled pilot, no wholesale migration

We will evaluate [BuilderIO/agent-native](https://github.com/BuilderIO/agent-native) (MIT, currently beta) to prevent duplicate UI/agent feature development. We will **NOT** replace the existing Procurement Node.js backend, deterministic quote-evidence engine, RFQ/supplier records, hosted preview security, or report computations with a second framework instance.

Current stack: Node HTTP backend in server.js; HTML/CSS/JS frontend in public/; common /api endpoints; evidence-based pricing in procurement-reports.js; free Render synthetic hosted demo. Agent-Native offers React/TypeScript app surfaces, typed shared actions, database-backed state, agents, roles, toolkit/dashboard UI. These are useful but **not drop-in** for this app; adopting the full framework would also entail React build tooling and a migration to SQL-backed data. See official docs: https://www.agent-native.com/docs/what-is-agent-native/ and https://www.agent-native.com/docs/agent-native-toolkit/.

## Plan to avoid rebuilding twice

1. **Freeze core domain contracts:** Keep /api/state, /api/price-comparison, /api/daily-report, /api/market-intelligence/search, /api/market-intelligence/convert and existing quote-review endpoints as backend source-of-truth. Do not implement new fake calculators in React or agents.
2. **Create one isolated read-only UI pilot**, not a second procurement application: show interactive dashboard KPIs/charts and filtered daily management/buyer reports by calling those existing read-only APIs against *synthetic data only*. Evaluate Agent-Native Toolkit dashboard chart/cards, or use its visual patterns if technical integration requires replacing existing app infrastructure.
3. **Use typed action adapters, not two business engines.** An eventual agent action calls the existing backend domain service after authentication/authorization and audit checks; human UI and agent should invoke the same audited operation.
4. **No new database migration** and no extra public service/paid hosting for the pilot. Work on a branch only; do not alter main, current Render website, saved business records, or Gmail/WeChat sending.
5. **Run independent tests**: mobile RTL, every chart sourced from real API response (not hard-coded), zero repeated menu items, no mismatch between report KPI and dashboard KPI, monthly vs daily grouping, buyer redaction, auth, protected data, good load times, and original backend smoke/security tests.
6. Only after pilot evidence is reviewed decide whether an incremental React/Agent-Native interface is materially better than lightweight existing frontend. Do not declare adoption based on README screenshots.

## Technical gate: accept Agent-Native components only if all pass

- Works with existing authenticated Procurement /api JSON without copying business logic or database state.
- No unapproved real business data sent to any third-party model/cloud; local synthetic tests only.
- Arabic RTL mobile layout and brand-quality design are measurably improved.
- Current free Render deployment remains operational and no paid provider is needed.
- The existing quote-comparison constraints (verified evidence, same quantity/specs/unit/currency/FOB port) produce identical outputs.
- Buyer reports remain isolated from internal notes, private supplier documents and administrator-only metadata.
- No auto-email or WeChat dispatch, no credentials in source, and no permission bypass.
- Tests/CI pass, deployment can be rolled back to prior known-good service.

## Outcome if pilot fails

Continue the standalone Node/HTML frontend with a centralized sidebar, independently interactive dashboard charts, and dedicated reports. **Reusing Agent-Native ideas does not require adopting Agent-Native runtime**. Keep the design and domain contracts portable for future upgrade.

Status: **Decision recorded; pilot not yet implemented or verified.** This document is not approval of full framework migration.