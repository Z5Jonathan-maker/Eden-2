# Eden Claims Platform - Changelog

## [Feb 3, 2026] - Major Feature Release 🚀

### ✨ New Features

#### 1. Sales Enablement System
Complete field sales guide replacing the need for scripts or training materials.

**Door Knock Walkthrough:**
- 5-step guided conversation flow
- Personalized scripts with rep name
- Loss-type messaging (Wind, Water, Fire)
- Active storm selector (Hurricane Milton, Jan 31 Wind Event)
- 5 objection handlers with professional responses
- Progress tracking with step indicators

**Guided Presentation:**
- 6-section educational walkthrough
- Trust-building approach (no pressure tactics)
- Clear process explanation
- Soft close with CTA options

**Files:** `SalesEnablement.jsx`

---

#### 2. Interactive Canvassing Map (Enzy-Style)
Full-featured door-to-door canvassing map - completely FREE using OpenStreetMap.

**Features:**
- Interactive map with click-to-add pins
- 7 disposition types (color-coded)
- Real-time GPS tracking
- Live team location tracking
- Territory polygon support
- Side panel with stats & recent activity
- Quick disposition buttons
- Pin history tracking

**Backend:**
- Full CRUD API for pins
- Territory management
- Live location tracking
- Stats & analytics

**Files:** `CanvassingMap.jsx`, `canvassing_map.py`
**Packages:** leaflet, react-leaflet, leaflet-draw

---

### 🔧 Bug Fixes

#### Weather/DOL Verification
- **Fixed:** Iowa State METAR API returns CSV format, not JSON
- **Fixed:** Added CSV parsing with proper header detection
- **Fixed:** Peak wind gust tracking for accurate max readings
- **Fixed:** Lowered detection threshold from 50mph to 20mph
- **Fixed:** Timestamp parsing for different date formats
- **Result:** Successfully detects Hurricane Milton (Oct 2024) with 86.3 mph winds

**Files:** `weather.py`

---

#### Scales Estimate Comparison
- **Fixed:** Carrier estimates often bundled in claim packages
- **Added:** Smart page detection for Xactimate content
- **Added:** 3 alternative parsing methods for different formats
- **Added:** Visual warnings for PDFs with 0 line items
- **Added:** `line_item_count` in API responses

**Files:** `pdf_parser.py`, `scales.py`, `Scales.jsx`

---

### 🎨 UI/UX Improvements

- Added "Turf Map" to sidebar navigation
- Added "Sales Pitch" to sidebar navigation
- Improved estimate list with warning indicators
- Better error feedback for failed PDF parsing

---

### 📦 Dependencies Added
```json
{
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0",
  "@react-leaflet/core": "^3.0.0",
  "leaflet-draw": "^1.0.4",
  "react-leaflet-draw": "^0.21.0"
}
```

---

### 📊 Database Collections Added
- `canvassing_pins` - Door markers with dispositions
- `canvassing_territories` - Polygon territories
- `canvassing_locations` - Live rep positions

---

### 🔌 API Endpoints Added
```
POST   /api/canvassing-map/pins
GET    /api/canvassing-map/pins
GET    /api/canvassing-map/pins/:id
PATCH  /api/canvassing-map/pins/:id
DELETE /api/canvassing-map/pins/:id

POST   /api/canvassing-map/territories
GET    /api/canvassing-map/territories
GET    /api/canvassing-map/territories/:id
PATCH  /api/canvassing-map/territories/:id
DELETE /api/canvassing-map/territories/:id

POST   /api/canvassing-map/location
GET    /api/canvassing-map/locations/live
GET    /api/canvassing-map/stats/overview
GET    /api/canvassing-map/dispositions
```

---

## Previous Sessions

### [Feb 2, 2026] - Vision Board & Client Education
- Interactive Vision Board with journal, goals, team feed
- Client Education Hub with categories, glossary, Q&A
- Sidebar navigation reorganization

### [Feb 1, 2026] - Canvassing & Weather
- Canvassing Tally System (clock in/out, metrics)
- Weather/DOL Verification (initial implementation)
- Manager dashboard with leaderboards

### [Jan 2026] - Core Platform
- Claims management
- Inspection photos with annotations
- Scales estimate comparison
- Eve AI assistant
- Doctrine knowledge hub
- Stripe payment integration
- Landing page with demo
