import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import {
  Search, Satellite, Eye, ChevronLeft, ChevronRight,
  Loader2, History, Ruler, Trash2, MapPin, CornerDownLeft,
} from 'lucide-react';
import { assertApiUrl, getAuthToken } from '../lib/api';

const getApiUrl = () => assertApiUrl();

const WAYBACK_SELECTION_URL = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=pjson';
const ESRI_WORLD_IMAGERY_TILE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
// Wayback tiles use the numeric "M" value from the Selection metadata, NOT the string ID.
const WAYBACK_TILE_URL = (releaseNum) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false&release=${releaseNum}`;

// ── Geodesic helpers ────────────────────────────────────────────────
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_FT = 20_902_231; // mean radius in feet

/** Haversine distance between two lat/lng points in feet */
const haversineFt = (a, b) => {
  const dLat = (b[0] - a[0]) * DEG_TO_RAD;
  const dLng = (b[1] - a[1]) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a[0] * DEG_TO_RAD) * Math.cos(b[0] * DEG_TO_RAD) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_FT * Math.asin(Math.sqrt(h));
};

/** Approximate polygon area in sqft using flat-Earth projection (accurate at building scale) */
const polygonAreaSqFt = (points) => {
  if (points.length < 3) return 0;
  const refLat = points[0][0];
  const ftPerDegLat = 364_320; // ~111km
  const ftPerDegLng = ftPerDegLat * Math.cos(refLat * DEG_TO_RAD);
  // Convert to local XY in feet
  const xy = points.map(([lat, lng]) => [
    (lng - points[0][1]) * ftPerDegLng,
    (lat - points[0][0]) * ftPerDegLat,
  ]);
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    area += xy[i][0] * xy[j][1];
    area -= xy[j][0] * xy[i][1];
  }
  return Math.abs(area / 2);
};

/** Perimeter in feet */
const perimeterFt = (points) => {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += haversineFt(points[i], points[(i + 1) % points.length]);
  }
  return total;
};

// ── Map interaction handlers ────────────────────────────────────────
const MapClickHandler = ({ onSelect }) => {
  useMapEvents({ click(e) { if (typeof onSelect === 'function') onSelect(e.latlng); } });
  return null;
};

// ── Main component ──────────────────────────────────────────────────
const PropertyIntelligence = ({ embedded = false, onDataChange } = {}) => {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');

  const [loading, setLoading] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [resolvedAddress, setResolvedAddress] = useState('');

  const [viewMode, setViewMode] = useState('satellite');
  const [selectedImageDate, setSelectedImageDate] = useState(0);
  const [imageryReleases, setImageryReleases] = useState([]);

  // Measurement state
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);

  const selectedRelease = useMemo(
    () => imageryReleases[selectedImageDate] || null,
    [imageryReleases, selectedImageDate],
  );

  const canSubmit = Boolean(address?.trim() && state?.trim() && (city?.trim() || zip?.trim()));

  // Feed data up to parent for report generation
  useEffect(() => {
    if (typeof onDataChange === 'function') {
      onDataChange({
        images: imageryReleases,
        address: `${address} ${city} ${state} ${zip}`.trim(),
      });
    }
  }, [imageryReleases, address, city, state, zip, onDataChange]);

  // ── Helpers ──────────────────────────────────────────────────────

  const fetchJson = async (url, options = {}, timeoutMs = 25000) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const token = getAuthToken();
    const authHdr = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch(url, {
        credentials: 'include',
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

    // Strategy 1: Nominatim (OpenStreetMap) — free, rooftop-level accuracy
    try {
      const params = new URLSearchParams({
        q: fullQuery,
        format: 'json',
        limit: '1',
        countrycodes: 'us',
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

    // Strategy 3: Census geocoder (reliable fallback)
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
    setMeasurePoints([]);
    setMeasureMode(false);

    try {
      const coords = await geocode();
      if (!coords) { toast.error('Could not geocode address'); return; }

      setMapCenter(coords);
      setResolvedAddress(`${address}, ${city}, ${state} ${zip}`.trim());

      const releases = await loadReleases();
      setImageryReleases(releases);

      if (releases.length > 0) {
        // Start at most recent
        setSelectedImageDate(0);
        setViewMode('aerial');
        toast.success(`Loaded ${releases.length} historical imagery dates`);
      } else {
        toast.info('Showing current satellite — historical timeline unavailable');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load imagery');
    } finally {
      setLoading(false);
    }
  };

  // ── Measurement handlers ─────────────────────────────────────────

  const handleMapClick = useCallback((latlng) => {
    if (measureMode) {
      setMeasurePoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
    } else {
      setMapCenter({ lat: latlng.lat, lng: latlng.lng });
      toast.success('Pin moved');
    }
  }, [measureMode]);

  const undoLastPoint = () => setMeasurePoints((prev) => prev.slice(0, -1));
  const clearMeasurement = () => setMeasurePoints([]);

  const area = useMemo(() => polygonAreaSqFt(measurePoints), [measurePoints]);
  const perimeter = useMemo(() => perimeterFt(measurePoints), [measurePoints]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-tactical font-bold text-white tracking-wide">PROPERTY IMAGERY</h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            Historical aerial footage &amp; roof measurement
          </p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
          <Satellite className="w-3 h-3" /> ESRI Wayback
        </span>
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

            {/* Measure toggle */}
            <div className="flex items-center gap-2">
              <button onClick={() => setMeasureMode(!measureMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase flex items-center gap-1.5 transition-all border ${
                  measureMode
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'text-zinc-500 border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600'
                }`}>
                <Ruler className="w-3.5 h-3.5" />
                {measureMode ? 'Measuring' : 'Measure Roof'}
              </button>
              {measurePoints.length > 0 && (
                <>
                  <button onClick={undoLastPoint} title="Undo last point"
                    className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 border border-zinc-700/40 hover:border-zinc-600 transition-colors">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={clearMeasurement} title="Clear measurement"
                    className="p-1.5 rounded text-zinc-500 hover:text-red-400 border border-zinc-700/40 hover:border-red-500/40 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Map */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-800/60" style={{ height: 420 }}>
            <MapContainer
              key={`${viewMode}-${selectedRelease?.m || 'current'}-${mapCenter.lat}-${mapCenter.lng}`}
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
              {/* Measurement polygon */}
              {measurePoints.length >= 3 && (
                <Polygon
                  positions={measurePoints}
                  pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, weight: 2, dashArray: '6 3' }}
                />
              )}
              {measurePoints.length >= 2 && measurePoints.length < 3 && (
                <Polyline
                  positions={measurePoints}
                  pathOptions={{ color: '#f97316', weight: 2, dashArray: '6 3' }}
                />
              )}
              {/* Measurement vertex markers */}
              {measurePoints.map((pt, i) => (
                <CircleMarker
                  key={i}
                  center={pt}
                  radius={4}
                  pathOptions={{ color: '#fff', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
                />
              ))}
              <MapClickHandler onSelect={handleMapClick} />
            </MapContainer>

            {/* Overlay: date badge */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg z-[1000] pointer-events-none">
              <p className="text-[10px] text-zinc-400 font-mono uppercase">Captured</p>
              <p className="text-sm font-mono text-white">
                {viewMode === 'aerial' ? (selectedRelease?.label || 'Historical') : 'Current imagery'}
              </p>
            </div>

            {/* Overlay: measure mode indicator */}
            {measureMode && (
              <div className="absolute top-3 right-3 bg-orange-500/20 border border-orange-500/40 backdrop-blur px-3 py-1.5 rounded-lg z-[1000] pointer-events-none">
                <p className="text-xs font-mono text-orange-300">
                  {measurePoints.length < 3
                    ? `Click roof corners (${measurePoints.length}/3+ pts)`
                    : 'Click to add more points'}
                </p>
              </div>
            )}

            {/* Overlay: measurement results */}
            {measurePoints.length >= 3 && (
              <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur border border-orange-500/30 px-4 py-2.5 rounded-lg z-[1000]">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">Area</p>
                    <p className="text-lg font-mono font-bold text-orange-300">
                      {area < 1000 ? `${Math.round(area)} sq ft` : `${(area / 1000).toFixed(1)}k sq ft`}
                    </p>
                  </div>
                  <div className="w-px h-8 bg-zinc-700" />
                  <div>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">Perimeter</p>
                    <p className="text-sm font-mono text-zinc-300">{Math.round(perimeter)} ft</p>
                  </div>
                  <div className="w-px h-8 bg-zinc-700" />
                  <div>
                    <p className="text-[10px] font-mono text-zinc-500 uppercase">Squares</p>
                    <p className="text-sm font-mono text-zinc-300">{(area / 100).toFixed(1)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

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
              <div className="flex gap-1">
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

          {/* Measure instructions */}
          {measureMode && measurePoints.length < 3 && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
              <h4 className="text-sm font-mono text-orange-300 mb-1">Roof Measurement Mode</h4>
              <p className="text-xs text-zinc-400">
                Click on the map to place points around the roof perimeter. Place at least 3 points to calculate area.
                The tool will show area in sq ft and roofing squares (1 square = 100 sq ft).
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
            Enter an address to load ESRI Wayback satellite imagery. Browse historical aerial photos and measure roof area in square feet.
          </p>
        </div>
      )}
    </div>
  );
};

export default PropertyIntelligence;
