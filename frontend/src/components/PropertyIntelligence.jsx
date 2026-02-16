import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polygon, Polyline, useMapEvents, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  Search, Satellite, Eye, ChevronLeft, ChevronRight,
  Loader2, History, Ruler, Trash2, MapPin, CornerDownLeft,
  PenTool, Save, Download, Layers, MousePointer, Maximize2,
} from 'lucide-react';
import { assertApiUrl, getAuthToken } from '../lib/api';
import {
  haversineFt, polygonAreaSqFt, perimeterFt, polylineLengthFt,
  segmentLengthsFt, formatDistance, formatArea, sqftToSquares,
  serializeArtifact,
} from '../lib/geoUtils';
import { useImageryArtifacts } from '../hooks/useImageryArtifacts';

const getApiUrl = () => assertApiUrl();

const WAYBACK_SELECTION_URL = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=pjson';
const ESRI_WORLD_IMAGERY_TILE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const WAYBACK_TILE_URL = (releaseNum) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false&release=${releaseNum}`;

// Tool modes
const TOOLS = { PAN: 'pan', DISTANCE: 'distance', AREA: 'area', ROOF_FACET: 'roofFacet' };

// Saved artifact display colors
const ARTIFACT_COLORS = {
  distance:  { color: '#3b82f6', fill: '#3b82f6' },
  area:      { color: '#22c55e', fill: '#22c55e' },
  roofFacet: { color: '#a855f7', fill: '#a855f7' },
  polygon:   { color: '#22c55e', fill: '#22c55e' },
};

// ── Map interaction handler ─────────────────────────────────────────
const MapClickHandler = ({ onSelect }) => {
  useMapEvents({ click(e) { if (typeof onSelect === 'function') onSelect(e.latlng); } });
  return null;
};

// ── Main component ──────────────────────────────────────────────────
const PropertyIntelligence = ({ embedded = false, onDataChange, claimId = null } = {}) => {
  // Address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');

  // Map
  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');

  // View / timeline
  const [viewMode, setViewMode] = useState('satellite');
  const [selectedImageDate, setSelectedImageDate] = useState(0);
  const [imageryReleases, setImageryReleases] = useState([]);

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [compareDateIdx, setCompareDateIdx] = useState(null);

  // Tool & drawing
  const [activeTool, setActiveTool] = useState(TOOLS.PAN);
  const [drawingPoints, setDrawingPoints] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [facetLabel, setFacetLabel] = useState('');
  const [showFacetPrompt, setShowFacetPrompt] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);

  // Session
  const [sessionId, setSessionId] = useState(null);

  // Artifacts hook
  const {
    artifacts, saving: artifactsSaving,
    loadArtifacts, saveArtifact, deleteArtifact, createSession,
  } = useImageryArtifacts(sessionId, claimId);

  // Keep a ref to drawingPoints for the click handler callback
  const drawingPointsRef = useRef(drawingPoints);
  drawingPointsRef.current = drawingPoints;

  const selectedRelease = useMemo(
    () => imageryReleases[selectedImageDate] || null,
    [imageryReleases, selectedImageDate],
  );

  const compareRelease = useMemo(
    () => (compareDateIdx !== null ? imageryReleases[compareDateIdx] : null),
    [imageryReleases, compareDateIdx],
  );

  const canSubmit = Boolean(address?.trim() && state?.trim() && (city?.trim() || zip?.trim()));

  // Feed data up to parent for report generation
  useEffect(() => {
    if (typeof onDataChange === 'function') {
      onDataChange({
        images: imageryReleases,
        address: `${address} ${city} ${state} ${zip}`.trim(),
        artifacts,
      });
    }
  }, [imageryReleases, address, city, state, zip, onDataChange, artifacts]);

  // ── Helpers ──────────────────────────────────────────────────────

  const fetchJson = async (url, options = {}, timeoutMs = 25000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const apiBase = getApiUrl();
    const isBackend = url.startsWith('/api') || (apiBase && url.startsWith(apiBase));
    const token = isBackend ? getAuthToken() : null;
    const authHdr = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch(url, {
        credentials: isBackend ? 'include' : 'omit',
        ...options,
        headers: { ...authHdr, ...options.headers },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
    finally { clearTimeout(timeout); }
  };

  const parseWaybackDate = (name) => {
    const m = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  };

  const formatLabel = (iso) => {
    if (!iso) return 'Unknown';
    const d = new Date(`${iso}T00:00:00Z`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Geocode (priority: Nominatim > Backend > Census) ─────────────

  const geocode = async () => {
    const apiUrl = getApiUrl();
    const fullQuery = `${address}, ${city}, ${state} ${zip}`.trim();

    // Strategy 1: Nominatim
    try {
      const params = new URLSearchParams({
        q: fullQuery, format: 'json', limit: '1', countrycodes: 'us',
      });
      const data = await fetchJson(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { credentials: 'omit', headers: { 'User-Agent': 'EdenClaimsApp/1.0' } },
        10000,
      );
      const hit = Array.isArray(data) ? data[0] : null;
      const lat = Number(hit?.lat);
      const lng = Number(hit?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    } catch (err) {
      console.warn('[PropertyImagery] Nominatim geocode failed:', err);
    }

    // Strategy 2: Backend geocode
    if (apiUrl != null) {
      try {
        const params = new URLSearchParams({ address: address.trim(), city: city.trim(), state: state.trim(), zip_code: zip.trim() });
        const data = await fetchJson(`${apiUrl}/api/weather/stations/nearby?${params}`, { method: 'GET' }, 20000);
        const coords = data?.coordinates;
        const lat = Number(coords?.latitude);
        const lng = Number(coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      } catch (err) {
        console.warn('[PropertyImagery] Backend geocode failed:', err);
      }
    }

    // Strategy 3: Census geocoder
    const queries = [fullQuery, `${address}, ${state} ${zip}`.trim()].filter(Boolean);
    for (const query of queries) {
      try {
        const params = new URLSearchParams({ address: query, benchmark: 'Public_AR_Current', format: 'json' });
        const data = await fetchJson(
          `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`,
          { credentials: 'omit' },
          15000,
        );
        const match = data?.result?.addressMatches?.[0]?.coordinates;
        const lat = Number(match?.y);
        const lng = Number(match?.x);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      } catch (err) {
        console.warn('[PropertyImagery] Census geocode failed:', err);
      }
    }

    return null;
  };

  // ── Load imagery releases ────────────────────────────────────────

  const loadReleases = async () => {
    const apiUrl = getApiUrl();
    let data = apiUrl != null ? await fetchJson(`${apiUrl}/api/weather/imagery/releases`, {}, 25000) : null;
    if (!data) data = await fetchJson(WAYBACK_SELECTION_URL, {}, 20000);
    if (!data) return [];

    const selection = Array.isArray(data.selection) ? data.selection : Array.isArray(data.Selection) ? data.Selection : [];
    return selection
      .map((item) => {
        const date = parseWaybackDate(item?.Name);
        return { id: item?.ID, m: item?.M, date, label: formatLabel(date) };
      })
      .filter((r) => r.m && r.date)
      .slice(0, 60);
  };

  // ── Main search action ───────────────────────────────────────────

  const searchImagery = async () => {
    if (!canSubmit) { toast.error('Enter address, state, and city or ZIP'); return; }

    setLoading(true);
    setMapCenter(null);
    setDrawingPoints([]);
    setActiveTool(TOOLS.PAN);

    try {
      const coords = await geocode();
      if (!coords) { toast.error('Could not geocode address'); return; }

      setMapCenter(coords);
      setResolvedAddress(`${address}, ${city}, ${state} ${zip}`.trim());

      const releases = await loadReleases();
      setImageryReleases(releases);

      if (releases.length > 0) {
        setSelectedImageDate(0);
        setViewMode('aerial');
        toast.success(`Loaded ${releases.length} historical imagery dates`);
      } else {
        toast.info('Showing current satellite — historical timeline unavailable');
      }

      // Create imagery session if claim-linked
      if (claimId) {
        const session = await createSession({
          address: `${address}, ${city}, ${state} ${zip}`.trim(),
          lat: coords.lat, lng: coords.lng,
          claimId,
          timelineEntries: releases.map(r => r.date),
        });
        if (session) {
          setSessionId(session.id || session._id);
          loadArtifacts({ sessionId: session.id || session._id });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load imagery');
    } finally {
      setLoading(false);
    }
  };

  // ── Drawing handlers ─────────────────────────────────────────────

  const handleMapClick = useCallback((latlng) => {
    if (activeTool === TOOLS.PAN) {
      setMapCenter({ lat: latlng.lat, lng: latlng.lng });
      toast.success('Pin moved');
      return;
    }
    // Save current state to undo stack
    setUndoStack(prev => [...prev, [...drawingPointsRef.current]]);
    setDrawingPoints(prev => [...prev, [latlng.lat, latlng.lng]]);
  }, [activeTool]);

  const undoLastPoint = () => {
    if (undoStack.length > 0) {
      setDrawingPoints(undoStack[undoStack.length - 1]);
      setUndoStack(prev => prev.slice(0, -1));
    } else if (drawingPoints.length > 0) {
      setDrawingPoints(prev => prev.slice(0, -1));
    }
  };

  const clearDrawing = () => {
    setDrawingPoints([]);
    setUndoStack([]);
  };

  const switchTool = (tool) => {
    if (drawingPoints.length > 0) clearDrawing();
    setActiveTool(tool);
  };

  // ── Computed measurements for current drawing ────────────────────

  const currentArea = useMemo(() => polygonAreaSqFt(drawingPoints), [drawingPoints]);
  const currentPerimeter = useMemo(() => perimeterFt(drawingPoints), [drawingPoints]);
  const currentLength = useMemo(() => polylineLengthFt(drawingPoints), [drawingPoints]);
  const currentSegments = useMemo(() => segmentLengthsFt(drawingPoints), [drawingPoints]);

  // ── Save / finish measurement ────────────────────────────────────

  const finishMeasurement = async () => {
    const type = activeTool === TOOLS.DISTANCE ? 'distance'
      : activeTool === TOOLS.ROOF_FACET ? 'roofFacet'
      : 'area';

    if (type === 'distance' && drawingPoints.length < 2) return;
    if (type !== 'distance' && drawingPoints.length < 3) return;

    // For roof facets, ask for label first
    if (type === 'roofFacet' && !facetLabel) {
      setShowFacetPrompt(true);
      return;
    }

    const label = type === 'roofFacet' ? facetLabel
      : type === 'distance' ? `Distance: ${formatDistance(currentLength)}`
      : `Area: ${formatArea(currentArea)}`;

    const artifactData = {
      type,
      label,
      points: drawingPoints,
      provider: 'esri_wayback',
      imageryDate: selectedRelease?.date || null,
      zoom: 19,
      claimId,
      sessionId,
    };

    try {
      await saveArtifact(artifactData);
      toast.success('Measurement saved');
      clearDrawing();
      setFacetLabel('');
      setShowFacetPrompt(false);
    } catch {
      toast.error('Failed to save measurement');
    }
  };

  const handleSaveFacet = () => {
    if (!facetLabel.trim()) { toast.error('Enter a facet label'); return; }
    finishMeasurement();
  };

  const handleDeleteArtifact = async (id) => {
    const ok = await deleteArtifact(id);
    if (ok) toast.success('Measurement deleted');
    else toast.error('Failed to delete');
  };

  // ── Evidence Pack export ─────────────────────────────────────────

  const exportEvidencePack = () => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Evidence Pack - ${resolvedAddress}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#222}
h1{font-size:1.4em;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:1.15em;color:#555;margin-top:24px}
table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:0.9em}
th{background:#f5f5f5}
.meta{color:#666;font-size:0.85em}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.8em;font-weight:600}
.distance{background:#dbeafe;color:#1e40af}
.area{background:#dcfce7;color:#166534}
.roofFacet{background:#f3e8ff;color:#6b21a8}
</style></head><body>
<h1>Evidence Pack: Property Imagery</h1>
<p class="meta">
  Address: ${resolvedAddress}<br>
  Coordinates: ${mapCenter?.lat.toFixed(6)}, ${mapCenter?.lng.toFixed(6)}<br>
  Generated: ${new Date().toLocaleString()}<br>
  Provider: ESRI Wayback · Projection: Equirectangular local ft
</p>

<h2>Imagery Timeline (${imageryReleases.length} dates)</h2>
<table><tr><th>#</th><th>Date</th><th>Release ID</th></tr>
${imageryReleases.map((r, i) => `<tr><td>${i + 1}</td><td>${r.label}</td><td>${r.m}</td></tr>`).join('')}
</table>

<h2>Measurements (${artifacts.length})</h2>
${artifacts.length === 0 ? '<p>No saved measurements.</p>' : `
<table><tr><th>Type</th><th>Label</th><th>Value</th><th>Imagery Date</th></tr>
${artifacts.map(a => {
  const c = a.computed || {};
  const val = a.type === 'distance' ? formatDistance(c.totalFt || 0)
    : `${formatArea(c.areaSqFt || 0)} (${sqftToSquares(c.areaSqFt || 0).toFixed(1)} squares)`;
  return `<tr><td><span class="badge ${a.type}">${a.type}</span></td><td>${a.label || '\u2014'}</td><td>${val}</td><td>${a.meta?.imageryDate || '\u2014'}</td></tr>`;
}).join('')}
</table>`}

${artifacts.filter(a => a.type === 'roofFacet').length > 0 ? `
<h2>Roof Facet Summary</h2>
<table><tr><th>Facet</th><th>Area (sq ft)</th><th>Squares</th></tr>
${artifacts.filter(a => a.type === 'roofFacet').map(a => {
  const c = a.computed || {};
  return `<tr><td>${a.label}</td><td>${Math.round(c.areaSqFt || 0)}</td><td>${sqftToSquares(c.areaSqFt || 0).toFixed(1)}</td></tr>`;
}).join('')}
<tr style="font-weight:bold"><td>Total</td><td>${Math.round(artifacts.filter(a => a.type === 'roofFacet').reduce((s, a) => s + (a.computed?.areaSqFt || 0), 0))}</td><td>${sqftToSquares(artifacts.filter(a => a.type === 'roofFacet').reduce((s, a) => s + (a.computed?.areaSqFt || 0), 0)).toFixed(1)}</td></tr>
</table>` : ''}

<p class="meta" style="margin-top:32px;border-top:1px solid #ddd;padding-top:12px">
  Eden Claims OS &middot; Evidence Pack &middot; ${new Date().toISOString()}
</p>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-pack-${resolvedAddress?.replace(/[^a-zA-Z0-9]/g, '-') || 'property'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Evidence Pack exported');
  };

  // ── Render helpers ───────────────────────────────────────────────

  const renderSavedArtifact = (artifact) => {
    const pts = (artifact.points || []).map(p =>
      Array.isArray(p) ? p : [p.lat, p.lng]
    );
    if (pts.length < 2) return null;
    const colors = ARTIFACT_COLORS[artifact.type] || ARTIFACT_COLORS.area;
    const id = artifact.id || artifact._id;

    if (artifact.type === 'distance') {
      return (
        <React.Fragment key={id}>
          <Polyline positions={pts}
            pathOptions={{ color: colors.color, weight: 2, opacity: 0.8 }} />
          {pts.map((pt, i) => (
            <CircleMarker key={`sa-${id}-${i}`} center={pt} radius={3}
              pathOptions={{ color: '#fff', fillColor: colors.fill, fillOpacity: 1, weight: 1 }} />
          ))}
        </React.Fragment>
      );
    }

    return (
      <React.Fragment key={id}>
        <Polygon positions={pts}
          pathOptions={{ color: colors.color, fillColor: colors.fill, fillOpacity: 0.1, weight: 2 }} />
        {pts.map((pt, i) => (
          <CircleMarker key={`sa-${id}-${i}`} center={pt} radius={3}
            pathOptions={{ color: '#fff', fillColor: colors.fill, fillOpacity: 1, weight: 1 }} />
        ))}
      </React.Fragment>
    );
  };

  // Can the current drawing be saved?
  const canSave = (activeTool === TOOLS.DISTANCE && drawingPoints.length >= 2) ||
    (activeTool !== TOOLS.DISTANCE && activeTool !== TOOLS.PAN && drawingPoints.length >= 3);

  // ── RENDER ───────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      {/* Segment label tooltip styles */}
      <style>{`
        .segment-label {
          background: rgba(0,0,0,0.85) !important;
          border: 1px solid rgba(249,115,22,0.5) !important;
          color: #fdba74 !important;
          font-size: 10px !important;
          font-family: ui-monospace, monospace !important;
          padding: 1px 5px !important;
          border-radius: 3px !important;
          box-shadow: none !important;
        }
        .segment-label::before { display: none !important; }
      `}</style>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-tactical font-bold text-white tracking-wide">PROPERTY IMAGERY</h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            Historical aerial footage &amp; measurement tools
          </p>
        </div>
        <div className="flex items-center gap-2">
          {artifacts.length > 0 && (
            <button onClick={exportEvidencePack}
              className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-all flex items-center gap-1">
              <Download className="w-3 h-3" /> Evidence Pack
            </button>
          )}
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
            <Satellite className="w-3 h-3" /> ESRI Wayback
          </span>
        </div>
      </div>

      {/* Address Form */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
              placeholder="123 Main St" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
              placeholder="Tampa" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">State</label>
            <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())}
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
              placeholder="FL" maxLength={2} />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">ZIP</label>
            <input value={zip} onChange={(e) => setZip(e.target.value)}
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
              placeholder="33534" />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={searchImagery} disabled={loading || !canSubmit}
            className="px-5 py-2 rounded-lg text-sm font-mono uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Load Imagery
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-mono">Geocoding &amp; loading imagery releases...</p>
        </div>
      )}

      {/* Map + Results */}
      {mapCenter && !loading && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-0.5">
              {[
                { key: 'aerial', label: 'Aerial', icon: Eye },
                { key: 'satellite', label: 'Current', icon: Satellite },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setViewMode(key)}
                  className={`px-3 py-1.5 rounded text-xs font-mono uppercase flex items-center gap-1.5 transition-all ${
                    viewMode === key
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>

            {/* Tool selector */}
            <div className="flex bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-0.5">
              {[
                { key: TOOLS.PAN, label: 'Pan', icon: MousePointer },
                { key: TOOLS.DISTANCE, label: 'Distance', icon: Ruler },
                { key: TOOLS.AREA, label: 'Area', icon: Maximize2 },
                { key: TOOLS.ROOF_FACET, label: 'Facet', icon: PenTool },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => switchTool(key)}
                  className={`px-3 py-1.5 rounded text-xs font-mono uppercase flex items-center gap-1.5 transition-all ${
                    activeTool === key
                      ? key === TOOLS.PAN
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}>
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>

            {/* Drawing actions */}
            <div className="flex items-center gap-1.5">
              {drawingPoints.length > 0 && (
                <>
                  <button onClick={undoLastPoint} title="Undo last point"
                    className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 border border-zinc-700/40 hover:border-zinc-600 transition-colors">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={clearDrawing} title="Clear drawing"
                    className="p-1.5 rounded text-zinc-500 hover:text-red-400 border border-zinc-700/40 hover:border-red-500/40 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {canSave && (
                    <button onClick={finishMeasurement} title="Save measurement"
                      disabled={artifactsSaving}
                      className="px-2.5 py-1.5 rounded text-xs font-mono text-green-400 border border-green-500/40 hover:bg-green-500/10 transition-colors flex items-center gap-1 disabled:opacity-50">
                      {artifactsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  )}
                </>
              )}

              {/* Saved panel toggle */}
              {artifacts.length > 0 && (
                <button onClick={() => setShowSavedPanel(!showSavedPanel)} title="Saved measurements"
                  className={`p-1.5 rounded border transition-colors ${
                    showSavedPanel
                      ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
                      : 'text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600'
                  }`}>
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Compare toggle */}
              {imageryReleases.length >= 2 && (
                <button onClick={() => {
                  setCompareMode(!compareMode);
                  if (!compareMode && compareDateIdx === null) {
                    setCompareDateIdx(Math.min(imageryReleases.length - 1, selectedImageDate + 1));
                  }
                }}
                  title="Compare dates side-by-side"
                  className={`px-2.5 py-1.5 rounded text-xs font-mono border transition-colors flex items-center gap-1 ${
                    compareMode
                      ? 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10'
                      : 'text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600'
                  }`}>
                  <Eye className="w-3.5 h-3.5" /> A/B
                </button>
              )}
            </div>
          </div>

          {/* Map */}
          <div className={`relative rounded-xl overflow-hidden border border-zinc-800/60 ${compareMode ? 'grid grid-cols-2 gap-px bg-zinc-700' : ''}`}
            style={{ height: compareMode ? 480 : 420 }}>
            {/* Primary map */}
            <div className="relative w-full h-full">
              <MapContainer
                key={`main-${viewMode}-${selectedRelease?.m || 'current'}-${mapCenter.lat}-${mapCenter.lng}`}
                center={[mapCenter.lat, mapCenter.lng]}
                zoom={19}
                className="w-full h-full z-0"
                scrollWheelZoom={true}
                style={{ background: '#18181b' }}
              >
                <TileLayer
                  url={
                    viewMode === 'aerial' && selectedRelease?.m
                      ? WAYBACK_TILE_URL(selectedRelease.m)
                      : ESRI_WORLD_IMAGERY_TILE_URL
                  }
                  attribution='&copy; Esri World Imagery / Wayback'
                  maxZoom={20}
                />
                <CircleMarker
                  center={[mapCenter.lat, mapCenter.lng]}
                  radius={6}
                  pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }}
                />

                {/* Saved artifacts */}
                {artifacts.map(renderSavedArtifact)}

                {/* Current drawing — distance (polyline) */}
                {activeTool === TOOLS.DISTANCE && drawingPoints.length >= 2 && (
                  <Polyline
                    positions={drawingPoints}
                    pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 3' }}
                  />
                )}

                {/* Current drawing — area/facet (polygon when 3+ pts, polyline when 2) */}
                {activeTool !== TOOLS.DISTANCE && activeTool !== TOOLS.PAN && drawingPoints.length >= 3 && (
                  <Polygon
                    positions={drawingPoints}
                    pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, weight: 2, dashArray: '6 3' }}
                  />
                )}
                {activeTool !== TOOLS.DISTANCE && activeTool !== TOOLS.PAN && drawingPoints.length === 2 && (
                  <Polyline
                    positions={drawingPoints}
                    pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 3' }}
                  />
                )}

                {/* Segment distance labels (distance tool) */}
                {activeTool === TOOLS.DISTANCE && currentSegments.map((len, i) => {
                  const mid = [
                    (drawingPoints[i][0] + drawingPoints[i + 1][0]) / 2,
                    (drawingPoints[i][1] + drawingPoints[i + 1][1]) / 2,
                  ];
                  return (
                    <CircleMarker key={`seg-${i}`} center={mid} radius={0}
                      pathOptions={{ opacity: 0, fillOpacity: 0 }}>
                      <Tooltip permanent direction="center" className="segment-label">
                        {formatDistance(len)}
                      </Tooltip>
                    </CircleMarker>
                  );
                })}

                {/* Vertex markers */}
                {drawingPoints.map((pt, i) => (
                  <CircleMarker
                    key={`v-${i}`}
                    center={pt}
                    radius={4}
                    pathOptions={{ color: '#fff', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
                  />
                ))}

                <MapClickHandler onSelect={handleMapClick} />
              </MapContainer>

              {/* Overlay: date badge */}
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg z-[1000] pointer-events-none">
                <p className="text-[10px] text-zinc-400 font-mono uppercase">
                  {compareMode ? 'Date A' : 'Captured'}
                </p>
                <p className="text-sm font-mono text-white">
                  {viewMode === 'aerial' ? (selectedRelease?.label || 'Historical') : 'Current imagery'}
                </p>
              </div>

              {/* Overlay: tool mode indicator */}
              {activeTool !== TOOLS.PAN && (
                <div className="absolute top-3 right-3 bg-orange-500/20 border border-orange-500/40 backdrop-blur px-3 py-1.5 rounded-lg z-[1000] pointer-events-none">
                  <p className="text-xs font-mono text-orange-300">
                    {activeTool === TOOLS.DISTANCE
                      ? drawingPoints.length < 2
                        ? `Click to place points (${drawingPoints.length} placed)`
                        : `${currentSegments.length} segments · Save when done`
                      : drawingPoints.length < 3
                        ? `Click corners (${drawingPoints.length}/3+ pts)`
                        : 'Click to add more, or Save'}
                  </p>
                </div>
              )}

              {/* Overlay: distance measurement results */}
              {activeTool === TOOLS.DISTANCE && drawingPoints.length >= 2 && (
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur border border-blue-500/30 px-4 py-2.5 rounded-lg z-[1000]">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Total Distance</p>
                      <p className="text-lg font-mono font-bold text-blue-300">{formatDistance(currentLength)}</p>
                    </div>
                    <div className="w-px h-8 bg-zinc-700" />
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Segments</p>
                      <p className="text-sm font-mono text-zinc-300">{currentSegments.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Overlay: area/facet measurement results */}
              {(activeTool === TOOLS.AREA || activeTool === TOOLS.ROOF_FACET) && drawingPoints.length >= 3 && (
                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur border border-orange-500/30 px-4 py-2.5 rounded-lg z-[1000]">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Area</p>
                      <p className="text-lg font-mono font-bold text-orange-300">{formatArea(currentArea)}</p>
                    </div>
                    <div className="w-px h-8 bg-zinc-700" />
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Perimeter</p>
                      <p className="text-sm font-mono text-zinc-300">{formatDistance(currentPerimeter)}</p>
                    </div>
                    <div className="w-px h-8 bg-zinc-700" />
                    <div>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase">Squares</p>
                      <p className="text-sm font-mono text-zinc-300">{sqftToSquares(currentArea).toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Compare map (side-by-side Date B) */}
            {compareMode && compareRelease && (
              <div className="relative w-full h-full">
                <MapContainer
                  key={`cmp-${compareRelease.m}-${mapCenter.lat}-${mapCenter.lng}`}
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={19}
                  className="w-full h-full z-0"
                  scrollWheelZoom={true}
                  style={{ background: '#18181b' }}
                >
                  <TileLayer
                    url={WAYBACK_TILE_URL(compareRelease.m)}
                    attribution='&copy; Esri World Imagery / Wayback'
                    maxZoom={20}
                  />
                  <CircleMarker
                    center={[mapCenter.lat, mapCenter.lng]}
                    radius={6}
                    pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }}
                  />
                  {/* Show saved artifacts on compare map too */}
                  {artifacts.map(renderSavedArtifact)}
                </MapContainer>

                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg z-[1000] pointer-events-none">
                  <p className="text-[10px] text-zinc-400 font-mono uppercase">Date B</p>
                  <p className="text-sm font-mono text-white">{compareRelease.label}</p>
                </div>
              </div>
            )}
          </div>

          {/* Compare date selector */}
          {compareMode && (
            <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-4 py-2">
              <span className="text-xs font-mono text-zinc-500 uppercase">Compare Date:</span>
              <select
                value={compareDateIdx ?? ''}
                onChange={(e) => setCompareDateIdx(Number(e.target.value))}
                className="bg-zinc-950/40 border border-zinc-800/70 rounded px-2 py-1 text-sm text-zinc-200 font-mono"
              >
                {imageryReleases.map((r, i) => (
                  <option key={r.id} value={i}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Address info */}
          {resolvedAddress && (
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <MapPin className="w-3 h-3" />
              <span>{resolvedAddress}</span>
              <span className="text-zinc-700">|</span>
              <span>{mapCenter.lat.toFixed(6)}, {mapCenter.lng.toFixed(6)}</span>
            </div>
          )}

          {/* Historical Timeline */}
          <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-mono uppercase text-zinc-300 flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" /> Historical Imagery Timeline
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600">
                  {imageryReleases.length > 0
                    ? `${selectedImageDate + 1} / ${imageryReleases.length}`
                    : '0 dates'}
                </span>
                <button onClick={() => { setSelectedImageDate(Math.max(0, selectedImageDate - 1)); setViewMode('aerial'); }}
                  disabled={imageryReleases.length === 0}
                  className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => { setSelectedImageDate(Math.min(imageryReleases.length - 1, selectedImageDate + 1)); setViewMode('aerial'); }}
                  disabled={imageryReleases.length === 0}
                  className="p-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Range slider */}
            {imageryReleases.length > 1 && (
              <div className="mb-3">
                <input
                  type="range"
                  min={0}
                  max={imageryReleases.length - 1}
                  value={selectedImageDate}
                  onChange={(e) => { setSelectedImageDate(Number(e.target.value)); setViewMode('aerial'); }}
                  className="w-full h-1.5 rounded-full appearance-none bg-zinc-800 cursor-pointer accent-cyan-400
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:border-2
                    [&::-webkit-slider-thumb]:border-zinc-900 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-zinc-600 mt-1">
                  <span>{imageryReleases[imageryReleases.length - 1]?.label}</span>
                  <span>{imageryReleases[0]?.label}</span>
                </div>
              </div>
            )}

            {imageryReleases.length === 0 ? (
              <p className="text-xs text-zinc-600 py-2">Historical release timeline unavailable.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {imageryReleases.map((img, idx) => (
                  <button key={img.id}
                    onClick={() => { setSelectedImageDate(idx); setViewMode('aerial'); }}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-mono transition-all border ${
                      selectedImageDate === idx
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'text-zinc-500 border-zinc-800/40 hover:text-zinc-300 hover:border-zinc-700'
                    }`}>
                    {img.label}
                  </button>
                ))}
              </div>
            )}

            {viewMode !== 'aerial' && imageryReleases.length > 0 && (
              <p className="text-[11px] text-zinc-600 mt-1">Switch to Aerial view to browse dated imagery.</p>
            )}
          </div>

          {/* Saved Measurements Panel */}
          {showSavedPanel && artifacts.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-zinc-300 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" /> Saved Measurements
                <span className="text-[10px] text-zinc-600">({artifacts.length})</span>
              </h3>
              <div className="space-y-2">
                {artifacts.map((a) => {
                  const c = a.computed || {};
                  const colors = ARTIFACT_COLORS[a.type] || ARTIFACT_COLORS.area;
                  return (
                    <div key={a.id || a._id}
                      className="flex items-center justify-between bg-zinc-950/40 border border-zinc-800/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors.color }} />
                        <div>
                          <p className="text-xs font-mono text-zinc-200">{a.label || a.type}</p>
                          <p className="text-[10px] font-mono text-zinc-500">
                            {a.type === 'distance'
                              ? formatDistance(c.totalFt || 0)
                              : `${formatArea(c.areaSqFt || 0)} · ${sqftToSquares(c.areaSqFt || 0).toFixed(1)} sq`
                            }
                            {a.meta?.imageryDate && ` · ${a.meta.imageryDate}`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => handleDeleteArtifact(a.id || a._id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Roof facet summary */}
              {artifacts.filter(a => a.type === 'roofFacet').length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/50">
                  <h4 className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Roof Facet Summary</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] font-mono text-zinc-600">Total Area</p>
                      <p className="text-sm font-mono text-purple-300">
                        {formatArea(artifacts.filter(a => a.type === 'roofFacet').reduce((s, a) => s + (a.computed?.areaSqFt || 0), 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-600">Total Squares</p>
                      <p className="text-sm font-mono text-purple-300">
                        {sqftToSquares(artifacts.filter(a => a.type === 'roofFacet').reduce((s, a) => s + (a.computed?.areaSqFt || 0), 0)).toFixed(1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono text-zinc-600">Facets</p>
                      <p className="text-sm font-mono text-purple-300">
                        {artifacts.filter(a => a.type === 'roofFacet').length}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roof Facet Label Prompt */}
          {showFacetPrompt && (
            <div className="bg-purple-500/5 border border-purple-500/30 rounded-xl p-4">
              <h4 className="text-sm font-mono text-purple-300 mb-2">Name This Roof Facet</h4>
              <div className="flex gap-2">
                <input
                  value={facetLabel}
                  onChange={(e) => setFacetLabel(e.target.value)}
                  placeholder="e.g., Front Gable, Rear Hip, Main"
                  className="flex-1 bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFacet(); }}
                />
                <button onClick={handleSaveFacet} disabled={artifactsSaving}
                  className="px-4 py-2 rounded-lg text-sm font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all disabled:opacity-50">
                  {artifactsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Facet'}
                </button>
                <button onClick={() => { setShowFacetPrompt(false); setFacetLabel(''); }}
                  className="px-3 py-2 rounded-lg text-sm text-zinc-500 border border-zinc-700/40 hover:text-zinc-300">
                  Cancel
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                {['Main', 'Front Gable', 'Rear Hip', 'Side Shed', 'Garage', 'Dormer'].map(preset => (
                  <button key={preset} onClick={() => setFacetLabel(preset)}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                      facetLabel === preset
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'text-zinc-500 border-zinc-700/30 hover:text-zinc-300'
                    }`}>
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tool instructions */}
          {activeTool !== TOOLS.PAN && drawingPoints.length < (activeTool === TOOLS.DISTANCE ? 2 : 3) && (
            <div className={`border rounded-xl p-4 ${
              activeTool === TOOLS.ROOF_FACET
                ? 'bg-purple-500/5 border-purple-500/20'
                : activeTool === TOOLS.DISTANCE
                  ? 'bg-blue-500/5 border-blue-500/20'
                  : 'bg-orange-500/5 border-orange-500/20'
            }`}>
              <h4 className={`text-sm font-mono mb-1 ${
                activeTool === TOOLS.ROOF_FACET ? 'text-purple-300'
                : activeTool === TOOLS.DISTANCE ? 'text-blue-300'
                : 'text-orange-300'
              }`}>
                {activeTool === TOOLS.DISTANCE ? 'Distance Tool'
                  : activeTool === TOOLS.ROOF_FACET ? 'Roof Facet Tracing'
                  : 'Area Measurement'}
              </h4>
              <p className="text-xs text-zinc-400">
                {activeTool === TOOLS.DISTANCE
                  ? 'Click on the map to place points along a line. Each segment length is labeled. Press Save when done.'
                  : activeTool === TOOLS.ROOF_FACET
                    ? 'Click the corners of one roof facet (plane). Place at least 3 points. You\'ll name the facet before saving.'
                    : 'Click on the map to place points around the area. Place at least 3 points to calculate area in sq ft and roofing squares.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!mapCenter && !loading && (
        <div className="text-center py-14">
          <Satellite className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-mono text-zinc-400 mb-2">Historical Property Imagery</h3>
          <p className="text-zinc-600 text-sm max-w-lg mx-auto">
            Enter an address to load ESRI Wayback satellite imagery. Browse historical aerial photos,
            measure distances, trace roof facets, and export evidence packs.
          </p>
        </div>
      )}
    </div>
  );
};

export default PropertyIntelligence;
