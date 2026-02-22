import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Input } from '../../../shared/ui/input';
import { toast } from 'sonner';
import {
  Cloud, Wind, MapPin, Calendar, Search, FileText, CheckCircle2,
  AlertTriangle, Copy, Download, History, Loader2, Shield,
  Thermometer, CloudRain, Droplets, CloudLightning, Snowflake,
  Eye, ChevronDown, ChevronUp, ExternalLink, Zap, Target
} from 'lucide-react';
import { apiGet, API_URL } from '@/lib/api';

// Event type configuration - Drodat style
const EVENT_CONFIG = {
  W: { label: 'Wind', color: 'bg-orange-500', icon: Wind, description: 'High Wind Event' },
  H: { label: 'Hail', color: 'bg-cyan-500', icon: CloudRain, description: 'Hail Event' },
  T: { label: 'Tornado', color: 'bg-gray-700', icon: CloudLightning, description: 'Tornado' },
  R: { label: 'Rain', color: 'bg-blue-500', icon: Droplets, description: 'Heavy Rain' },
  S: { label: 'Storm', color: 'bg-purple-500', icon: Cloud, description: 'Severe Storm' },
};

// Confidence level styling
const CONFIDENCE_STYLES = {
  confirmed: { color: 'text-emerald-300', bg: 'bg-emerald-500/20', label: 'CONFIRMED', description: 'Strong multi-source evidence supports this DOL' },
  high: { color: 'text-green-400', bg: 'bg-green-500/20', label: 'HIGH CONFIDENCE', description: 'Strong evidence supports this DOL' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'MEDIUM CONFIDENCE', description: 'Moderate evidence, review recommended' },
  low: { color: 'text-red-400', bg: 'bg-red-500/20', label: 'LOW CONFIDENCE', description: 'Limited evidence, additional verification needed' },
  unverified: { color: 'text-slate-300', bg: 'bg-slate-500/20', label: 'UNVERIFIED', description: 'No claim-grade event signal found in selected window' },
};

const WeatherVerification = ({ embedded = false }) => {
  // Form state
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [dolDate, setDolDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventType, setEventType] = useState('wind');
  
  // Results state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // History state
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // UI state
  const [expandedEvent, setExpandedEvent] = useState(null);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const getResponseErrorDetail = async (response, fallbackMessage) => {
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
      if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
    } catch (err) {
      // Fall through to status-based message.
    }

    const statusText = response.statusText ? `: ${response.statusText}` : '';
    return `${fallbackMessage} (${response.status}${statusText})`;
  };

  const fetchJsonWithResilience = async (url, options, fallbackMessage, retries = 1, timeoutMs = 45000) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { ...options, credentials: 'include', signal: controller.signal });
        if (response.ok) {
          return { ok: true, data: await response.json(), response };
        }
        const detail = await getResponseErrorDetail(response, fallbackMessage);
        lastError = new Error(detail);
        if ([502, 503, 504].includes(response.status) && attempt < retries) {
          await delay(350 * (attempt + 1));
          continue;
        }
        return { ok: false, errorMessage: detail, response };
      } catch (err) {
        lastError = new Error('Network issue reaching weather services. Please try again in a moment.');
        if (attempt < retries) {
          await delay(450 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return { ok: false, errorMessage: lastError?.message || fallbackMessage, response: null };
  };

  // Load history on mount
  const fetchHistory = useCallback(async () => {
    try {
      const res = await apiGet('/api/weather/history?days=30');
      if (res.ok) {
        setHistory(res.data.verifications || []);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const normalizeVerificationPayload = (data) => {
    const primarySources = data?.primary_sources || [];
    const stationSource = primarySources.find(s => s.source_type === 'asos_metar') || primarySources[0];

    return {
      ...data,
      verification_status: data?.verified_dol ? 'verified' : 'review_needed',
      confidence: (data?.confidence || 'unverified').toLowerCase(),
      summary: data?.event_summary || 'Verification completed',
      nearest_station: stationSource?.station_id || 'N/A',
      station_distance: stationSource?.distance_miles !== undefined && stationSource?.distance_miles !== null
        ? `${stationSource.distance_miles} miles`
        : 'N/A',
    };
  };

  const fetchCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const result = await fetchJsonWithResilience(
        `${API_URL}/api/weather/dol/candidates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address,
            city,
            state,
            zip_code: zip,
            start_date: dolDate,
            end_date: endDate || dolDate,
            event_type: eventType,
            top_n: 10,
            max_distance_miles: 25,
            min_wind_mph: 30
          })
        },
        'Failed to fetch candidate dates',
      );

      if (result.ok) {
        setCandidates(result.data?.candidates || []);
        return { ok: true, data: result.data };
      }

      return { ok: false, errorMessage: result.errorMessage || 'Failed to fetch candidate dates' };
    } catch (err) {
      console.error('Failed to fetch candidate dates:', err);
      return { ok: false, errorMessage: err?.message || 'Failed to fetch candidate dates' };
    } finally {
      setCandidatesLoading(false);
    }
  };

  const verifyDOL = async () => {
    if (!address || !city || !state || !dolDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setEvents([]);
    setCandidates([]);

    try {
      const verifyResult = await fetchJsonWithResilience(
        `${API_URL}/api/weather/verify-dol`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address,
            city,
            state,
            zip_code: zip,
            start_date: dolDate,
            end_date: endDate || dolDate,
            event_type: eventType
          })
        },
        'Verification failed',
        1,
        60000,
      );

      let verifyPayload = null;
      if (verifyResult.ok) {
        verifyPayload = verifyResult.data;
      } else if (
        city &&
        String(verifyResult.errorMessage || '').toLowerCase().includes('unable to geocode')
      ) {
        // Retry without city for areas where postal city naming diverges.
        const retryWithoutCity = await fetchJsonWithResilience(
          `${API_URL}/api/weather/verify-dol`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              address,
              city: '',
              state,
              zip_code: zip,
              start_date: dolDate,
              end_date: endDate || dolDate,
              event_type: eventType
            })
          },
          'Verification failed',
          0,
          60000,
        );
        if (retryWithoutCity.ok) {
          verifyPayload = retryWithoutCity.data;
        } else {
          throw new Error(retryWithoutCity.errorMessage || verifyResult.errorMessage || 'Verification failed');
        }
      } else {
        throw new Error(verifyResult.errorMessage || 'Verification failed');
      }

      const normalized = normalizeVerificationPayload(verifyPayload);
      setResult(normalized);
      processEvents(normalized);
      const inlineCandidates = normalized?.candidate_dates?.[eventType] || [];
      setCandidates(inlineCandidates);

      const candidatesResult = await fetchCandidates();
      fetchHistory();

      if (candidatesResult?.ok === false) {
        toast.warning(candidatesResult.errorMessage || 'Verification complete; candidate discovery is temporarily unavailable');
      } else {
        toast.success('Verification complete');
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Failed to verify date of loss');
    } finally {
      setLoading(false);
    }
  };

  const processEvents = (data) => {
    const processed = [];

    const fromCandidates = data?.candidate_dates?.[eventType] || [];
    fromCandidates.forEach((candidate) => {
      const peakStart = candidate.peak_window_start || candidate.candidate_date;
      const [datePart, timePart = '00:00'] = String(peakStart).split(/[T ]/);
      const isWind = eventType === 'wind';
      const magnitude = isWind
        ? candidate.peak_wind_mph
        : candidate.max_hail_inches;
      const unit = isWind ? 'MPH' : 'IN';

      processed.push({
        date: candidate.candidate_date || datePart,
        time: timePart.slice(0, 5),
        type: isWind ? 'WIND SIGNAL' : 'HAIL SIGNAL',
        magnitude: magnitude || 0,
        unit,
        location: `${city}, ${state}`,
        source: isWind ? 'METAR/ASOS' : 'NWS LSR',
        remarks: isWind
          ? `${candidate.station_count || 0} station(s) corroborate this day`
          : `${candidate.report_count || 0} hail report(s), closest ${candidate.min_distance_miles || 'n/a'} miles`,
        eventBadges: isWind ? ['W'] : ['H'],
      });
    });

    if (processed.length === 0 && data?.primary_sources) {
      data.primary_sources.forEach((source) => {
        if (source.source_type !== 'asos_metar' && source.source_type !== 'nws_lsr_hail') {
          return;
        }
        const stamp = source.timestamp || '';
        const parsed = stamp ? String(stamp).split(/[T ]/) : [];
        const datePart = parsed[0] || dolDate;
        const timePart = (parsed[1] || '00:00').slice(0, 5);
        const isHail = source.source_type === 'nws_lsr_hail';
        processed.push({
          date: datePart,
          time: timePart,
          type: isHail ? 'HAIL REPORT' : 'WIND OBS',
          magnitude: isHail ? (source.magnitude || 0) : (source.max_wind_mph || 0),
          unit: isHail ? 'IN' : 'MPH',
          location: `${city}, ${state}`,
          source: isHail ? 'NWS LSR' : source.station_id,
          remarks: isHail
            ? `${source.distance_miles || 'n/a'} miles from property`
            : `${source.observation_count || 0} observations`,
          eventBadges: isHail ? ['H'] : ['W'],
        });
      });
    }

    processed.sort((a, b) => new Date(b.date) - new Date(a.date));
    setEvents(processed);
  };

  const getEventBadges = (event) => {
    const badges = [];
    const type = (event.type || '').toUpperCase();
    
    if (type.includes('HAIL')) badges.push('H');
    if (type.includes('WIND') || type.includes('TSTM')) badges.push('W');
    if (type.includes('TORNADO')) badges.push('T');
    if (type.includes('RAIN') || type.includes('FLOOD')) badges.push('R');
    if (badges.length === 0) badges.push('S');
    
    return badges;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr || 'N/A';
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const copyReport = () => {
    if (!result) return;
    
    let report = `DATE OF LOSS VERIFICATION REPORT\n`;
    report += `Generated by Eden Claims Platform\n`;
    report += `================================\n\n`;
    report += `Property: ${address}, ${city}, ${state} ${zip}\n`;
    report += `Claimed DOL: ${formatDate(dolDate)}\n`;
    report += `Verification Date: ${new Date().toLocaleDateString()}\n\n`;
    report += `VERIFICATION STATUS: ${result.verification_status?.toUpperCase()}\n`;
    report += `CONFIDENCE LEVEL: ${result.confidence?.toUpperCase()}\n\n`;
    report += `WEATHER EVENTS FOUND: ${events.length}\n`;
    report += `--------------------------------\n\n`;
    
    events.forEach(event => {
      report += `${formatDate(event.date)} @ ${event.time}\n`;
      report += `  Type: ${event.type}\n`;
      report += `  Magnitude: ${event.magnitude} ${event.unit}\n`;
      report += `  Source: ${event.source}\n`;
      if (event.remarks) report += `  Details: ${event.remarks}\n`;
      report += `\n`;
    });
    
    report += `\nDATA SOURCES\n`;
    report += `------------\n`;
    report += `• National Weather Service (NWS)\n`;
    report += `• NOAA Storm Events Database\n`;
    report += `• Local Storm Reports (LSRs)\n`;
    report += `• NEXRAD Radar Data\n`;
    report += `• METAR/ASOS Stations\n\n`;
    report += `Nearest Station: ${result.nearest_station || 'N/A'}\n`;
    report += `Station Distance: ${result.station_distance || 'N/A'}\n\n`;
    report += `This report is carrier-defensible and source-cited.`;
    
    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard');
  };

  const getConfidenceStyle = (level) => {
    return CONFIDENCE_STYLES[level] || CONFIDENCE_STYLES.medium;
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen page-enter'} text-white`}>
      {/* Header - only show if not embedded */}
      {!embedded && (
        <div className="bg-zinc-900/80 border-b border-zinc-800/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <CloudLightning className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-tactical font-bold text-white">Weather & DOL Verification</h1>
                <p className="text-zinc-500 font-mono text-sm">Forensic weather analysis for date of loss</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="border-gray-300 text-gray-300"
            >
              <History className="w-4 h-4 mr-2" />
              History ({history.length})
            </Button>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Shield className="w-3 h-3 mr-1" />
              Carrier-Defensible
            </Badge>
          </div>
        </div>
      </div>
      )}

      <div className={`${embedded ? 'p-4' : 'p-6'}`}>
        {/* Search Form */}
        <Card className="bg-zinc-900/50 border-zinc-800/50 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Property Address *</label>
                <Input
                  data-testid="address-input"
                  placeholder="123 Main St"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">City *</label>
                <Input
                  placeholder="Tampa"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">State *</label>
                <Input
                  placeholder="FL"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Date of Loss *</label>
                <Input
                  type="date"
                  value={dolDate}
                  onChange={(e) => setDolDate(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date (optional)</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Peril Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full h-10 rounded-md bg-gray-800 border border-gray-300 px-3 text-gray-900"
                >
                  <option value="wind">Wind</option>
                  <option value="hail">Hail</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button 
                onClick={verifyDOL}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Verify + Discover Dates
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800/50 mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Recent Verifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {history.slice(0, 10).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-750 cursor-pointer"
                    onClick={() => {
                      setAddress(item.address || '');
                      setCity(item.city || '');
                      setState(item.state || '');
                      setDolDate(item.analysis_start_date || '');
                      setShowHistory(false);
                    }}
                  >
                    <div>
                      <p className="text-gray-900 font-medium text-sm">{item.address}, {item.city}</p>
                      <p className="text-gray-500 text-xs">Window start: {formatDate(item.analysis_start_date)}</p>
                    </div>
                    <Badge className={`${
                      item.dol_confidence === 'confirmed' || item.dol_confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                      item.dol_confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {item.dol_confidence || 'N/A'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Verification Summary */}
            <div className="space-y-4">
              {/* Status Card */}
              <Card className="bg-white border-gray-200">
                <CardContent className="p-4">
                  <div className="text-center">
                    {result.verification_status === 'verified' ? (
                      <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {result.verification_status === 'verified' ? 'DOL VERIFIED' : 'REVIEW NEEDED'}
                    </h3>
                    <p className="text-gray-600 text-sm">{result.summary}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Confidence Level */}
              <Card className={`border-gray-200 ${getConfidenceStyle(result.confidence).bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Zap className={`w-6 h-6 ${getConfidenceStyle(result.confidence).color}`} />
                    <div>
                      <p className={`font-bold ${getConfidenceStyle(result.confidence).color}`}>
                        {getConfidenceStyle(result.confidence).label}
                      </p>
                      <p className="text-gray-600 text-xs">
                        {getConfidenceStyle(result.confidence).description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Station Info */}
              <Card className="bg-white border-gray-200">
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Data Source</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">Nearest Station</span>
                      <span className="text-gray-900 text-sm font-medium">{result.nearest_station || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">Distance</span>
                      <span className="text-gray-900 text-sm font-medium">{result.station_distance || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">Events Found</span>
                      <span className="text-gray-900 text-sm font-medium">{events.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  onClick={copyReport}
                  className="flex-1 bg-gray-800 hover:bg-gray-700"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Report
                </Button>
                <Button 
                  className="flex-1 bg-gray-800 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>

            {/* Right Column - Events Table (Drodat Style) */}
            <div className="lg:col-span-2">
              <Card className="bg-white border-gray-200 mb-4">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-500" />
                      Top Candidate DOLs
                    </CardTitle>
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      {eventType.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {candidatesLoading ? (
                    <div className="py-6 text-center text-gray-500 text-sm">
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                      Ranking candidate dates...
                    </div>
                  ) : candidates.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">
                      No claim-grade candidate dates found in this window.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {candidates.slice(0, 5).map((candidate, index) => (
                        <div key={`${candidate.candidate_date}-${index}`} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900">
                              #{index + 1} {formatDate(candidate.candidate_date)}
                            </p>
                            <Badge className={`${
                              candidate.confidence === 'confirmed' || candidate.confidence === 'high'
                                ? 'bg-green-500/20 text-green-700'
                                : candidate.confidence === 'medium'
                                  ? 'bg-yellow-500/20 text-yellow-700'
                                  : 'bg-slate-500/20 text-slate-700'
                            }`}>
                              {(candidate.confidence || 'low').toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            {eventType === 'wind'
                              ? `Peak wind ${candidate.peak_wind_mph || 0} mph | ${candidate.station_count || 0} station(s)`
                              : `Max hail ${candidate.max_hail_inches || 0} in | ${candidate.report_count || 0} report(s)`}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Window: {candidate.peak_window_start || 'n/a'} -> {candidate.peak_window_end || 'n/a'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-blue-400" />
                      Weather Events
                    </CardTitle>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      {events.length} Events
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 text-xs font-medium text-gray-500 border-b border-gray-200">
                    <div className="col-span-3">Date & Time</div>
                    <div className="col-span-2">Type</div>
                    <div className="col-span-2">Magnitude</div>
                    <div className="col-span-2">Source</div>
                    <div className="col-span-3">Events</div>
                  </div>

                  {/* Events List */}
                  <div className="max-h-[500px] overflow-y-auto">
                    {events.length === 0 ? (
                      <div className="text-center py-12">
                        <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">No weather events found</p>
                        <p className="text-gray-400 text-sm">Enter a date of loss to search</p>
                      </div>
                    ) : (
                      events.map((event, idx) => (
                        <div key={idx}>
                          <div 
                            className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                              expandedEvent === idx ? 'bg-orange-50' : ''
                            }`}
                            onClick={() => setExpandedEvent(expandedEvent === idx ? null : idx)}
                          >
                            {/* Date & Time */}
                            <div className="col-span-3 min-w-0">
                              <p className="text-gray-900 font-medium text-sm truncate">{formatDate(event.date)}</p>
                              <p className="text-gray-500 text-xs">{event.time}</p>
                            </div>
                            
                            {/* Type */}
                            <div className="col-span-2 text-gray-600 flex items-center text-sm truncate">
                              {event.type}
                            </div>
                            
                            {/* Magnitude */}
                            <div className={`col-span-2 font-bold text-sm ${
                              (event.unit === 'MPH' && parseFloat(event.magnitude) > 50) ? 'text-red-600' :
                              (event.unit === 'MPH' && parseFloat(event.magnitude) > 30) ? 'text-orange-600' :
                              (event.unit === 'IN' && parseFloat(event.magnitude) > 1) ? 'text-cyan-600' :
                              'text-gray-700'
                            }`}>
                              {event.magnitude} {event.unit}
                            </div>
                            
                            {/* Source */}
                            <div className="col-span-2">
                              <Badge variant="outline" className="text-gray-600 border-gray-300 text-xs">
                                {event.source}
                              </Badge>
                            </div>
                            
                            {/* Event Badges */}
                            <div className="col-span-3 flex flex-wrap gap-1">
                              {event.eventBadges?.map((badge, i) => (
                                <span
                                  key={i}
                                  className={`${EVENT_CONFIG[badge]?.color || 'bg-gray-200'} text-gray-900 text-xs font-bold px-2 py-0.5 rounded`}
                                  title={EVENT_CONFIG[badge]?.description}
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                            
                            {/* Expand Icon */}
                            <div className="col-span-1 flex justify-end">
                              {expandedEvent === idx ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                          
                          {/* Expanded Details */}
                          {expandedEvent === idx && event.remarks && (
                            <div className="px-4 py-3 bg-gray-800/30 border-b border-gray-200">
                              <p className="text-gray-600 text-sm">
                                <span className="text-gray-500 font-medium">Details: </span>
                                {event.remarks}
                              </p>
                              {event.location && (
                                <p className="text-gray-500 text-xs mt-1">
                                  <MapPin className="w-3 h-3 inline mr-1" />
                                  {event.location}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="text-center py-16">
            <CloudLightning className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">Verify Date of Loss</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Enter the property address and claimed date of loss to retrieve weather event data from NWS, NOAA, and local storm reports.
            </p>
          </div>
        )}

        {/* Data Sources Footer */}
        {result && (
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-300">Verified Data Sources</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['NWS', 'NOAA', 'LSRs', 'NEXRAD Radar', 'METAR', 'ASOS'].map(source => (
                <Badge key={source} variant="outline" className="text-gray-600 border-gray-300">
                  {source}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Reports are carrier-defensible and immutable once attached to a claim.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherVerification;
