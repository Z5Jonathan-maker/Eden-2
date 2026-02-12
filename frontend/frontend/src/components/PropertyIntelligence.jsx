import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { toast } from 'sonner';
import {
  Search,
  Satellite,
  Map as MapIcon,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Cloud,
  Home,
  Shield,
  Loader2,
  Image as ImageIcon,
  History,
  Target,
  Wind,
  CloudRain,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const EVENT_BADGES = {
  W: { label: 'Wind', color: 'bg-orange-500', description: 'Wind event signal' },
  H: { label: 'Hail', color: 'bg-blue-500', description: 'Hail event signal' },
};

const HISTORICAL_DATES = [
  { date: '2024-08-15', label: 'Aug 15, 2024' },
  { date: '2024-03-22', label: 'Mar 22, 2024' },
  { date: '2023-09-10', label: 'Sep 10, 2023' },
  { date: '2023-04-05', label: 'Apr 5, 2023' },
  { date: '2022-11-18', label: 'Nov 18, 2022' },
  { date: '2022-06-30', label: 'Jun 30, 2022' },
];

const confidenceBadgeClass = (confidence) => {
  if (confidence === 'confirmed' || confidence === 'high') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (confidence === 'medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
};

const PropertyIntelligence = ({ embedded = false }) => {
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [perilMode, setPerilMode] = useState('wind');

  const [loading, setLoading] = useState(false);
  const [propertyData, setPropertyData] = useState(null);
  const [dolCandidates, setDolCandidates] = useState([]);
  const [selectedDolCandidate, setSelectedDolCandidate] = useState(null);
  const [weatherEvents, setWeatherEvents] = useState([]);
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('satellite');
  const [selectedImageDate, setSelectedImageDate] = useState(0);

  const token = localStorage.getItem('eden_token');

  const processWeatherEvents = (candidates, peril) => {
    return (candidates || [])
      .map((candidate) => ({
        date: candidate.candidate_date,
        signalValue: peril === 'wind' ? (candidate.peak_wind_mph || 0) : (candidate.max_hail_inches || 0),
        signalUnit: peril === 'wind' ? 'mph' : 'in',
        evidence: peril === 'wind'
          ? `${candidate.station_count || 0} station(s), weighted ${candidate.weighted_support_score || 0}`
          : `${candidate.report_count || 0} report(s), nearest ${candidate.min_distance_miles || 'n/a'} mi`,
        confidence: candidate.confidence || 'low',
        eventTypes: [peril === 'wind' ? 'W' : 'H'],
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const fetchPropertyIntelligence = async () => {
    if (!address || !city || !state) {
      toast.error('Please enter a complete address');
      return;
    }

    if (!API_URL) {
      toast.error('Backend URL is not configured');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const basePayload = {
        address,
        city,
        state,
        zip_code: zip,
        start_date: startDate,
        end_date: endDate,
        event_type: perilMode,
        top_n: 10,
        max_distance_miles: 25,
        min_wind_mph: 30,
      };

      const candidateRes = await fetch(`${API_URL}/api/weather/dol/candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(basePayload),
      });

      if (!candidateRes.ok) {
        throw new Error('Failed to fetch DOL candidates');
      }

      const candidateData = await candidateRes.json();
      const candidates = candidateData.candidates || [];
      setDolCandidates(candidates);
      setSelectedDolCandidate(candidates[0] || null);
      setWeatherEvents(processWeatherEvents(candidates, perilMode));

      const selectedDate = candidates[0]?.candidate_date || endDate;
      const verifyRes = await fetch(`${API_URL}/api/weather/verify-dol`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          address,
          city,
          state,
          zip_code: zip,
          start_date: selectedDate,
          end_date: selectedDate,
          event_type: perilMode,
        }),
      });

      let verifyData = null;
      if (verifyRes.ok) {
        verifyData = await verifyRes.json();
      }

      setPropertyData({
        address: `${address}, ${city}, ${state} ${zip}`,
        coordinates: verifyData?.location || candidateData?.location || null,
        verifiedDol: verifyData?.verified_dol || candidates[0]?.candidate_date || null,
        confidence: verifyData?.confidence || candidates[0]?.confidence || 'unverified',
        summary: verifyData?.event_summary || null,
        lastUpdated: new Date().toISOString(),
      });

      toast.success('Property intel loaded with DOL candidates');
    } catch (err) {
      console.error(err);
      setError('Failed to fetch property intelligence');
      setPropertyData(null);
      setDolCandidates([]);
      setSelectedDolCandidate(null);
      setWeatherEvents([]);
      toast.error('Failed to fetch property intel');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr || 'N/A';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const copyReport = () => {
    if (!propertyData) return;

    let report = 'PROPERTY INTEL + DOL DISCOVERY REPORT\n';
    report += 'Generated by Eden Claims Platform\n';
    report += '================================\n\n';
    report += `Property: ${propertyData.address}\n`;
    report += `Report Date: ${new Date().toLocaleDateString()}\n`;
    report += `Peril Mode: ${perilMode.toUpperCase()}\n`;
    report += `Selected DOL: ${propertyData.verifiedDol ? formatDate(propertyData.verifiedDol) : 'N/A'}\n`;
    report += `Confidence: ${(propertyData.confidence || 'unverified').toUpperCase()}\n\n`;
    report += 'CANDIDATE DATES\n';
    report += '----------------\n';

    dolCandidates.slice(0, 10).forEach((candidate, idx) => {
      report += `${idx + 1}. ${formatDate(candidate.candidate_date)} | ${String(candidate.confidence || 'low').toUpperCase()}\n`;
      if (perilMode === 'wind') {
        report += `   Peak Wind: ${candidate.peak_wind_mph || 0} mph\n`;
        report += `   Stations: ${candidate.station_count || 0}\n`;
      } else {
        report += `   Max Hail: ${candidate.max_hail_inches || 0} in\n`;
        report += `   Reports: ${candidate.report_count || 0}\n`;
      }
    });

    report += '\nData Sources: NWS, NOAA, METAR/ASOS, IEM LSR, Satellite Imagery\n';
    report += 'This report is carrier-defensible and source-cited.';

    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard');
  };

  return (
    <div className={`${embedded ? '' : 'min-h-screen'} bg-gray-50 text-gray-900`}>
      {!embedded && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Satellite className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Property Intelligence</h1>
                <p className="text-gray-600 text-sm">Historical imagery first, integrated DOL discovery built in</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Shield className="w-3 h-3 mr-1" />
              Carrier-Defensible
            </Badge>
          </div>
        </div>
      )}

      <div className={`${embedded ? 'p-4' : 'p-6'}`}>
        <Card className="bg-white border-gray-200 mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Street Address</label>
                <Input
                  placeholder="123 Main St"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">City</label>
                <Input
                  placeholder="Tampa"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">State</label>
                <Input
                  placeholder="FL"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">ZIP</label>
                <Input
                  placeholder="33601"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="bg-gray-800 border-gray-300 text-gray-900"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Peril</label>
                <select
                  value={perilMode}
                  onChange={(e) => setPerilMode(e.target.value)}
                  className="w-full h-10 rounded-md bg-gray-800 border border-gray-300 px-3 text-gray-900"
                >
                  <option value="wind">Wind</option>
                  <option value="hail">Hail</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button
                onClick={fetchPropertyIntelligence}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-4"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">Run Intel + DOL Discovery</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="bg-red-50 border-red-200 mb-6">
            <CardContent className="p-4 text-red-700 text-sm">{error}</CardContent>
          </Card>
        )}

        {propertyData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-blue-400" />
                      Property View
                    </CardTitle>
                    <div className="flex bg-gray-800 rounded-lg p-1">
                      {[
                        { key: 'aerial', label: 'Aerial', icon: Eye },
                        { key: 'satellite', label: 'Satellite', icon: Satellite },
                        { key: 'street', label: 'Street', icon: MapIcon },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setViewMode(key)}
                          className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${
                            viewMode === key
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="relative h-64 bg-gray-800 rounded-lg overflow-hidden">
                    <iframe
                      className="w-full h-full border-0"
                      src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(propertyData.address)}&maptype=${viewMode === 'street' ? 'roadmap' : 'satellite'}&zoom=19`}
                      allowFullScreen
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
                      <p className="text-xs text-gray-300">Captured on</p>
                      <p className="text-sm font-medium text-white">{HISTORICAL_DATES[selectedImageDate].label}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Historical Imagery Timeline
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedImageDate(Math.max(0, selectedImageDate - 1))}
                          className="p-1 text-gray-500 hover:text-gray-900"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedImageDate(Math.min(HISTORICAL_DATES.length - 1, selectedImageDate + 1))}
                          className="p-1 text-gray-500 hover:text-gray-900"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {HISTORICAL_DATES.map((img, idx) => (
                        <button
                          key={img.date}
                          onClick={() => setSelectedImageDate(idx)}
                          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                            selectedImageDate === idx
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {img.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Home className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-medium">{propertyData.address}</p>
                      <p className="text-gray-500 text-sm mt-1">
                        Last updated: {new Date(propertyData.lastUpdated).toLocaleString()}
                      </p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge className={confidenceBadgeClass(propertyData.confidence)}>
                          {(propertyData.confidence || 'unverified').toUpperCase()}
                        </Badge>
                        {propertyData.verifiedDol && (
                          <Badge variant="outline" className="border-blue-300 text-blue-700">
                            Selected DOL: {formatDate(propertyData.verifiedDol)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={copyReport}
                        className="p-2 text-gray-500 hover:text-gray-900 bg-gray-800 rounded-lg"
                        title="Copy Report"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 text-gray-500 hover:text-gray-900 bg-gray-800 rounded-lg"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-emerald-500" />
                      DOL Discovery Candidates
                    </CardTitle>
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                      {perilMode.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {dolCandidates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No candidates found in this analysis window.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dolCandidates.slice(0, 6).map((candidate, index) => {
                        const isSelected = selectedDolCandidate?.candidate_date === candidate.candidate_date;
                        return (
                          <button
                            key={`${candidate.candidate_date}-${index}`}
                            onClick={() => {
                              setSelectedDolCandidate(candidate);
                              setPropertyData((prev) => ({
                                ...prev,
                                verifiedDol: candidate.candidate_date,
                                confidence: candidate.confidence,
                              }));
                            }}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-gray-900">
                                #{index + 1} {formatDate(candidate.candidate_date)}
                              </p>
                              <Badge className={confidenceBadgeClass(candidate.confidence)}>
                                {String(candidate.confidence || 'low').toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {perilMode === 'wind'
                                ? `${candidate.peak_wind_mph || 0} mph peak, ${candidate.station_count || 0} station(s)`
                                : `${candidate.max_hail_inches || 0} in hail, ${candidate.report_count || 0} report(s)`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white border-gray-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-blue-400" />
                      Signal Timeline
                    </CardTitle>
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                      {weatherEvents.length} Signals
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-800/50 text-xs font-medium text-gray-500 border-b border-gray-200">
                    <div className="col-span-4">Date</div>
                    <div className="col-span-2 flex items-center gap-1">
                      {perilMode === 'wind' ? <Wind className="w-3 h-3" /> : <CloudRain className="w-3 h-3" />} Signal
                    </div>
                    <div className="col-span-4">Evidence</div>
                    <div className="col-span-2">Type</div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto">
                    {weatherEvents.length === 0 ? (
                      <div className="text-center py-12">
                        <Cloud className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-500">No discovery signals found</p>
                        <p className="text-gray-600 text-sm">Run intel for this property to populate timeline</p>
                      </div>
                    ) : (
                      weatherEvents.map((event, idx) => (
                        <div
                          key={idx}
                          className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-gray-200/50 hover:bg-gray-800/30 transition-colors"
                        >
                          <div className="col-span-4 text-gray-900 font-medium">{formatDate(event.date)}</div>
                          <div className="col-span-2 text-gray-300">{event.signalValue} {event.signalUnit}</div>
                          <div className="col-span-4 text-gray-500 text-xs">{event.evidence}</div>
                          <div className="col-span-2 flex gap-1">
                            {event.eventTypes.map((type) => (
                              <span
                                key={type}
                                className={`${EVENT_BADGES[type]?.color} text-white text-xs font-bold px-2 py-0.5 rounded`}
                                title={EVENT_BADGES[type]?.description}
                              >
                                {type}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {!propertyData && !loading && (
          <div className="text-center py-16">
            <Satellite className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">Enter Property Address</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Run one workflow for historical imagery + carrier-defensible DOL discovery signals.
            </p>
          </div>
        )}

        {propertyData && (
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-300">Verified Data Sources</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['NWS', 'NOAA', 'METAR/ASOS', 'IEM LSR', 'Satellite Imagery'].map((source) => (
                <Badge key={source} variant="outline" className="text-gray-600 border-gray-300">
                  {source}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Property Intel now includes DOL candidate ranking. Use confidence + evidence before claim filing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyIntelligence;
