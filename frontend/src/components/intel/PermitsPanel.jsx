import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Building2, Search, Loader2, Calendar, MapPin, Shield,
  ChevronDown, ChevronUp, FileText, Home, DollarSign,
} from 'lucide-react';
import { assertApiUrl, getAuthToken } from '../../lib/api';

const getApiUrl = () => assertApiUrl();

const PermitsPanel = ({ onDataChange } = {}) => {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [county, setCounty] = useState('');

  const [loading, setLoading] = useState(false);
  const [permits, setPermits] = useState([]);
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [searched, setSearched] = useState(false);
  const [expandedPermit, setExpandedPermit] = useState(null);

  const canSubmit = Boolean(address?.trim() && (city?.trim() || zip?.trim()) && state?.trim());

  // Feed data up to parent for report generation
  useEffect(() => {
    if (typeof onDataChange === 'function') {
      onDataChange({ permits, propertyInfo, address: `${address} ${city} ${state} ${zip}`.trim() });
    }
  }, [permits, propertyInfo, address, city, state, zip, onDataChange]);

  const searchPermits = async () => {
    const apiUrl = getApiUrl();
    if (apiUrl == null) { toast.error('Backend URL not configured'); return; }
    if (!canSubmit) { toast.error('Enter address, city/ZIP, and state'); return; }

    setLoading(true);
    setPermits([]);
    setPropertyInfo(null);
    setSearched(false);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const token = getAuthToken();
      const res = await fetch(`${apiUrl}/api/weather/permits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip_code: zip.trim(),
          county: county.trim() || undefined,
        }),
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Permit lookup failed (${res.status})`);
      }

      const data = await res.json();
      setPermits(data?.permits || []);
      setPropertyInfo(data?.property_info || null);
      setSearched(true);

      if ((data?.permits || []).length > 0) {
        toast.success(`Found ${data.permits.length} permit(s)`);
      } else {
        toast.info('No permits found for this address');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Permit lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  const roofPermits = permits.filter(p => (p.type || '').toLowerCase().includes('roof'));
  const otherPermits = permits.filter(p => !(p.type || '').toLowerCase().includes('roof'));

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-tactical font-bold text-white tracking-wide">PERMIT HISTORY</h2>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
            Search building permits from county public records
          </p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-mono uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
          <Building2 className="w-3 h-3" /> Public Records
        </span>
      </div>

      {/* Search Form */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100" placeholder="123 Main St" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100" placeholder="Tampa" />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">State</label>
            <input value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100" placeholder="FL" maxLength={2} />
          </div>
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">ZIP</label>
            <input value={zip} onChange={(e) => setZip(e.target.value)} className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100" placeholder="33534" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">County (optional)</label>
            <input value={county} onChange={(e) => setCounty(e.target.value)} className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100" placeholder="Hillsborough" />
          </div>
          <button onClick={searchPermits} disabled={loading || !canSubmit} className="px-5 py-2 rounded-lg text-sm font-mono uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50 mt-5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search Permits
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-10">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-zinc-400 text-sm font-mono">Searching public permit records...</p>
          <p className="text-zinc-600 text-xs mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-4">
          {/* Property Info Card */}
          {propertyInfo && (propertyInfo.owner || propertyInfo.year_built || propertyInfo.assessed_value) && (
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-zinc-300 flex items-center gap-2 mb-3">
                <Home className="w-4 h-4 text-blue-400" /> Property Information
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {propertyInfo.owner && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">Owner</p>
                    <p className="text-sm text-zinc-200">{propertyInfo.owner}</p>
                  </div>
                )}
                {propertyInfo.year_built && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">Year Built</p>
                    <p className="text-sm text-zinc-200">{propertyInfo.year_built}</p>
                  </div>
                )}
                {propertyInfo.assessed_value && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">Assessed Value</p>
                    <p className="text-sm text-zinc-200">{propertyInfo.assessed_value}</p>
                  </div>
                )}
                {propertyInfo.parcel_id && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">Parcel/Folio</p>
                    <p className="text-sm text-zinc-200 font-mono">{propertyInfo.parcel_id}</p>
                  </div>
                )}
                {propertyInfo.property_use && (
                  <div>
                    <p className="text-[10px] font-mono text-zinc-600 uppercase">Use</p>
                    <p className="text-sm text-zinc-200">{propertyInfo.property_use}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Roofing Permits (highlighted) */}
          {roofPermits.length > 0 && (
            <div className="bg-zinc-900/50 border border-orange-500/30 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-orange-300 flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4" /> Roofing Permits ({roofPermits.length})
                <span className="text-[10px] text-zinc-500 normal-case">Critical for claim strategy</span>
              </h3>
              <div className="space-y-2">
                {roofPermits.map((p, idx) => (
                  <PermitCard key={`roof-${idx}`} permit={p} highlight expanded={expandedPermit === `roof-${idx}`} onToggle={() => setExpandedPermit(expandedPermit === `roof-${idx}` ? null : `roof-${idx}`)} />
                ))}
              </div>
            </div>
          )}

          {/* Other Permits */}
          {otherPermits.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
              <h3 className="text-sm font-mono uppercase text-zinc-300 flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-zinc-500" /> Other Permits ({otherPermits.length})
              </h3>
              <div className="space-y-2">
                {otherPermits.map((p, idx) => (
                  <PermitCard key={`other-${idx}`} permit={p} expanded={expandedPermit === `other-${idx}`} onToggle={() => setExpandedPermit(expandedPermit === `other-${idx}` ? null : `other-${idx}`)} />
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {permits.length === 0 && (
            <div className="text-center py-10">
              <Building2 className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">No permit records found</p>
              <p className="text-zinc-600 text-xs mt-1">Try adjusting the address or check the county property appraiser directly</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="text-center py-14">
          <Building2 className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-mono text-zinc-400 mb-2">Search Permit History</h3>
          <p className="text-zinc-600 text-sm max-w-lg mx-auto">
            Look up building permits from county public records. Roofing permits are highlighted — critical for determining prior work and claim strategy.
          </p>
        </div>
      )}
    </div>
  );
};

// Permit card sub-component
const PermitCard = ({ permit, highlight = false, expanded, onToggle }) => {
  const p = permit;
  const borderClass = highlight ? 'border-orange-500/40' : 'border-zinc-800/50';
  const bgClass = highlight ? 'bg-orange-500/5' : 'bg-zinc-950/20';

  return (
    <div className={`rounded-lg border ${borderClass} ${bgClass} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left p-3 hover:bg-zinc-800/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-xs font-mono text-zinc-300">{p.date || 'N/A'}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border flex-shrink-0 ${
              highlight ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40'
            }`}>{p.type || 'General'}</span>
            {p.permit_number && <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">#{p.permit_number}</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {p.value && <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">{p.value}</span>}
            {p.status && (
              <span className={`text-[10px] font-mono uppercase ${
                p.status === 'final' ? 'text-green-400' : p.status === 'active' || p.status === 'issued' ? 'text-blue-300' : 'text-zinc-500'
              }`}>{p.status}</span>
            )}
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
          </div>
        </div>
        {p.description && <p className="text-xs text-zinc-400 mt-1.5 line-clamp-1">{p.description}</p>}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-1 text-xs border-t border-zinc-800/30 mt-0 pt-2">
          {p.description && <div className="text-zinc-300">{p.description}</div>}
          {p.contractor && <div className="text-zinc-500"><span className="text-zinc-600">Contractor:</span> {p.contractor}</div>}
          {p.value && <div className="text-zinc-500"><span className="text-zinc-600">Value:</span> {p.value}</div>}
          {p.permit_number && <div className="text-zinc-500"><span className="text-zinc-600">Permit #:</span> {p.permit_number}</div>}
        </div>
      )}
    </div>
  );
};

export default PermitsPanel;
