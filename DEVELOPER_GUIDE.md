# Eden Claims Platform - Developer Guide

## Quick Start

### Prerequisites
- Node.js 18+ and Yarn
- Python 3.11+
- MongoDB 6.0+

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd eden-claims

# Setup backend
cd backend
cp .env.example .env
# Edit .env with your credentials
pip install -r requirements.txt

# Setup frontend
cd ../frontend
cp .env.example .env
# Edit .env with backend URL
yarn install
```

### 2. Start Services

```bash
# Terminal 1: Start MongoDB (if local)
mongod --dbpath /path/to/data

# Terminal 2: Start backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8001

# Terminal 3: Start frontend
cd frontend
yarn start
```

### 3. Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8001
- Health Check: http://localhost:8001/health

### 4. Test Credentials
- **Admin**: test@eden.com / password


## Project Structure

```
/app
├── backend/                 # FastAPI backend
│   ├── server.py           # Main entry point
│   ├── core.py             # Platform core utilities
│   ├── dependencies.py     # Shared dependencies
│   ├── auth.py             # JWT authentication
│   ├── routes/             # API route modules
│   │   ├── ai.py           # Eve AI assistant
│   │   ├── claims.py       # Claims CRUD
│   │   ├── inspection_photos.py
│   │   ├── canvassing_map.py
│   │   └── ... (30+ modules)
│   ├── tests/              # Backend tests
│   ├── uploads/            # File storage
│   ├── .env                # Environment variables
│   └── requirements.txt
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.js          # Route definitions
│   │   ├── lib/
│   │   │   ├── api.js      # HTTP client
│   │   │   ├── core.js     # Shared utilities
│   │   │   └── shared-ui.jsx # Shared components
│   │   ├── features/       # Feature modules
│   │   │   ├── inspections/
│   │   │   │   └── hooks/  # Custom hooks
│   │   │   ├── claims/
│   │   │   ├── eve/
│   │   │   └── contracts/
│   │   ├── components/     # UI components
│   │   │   ├── ui/         # Shadcn components
│   │   │   └── ...
│   │   └── context/        # React contexts
│   ├── .env
│   └── package.json
│
└── memory/                 # Project documentation
    ├── PRD.md              # Product requirements
    └── ITERATION_PLAN.md   # Development roadmap
```


## Architecture Patterns

### API Client
All API calls should use the centralized client in `/frontend/src/lib/api.js`:

```javascript
import { api, apiPost, apiPut, apiDelete, clearCache } from '../lib/api';

// GET request
const { ok, data, error } = await api('/api/claims/');

// POST request
const { ok, data } = await apiPost('/api/claims/', claimData);

// Clear cache after mutations
clearCache('/api/claims');
```

### Status Enums
Use standardized enums from `/frontend/src/lib/core.js`:

```javascript
import { CLAIM_STATUS, PIN_STATUS, CONTRACT_STATUS } from '../lib/core';

// In components
if (claim.status === CLAIM_STATUS.SUBMITTED) {
  // ...
}
```

### Shared UI Components
Use shared components from `/frontend/src/lib/shared-ui.jsx`:

```javascript
import { LoadingState, ErrorState, EmptyState, StatusPill } from '../lib/shared-ui';

// Loading
if (isLoading) return <LoadingState message="Loading claims..." />;

// Error
if (error) return <ErrorState message={error} onRetry={fetchData} />;

// Empty
if (items.length === 0) return <EmptyState title="No claims" onAction={createClaim} />;
```

### Custom Hooks (Inspections)
Use hooks from `/frontend/src/features/inspections/hooks/`:

```javascript
import { useCameraStream, usePhotoCapture, useInspectionPhotos } from '../features/inspections/hooks';

function CameraComponent() {
  const { isReady, startStream, stopStream, switchCamera } = useCameraStream();
  const { capturePhoto, showFlash } = usePhotoCapture();
  const { photos, uploadPhoto, isUploading } = useInspectionPhotos({ claimId });
  // ...
}
```


## Coding Conventions

### Backend (Python)
- Use Pydantic models for request/response validation
- Always exclude `_id` from MongoDB responses
- Use `datetime.now(timezone.utc)` for timestamps
- Import standardized errors from `core.py`

```python
from core import ValidationError, NotFoundError, now_iso, exclude_mongo_id

@router.get("/resource/{id}")
async def get_resource(id: str):
    doc = await db.resources.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise NotFoundError("Resource", id)
    return doc
```

### Frontend (JavaScript/React)
- Use Tailwind CSS for styling
- Use Shadcn components from `/components/ui/`
- Use the centralized API client
- Add `data-testid` attributes for testing
- Keep components under 300 lines

```javascript
// Good
<Button data-testid="submit-claim-btn" onClick={handleSubmit}>
  Submit
</Button>

// Bad - inline fetch
const res = await fetch(`${API_URL}/api/claims`, {
  headers: { Authorization: `Bearer ${token}` }
});
```


## Testing

### Run Backend Tests
```bash
cd backend
pytest tests/
```

### Run Linting
```bash
# Backend
cd backend
ruff check .

# Frontend
cd frontend
yarn lint
```

### Test API Endpoints
```bash
# Health check
curl http://localhost:8001/health

# Login
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@eden.com","password":"password"}'
```


## Environment Variables

### Required (Backend)
| Variable | Description |
|----------|-------------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `ENCRYPTION_KEY` | 32-char encryption key |
| `BASE_URL` | Domain for OAuth callbacks |

### Required (Frontend)
| Variable | Description |
|----------|-------------|
| `REACT_APP_BACKEND_URL` | Backend API URL |

### Optional (Integrations)
| Variable | Feature |
|----------|---------|
| `EMERGENT_LLM_KEY` | Eve AI assistant |
| `STRIPE_SECRET_KEY` | Payments |
| `REGRID_API_TOKEN` | Property data |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `SIGNNOW_CLIENT_ID/SECRET` | E-signatures |


## Debugging

### View Logs
```bash
# Backend logs
tail -f /var/log/supervisor/backend.err.log

# Frontend logs
tail -f /var/log/supervisor/frontend.err.log
```

### Check Service Status
```bash
sudo supervisorctl status
```

### Restart Services
```bash
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

### Debug MongoDB
```bash
mongosh
use eden_claims
db.claims.find().limit(5).pretty()
```


## Common Issues

### "Camera blocked in preview"
The camera is blocked when viewing in an iframe. Open the URL directly in a new browser tab.

### "Maximum call stack size exceeded"
Set `DISABLE_VISUAL_EDITS=true` in frontend/.env and restart.

### "Token expired"
Clear localStorage and login again:
```javascript
localStorage.removeItem('eden_token');
```

### MongoDB ObjectId errors
Always exclude `_id` from responses:
```python
await db.collection.find({}, {"_id": 0}).to_list(100)
```


## Feature Flags

Currently implemented features:
- ✅ Claims CRM (Garden)
- ✅ Eve AI Assistant
- ✅ Inspection Photos + Rapid Capture
- ✅ Harvest (D2D Canvassing)
- ✅ Contract Management
- ✅ Property Intelligence
- ✅ Weather Verification
- ✅ Florida Statutes Database
- ✅ Industry Experts Knowledge Base

Stub/Future features:
- ⚠️ Supplement Tracker (partial)
- ⚠️ Carrier Communication Log
- ⚠️ Deadline Engine


## Contributing

1. Create a feature branch from `main`
2. Follow coding conventions
3. Add tests for new functionality
4. Run linting before committing
5. Update documentation if needed
6. Submit a pull request
