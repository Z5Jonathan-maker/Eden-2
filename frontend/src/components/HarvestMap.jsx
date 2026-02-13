/**
 * HarvestMap - Phone-first canvassing map component
 * GPS + Pins + Visits with Spotio-style UX
 *
 * Now supports dynamic dispositions from the backend API
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { useGpsWatch } from '../hooks/useGpsWatch';
import { useHarvestPins, DEFAULT_PIN_STATUSES } from '../hooks/useHarvestPins';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  MapPin,
  Navigation,
  Plus,
  X,
  Check,
  Phone,
  Calendar,
  Home,
  Ban,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom pin icon based on status - uses dynamic dispositions
const createPinIcon = (status, visitCount = 0, dispositions = DEFAULT_PIN_STATUSES) => {
  const statusInfo = dispositions[status] || { color: '#9CA3AF' };
  const color = statusInfo.color;

  return L.divIcon({
    className: 'harvest-pin-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background-color: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: bold;
      ">${visitCount > 0 ? visitCount : ''}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

// User location marker
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background-color: #3B82F6;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 2px #3B82F6, 0 2px 8px rgba(59,130,246,0.5);
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Component to handle map clicks
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// Component to center map on user location
const CenterOnUser = ({ position, shouldCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (shouldCenter && position) {
      map.setView([position.lat, position.lng], 17);
    }
  }, [shouldCenter, position, map]);

  return null;
};

// Pin popup with status buttons - now uses dynamic dispositions
const PinPopup = ({
  pin,
  onLogVisit,
  onClose,
  userPosition,
  dispositions = DEFAULT_PIN_STATUSES,
}) => {
  const [logging, setLogging] = useState(false);

  const handleStatusClick = async (status) => {
    setLogging(true);
    try {
      await onLogVisit(pin, status);
      toast.success(`Logged: ${dispositions[status]?.label || status}`);
      onClose?.();
    } catch (err) {
      toast.error('Failed to log visit');
    } finally {
      setLogging(false);
    }
  };

  // Get icon component based on status code
  const getStatusIcon = (code) => {
    const icons = {
      NH: Home,
      NI: X,
      CB: Phone,
      AP: Calendar,
      SG: Check,
      DNK: Ban,
    };
    return icons[code] || MapPin;
  };

  // Build status buttons from dispositions
  const statusButtons = Object.entries(dispositions).map(([code, info]) => ({
    code,
    icon: getStatusIcon(code),
    label: code,
    color: info.color,
  }));

  return (
    <div className="min-w-[200px]">
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
        {statusButtons.map(({ code, icon: Icon, label, color }) => (
          <button
            key={code}
            onClick={() => handleStatusClick(code)}
            disabled={logging}
            className={`
              flex flex-col items-center justify-center p-2 rounded-lg text-white text-xs font-medium
              transition-all active:scale-95 disabled:opacity-50
            `}
            style={{ backgroundColor: color }}
            data-testid={`status-btn-${code}`}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

// Dynamic Legend Component
const MapLegend = ({ dispositions, pins, expanded, onToggle }) => {
  const getCount = (code) => pins.filter((p) => p.status === code).length;

  return (
    <div className="absolute top-14 right-2 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg overflow-hidden max-w-[180px]">
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

  const [selectedPin, setSelectedPin] = useState(null);
  const [centerOnUser, setCenterOnUser] = useState(true);
  const [dropping, setDropping] = useState(false);
  const [legendExpanded, setLegendExpanded] = useState(false);
  const mapRef = useRef(null);

  // Filter pins based on activeFilters (if provided)
  const filteredPins = activeFilters
    ? pins.filter((pin) => !pin.status || activeFilters.includes(pin.status))
    : pins;

  // Default center (Tampa, FL area)
  const defaultCenter = [27.9506, -82.4572];
  const mapCenter = position ? [position.lat, position.lng] : defaultCenter;

  // Handle map click to create pin
  const handleMapClick = useCallback(
    async (latlng) => {
      try {
        setDropping(true);
        await createPin({ lat: latlng.lat, lng: latlng.lng });
        toast.success('Pin dropped!');
      } catch (err) {
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
    } catch (err) {
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
    if (mapRef.current && position) {
      mapRef.current.setView([position.lat, position.lng], 17);
    }
    refreshPosition();
  }, [position, refreshPosition]);

  return (
    <div className={`relative h-full w-full ${className}`} data-testid="harvest-map">
      {/* GPS Error Banner */}
      {gpsError && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-red-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg flex items-center justify-between">
          <span>{gpsError}</span>
          <button onClick={refreshPosition} className="ml-2 hover:bg-red-700 p-1 rounded">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white text-xs px-3 py-2 rounded-full shadow-lg flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading pins...
        </div>
      )}

      {/* Accuracy Indicator */}
      {accuracy && (
        <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur text-xs px-2 py-1 rounded-full shadow text-gray-600">
          ±{Math.round(accuracy)}m
        </div>
      )}

      {/* Dynamic Legend */}
      <MapLegend
        dispositions={dispositions}
        pins={pins}
        expanded={legendExpanded}
        onToggle={() => setLegendExpanded(!legendExpanded)}
      />

      {/* Map Container */}
      <MapContainer
        center={mapCenter}
        zoom={hasLocation ? 17 : 14}
        className="h-full w-full"
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onMapClick={handleMapClick} />
        <CenterOnUser position={position} shouldCenter={centerOnUser && !selectedPin} />

        {/* User Location */}
        {position && (
          <>
            {/* Accuracy circle */}
            {accuracy && (
              <Circle
                center={[position.lat, position.lng]}
                radius={accuracy}
                pathOptions={{
                  color: '#3B82F6',
                  fillColor: '#3B82F6',
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}

            {/* User marker */}
            <Marker
              position={[position.lat, position.lng]}
              icon={userLocationIcon}
              zIndexOffset={1000}
            />
          </>
        )}

        {/* Pins - filtered by activeFilters */}
        {filteredPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createPinIcon(pin.status, pin.visit_count, dispositions)}
            eventHandlers={{
              click: () => setSelectedPin(pin),
            }}
          >
            <Popup onClose={() => setSelectedPin(null)} closeButton={true} autoPan={true}>
              <PinPopup
                pin={pin}
                onLogVisit={handleLogVisit}
                onClose={() => setSelectedPin(null)}
                userPosition={position}
                dispositions={dispositions}
              />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* FAB Buttons */}
      <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Center on me */}
        <button
          onClick={handleCenterOnMe}
          className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          data-testid="center-on-me-btn"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>

        {/* Drop at my location */}
        <button
          onClick={handleDropAtMyLocation}
          disabled={!hasLocation || dropping}
          className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95
            ${hasLocation ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500'}
          `}
          data-testid="drop-pin-btn"
        >
          {dropping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
        </button>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => fetchPins()}
        className="absolute bottom-4 left-4 z-[1000] w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
        data-testid="refresh-pins-btn"
      >
        <RefreshCw className="w-4 h-4 text-gray-600" />
      </button>

      {/* Stats bar with dynamic colors */}
      <div className="absolute bottom-24 left-4 right-4 z-[1000] bg-white/95 backdrop-blur rounded-lg shadow-lg p-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-gray-700">
              {filteredPins.length} pins
              {activeFilters && activeFilters.length < 6 ? ' (filtered)' : ''}
            </span>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dispositions.SG?.color || '#10B981' }}
              />
              <span>{filteredPins.filter((p) => p.status === 'SG').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dispositions.AP?.color || '#3B82F6' }}
              />
              <span>{filteredPins.filter((p) => p.status === 'AP').length}</span>
            </div>
            <div className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: dispositions.CB?.color || '#8B5CF6' }}
              />
              <span>{filteredPins.filter((p) => p.status === 'CB').length}</span>
            </div>
          </div>
          <span className="text-gray-400">
            {filteredPins.reduce((sum, p) => sum + (p.visit_count || 0), 0)} visits
          </span>
        </div>
      </div>
    </div>
  );
};

export default HarvestMap;
