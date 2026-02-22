# Backend Scripts

Utility scripts for Eden Claims Management System.

## Database Initialization

### `init_indexes.py`

Creates MongoDB indexes for optimal query performance.

**When to run:**
- First time deployment
- After database schema changes
- After upgrading to this version (one-time)

**How to run:**

```bash
cd backend
python scripts/init_indexes.py
```

**What it does:**
- Creates indexes on frequently queried fields
- Adds unique constraints (email, claim_id)
- Creates compound indexes for common query patterns
- Includes geospatial indexes for harvest/canvassing features

**Collections indexed:**
- `users` - email, id, role, is_active
- `claims` - claim_id, status, created_at, assigned_to, client_id
- `notes` - claim_id, author_id, created_at
- `documents` - claim_id, type, uploaded_at
- `inspection_photos` - claim_id, inspection_id, captured_at
- `supplements` - claim_id, status
- `harvest_pins` - user_id, territory_id, status, location
- `harvest_territories` - user_id
- `notifications` - user_id, read, created_at

**Performance impact:**
- Claim lookups: 10-100x faster
- List queries with filters: 5-50x faster
- Prevents full collection scans

**Safety:**
- Idempotent - safe to run multiple times
- Will skip if index already exists
- No data modification, only index creation

## Deployment Checklist

1. Deploy backend code
2. Run `python scripts/init_indexes.py`
3. Verify indexes: Use MongoDB Compass or:
   ```bash
   mongosh "your_mongo_url" --eval "db.claims.getIndexes()"
   ```
4. Monitor query performance in logs

## Future Scripts

- `migrate_data.py` - Data migration for schema changes
- `seed_test_data.py` - Populate test data for development
- `backup_db.py` - Database backup utility
