import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Shield, Search, Wind, CloudHail, MapPin, Loader2, ChevronDown, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DolDiscovery = ({ embedded = false }) => {
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

  const token = localStorage.getItem('eden_token');

  const canSubmit = useMemo(() => {
    return Boolean(address?.trim() && city?.trim() && state?.trim() && zip?.trim());
  }, [address, city, state, zip]);

  const openEvidencePacket = (candidate) => {
    try {
      if (!candidate || !results?.location) return;
      const loc = results.location;
      const lat = Number(loc.latitude);
      const lon = Number(loc.longitude);

      const title = `Eden Evidence Packet — ${candidate.candidate_date} (${perilMode.toUpperCase()})`;
      const mapUrl = (Number.isFinite(lat) && Number.isFinite(lon))
        ? `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=13&size=900x360&markers=${lat},${lon},red-pushpin`
        : '';

      const stations = Array.isArray(candidate.stations_used) ? candidate.stations_used : [];
      const rebuttals = Array.isArray(candidate.denial_rebuttal_bullets) ? candidate.denial_rebuttal_bullets : [];

      const stationRows = stations.map(s => {
        const dist = (s?.distance_miles != null) ? `${Number(s.distance_miles).toFixed(1)} mi` : '—';
        const name = s?.station_name || s?.station_id || '—';
        const id = s?.station_id || '—';
        return `<tr><td>${id}</td><td>${name}</td><td style="text-align:right">${dist}</td></tr>`;
      }).join('');

      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 6px 0; }
  h2 { font-size: 14px; margin: 18px 0 8px 0; text-transform: uppercase; letter-spacing: .08em; color: #333; }
  .muted { color: #555; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 18px; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border-bottom: 1px solid #eee; padding: 8px 6px; }
  th { text-align: left; color: #333; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
  .pill { display:inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; border: 1px solid #ddd; }
  .btnrow { display:flex; gap:10px; justify-content:flex-end; margin-bottom:12px; }
  .btn { border:1px solid #ddd; background:#fff; padding:8px 10px; border-radius:8px; cursor:pointer; font-size:12px; }
  .btn:hover { background:#f7f7f7; }
  ul { margin: 8px 0 0 18px; }
  .map { width:100%; border-radius:10px; border:1px solid #ddd; overflow:hidden; }
  .kpi { display:flex; gap:12px; flex-wrap:wrap; margin-top:8px; }
  .kpi div { font-size:12px; }
  .kpi b { font-size:13px; }
  @media print { .btnrow { display:none; } body { margin: 0.5in; } }
</style>
</head>
<body>
  <div class="btnrow">
    <button class="btn" onclick="window.print()">Print</button>
    <button class="btn" onclick="window.close()">Close</button>
  </div>

  <h1>Evidence Packet — ${candidate.candidate_date} <span class="pill">${perilMode.toUpperCase()}</span></h1>
  <div class="muted">${loc.address || ''}${loc.city ? `, ${loc.city}` : ''}${loc.state ? `, ${loc.state}` : ''} ${loc.zip_code || ''}</div>
  <div class="muted">Analysis window: ${results.analysis_start_date} → ${results.analysis_end_date}</div>

  ${mapUrl ? `<div style="margin-top:14px"><img class="map" src="${mapUrl}" alt="Map" /></div>` : ''}

  <div class="grid" style="margin-top:14px">
    <div class="card">
      <h2>Event Summary</h2>
      <div class="kpi">
        <div><b>Peak window</b><br/>${candidate.peak_window_start || '—'} → ${candidate.peak_window_end || '—'}</div>
        ${perilMode === 'wind' ? `<div><b>Peak gust</b><br/>${candidate.max_gust_mph ? `${Math.round(candidate.max_gust_mph)} mph` : '—'}</div>` : ''}
        ${perilMode === 'hail' ? `<div><b>Hail reports</b><br/>${candidate.hail_reports ?? 0}</div>` : ''}
        ${perilMode === 'hail' ? `<div><b>Max hail</b><br/>${candidate.max_hail_in ? `${candidate.max_hail_in}"` : '—'}</div>` : ''}
        <div><b>Confidence</b><br/>${candidate.confidence}</div>
      </div>

      <h2 style="margin-top:14px">Why defensible</h2>
      <div style="font-size:13px; line-height:1.45">${candidate.explanation || ''}</div>

      <h2 style="margin-top:14px">Common denial rebuttals</h2>
      ${rebuttals.length ? `<ul>${rebuttals.map(b => `<li>${b}</li>`).join('')}</ul>` : `<div class="muted">No rebuttal bullets returned for this candidate.</div>`}
    </div>

    <div class="card">
      <h2>Stations used</h2>
      ${stations.length ? `<table><thead><tr><th>Station</th><th>Name</th><th style="text-align:right">Distance</th></tr></thead><tbody>${stationRows}</tbody></table>` : `<div class="muted">No stations listed for this candidate.</div>`}

      <h2 style="margin-top:14px">Property context</h2>
      <div style="font-size:12px; line-height:1.45">
        <div><b>Lat/Lon:</b> ${Number.isFinite(lat) ? lat.toFixed(5) : '—'}, ${Number.isFinite(lon) ? lon.toFixed(5) : '—'}</div>
        ${parcel?.apn ? `<div><b>APN:</b> ${parcel.apn}</div>` : ''}
        ${parcel?.county ? `<div><b>County:</b> ${parcel.county}</div>` : ''}
        ${parcel?.address ? `<div><b>Parcel Addr:</b> ${parcel.address}</div>` : ''}
      </div>

      <h2 style="margin-top:14px">Notes</h2>
      <div class="muted">This packet is generated from certified station observations (wind) and/or NWS Local Storm Reports (hail corroboration). Radar layers, if used elsewhere in Eden, are corroboration-only.</div>
    </div>
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
    if (!API_URL) return;

    setParcelLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/regrid/parcel/point?lat=${lat}&lon=${lon}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    if (!API_URL) {
      toast.error('Missing backend URL. Set REACT_APP_BACKEND_URL in Vercel/local env.');
      return;
    }
    if (!token) {
      toast.error('Missing auth token. Please log in again.');
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
      const payload = {
        address,
        city,
        state,
        zip_code: zip,
        peril_mode: perilMode,
        window_days: Number(windowDays) || 365,
        min_wind_mph: Number(minWind) || 30,
        max_distance_miles: Number(maxDistance) || 50,
      };
      // optional advanced override
      if (startDate && endDate) {
        payload.start_date = startDate;
        payload.end_date = endDate;
      }

      const res = await fetch(`${API_URL}/api/weather/dol/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
                <div className="text-zinc-200">{results?.location?.address}</div>
                <div className="text-zinc-500">{results?.location?.city}, {results?.location?.state} {results?.location?.zip_code}</div>
                <div className="text-zinc-500 text-xs font-mono">
                  Lat/Lon: {Number(results?.location?.latitude || 0).toFixed(5)}, {Number(results?.location?.longitude || 0).toFixed(5)}
                </div>
                <div className="text-zinc-500 text-xs font-mono">
                  Window: {results?.analysis_start_date} → {results?.analysis_end_date}
                </div>
              </div>

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
              <h3 className="text-sm font-mono uppercase text-zinc-200">Ranked Candidates</h3>
              <div className="mt-3 space-y-3">
                {(results?.candidates || []).length === 0 && (
                  <div className="text-sm text-zinc-500">No candidates found for the selected window/filters.</div>
                )}
                {(results?.candidates || []).map((c, idx) => (
                  <div key={`${c.candidate_date}-${idx}`} className="border border-zinc-800/60 rounded-lg p-3 bg-zinc-950/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-mono text-zinc-100">{c.candidate_date}</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEvidencePacket(c)}
                          className="inline-flex items-center gap-2 px-2 py-1 rounded border border-zinc-700/50 bg-zinc-900/40 text-zinc-200 text-[11px] font-mono hover:bg-zinc-900/70"
                          title="Open a printable, desk-adjuster-friendly evidence packet"
                        >
                          <FileText className="w-3.5 h-3.5" /> Packet
                        </button>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                          c.confidence === 'high' ? 'bg-green-500/15 text-green-300 border-green-500/30'
                            : c.confidence === 'medium' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
                              : 'bg-zinc-800/40 text-zinc-300 border-zinc-700/40'
                        }`}>{c.confidence}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">
                      {perilMode === 'wind' && (
                        <div className="text-xs font-mono text-zinc-400">
                          Peak gust: {c.max_gust_mph ? `${Math.round(c.max_gust_mph)} mph` : '—'} · Stations: {(c.stations_used || []).length}
                        </div>
                      )}
                      {perilMode === 'hail' && (
                        <div className="text-xs font-mono text-zinc-400">
                          Reports: {c.hail_reports ?? 0} · Closest: {c.min_report_distance_miles ? `${Math.round(c.min_report_distance_miles)} mi` : '—'} · Max size: {c.max_hail_in ? `${c.max_hail_in}"` : '—'}
                        </div>
                      )}
                      <div className="mt-2 text-sm text-zinc-200">{c.explanation}</div>
                      {(c.denial_rebuttal_bullets || []).length > 0 && (
                        <ul className="mt-2 list-disc pl-5 text-sm text-zinc-300 space-y-1">
                          {c.denial_rebuttal_bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DolDiscovery;
