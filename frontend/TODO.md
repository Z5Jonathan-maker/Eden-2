# Remaining Functional Bugs & TODOs

## UI/UX
- [ ] **PerformanceConsole.jsx**: Mock data is currently used in `PerformanceOverview`. Connect to backend API.
- [ ] **Adam Component**: Refactor `Adam.jsx` to be inside `components/adam/` to avoid circular dependencies and improve organization.

## Backend
- [ ] **Missing Tests**: Many routes lack comprehensive unit tests.
- [ ] **Dependency Injection**: Some services are instantiated directly instead of using FastAPI's dependency injection system.

## Code Quality
- [ ] **Type Safety**: Frontend lacks TypeScript. Consider migrating critical paths to TS.
- [ ] **Linting**: Setup ESLint and Prettier for consistent code style (currently missing in root).

## Known Issues
- `python -m compileall backend/` fails if Python is not in the system PATH.
