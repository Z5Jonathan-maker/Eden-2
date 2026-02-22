# Florida PA Gap Matrix (Execution Order)

## Principle
Build on current Eden flows. No feature removals. Add controls that improve claim defensibility, timeliness, and settlement outcomes.

## P0 (ship now)
1. Claim readiness + deadline watch
- Status: Implemented in this pass.
- API: `GET /api/claims/{claim_id}/florida-readiness`
- UI: surfaced in claim quick actions panel.

2. Evidence sufficiency checklist
- Required per file: policy, estimate, photo set, chronology note, carrier correspondence.
- Add claim-level score + missing evidence list.

3. Outbound communication QA gate
- Before send: verify claim #, date of loss, policy #, requested action, deadline.
- Block send or require override with reason.

## P1 (next)
4. Demand package builder
- Generate package manifest and export bundle.
- Include chronology + supporting artifacts + citation section.

5. Supplement strategy assistant
- Line-item rebuttal generation with evidence linking.
- Track response due targets after submission.

6. Coverage snapshot parser
- Parse declarations/endorsements into structured key terms.
- Highlight exclusion conflicts requiring counsel review.

## P2 (scale)
7. Negotiation workspace
- Offer/counteroffer history, argument library, outcome analytics.

8. QA/compliance dashboard
- Adjuster file scorecards: timeliness, completeness, documentation quality.

9. Client expectation automation
- Stage-based updates and required-client-action prompts.

## Implementation notes
- Legal guardrail: all deadline outputs marked as operational guidance, not legal advice.
- Observability: log all high-impact actions and overrides.
- Security: role-gate admin/legal-sensitive actions.
