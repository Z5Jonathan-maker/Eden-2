/**
 * HarvestMap - Google Maps powered canvassing map
 * Uses @vis.gl/react-google-maps with Marker (no Cloud Map ID needed)
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { useGpsWatch } from '../hooks/useGpsWatch';
import { useHarvestPins, DEFAULT_PIN_STATUSES } from '../hooks/useHarvestPins';
import { Badge } from '../shared/ui/badge';
import { toast } from 'sonner';
import {
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const DEFAULT_CENTER = { lat: 27.9506, lng: -82.4572 };
const DEFAULT_ZOOM = 17;

// SVG icon generators — no mapId needed unlike AdvancedMarker
const makePinSvg = (color, text = '') => {
  const label = text ? `<text x="14" y="18" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="monospace">${text}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="3"/>${label}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const GPS_DOT_SVG = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"><circle cx="11" cy="11" r="8" fill="#3B82F6" stroke="white" stroke-width="3"/><circle cx="11" cy="11" r="11" fill="#3B82F680" opacity="0.4"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
})();

// Status button popup for a pin
const PinPopup = ({ pin, onLogVisit, onClose, dispositions = DEFAULT_PIN_STATUSES }) => {
  const [logging, setLogging] = useState(false);

  const handleStatusClick = async (status) => {
    setLogging(true);
    try {
      await onLogVisit(pin, status);
      toast.success(`Logged: ${dispositions[status]?.label || status}`);
      onClose?.();
    } catch {
      toast.error('Failed to log visit');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="min-w-[220px] p-1">
      {pin.address && <div className="font-medium text-sm mb-2 text-gray-900">{pin.address}</div>}

      <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
        <span>Visits: {pin.visit_count || 0}</span>
        {pin.status && dispositions[pin.status] && (
          <Badge
            style={{ backgroundColor: dispositions[pin.status].color }}
            className="text-white text-xs"
          >
            {dispositions[pin.status].label}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1">
        {Object.entries(dispositions).map(([code, info]) => (
          <button
            key={code}
            onClick={() => handleStatusClick(code)}
            disabled={logging}
            className="flex flex-col items-center justify-center p-2 rounded-lg text-white text-xs font-medium transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: info.color }}
            data-testid={`status-btn-${code}`}
          >
            <span className="text-sm mb-0.5">{info.icon || '📌'}</span>
            {code}
          </button>
        ))}
      </div>
    </div>
  );
};

// Map legend
const MapLegend = ({ dispositions, pins, expanded, onToggle }) => {
  const getCount = (code) => pins.filter((p) => p.status === code).length;

  return (
    <div className="absolute top-14 right-2 z-10 bg-white/95 backdrop-blur rounded-lg shadow-lg overflow-hidden max-w-[180px]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        data-testid="legend-toggle"
      >
        <span>Legend</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-gray-100 pt-2">
          {Object.entries(dispositions).map(([code, info]) => (
            <div key={code} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: info.color }}
                />
                <span className="text-gray-600 truncate">{info.label}</span>
              </div>
              <span className="font-medium text-gray-900 ml-2">{getCount(code)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
            <span className="text-gray-500">Total</span>
            <span className="font-bold text-gray-900">{pins.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Inner map component (has access to useMap hook)
const HarvestMapInner = ({
  position,
  hasLocation,
  gpsError,
  refreshPosition,
  pins,
  filteredPins,
  loading,
  createPin,
  logVisit,
  fetchPins,
  dispositions,
  onPinStatusChange,
}) => {
  const map = useMap();
  const [selectedPin, setSelectedPin] = useState(null);
  const [dropping, setDropping] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const hasCentered = useRef(false);

  // Center on user location once
  useEffect(() => {
    if (map && position && !hasCentered.current) {
      map.panTo({ lat: position.lat, lng: position.lng });
      map.setZoom(DEFAULT_ZOOM);
      hasCentered.current = true;
    }
  }, [map, position]);

  // Handle map click to create pin
  const handleMapClick = useCallback(
    async (e) => {
      const lat = e.detail?.latLng?.lat;
      const lng = e.detail?.latLng?.lng;
      if (lat == null || lng == null) return;

      try {
        setDropping(true);
        await createPin({ lat, lng });
        toast.success('Pin dropped!');
      } catch {
        toast.error('Failed to drop pin');
      } finally {
        setDropping(false);
      }
    },
    [createPin]
  );

  // Drop pin at current GPS location
  const handleDropAtMyLocation = useCallback(async () => {
    if (!position) {
      toast.error('Waiting for GPS location...');
      return;
    }
    try {
      setDropping(true);
      await createPin({ lat: position.lat, lng: position.lng });
      toast.success('Pin dropped at your location!');
    } catch {
      toast.error('Failed to drop pin');
    } finally {
      setDropping(false);
    }
  }, [position, createPin]);

  // Handle logging a visit
  const handleLogVisit = useCallback(
    async (pin, status) => {
      const visitLat = position?.lat ?? pin.lat;
      const visitLng = position?.lng ?? pin.lng;
      await logVisit(pin.id, status, visitLat, visitLng);
      onPinStatusChange?.();
    },
    [position, logVisit, onPinStatusChange]
  );

  // Center map on user
  const handleCenterOnMe = useCallback(() => {
    if (map && position) {
      map.panTo({ lat: position.lat, lng: position.lng });
      map.setZoom(DEFAULT_ZOOM);
    }
    refreshPosition();
  }, [map, position, refreshPosition]);

  // Memoize pin icon URLs to avoid re-encoding on every render
  const pinIcons = useMemo(() => {
    const cache = {};
    for (const [code, info] of Object.entries(dispositions)) {
      cache[code] = makePinSvg(info.color);
    }
    cache._default = makePinSvg('#9CA3AF');
    return cache;
  }, [dispositions]);

  return (
    <>
      {/* GPS Error Banner */}
      {gpsError && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-red-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center justify-between">
          <span>{gpsError}</span>
          <button onClick={refreshPosition} className="ml-2 hover:bg-red-700 p-1 rounded">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-blue-600 text-white text-xs px-3 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading pins...
        </div>
      )}

      {/* Legend */}
      <MapLegend
        dispositions={dispositions}
        pins={pins}
        expanded={legendExpanded}
        onToggle={() => setLegendExpanded(!legendExpanded)}
      />

      {/* Google Map */}
      <Map
        defaultCenter={position ? { lat: position.lat, lng: position.lng } : DEFAULT_CENTER}
        defaultZoom={hasLocation ? DEFAULT_ZOOM : 14}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        mapTypeId="hybrid"
        onClick={handleMapClick}
        reuseMaps
        style={{ width: '100%', height: '100%' }}
      >
        {/* GPS Blue Dot */}
        {position && (
          <Marker
            position={{ lat: position.lat, lng: position.lng }}
            icon={GPS_DOT_SVG}
            zIndex={1000}
            clickable={false}
          />
        )}

        {/* Pins */}
        {filteredPins.map((pin) => (
          <Marker
            key={pin.id}
            position={{ lat: pin.lat, lng: pin.lng }}
            icon={pinIcons[pin.status] || pinIcons._default}
            onClick={() => setSelectedPin(pin)}
          />
        ))}

        {/* Info Window for selected pin */}
        {selectedPin && (
          <InfoWindow
            position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
            onCloseClick={() => setSelectedPin(null)}
          >
            <PinPopup
              pin={selectedPin}
              onLogVisit={handleLogVisit}
              onClose={() => setSelectedPin(null)}
              dispositions={dispositions}
            />
          </InfoWindow>
        )}
      </Map>

      {/* FAB Buttons */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleCenterOnMe}
          className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          data-testid="center-on-me-btn"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>

        <button
          onClick={handleDropAtMyLocation}
          disabled={!hasLocation || dropping}
          className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            hasLocation ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500'
          }`}
          data-testid="drop-pin-btn"
        >
          {dropping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => fetchPins()}
        className="absolute bottom-4 left-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
        data-testid="refresh-pins-btn"
      >
        <RefreshCw className="w-4 h-4 text-gray-600" />
      </button>

      {/* Pin count pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-zinc-900/80 backdrop-blur rounded-full shadow-lg px-3 py-1 flex items-center gap-2 text-[11px] text-zinc-300 pointer-events-none">
        <span className="font-mono">{filteredPins.length} pins</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dispositions.DL?.color || '#10B981' }} />
          <span>{filteredPins.filter((p) => p.status === 'DL').length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dispositions.AP?.color || '#3B82F6' }} />
          <span>{filteredPins.filter((p) => p.status === 'AP').length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dispositions.FU?.color || '#8B5CF6' }} />
          <span>{filteredPins.filter((p) => p.status === 'FU').length}</span>
        </div>
      </div>
    </>
  );
};

// Main HarvestMap Component
export const HarvestMap = ({
  territoryId = null,
  className = '',
  onPinStatusChange,
  activeFilters = null,
}) => {
  const { position, accuracy, error: gpsError, refreshPosition, hasLocation } = useGpsWatch();
  const {
    pins,
    loading,
    error: pinsError,
    createPin,
    logVisit,
    fetchPins,
    dispositions,
  } = useHarvestPins({ territoryId });

  const filteredPins = activeFilters
    ? pins.filter((pin) => !pin.status || activeFilters.includes(pin.status))
    : pins;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`relative h-full w-full flex items-center justify-center bg-zinc-900 ${className}`}>
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white text-lg font-bold mb-2">Google Maps API Key Required</h3>
          <p className="text-zinc-400 text-sm max-w-sm">
            Set <code className="text-orange-400">VITE_GOOGLE_MAPS_API_KEY</code> in your .env file
            to enable the map.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full ${className}`} data-testid="harvest-map">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <HarvestMapInner
          position={position}
          hasLocation={hasLocation}
          gpsError={gpsError}
          refreshPosition={refreshPosition}
          pins={pins}
          filteredPins={filteredPins}
          loading={loading}
          createPin={createPin}
          logVisit={logVisit}
          fetchPins={fetchPins}
          dispositions={dispositions}
          onPinStatusChange={onPinStatusChange}
        />
      </APIProvider>
    </div>
  );
};

export default HarvestMap;
