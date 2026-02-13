# Vite Migration Guide

## Overview

This guide documents the migration from Create React App (CRA) + Craco to Vite for **60s → 3s build times** and instant HMR.

## Why Vite?

| Metric | CRA + Craco (Before) | Vite (After) | Improvement |
|--------|---------------------|--------------|-------------|
| **Dev Server Start** | 15-30s | 1-2s | **15x faster** |
| **Hot Reload** | 2-5s | <100ms | **50x faster** |
| **Production Build** | 60-90s | 3-5s | **20x faster** |
| **Bundle Size** | No tree-shaking | ES modules | Smaller bundles |

## Migration Steps

### Phase 1: Install Vite Dependencies ✅

```bash
npm install --save-dev vite @vitejs/plugin-react
```

### Phase 2: Configuration Files ✅

**Created:**
- `vite.config.js` - Main Vite configuration
- `index.html` - Moved to root (Vite requirement)

**To Update:**
- `package.json` - Replace scripts
- Update import paths to use `@/` aliases

### Phase 3: Update package.json Scripts

**Before (CRA + Craco):**
```json
{
  "scripts": {
    "start": "craco start",
    "build": "cross-env CI=false craco build",
    "test": "craco test"
  }
}
```

**After (Vite):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

### Phase 4: Update Environment Variable Access

Vite uses `import.meta.env` instead of `process.env`:

**Before:**
```javascript
const apiUrl = process.env.REACT_APP_BACKEND_URL;
const isProd = process.env.NODE_ENV === 'production';
```

**After:**
```javascript
const apiUrl = import.meta.env.REACT_APP_BACKEND_URL;
const isProd = import.meta.env.PROD; // or import.meta.env.MODE === 'production'
```

**Search & Replace Needed:**
```bash
# Find all process.env usages
grep -r "process\.env" src/
```

### Phase 5: Update Import Paths

Use path aliases for cleaner imports:

**Before:**
```javascript
import ClaimsList from '../../../components/ClaimsList';
import { apiGet } from '../../../lib/api';
```

**After:**
```javascript
import ClaimsList from '@/components/ClaimsList';
import { apiGet } from '@/lib/api';
```

### Phase 6: Remove CRA Dependencies

After Vite is working, remove old dependencies:

```bash
npm uninstall react-scripts @craco/craco
```

### Phase 7: Update Vercel Build Config

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "vite"
}
```

## Breaking Changes to Fix

### 1. Global Variable Access

**Issue:** CRA injects `process.env` at build time, Vite uses `import.meta.env`

**Files to Update (~50 files):**
```bash
# Find all usages
grep -r "process\.env\.REACT_APP" src/
```

**Fix:**
```javascript
// Before
const url = process.env.REACT_APP_BACKEND_URL;

// After
const url = import.meta.env.REACT_APP_BACKEND_URL;
```

### 2. Dynamic Imports with Variables

**Issue:** Vite requires static strings in dynamic imports

**Before:**
```javascript
const module = await import(`./components/${componentName}.jsx`);
```

**After:**
```javascript
// Use explicit imports or glob imports
const modules = import.meta.glob('./components/*.jsx');
const module = await modules[`./components/${componentName}.jsx`]();
```

### 3. Public Folder Access

**Issue:** CRA uses `%PUBLIC_URL%`, Vite uses `/`

**Before:**
```javascript
<img src={process.env.PUBLIC_URL + '/logo.png'} />
```

**After:**
```javascript
<img src="/logo.png" />
```

### 4. SVG Imports

**Issue:** CRA uses `ReactComponent` import, Vite uses `?react` suffix

**Before:**
```javascript
import { ReactComponent as Logo } from './logo.svg';
```

**After:**
```javascript
import Logo from './logo.svg?react';
```

## Testing the Migration

### Step 1: Dev Server
```bash
npm run dev
# Should start in 1-2s (vs 15-30s with CRA)
```

### Step 2: Build
```bash
npm run build
# Should complete in 3-5s (vs 60-90s with CRA)
```

### Step 3: Preview
```bash
npm run preview
# Test production build locally
```

### Step 4: E2E Tests
```bash
npm run e2e
# Verify all functionality works
```

## Rollback Plan

If Vite migration causes issues:

1. Keep `craco.config.js` for now (don't delete)
2. Revert package.json scripts to CRA
3. Remove `vite.config.js` and root `index.html`
4. Continue with CRA while fixing Vite issues

## Performance Metrics

### Before (CRA + Craco)
```
Dev Server Start: 25s
Hot Reload: 3s
Production Build: 65s
Bundle Size: 2.1MB (uncompressed)
```

### After (Vite) - Expected
```
Dev Server Start: 1.5s ⚡ (17x faster)
Hot Reload: 50ms ⚡ (60x faster)
Production Build: 4s ⚡ (16x faster)
Bundle Size: 1.8MB ⚡ (15% smaller with better tree-shaking)
```

## Next Steps

1. **Search & Replace:** Update all `process.env` to `import.meta.env`
2. **Update Scripts:** Change package.json to use Vite commands
3. **Test Thoroughly:** Run E2E tests and manual testing
4. **Deploy to Staging:** Test in Vercel staging environment
5. **Production Deploy:** After successful staging tests

## Resources

- [Vite Guide](https://vitejs.dev/guide/)
- [Vite Migration from CRA](https://vitejs.dev/guide/migration.html)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

## Status

- [x] Vite config created
- [x] index.html moved to root
- [ ] Update package.json scripts
- [ ] Find/replace process.env → import.meta.env
- [ ] Test dev server
- [ ] Test production build
- [ ] Deploy to staging

**Estimated Time:** 2-3 hours
**Risk Level:** Low (can rollback easily)
**Impact:** High (20x faster builds, better DX)
