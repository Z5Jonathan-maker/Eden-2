# Backend Import Deploy Runbook

This activates the new claim import duplicate strategies in `backend/routes/data.py`:

- `skip`
- `auto_renumber`
- `update_blank_fields`

## 1. Deploy Backend Service

1. Open your backend host dashboard (Render service running Eden API).
2. Trigger deploy from the latest commit containing:
   - `backend/routes/data.py`
   - `backend/tests/test_data_import_duplicate_strategy.py`
3. Wait for deploy to finish and service health to be green.

## 2. Post-Deploy Smoke Check

Use an admin token and call:

`POST /api/data/import/claims` with multipart form:
- `file`: CSV/XLSX
- `dry_run`: `true`
- `duplicate_strategy`: one of `skip|auto_renumber|update_blank_fields`
- `import_mapping`: optional JSON mapping

Expected response must include:
- `duplicate_strategy`
- `updated`
- `would_import` (dry run)
- `row_report`

If these keys are missing, backend is still running old code.

## 3. UI Verification in Eden

1. Open `Data Ops`.
2. Select XLSX file.
3. Choose duplicate strategy from `Duplicates` dropdown.
4. Run `Dry Run With Mapping`.
5. Confirm summary includes:
   - `Updated`
   - `Duplicate Strategy`
6. Confirm no warning banner about old backend support.

## 4. Strategy Behavior Expectations

- `skip`
  - Existing `claim_number` rows are skipped.
- `auto_renumber`
  - Existing `claim_number` rows are imported with suffix like `-DUP-001`.
- `update_blank_fields`
  - Existing claims are updated only where current value is blank.
  - Existing non-blank values are preserved.
  - `estimated_value` updates only when existing value is `<= 0` and incoming is `> 0`.

## 5. Rollback

If issues occur:

1. Redeploy previous stable backend release.
2. In UI, set duplicate strategy to `skip` (safe fallback).
3. Re-run dry run to confirm expected counts before any live import.
