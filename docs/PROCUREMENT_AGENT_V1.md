# Procurement Agent V1

Architecture for the first real procurement intelligence layer.

## Flow
RFQ -> Supplier -> Gmail -> Quote/Attachment -> Structured Quote -> Price Intelligence -> Risk Intelligence -> Missing Fields -> Approval -> Follow-up -> Comparison.

## Scope
V1 analyzes and normalizes quotations. It does not autonomously award suppliers or issue purchase orders.

## Intelligence modules
- Quote normalization for cold-storage procurement
- Price anomaly and normalization checks
- Technical/commercial/payment/delivery/supply-chain risk findings
- Missing-field detection
- Follow-up draft generation

## Human control
Sending RFQs/follow-ups, supplier exclusion, award and future PO actions remain behind approval policy unless explicitly enabled.

## Next integration
Connect Gmail reply/attachment ingestion to analyzeQuotation(), persist structured results, and expose them in the dashboard.
