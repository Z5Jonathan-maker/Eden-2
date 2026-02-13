# EDEN MyCard Master Prompt (React/CRA-Compatible)

Use this prompt when implementing or refining `/mycard` in the Eden React app.

## Objective
Upgrade `/mycard` into a production-ready digital business card system with:
- template differentiation
- live preview
- headshot upload + persistence
- license number validation
- share/distribution UX
- engagement tracking hooks
- feedback capture
- local draft restore
- backend persistence
- Google reviews panel
- tactical/HUD styling

## Implementation Rules
- Keep existing API contracts unless additive.
- Prefer modular components under `frontend/src/components/mycard/`.
- Preserve existing visual language and tactical theme.
- Add safe fallbacks for missing external integrations.
- Never block page render on analytics/reviews failures.

## Required Modules
- `TemplateSelector`
- `LivePreviewPanel`
- `HeadshotUploader`
- `ShareModal`
- `FeedbackModule`
- `EngagementPanel`
- `PerformanceSummary`
- `ReviewsPanel`
- `AnalyticsHooks`

## Required Backend
- `GET /api/mycard/me`
- `POST /api/mycard/create`
- `PUT /api/mycard/update`
- `POST /api/mycard/share-link`
- `GET /api/mycard/google-reviews`
- `POST /api/mycard/upload-headshot`

## Required Data Persistence
Persist and hydrate:
- `template_id`
- `profile_photo_url`
- `license_number`
- core profile fields
- analytics summary
- feedback records

## Verification Checklist
1. Login and open `/mycard`.
2. Confirm draft restore after refresh.
3. Upload headshot and verify persistent URL after save + refresh.
4. Save card and verify all fields rehydrate.
5. Open engagement tab and verify reviews panel handles:
   - configured response
   - unconfigured fallback
6. Open share modal and verify copy/send placeholders and tracker hooks.
