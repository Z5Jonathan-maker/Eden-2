# Architecture Overview

## High Level
Eden is a full-stack web application designed for claims management and field operations. It follows a standard Client-Server architecture.

- **Frontend**: React Single Page Application (SPA)
- **Backend**: FastAPI (Python) REST API
- **Database**: MongoDB (NoSQL)
- **Authentication**: JWT (JSON Web Tokens)

## Frontend Architecture
Located in `frontend/`

### Tech Stack
- **Framework**: React 18
- **Build Tool**: Create React App (CRA) / Webpack
- **Routing**: React Router v6
- **State Management**: React Context + Hooks (`AuthContext`, `ThemeContext`)
- **UI Library**: Shadcn/UI (Radix Primitives + Tailwind CSS)
- **Maps**: React Leaflet
- **HTTP Client**: Axios (via `lib/api.js`)

### Structure
- `src/components/`: UI components. Large features (Adam, Harvest, University) have their own subfolders.
- `src/features/`: Feature-specific logic (currently used for `inspections`).
- `src/context/`: Global state providers.
- `src/lib/`: Shared utilities and API client.

## Backend Architecture
Located in `backend/`

### Tech Stack
- **Framework**: FastAPI
- **Runtime**: Python 3.11+
- **Database Driver**: Motor (AsyncIO for MongoDB)
- **Validation**: Pydantic v2

### Structure
- `server.py`: Application entry point. Configures FastAPI app, CORS, and Exception Handlers.
- `routes/`: API route definitions, organized by domain (e.g., `auth.py`, `claims.py`, `harvest_*.py`).
- `services/`: Business logic and external service integrations.
- `models.py`: Pydantic data models.
- `workers/`: Background tasks and schedulers.
- `utils/`: Helper functions.

## Data Flow

1. **User Interaction**: User interacts with React UI components.
2. **API Request**: Component calls `apiGet`/`apiPost` from `lib/api.js`.
3. **Authentication**: `api.js` attaches JWT token to headers.
4. **Routing**: FastAPI `server.py` routes request to appropriate `routes/` module.
5. **Controller Logic**: Route handler validates input (Pydantic), checks auth dependencies.
6. **Service Layer**: Route calls `services/` or directly interacts with Database.
7. **Database**: Motor client executes async queries against MongoDB.
8. **Response**: Data is returned as JSON, validated by response models.

## Key Domains
- **Harvest**: Field operations, territory management, gamification.
- **Claims**: Core claims processing workflow.
- **Adam**: QA automation and system health monitoring.
- **University**: Learning Management System (LMS) for agent training.
- **Eve AI**: AI assistant integration.
