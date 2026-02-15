import React, { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Shield, Search, Wind, CloudHail, MapPin, Loader2, ChevronDown, FileText } from 'lucide-react';
import { assertApiUrl, getAuthToken } from '../lib/api';

const getApiUrl = () => assertApiUrl();

const authHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const DolDiscovery = ({ embedded = false, onDataChange } = {}) => {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');

  const [perilMode, setPerilMode] = useState('wind');
  const [windowDays, setWindowDays] = useState(365);
  const [minWind, setMinWind] = useState(30);
  const [maxDistance, setMaxDistance] = useState(50);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [parcel, setParcel] = useState(null);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState(null);

  const copyCarrierResponse = (text) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Carrier response copied to clipboard'),
      () => toast.error('Failed to copy to clipboard')
    );
  };

  // Feed data up to parent for report generation
  useEffect(() => {
    if (typeof onDataChange === 'function') {
      onDataChange({
        candidates: results?.candidates || [],
        location: results?.location || {},
        address: `${address} ${city} ${state} ${zip}`.trim(),
      });
    }
  }, [results, address, city, state, zip, onDataChange]);

  const canSubmit = useMemo(() => {
    return Boolean(address?.trim() && city?.trim() && state?.trim() && zip?.trim());
  }, [address, city, state, zip]);

  const openEvidencePacket = (candidate) => {
    try {
      if (!candidate || !results?.location) return;
      const loc = results.location;
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);
      const sc = candidate.score_components;

      const title = `Eden Defense Pack — ${candidate.candidate_date} (${perilMode.toUpperCase()})`;
      const mapUrl = (Number.isFinite(lat) && Number.isFinite(lon))
        ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=13&size=900x360&markers=${lat},${lon},red-pushpin`
        : '';

      // Use station_details from response if available, fall back to stations_used IDs
      const stationDetails = Array.isArray(results?.station_details) ? results.station_details : [];
      const stations = stationDetails.length > 0
        ? stationDetails
        : (Array.isArray(results?.stations_used) ? results.stations_used.map(id => ({ station_id: id })) : []);

      const stationRows = stations.map(s => {
        const dist = (s?.distance_miles != null) ? `${Number(s.distance_miles).toFixed(1)} mi` : '\u2014';
        const name = s?.station_name || s?.station_id || '\u2014';
        const id = s?.station_id || '\u2014';
        const obs = s?.observation_count || '\u2014';
        const peak = s?.peak_wind_mph ? `${s.peak_wind_mph} mph` : '\u2014';
        return `<tr><td>${id}</td><td>${name}</td><td style="text-align:right">${dist}</td><td style="text-align:right">${obs}</td><td style="text-align:right">${peak}</td></tr>`;
      }).join('');

      const whyBulletsHtml = (candidate.why_bullets || []).map(b => `<li>${b}</li>`).join('');
      const scoreBarPct = sc ? Math.round((sc.composite_score || 0) * 100) : 0;

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 6px 0; color: #ea580c; }
  h2 { font-size: 13px; margin: 18px 0 8px 0; text-transform: uppercase; letter-spacing: .08em; color: #333; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .muted { color: #555; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #eee; padding: 8px 6px; }
  th { text-align: left; color: #333; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .pill { display:inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill-conf { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .pill-high { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .pill-med { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
  .pill-low { background: #f4f4f5; color: #71717a; border: 1px solid #d4d4d8; }
  .btnrow { display:flex; gap:10px; justify-content:flex-end; margin-bottom:12px; }
  .btn { border:1px solid #ddd; background:#fff; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:12px; }
  .btn:hover { background:#f7f7f7; }
  .btn-primary { background: #ea580c; color: #fff; border-color: #ea580c; }
  .btn-primary:hover { background: #c2410c; }
  ul { margin: 8px 0 0 18px; }
  li { margin-bottom: 4px; font-size: 13px; line-height: 1.5; }
  .map { width:100%; border-radius:10px; border:1px solid #ddd; overflow:hidden; }
  .kpi { display:flex; gap:16px; flex-wrap:wrap; margin-top:8px; }
  .kpi div { font-size:12px; }
  .kpi b { font-size:14px; display:block; margin-bottom:2px; }
  .score-bar { height: 10px; background: #f4f4f5; border-radius: 999px; overflow: hidden; margin-top: 6px; }
  .score-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #ea580c, #22c55e); }
  .score-row { display: flex; gap: 16px; margin-top: 4px; font-size: 11px; color: #666; }
  .carrier-box { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px; margin-top: 8px; font-size: 13px; line-height: 1.6; }
  .section-full { grid-column: 1 / -1; }
  .methodology { background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 14px; font-size: 11px; color: #666; line-height: 1.6; margin-top: 18px; }
  @media print { .btnrow { display:none; } body { margin: 0.5in; } }
</style>
</head>
<body>
  <div class="btnrow">
    <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
    <button class="btn" onclick="navigator.clipboard.writeText(document.querySelector('.carrier-box')?.innerText || '').then(()=>alert('Copied!'))">Copy Carrier Response</button>
    <button class="btn" onclick="window.close()">Close</button>
  </div>

  <h1>Defense Pack \u2014 ${candidate.candidate_date}</h1>
  <div class="muted" style="font-size:13px">${loc.matched_address || `${address}, ${city}, ${state} ${zip}`}</div>
  <div class="muted">Analysis: ${results.analysis_window?.start_date || '\u2014'} \u2192 ${results.analysis_window?.end_date || '\u2014'} \u00B7 ${perilMode.toUpperCase()} mode</div>

  ${mapUrl ? `<div style="margin-top:14px"><img class="map" src="${mapUrl}" alt="Map" /></div>` : ''}

  <div class="grid" style="margin-top:18px">
    <div class="card">
      <h2>Event Summary</h2>
      <div class="kpi">
        <div><b>${candidate.candidate_date || '\u2014'}</b>Date</div>
        ${perilMode === 'wind' ? `<div><b>${candidate.peak_wind_mph ? `${Math.round(candidate.peak_wind_mph)} mph` : '\u2014'}</b>Peak Gust</div>` : ''}
        ${perilMode === 'hail' ? `<div><b>${candidate.report_count ?? 0}</b>Reports</div>` : ''}
        <div><b>${candidate.station_count || 0}</b>Stations</div>
        <div><b><span class="pill ${candidate.confidence === 'confirmed' || candidate.confidence === 'high' ? 'pill-high' : candidate.confidence === 'medium' ? 'pill-med' : 'pill-low'}">${(candidate.confidence || 'N/A').toUpperCase()}</span></b>Confidence</div>
      </div>

      ${sc ? `
      <h2 style="margin-top:14px">Recommendation Score</h2>
      <div class="score-bar"><div class="score-fill" style="width:${scoreBarPct}%"></div></div>
      <div style="font-size:14px; font-weight:700; margin-top:4px; color:#ea580c">${scoreBarPct}%</div>
      <div class="score-row">
        <span>Wind Credibility: ${Math.round((sc.wind_credibility||0)*100)}%</span>
        <span>Verification: ${Math.round((sc.verification_strength||0)*100)}%</span>
        <span>Recency: ${Math.round((sc.recency||0)*100)}%</span>
      </div>
      ` : ''}

      <div style="font-size:13px; line-height:1.5; margin-top:12px">${candidate.event_summary || ''}</div>
    </div>

    <div class="card">
      <h2>Station Evidence</h2>
      ${stations.length ? `<table><thead><tr><th>Station</th><th>Name</th><th style="text-align:right">Distance</th><th style="text-align:right">Obs</th><th style="text-align:right">Peak</th></tr></thead><tbody>${stationRows}</tbody></table>` : `<div class="muted">No station data available.</div>`}

      <h2 style="margin-top:14px">Property Context</h2>
      <div style="font-size:12px; line-height:1.45">
        <div><b>Coordinates:</b> ${Number.isFinite(lat) ? lat.toFixed(5) : '\u2014'}, ${Number.isFinite(lon) ? lon.toFixed(5) : '\u2014'}</div>
        ${parcel?.apn ? `<div><b>APN:</b> ${parcel.apn}</div>` : ''}
        ${parcel?.county ? `<div><b>County:</b> ${parcel.county}</div>` : ''}
        ${parcel?.address ? `<div><b>Parcel Addr:</b> ${parcel.address}</div>` : ''}
        ${candidate.min_distance_miles != null ? `<div><b>Nearest Station:</b> ${candidate.min_distance_miles} mi</div>` : ''}
      </div>
    </div>

    ${whyBulletsHtml ? `
    <div class="card section-full">
      <h2>Why This Date</h2>
      <ul>${whyBulletsHtml}</ul>
    </div>
    ` : ''}

    ${candidate.carrier_response ? `
    <div class="card section-full">
      <h2>Carrier Response Paragraph</h2>
      <div class="carrier-box">${candidate.carrier_response}</div>
      <div class="muted" style="margin-top:6px">Copy this paragraph directly into carrier correspondence.</div>
    </div>
    ` : ''}
  </div>

  <div class="methodology">
    <b style="color:#333">Methodology</b><br/>
    This Defense Pack is generated from FAA-certified ASOS/METAR station observations sourced through the
    Iowa Environmental Mesonet (Iowa State University) and the National Weather Service API. Wind measurements
    are ground-truth observations from certified automated weather stations, not modeled or estimated data.
    Confidence scoring uses a three-pillar composite model: Wind Credibility (45%), Verification Strength (30%),
    and Recency (25%). All data is carrier-defensible and citation-ready.
  </div>

  <div style="text-align:center; margin-top:18px; font-size:11px; color:#999">
    Eden Claims Intelligence Platform \u00B7 Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} \u00B7 Confidential
  </div>
</body>
</html>`;

      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) {
        toast.error('Pop-up blocked: allow pop-ups to open the evidence packet.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate evidence packet.');
    }
  };


  const fetchParcel = async (lat, lon) => {
    if (!lat || !lon) return;
    const baseUrl = getApiUrl();
    if (baseUrl == null) return;

    setParcelLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/regrid/parcel/point?lat=${lat}&lon=${lon}`, {
        credentials: 'include',
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.parcel) {
          setParcel(data.parcel);
        }
      }
    } catch (e) {
      // parcel is an enhancement only; do not block the flow
      console.warn('Parcel lookup failed', e);
    } finally {
      setParcelLoading(false);
    }
  };

  const findDefensibleDates = async () => {
    const apiUrl = getApiUrl();
    if (apiUrl == null) {
      toast.error('Missing backend URL. Set REACT_APP_BACKEND_URL in Vercel/local env.');
      return;
    }
    if (!canSubmit) {
      toast.error('Please enter a complete address (including ZIP).');
      return;
    }

    setLoading(true);
    setResults(null);
    setParcel(null);

    try {
      // Backend requires start_date and end_date; compute from window_days if not set
      const today = new Date();
      const daysBack = Number(windowDays) || 365;
      const computedEnd = today.toISOString().slice(0, 10);
      const computedStart = new Date(today.getTime() - daysBack * 86400000).toISOString().slice(0, 10);

      const payload = {
        address,
        city,
        state,
        zip_code: zip,
        start_date: startDate || computedStart,
        end_date: endDate || computedEnd,
        event_type: perilMode,
        min_wind_mph: Number(minWind) || 30,
        max_distance_miles: Number(maxDistance) || 50,
      };

      const res = await fetch(`${apiUrl}/api/weather/dol/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Request failed');
      }

      const data = await res.json();
      setResults(data);

      const lat = data?.location?.latitude;
      const lon = data?.location?.longitude;
      fetchParcel(lat, lon);
    } catch (e) {
      console.error(e);
      toast.error(`DOL discovery failed: ${e?.message || 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? '' : 'min-h-screen page-enter'}>
      <div className={embedded ? 'px-4 sm:px-6 py-6' : 'px-4 sm:px-6 py-8'}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-tactical font-bold text-white tracking-wide">DOL DISCOVERY</h2>
            <p className="text-xs sm:text-sm text-zinc-500 font-mono uppercase tracking-wider">
              Find carrier-defensible wind/hail date candidates (no manual DOL required)
            </p>
          </div>
          <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-green-500/10 text-green-400 border border-green-500/30 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Ground-Truth First
          </span>
        </div>

        {/* Inputs */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="text-[11px] font-mono text-zinc-500 uppercase">Address</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                placeholder="123 Main St"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-zinc-500 uppercase">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                placeholder="Tampa"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-500 uppercase">State</label>
                <input
                  value={state}
                  onChange={(e) => setState(e.target.value.toUpperCase())}
                  className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  placeholder="FL"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-500 uppercase">ZIP</label>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  placeholder="33534"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPerilMode('wind')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border transition-all flex items-center gap-1.5 ${
                  perilMode === 'wind'
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : 'bg-zinc-950/30 text-zinc-300 border-zinc-700/50 hover:border-zinc-600/70'
                }`}
              >
                <Wind className="w-4 h-4" /> Wind
              </button>
              <button
                onClick={() => setPerilMode('hail')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase border transition-all flex items-center gap-1.5 ${
                  perilMode === 'hail'
                    ? 'bg-blue-500/15 text-blue-200 border-blue-500/40'
                    : 'bg-zinc-950/30 text-zinc-300 border-zinc-700/50 hover:border-zinc-600/70'
                }`}
              >
                <CloudHail className="w-4 h-4" /> Hail
              </button>
            </div>

            <button
              onClick={findDefensibleDates}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-mono uppercase bg-green-500/15 text-green-300 border border-green-500/30 hover:border-green-400/40 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Find Defensible Dates
            </button>
          </div>

          {/* Advanced */}
          <details className="mt-4 group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-mono uppercase text-zinc-400">
              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              Advanced
            </summary>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-mono text-zinc-500 uppercase">Window Days</label>
                <input
                  type="number"
                  value={windowDays}
                  onChange={(e) => setWindowDays(e.target.value)}
                  className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-500 uppercase">Min Wind (mph)</label>
                <input
                  type="number"
                  value={minWind}
                  onChange={(e) => setMinWind(e.target.value)}
                  className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-500 uppercase">Max Distance (mi)</label>
                <input
                  type="number"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(e.target.value)}
                  className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-zinc-500 uppercase">Start</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-zinc-500 uppercase">End</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Defaults: last 365 days, wind threshold 30 mph, max station distance 50 miles.
            </p>
          </details>
        </div>

        {/* Results */}
        {results && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-zinc-200 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" /> Property Context
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="text-zinc-200">{results?.location?.matched_address || `${address}, ${city}, ${state} ${zip}`}</div>
                <div className="text-zinc-500 text-xs font-mono">
                  Lat/Lon: {Number(results?.location?.latitude || 0).toFixed(5)}, {Number(results?.location?.longitude || 0).toFixed(5)}
                </div>
                <div className="text-zinc-500 text-xs font-mono">
                  Window: {results?.analysis_window?.start_date} → {results?.analysis_window?.end_date}
                </div>
                <div className="text-zinc-500 text-xs font-mono">
                  Stations: {results?.station_count || 0} · Observations: {results?.observation_count || 0}
                </div>
              </div>

              {/* Station Details */}
              {Array.isArray(results?.station_details) && results.station_details.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-mono uppercase text-zinc-400 mb-2">Station Evidence</div>
                  <div className="space-y-1.5">
                    {results.station_details.map((s) => (
                      <div key={s.station_id} className="text-xs text-zinc-300 bg-zinc-950/30 rounded px-2 py-1.5 border border-zinc-800/40">
                        <div className="font-mono text-zinc-200">{s.station_id}</div>
                        <div className="text-zinc-500">{s.station_name}</div>
                        <div className="text-zinc-500 flex gap-2 mt-0.5">
                          {s.distance_miles != null && <span>{s.distance_miles} mi</span>}
                          {s.observation_count != null && <span>{s.observation_count} obs</span>}
                          {s.peak_wind_mph > 0 && <span>{s.peak_wind_mph} mph peak</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs font-mono uppercase text-zinc-400">Parcel (Regrid)</div>
                {parcelLoading && (
                  <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading parcel…
                  </div>
                )}
                {!parcelLoading && parcel && (
                  <div className="mt-2 text-sm text-zinc-200 space-y-1">
                    {parcel?.apn && <div><span className="text-zinc-500">APN:</span> {parcel.apn}</div>}
                    {parcel?.county && <div><span className="text-zinc-500">County:</span> {parcel.county}</div>}
                    {parcel?.address && <div><span className="text-zinc-500">Parcel Addr:</span> {parcel.address}</div>}
                  </div>
                )}
                {!parcelLoading && !parcel && (
                  <div className="mt-2 text-xs text-zinc-500">Parcel lookup unavailable (optional).</div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-zinc-200">Ranked Recommendations</h3>
              <div className="mt-3 space-y-3">
                {(results?.candidates || []).length === 0 && (
                  <div className="text-sm text-zinc-500">No candidates found for the selected window/filters.</div>
                )}
                {(results?.candidates || []).map((c, idx) => {
                  const isExpanded = expandedCandidate === idx;
                  const sc = c.score_components;
                  const confStyle = {
                    confirmed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    high: 'bg-green-500/15 text-green-300 border-green-500/30',
                    medium: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
                    low: 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40',
                    unverified: 'bg-zinc-800/30 text-zinc-500 border-zinc-700/30',
                  };
                  return (
                    <div key={`${c.candidate_date}-${idx}`} className={`border rounded-lg p-3 bg-zinc-950/20 transition-all ${idx === 0 ? 'border-orange-500/40 ring-1 ring-orange-500/20' : 'border-zinc-800/60'}`}>
                      {/* Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-zinc-500">#{idx + 1}</span>
                          <span className="text-sm font-mono text-zinc-100 font-bold">{c.candidate_date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEvidencePacket(c)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-zinc-700/50 bg-zinc-900/40 text-zinc-200 text-[11px] font-mono hover:bg-zinc-900/70" title="Evidence packet">
                            <FileText className="w-3.5 h-3.5" /> Packet
                          </button>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${confStyle[c.confidence] || confStyle.unverified}`}>{c.confidence}</span>
                        </div>
                      </div>

                      {/* Metrics */}
                      {perilMode === 'wind' && (
                        <div className="mt-2 text-xs font-mono text-zinc-400">
                          Peak gust: {c.peak_wind_mph ? `${Math.round(c.peak_wind_mph)} mph` : '—'} · Stations: {c.station_count || 0}
                          {c.min_distance_miles != null && ` · Closest: ${c.min_distance_miles} mi`}
                          {c.observation_count ? ` · ${c.observation_count} obs` : ''}
                        </div>
                      )}
                      {perilMode === 'hail' && (
                        <div className="mt-2 text-xs font-mono text-zinc-400">
                          Reports: {c.report_count ?? 0} · Closest: {c.min_distance_miles ? `${c.min_distance_miles} mi` : '—'} · Max size: {c.max_hail_inches ? `${c.max_hail_inches}"` : '—'}
                        </div>
                      )}

                      {/* Composite score bar */}
                      {sc && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-zinc-800/60 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.round((sc.composite_score || 0) * 100)}%`, background: 'linear-gradient(90deg, #f97316, #22c55e)' }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">{Math.round((sc.composite_score || 0) * 100)}%</span>
                          </div>
                          <div className="flex gap-3 mt-1 text-[10px] font-mono text-zinc-500">
                            <span>Wind: {Math.round((sc.wind_credibility || 0) * 100)}%</span>
                            <span>Verify: {Math.round((sc.verification_strength || 0) * 100)}%</span>
                            <span>Recent: {Math.round((sc.recency || 0) * 100)}%</span>
                          </div>
                        </div>
                      )}

                      <div className="mt-2 text-sm text-zinc-200">{c.event_summary}</div>

                      {/* Why this date + Carrier Response */}
                      {(c.why_bullets?.length > 0 || c.carrier_response) && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setExpandedCandidate(isExpanded ? null : idx)}
                            className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-orange-400/80 hover:text-orange-300 transition-colors"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            {isExpanded ? 'Hide details' : 'Why this date'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-3">
                              {c.why_bullets?.length > 0 && (
                                <ul className="space-y-1 pl-4">
                                  {c.why_bullets.map((b, bi) => (
                                    <li key={bi} className="text-xs text-zinc-300 list-disc">{b}</li>
                                  ))}
                                </ul>
                              )}
                              {c.carrier_response && (
                                <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-mono uppercase text-zinc-500">Carrier Response (copy-paste)</span>
                                    <button
                                      type="button"
                                      onClick={() => copyCarrierResponse(c.carrier_response)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-zinc-700/50 bg-zinc-800/40 text-[10px] font-mono text-orange-300 hover:bg-orange-500/10 transition-colors"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                  <p className="text-xs text-zinc-300 leading-relaxed">{c.carrier_response}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DolDiscovery;
