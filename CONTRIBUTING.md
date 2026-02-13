# Contributing to Eden 2

Welcome! This guide will help you get started contributing to Eden 2.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB 6.0+

### Setup (5 minutes)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your values
uvicorn server:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.example .env  # Set REACT_APP_BACKEND_URL
npm start
```

**Initialize Database:**
```bash
cd backend
python scripts/init_indexes.py  # Create indexes (one-time)
```

## 📁 Project Structure

```
/backend/
  /routes/          # API endpoints
  /services/        # Business logic
  /utils/           # Utilities (aggregations, helpers)
  /scripts/         # Database scripts, utilities
  models.py         # Pydantic models
  server.py         # FastAPI app

/frontend/
  /src/
    /components/    # UI components (to be organized by feature)
    /hooks/         # Custom React hooks
    /lib/           # API client, utilities
    /services/      # API services
    /context/       # React Context (Auth, Theme)
```

## 🎯 Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

**Code Style:**
- Run `npm run format` before committing (Prettier)
- Run `npm run lint:fix` to fix linting issues
- Follow existing patterns in the codebase

**Naming Conventions:**
- Components: PascalCase (e.g., `ClaimDetails.jsx`)
- Files: camelCase (e.g., `claimsApi.js`)
- Functions: camelCase (e.g., `fetchClaims`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_URL`)

### 3. Test Your Changes

**Backend:**
```bash
cd backend
pytest  # Run all tests
pytest tests/test_claims.py  # Run specific test
```

**Frontend:**
```bash
npm test  # Unit tests
npm run e2e  # End-to-end tests
```

### 4. Commit Your Changes

**Commit Message Format:**
```
type(scope): short description

Longer description if needed

- Bullet points for details
- Multiple lines OK

Co-Authored-By: Your Name <you@example.com>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance, dependencies

**Examples:**
```
feat(claims): Add bulk claim import

- Support CSV and Excel formats
- Validate data before import
- Show progress indicator

fix(auth): Cookie SameSite for cross-domain

Production uses samesite='none' for Vercel↔Render cookies
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## 🧪 Testing Guidelines

### Unit Tests
- Test business logic
- Test custom hooks
- Test utility functions
- Aim for 80% coverage

### Integration Tests
- Test full user flows
- Test API endpoints end-to-end

### E2E Tests
- Test critical user paths
- Login, Claims CRUD, Payments

## 🏗️ Architecture Guidelines

### Backend

**Route Structure:**
```python
# routes/claims.py
@router.get("/claims/{claim_id}")
async def get_claim(claim_id: str, user: dict = Depends(get_current_user)):
    # 1. Validate access
    # 2. Fetch data (use aggregations for multiple collections)
    # 3. Return response
```

**Use Aggregations for N+1 Queries:**
```python
# ❌ Bad: Multiple queries
claim = await db.claims.find_one({"id": claim_id})
notes = await db.notes.find({"claim_id": claim_id})
docs = await db.documents.find({"claim_id": claim_id})

# ✅ Good: Single aggregation
from utils.claim_aggregations import get_claim_with_full_details
result = await get_claim_with_full_details(db, claim_id, include_notes=True)
```

### Frontend

**Component Size:**
- Keep components under 200 lines
- Extract complex logic to custom hooks
- Break large components into smaller ones

**State Management:**
- Use React Context for global state (Auth, Theme)
- Use `useState` for local component state
- Use custom hooks for complex state logic

**API Calls:**
```javascript
// Use the centralized API client
import { apiGet, apiPost } from '@/lib/api';

// ✅ Good
const result = await apiGet('/api/claims/');
if (result.ok) {
  setClaims(result.data);
}

// ❌ Bad: Don't use fetch() directly
const res = await fetch(API_URL + '/api/claims/');
```

## 🚫 Common Pitfalls

### Security
- ✅ Never commit `.env` files
- ✅ Never expose sensitive data in errors
- ✅ Always validate user input (Pydantic models)
- ✅ Check permissions on protected routes

### Performance
- ✅ Use database indexes
- ✅ Use aggregation pipelines for complex queries
- ✅ Lazy load large components
- ✅ Memoize expensive calculations

### Code Quality
- ✅ Remove unused code (don't comment it out)
- ✅ Delete unused imports
- ✅ No `console.log` in production code
- ✅ Handle errors gracefully

## 📚 Helpful Resources

### Documentation
- [Backend API Docs](http://localhost:8000/docs) (when running locally)
- [Architecture Overview](./ARCHITECTURE.md)
- [Security Migration Guide](./SECURITY_MIGRATION.md)
- [Developer Excellence Roadmap](./DEVELOPER_EXCELLENCE_ROADMAP.md)

### Tools
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [Radix UI Components](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 🐛 Reporting Issues

**Good Issue:**
```markdown
**Bug**: Login fails with 401 after successful registration

**Steps to Reproduce:**
1. Navigate to /register
2. Fill in form with test@example.com
3. Submit registration
4. Click "Login" link
5. Enter same credentials
6. Click "Log In"

**Expected**: User should be logged in
**Actual**: 401 error, "Invalid credentials"

**Environment:**
- Browser: Chrome 122
- OS: Windows 11
- Backend: local (http://localhost:8000)

**Screenshots:** [attached]

**Additional Context:**
Works fine if I refresh the page before logging in.
```

## 🤝 Getting Help

- **Questions?** Open a GitHub Discussion
- **Bug?** Open an Issue with reproduction steps
- **Feature Idea?** Open an Issue tagged as "enhancement"
- **Urgent?** Tag with "urgent" label

## 🎉 Your First PR

Not sure where to start? Look for issues labeled:
- `good-first-issue` - Easy wins for newcomers
- `help-wanted` - Features we'd love help with
- `bug` - Fixes needed

Thank you for contributing to Eden 2! 🚀
