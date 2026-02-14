import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Input } from '../shared/ui/input';
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
const WAYBACK_SELECTION_URL = 'https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer?f=pjson';
const ESRI_WORLD_IMAGERY_TILE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const WAYBACK_TILE_URL = (releaseId) => `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?blankTile=false&release=${encodeURIComponent(releaseId)}`;
const CENSUS_GEOCODE_URL = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

const EVENT_BADGES = {
  W: { label: 'Wind', color: 'bg-orange-500', description: 'Wind event signal' },
  H: { label: 'Hail', color: 'bg-blue-500', description: 'Hail event signal' },
};

const confidenceBadgeClass = (confidence) => {
  if (confidence === 'confirmed' || confidence === 'high') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (confidence === 'medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
};

const MapClickHandler = ({ onSelect }) => {
  useMapEvents({
    click(event) {
      if (typeof onSelect === 'function') {
        onSelect(event.latlng);
      }
    },
  });
  return null;
};

const PropertyIntelligence = ({ embedded = false, onDataChange } = {}) => {
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
  const [imageryReleases, setImageryReleases] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [pinWasAdjusted, setPinWasAdjusted] = useState(false);

  const selectedRelease = useMemo(() => imageryReleases[selectedImageDate] || null, [imageryReleases, selectedImageDate]);

  // Feed data up to parent for report generation
  useEffect(() => {
    if (typeof onDataChange === 'function') {
      onDataChange({
        images: imageryReleases,
        candidates: dolCandidates,
        address: `${address} ${city} ${state} ${zip}`.trim(),
        yearBuilt: propertyData?.year_built,
      });
    }
  }, [imageryReleases, dolCandidates, address, city, state, zip, propertyData, onDataChange]);

  const getResponseErrorDetail = async (response, fallbackMessage) => {
    try {
      const payload = await response.json();
      if (typeof payload?.detail === 'string' && payload.detail.trim()) return payload.detail.trim();
      if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
      if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error.trim();
      if (Array.isArray(payload?.detail) && payload.detail.length > 0) {
        const first = payload.detail[0];
        if (typeof first?.msg === 'string') return first.msg;
      }
    } catch (err) {
      // Ignore JSON parse errors and fall back to status text.
    }

    const statusText = response.statusText ? `: ${response.statusText}` : '';
    return `${fallbackMessage} (${response.status}${statusText})`;
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const fetchJsonWithResilience = async (url, options, fallbackMessage, retries = 2, timeoutMs = 45000) => {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          credentials: 'include',
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          return { ok: true, data, response };
        }

        const detail = await getResponseErrorDetail(response, fallbackMessage);
        const retryableStatus = [502, 503, 504].includes(response.status);
        lastError = new Error(detail);

        if (retryableStatus && attempt < retries) {
          await delay(400 * (attempt + 1));
          continue;
        }

        return { ok: false, errorMessage: detail, response };
      } catch (fetchError) {
        const retryableNetworkError =
          fetchError?.name === 'AbortError' ||
          fetchError?.message === 'Failed to fetch' ||
          fetchError instanceof TypeError;

        if (retryableNetworkError && attempt < retries) {
          await delay(500 * (attempt + 1));
          continue;
        }

        lastError = new Error('Network issue reaching weather services. Please try again in a moment.');
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      ok: false,
      errorMessage: (lastError && lastError.message) || fallbackMessage,
      response: null,
    };
  };

  const normalizeCoordinate = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const parseWaybackDate = (name) => {
    const match = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  };

  const formatWaybackLabel = (isoDate, fallback) => {
    if (!isoDate) return fallback || 'Unknown Date';
    const parsed = new Date(`${isoDate}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const geocodeAddressCoordinates = async (street, cityName, stateCode, zipCode) => {
    // Prefer backend geocoding so we avoid browser CORS/rate-limit failures.
    const tryBackendGeocode = async (cityOverride) => {
      const backendParams = new URLSearchParams({
        address: street || '',
        city: cityOverride || '',
        state: stateCode || '',
        zip_code: zipCode || '',
      });

      const backendGeoResult = await fetchJsonWithResilience(
        `${API_URL}/api/weather/stations/nearby?${backendParams.toString()}`,
        {
          method: 'GET',
          headers: {},
        },
        'Address geocode unavailable',
        0,
        20000,
      );

      if (!backendGeoResult.ok) return null;
      const backendCoordinates = backendGeoResult?.data?.coordinates || {};
      const backendLatitude = normalizeCoordinate(backendCoordinates?.latitude);
      const backendLongitude = normalizeCoordinate(backendCoordinates?.longitude);
      if (backendLatitude === null || backendLongitude === null) return null;
      return { latitude: backendLatitude, longitude: backendLongitude };
    };

    const primaryBackendCoordinates = await tryBackendGeocode(cityName);
    if (primaryBackendCoordinates) return primaryBackendCoordinates;

    if (cityName) {
      const retryWithoutCity = await tryBackendGeocode('');
      if (retryWithoutCity) return retryWithoutCity;
    }

    // Secondary fallback for direct browser mode.
    const censusQueries = [
      `${street}, ${cityName}, ${stateCode} ${zipCode || ''}`.trim(),
      `${street}, ${stateCode} ${zipCode || ''}`.trim(),
      `${street}, ${zipCode || ''}`.trim(),
    ];

    for (const query of censusQueries) {
      if (!query) continue;
      const censusParams = new URLSearchParams({
        address: query,
        benchmark: 'Public_AR_Current',
        format: 'json',
      });

      const censusGeoResult = await fetchJsonWithResilience(
        `${CENSUS_GEOCODE_URL}?${censusParams.toString()}`,
        { method: 'GET' },
        'Address geocode unavailable',
        0,
        15000,
      );

      if (!censusGeoResult.ok) continue;
      const matches = censusGeoResult?.data?.result?.addressMatches || [];
      const coords = matches[0]?.coordinates;
      if (!coords) continue;
      const latitude = normalizeCoordinate(coords.y);
      const longitude = normalizeCoordinate(coords.x);
      if (latitude !== null && longitude !== null) {
        return { latitude, longitude };
      }
    }

    return null;
  };

  const ensureWaybackReleases = async () => {
    if (imageryReleases.length > 0) return imageryReleases;

    let releaseResult = await fetchJsonWithResilience(
      `${API_URL}/api/weather/imagery/releases`,
      {
        method: 'GET',
        headers: {},
      },
      'Historical imagery metadata unavailable',
      1,
      25000,
    );

    if (!releaseResult.ok) {
      releaseResult = await fetchJsonWithResilience(
        WAYBACK_SELECTION_URL,
        { method: 'GET' },
        'Historical imagery metadata unavailable',
        1,
        20000,
      );
      if (!releaseResult.ok) return [];
    }

    const selection = Array.isArray(releaseResult?.data?.selection)
      ? releaseResult.data.selection
      : Array.isArray(releaseResult?.data?.Selection)
        ? releaseResult.data.Selection
        : [];
    const parsedReleases = selection
      .map((item) => {
        const date = parseWaybackDate(item?.Name);
        return {
          id: item?.ID,
          date,
          label: formatWaybackLabel(date, item?.Name),
        };
      })
      .filter((item) => item.id && item.date)
      .slice(0, 60);

    setImageryReleases(parsedReleases);
    return parsedReleases;
  };

  const findClosestReleaseIndex = (releases, referenceDate) => {
    if (!referenceDate || releases.length === 0) return 0;

    const referenceMs = new Date(`${referenceDate}T00:00:00Z`).getTime();
    if (Number.isNaN(referenceMs)) return 0;

    let bestIndex = 0;
    let bestDiff = Number.MAX_SAFE_INTEGER;
    releases.forEach((release, index) => {
      const releaseMs = new Date(`${release.date}T00:00:00Z`).getTime();
      if (!Number.isNaN(releaseMs)) {
        const diff = Math.abs(releaseMs - referenceMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIndex = index;
        }
      }
    });

    return bestIndex;
  };

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
    if (!address || !state || (!city && !zip)) {
      toast.error('Please provide street, state, and either city or ZIP');
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
      const makeStartDate = (daysBack) => new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const baseAddressPayload = {
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip_code: zip.trim(),
        end_date: endDate,
        event_type: perilMode,
      };

      const candidateStages = [
        // Keep first-pass windows short to avoid backend overload from multi-year pulls.
        { label: 'standard', daysBack: 365, top_n: 10, max_distance_miles: 25, min_wind_mph: 30 },
        { label: 'stability', daysBack: 180, top_n: 10, max_distance_miles: 35, min_wind_mph: perilMode === 'wind' ? 24 : 30 },
        { label: 'fast-fallback', daysBack: 90, top_n: 8, max_distance_miles: 40, min_wind_mph: perilMode === 'wind' ? 20 : 30 },
        { label: 'expanded', daysBack: 730, top_n: 12, max_distance_miles: 50, min_wind_mph: perilMode === 'wind' ? 24 : 30 },
      ];

      const runCandidateStage = async (stageConfig, allowCityFallback = true) => {
        const payload = {
          ...baseAddressPayload,
          start_date: makeStartDate(stageConfig.daysBack),
          top_n: stageConfig.top_n,
          max_distance_miles: stageConfig.max_distance_miles,
          min_wind_mph: stageConfig.min_wind_mph,
        };

        const stageResult = await fetchJsonWithResilience(
          `${API_URL}/api/weather/dol/candidates`,
          {
            method: 'POST',
            headers: {},
            body: JSON.stringify(payload),
          },
          'DOL candidate discovery unavailable',
          1,
          55000,
        );

        if (stageResult.ok) {
          return { ok: true, data: stageResult.data, payload, cityFallbackUsed: false };
        }

        const canRetryWithoutCity =
          allowCityFallback &&
          payload.city &&
          String(stageResult.errorMessage || '').toLowerCase().includes('unable to geocode');
        if (!canRetryWithoutCity) {
          return { ok: false, errorMessage: stageResult.errorMessage, payload, cityFallbackUsed: false };
        }

        const retryPayload = { ...payload, city: '' };
        const retryResult = await fetchJsonWithResilience(
          `${API_URL}/api/weather/dol/candidates`,
          {
            method: 'POST',
            headers: {},
            body: JSON.stringify(retryPayload),
          },
          'DOL candidate discovery unavailable',
          0,
          55000,
        );
        if (retryResult.ok) {
          return { ok: true, data: retryResult.data, payload: retryPayload, cityFallbackUsed: true };
        }
        return { ok: false, errorMessage: retryResult.errorMessage || stageResult.errorMessage, payload: retryPayload, cityFallbackUsed: true };
      };

      let candidateData = null;
      let candidates = [];
      let candidateError = null;
      let selectedStageLabel = null;

      for (const stage of candidateStages) {
        const stageOutcome = await runCandidateStage(stage);
        if (!stageOutcome.ok) {
          candidateError = stageOutcome.errorMessage || 'DOL candidate discovery unavailable';
          console.warn(`[PropertyIntel] Candidate stage "${stage.label}" failed:`, candidateError);
          continue;
        }

        candidateData = stageOutcome.data;
        candidates = candidateData?.candidates || [];
        selectedStageLabel = stage.label;
        candidateError = null;
        if (stageOutcome.cityFallbackUsed) {
          toast.message('Address geocode improved by retrying without city label');
        }
        if (candidates.length > 0) {
          break;
        }
      }

      setDolCandidates(candidates);
      setSelectedDolCandidate(candidates[0] || null);
      if (candidates.length > 0) {
        setWeatherEvents(processWeatherEvents(candidates, perilMode));
      }

      if (selectedStageLabel && selectedStageLabel !== 'standard') {
        toast.message(`Using ${selectedStageLabel} search window to surface claim-grade signals`);
      }

      const selectedDate = candidates[0]?.candidate_date || endDate;
      let verifyData = null;
      let verifyError = null;
      const weatherNetworkIssue = 'Network issue reaching weather services. Please try again in a moment.';
      const cappedFallbackStartDate = (() => {
        const end = new Date(`${endDate}T00:00:00Z`);
        if (Number.isNaN(end.getTime())) return makeStartDate(30);
        end.setUTCDate(end.getUTCDate() - 30);
        return end.toISOString().split('T')[0];
      })();
      const verifyStartDate = candidates.length > 0
        ? selectedDate
        : cappedFallbackStartDate;
      const verifyEndDate = candidates.length > 0 ? selectedDate : endDate;

      // Always attempt verification, even if candidate discovery degraded.
      const verifyResult = await fetchJsonWithResilience(
        `${API_URL}/api/weather/verify-dol`,
        {
          method: 'POST',
          headers: {},
            body: JSON.stringify({
              address: baseAddressPayload.address,
              city: baseAddressPayload.city,
              state: baseAddressPayload.state,
              zip_code: baseAddressPayload.zip_code,
              start_date: verifyStartDate,
              end_date: verifyEndDate,
              event_type: perilMode,
            }),
          },
        'DOL verification failed',
        1,
        60000,
      );

      if (verifyResult.ok) {
        verifyData = verifyResult.data;
      } else {
        verifyError = verifyResult.errorMessage || 'DOL verification failed';
        if (String(verifyError).toLowerCase().includes('unable to geocode')) {
          const retryResult = await fetchJsonWithResilience(
            `${API_URL}/api/weather/verify-dol`,
            {
              method: 'POST',
              headers: {},
              body: JSON.stringify({
                address: baseAddressPayload.address,
                city: '',
                state: baseAddressPayload.state,
                zip_code: baseAddressPayload.zip_code,
                start_date: verifyStartDate,
                end_date: verifyEndDate,
                event_type: perilMode,
              }),
            },
            'DOL verification failed',
            0,
            60000,
          );

          if (retryResult.ok) {
            verifyData = retryResult.data;
            verifyError = null;
          } else {
            verifyError = retryResult.errorMessage || verifyError;
          }
        }
      }

      if (!verifyData && !candidates.length) {
        const fallbackCoordinates = await geocodeAddressCoordinates(
          baseAddressPayload.address,
          baseAddressPayload.city,
          baseAddressPayload.state,
          baseAddressPayload.zip_code,
        );
        const fallbackLat = normalizeCoordinate(fallbackCoordinates?.latitude);
        const fallbackLng = normalizeCoordinate(fallbackCoordinates?.longitude);
        if (fallbackLat !== null && fallbackLng !== null) {
          setMapCenter({ latitude: fallbackLat, longitude: fallbackLng });
        } else {
          setMapCenter(null);
        }

        setPropertyData({
          address: [address, city, `${state} ${zip}`.trim()].filter(Boolean).join(', '),
          coordinates: fallbackLat !== null && fallbackLng !== null ? { latitude: fallbackLat, longitude: fallbackLng } : null,
          verifiedDol: null,
          confidence: 'unverified',
          summary: 'Weather services are temporarily unavailable. Imagery mode is active; retry DOL discovery shortly.',
          lastUpdated: new Date().toISOString(),
        });
        toast.warning(verifyError || candidateError || 'Weather services unavailable. Showing imagery mode only.');
        return;
      }

      if (!candidates.length && verifyData?.verified_dol) {
        const topSource = (verifyData.primary_sources || []).reduce((best, src) => {
          const current = src?.max_wind_mph || 0;
          const top = best?.max_wind_mph || 0;
          return current > top ? src : best;
        }, null);

        const fallbackCandidate = {
          candidate_date: verifyData.verified_dol,
          confidence: verifyData.confidence || 'medium',
          peak_wind_mph: topSource?.max_wind_mph || 0,
          station_count: (verifyData.primary_sources || []).length || 1,
          weighted_support_score: (verifyData.primary_sources || []).length || 1,
        };

        const derivedCandidates = [fallbackCandidate];
        setDolCandidates(derivedCandidates);
        setSelectedDolCandidate(fallbackCandidate);
        setWeatherEvents(processWeatherEvents(derivedCandidates, perilMode));
      }

      let resolvedCoordinates = verifyData?.location || candidateData?.location || null;
      let lat = normalizeCoordinate(resolvedCoordinates?.latitude);
      let lng = normalizeCoordinate(resolvedCoordinates?.longitude);

      if (lat === null || lng === null) {
        const geocodedCoordinates = await geocodeAddressCoordinates(
          baseAddressPayload.address,
          baseAddressPayload.city,
          baseAddressPayload.state,
          baseAddressPayload.zip_code,
        );
        lat = normalizeCoordinate(geocodedCoordinates?.latitude);
        lng = normalizeCoordinate(geocodedCoordinates?.longitude);
        if (lat !== null && lng !== null) {
          resolvedCoordinates = { latitude: lat, longitude: lng };
        }
      }

      if (lat !== null && lng !== null) {
        setMapCenter({ latitude: lat, longitude: lng });
        setPinWasAdjusted(false);
      } else {
        setMapCenter(null);
        setPinWasAdjusted(false);
      }

      const waybackReleases = await ensureWaybackReleases();
      if (waybackReleases.length > 0) {
        const releaseReferenceDate = verifyData?.verified_dol || candidates[0]?.candidate_date || endDate;
        setSelectedImageDate(findClosestReleaseIndex(waybackReleases, releaseReferenceDate));
      }

      setPropertyData({
        address: [address, city, `${state} ${zip}`.trim()].filter(Boolean).join(', '),
        matchedAddress: resolvedCoordinates?.matched_address || null,
        geocoder: resolvedCoordinates?.geocoder || null,
        precision: resolvedCoordinates?.precision || null,
        coordinates: resolvedCoordinates,
        verifiedDol: verifyData?.verified_dol || candidates[0]?.candidate_date || null,
        confidence: verifyData?.confidence || candidates[0]?.confidence || 'unverified',
        summary:
          verifyData?.event_summary ||
          candidates[0]?.event_summary ||
          (candidateError === weatherNetworkIssue
            ? 'Weather providers are temporarily unreachable. Property imagery is still available.'
            : null),
        lastUpdated: new Date().toISOString(),
      });

      if (candidateError || verifyError) {
        const partialMessage =
          candidateError === weatherNetworkIssue || verifyError === weatherNetworkIssue
            ? 'Weather services temporarily unreachable. Loaded imagery-only mode.'
            : (candidateError || verifyError || 'Loaded with partial data');
        toast.warning(partialMessage);
      } else {
        toast.success('Property intel loaded with DOL candidates');
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err?.message || 'Failed to fetch property intelligence';
      setError(errorMessage);
      setPropertyData(null);
      setDolCandidates([]);
      setSelectedDolCandidate(null);
      setWeatherEvents([]);
      toast.error(errorMessage);
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

  const generateReportText = () => {
    if (!propertyData) return '';

    let report = 'PROPERTY INTEL + DOL DISCOVERY REPORT\n';
    report += 'Generated by Eden Claims Platform\n';
    report += '================================\n\n';
    report += `Property: ${propertyData.address}\n`;
    if (propertyData.matchedAddress && propertyData.matchedAddress !== propertyData.address) {
      report += `Geocoded Address: ${propertyData.matchedAddress}\n`;
    }
    report += `Report Date: ${new Date().toLocaleDateString()}\n`;
    report += `Peril Mode: ${perilMode.toUpperCase()}\n`;
    report += `Selected DOL: ${propertyData.verifiedDol ? formatDate(propertyData.verifiedDol) : 'N/A'}\n`;
    report += `Confidence: ${(propertyData.confidence || 'unverified').toUpperCase()}\n`;
    if (propertyData.coordinates) {
      report += `Coordinates: ${propertyData.coordinates.latitude?.toFixed(6)}, ${propertyData.coordinates.longitude?.toFixed(6)}\n`;
      report += `Geocoder: ${propertyData.geocoder || 'N/A'}\n`;
      report += `Precision: ${propertyData.precision || 'N/A'}\n`;
    }
    report += '\n';

    report += 'CANDIDATE DATES\n';
    report += '----------------\n';

    if (dolCandidates.length === 0) {
      report += 'No candidates found in analysis window.\n';
    } else {
      dolCandidates.slice(0, 10).forEach((candidate, idx) => {
        report += `${idx + 1}. ${formatDate(candidate.candidate_date)} | ${String(candidate.confidence || 'low').toUpperCase()}\n`;
        if (perilMode === 'wind') {
          report += `   Peak Wind: ${candidate.peak_wind_mph || 0} mph\n`;
          report += `   Stations: ${candidate.station_count || 0}\n`;
          report += `   Weighted Support: ${candidate.weighted_support_score || 0}\n`;
        } else {
          report += `   Max Hail: ${candidate.max_hail_inches || 0} in\n`;
          report += `   Reports: ${candidate.report_count || 0}\n`;
          report += `   Nearest Report: ${candidate.min_distance_miles || 'N/A'} mi\n`;
        }
      });
    }

    if (propertyData.summary) {
      report += `\nSUMMARY\n`;
      report += '--------\n';
      report += `${propertyData.summary}\n`;
    }

    report += '\nDATA SOURCES\n';
    report += '-------------\n';
    report += 'NWS (National Weather Service)\n';
    report += 'NOAA (National Oceanic and Atmospheric Administration)\n';
    report += 'METAR/ASOS (Airport Weather Stations)\n';
    report += 'IEM LSR (Iowa Environmental Mesonet Local Storm Reports)\n';
    report += 'ESRI Wayback Satellite Imagery\n';
    report += '\nThis report is carrier-defensible and source-cited.\n';
    report += 'Generated via Eden Claims Platform - Property Intelligence Module\n';

    return report;
  };

  const copyReport = () => {
    const report = generateReportText();
    if (!report) return;
    navigator.clipboard.writeText(report);
    toast.success('Report copied to clipboard');
  };

  const downloadReport = () => {
    const report = generateReportText();
    if (!report) return;

    const propertyAddress = propertyData?.address?.replace(/[^a-z0-9]/gi, '_') || 'property';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Property_Intel_${propertyAddress}_${dateStr}.txt`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success('Report downloaded');
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
                    {viewMode === 'street' ? (
                      <iframe
                        className="w-full h-full border-0"
                        src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(propertyData.matchedAddress || propertyData.address)}&maptype=roadmap&zoom=19`}
                        allowFullScreen
                        loading="lazy"
                      />
                    ) : (
                      mapCenter?.latitude !== null &&
                      mapCenter?.latitude !== undefined &&
                      mapCenter?.longitude !== null &&
                      mapCenter?.longitude !== undefined ? (
                        <MapContainer
                          key={`${viewMode}-${selectedRelease?.id || 'current'}-${mapCenter.latitude}-${mapCenter.longitude}`}
                          center={[mapCenter.latitude, mapCenter.longitude]}
                          zoom={19}
                          className="w-full h-full z-0"
                          scrollWheelZoom={true}
                        >
                          <TileLayer
                            url={
                              viewMode === 'aerial' && selectedRelease?.id
                                ? WAYBACK_TILE_URL(selectedRelease.id)
                                : ESRI_WORLD_IMAGERY_TILE_URL
                            }
                            attribution='&copy; Esri World Imagery / Wayback'
                            maxZoom={20}
                          />
                          <CircleMarker
                            center={[mapCenter.latitude, mapCenter.longitude]}
                            radius={8}
                            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.8 }}
                          />
                          <MapClickHandler
                            onSelect={(latlng) => {
                              setMapCenter({ latitude: latlng.lat, longitude: latlng.lng });
                              setPinWasAdjusted(true);
                              setPropertyData((prev) => ({
                                ...prev,
                                coordinates: {
                                  ...(prev?.coordinates || {}),
                                  latitude: latlng.lat,
                                  longitude: latlng.lng,
                                  precision: 'manual',
                                  geocoder: 'manual',
                                },
                              }));
                              toast.success('Pin updated to selected roof point');
                            }}
                          />
                        </MapContainer>
                      ) : (
                        <div className="w-full h-full relative">
                          <iframe
                            className="w-full h-full border-0"
                            src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(propertyData.matchedAddress || propertyData.address)}&maptype=satellite&zoom=19`}
                            allowFullScreen
                            loading="lazy"
                          />
                          <div className="absolute inset-x-3 bottom-3 rounded-md bg-black/70 px-3 py-2 text-xs text-gray-200">
                            Precision map overlay unavailable for this address format. Showing satellite fallback.
                          </div>
                        </div>
                      )
                    )}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur px-3 py-1.5 rounded-lg">
                      <p className="text-xs text-gray-300">Captured on</p>
                      <p className="text-sm font-medium text-white">
                        {viewMode === 'street'
                          ? 'Street map view'
                          : viewMode === 'aerial'
                            ? (selectedRelease?.label || 'Historical imagery')
                            : 'Current imagery'}
                      </p>
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
                          onClick={() => {
                            setSelectedImageDate(Math.max(0, selectedImageDate - 1));
                            setViewMode('aerial');
                          }}
                          className="p-1 text-gray-500 hover:text-gray-900"
                          disabled={imageryReleases.length === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedImageDate(Math.min(imageryReleases.length - 1, selectedImageDate + 1));
                            setViewMode('aerial');
                          }}
                          className="p-1 text-gray-500 hover:text-gray-900"
                          disabled={imageryReleases.length === 0}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {imageryReleases.length === 0 ? (
                      <div className="text-xs text-gray-500 py-2">
                        Historical release timeline unavailable right now.
                      </div>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {imageryReleases.map((img, idx) => (
                          <button
                            key={img.id}
                            onClick={() => {
                              setSelectedImageDate(idx);
                              setViewMode('aerial');
                            }}
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
                    )}
                    {viewMode !== 'aerial' && (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Switch to `Aerial` to browse dated imagery releases.
                      </p>
                    )}
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
                      {propertyData.matchedAddress && propertyData.matchedAddress !== propertyData.address && (
                        <p className="text-xs text-amber-500 mt-1">
                          Geocoder matched: {propertyData.matchedAddress}
                        </p>
                      )}
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
                        {pinWasAdjusted && (
                          <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                            Pin corrected manually
                          </Badge>
                        )}
                        {propertyData.precision === 'postal_code' && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Approximate geocode
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={copyReport}
                        className="p-2 text-gray-500 hover:text-gray-900 bg-gray-800 rounded-lg transition-colors"
                        title="Copy Report"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={downloadReport}
                        className="p-2 text-gray-500 hover:text-gray-900 bg-gray-800 rounded-lg transition-colors"
                        title="Download Report"
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
