# Eden Codex Mode Guardrails

This repository is operated under strict production-safe constraints.

## Locked stack
- Frontend: React (Vercel)
- Backend: FastAPI (Render)
- Database: MongoDB Atlas
- Auth: Existing JWT implementation

Do **not** replace frameworks, rewrite architecture, or remove existing routes/models/APIs without explicit approval.

## Change policy
- Prefer additive-only changes.
- Keep API and document shape changes backward-compatible.
- If a proposed change affects auth, permissions, routing, API response shape, or stored document structure, mark it:

`REQUIRES APPROVAL — DO NOT IMPLEMENT`

## Product priorities
- Intel Hub: defensible Date of Loss discovery with explainable evidence.
- Harvest: reliable pin drop, turf drawing, assignment, and persistence through existing APIs.

## Delivery discipline
For every change:
1. List exact files modified.
2. Provide diffs/patches.
3. Explain what changed and why.
4. Provide verification commands and expected results.
5. Include rollback steps.
6. Document risks and safeguards.

## Deployment checklist
1. Commit with clear message.
2. Push to `origin master`.
3. Verify deployment health/smoke routes.
