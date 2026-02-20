/**
 * FieldMode — DoorMamba-class map-first canvassing experience
 *
 * Binary mode: map + pins + 6-button quick-tap bar. No gamification chrome.
 * All scoring/badges/streaks run silently; payoff at session end.
 *
 * Quick-tap flow:
 *   1. Rep taps map → pin drops at GPS location
 *   2. 6-button bar appears → one tap = status set
 *   3. Cold pins (NA/NI/RN) → instant, no form
 *   4. Warm/hot pins (FU/AP/DL) → compact conversion form slides up
 *   5. Done → pin colored, bar resets, rep moves to next door
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { useGpsWatch } from '../../hooks/useGpsWatch';
import { useHarvestPins, DEFAULT_PIN_STATUSES } from '../../hooks/useHarvestPins';
import { harvestService } from '../../services/harvestService';
import { FIELD_MODE_PINS, DEFAULT_CENTER, FIELD_MODE_ZOOM } from '../../features/harvest/components/constants';
import FieldModeConversionForm from './FieldModeConversionForm';
import { toast } from 'sonner';
import {
  Navigation,
  Plus,
  Loader2,
  X,
  Square,
  Timer,
  MapPin,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Compact pin marker for field mode — smaller, cleaner
const FieldPin = ({ status, dispositions }) => {
  const info = dispositions[status] || { color: '#9CA3AF' };
  return (
    <div
      className="w-6 h-6 rounded-full border-2 border-white shadow-md"
      style={{ backgroundColor: info.color }}
    />
  );
};

// GPS blue dot
const GpsDot = () => (
  <div className="relative">
    <div
      className="w-4 h-4 rounded-full border-[3px] border-white"
      style={{
        backgroundColor: '#3B82F6',
        boxShadow: '0 0 0 2px #3B82F6, 0 2px 8px rgba(59,130,246,0.5)',
      }}
    />
    <div className="absolute inset-0 w-4 h-4 rounded-full bg-blue-500/30 animate-ping" />
  </div>
);

// Session timer display
const SessionTimer = ({ startTime }) => {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const mins = String(Math.floor(diff / 60)).padStart(2, '0');
      const secs = String(diff % 60).padStart(2, '0');
      setElapsed(`${mins}:${secs}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-1.5 bg-zinc-900/80 backdrop-blur rounded-full px-3 py-1.5 text-xs text-zinc-300 font-mono">
      <Timer className="w-3 h-3 text-orange-400" />
      {elapsed}
    </div>
  );
};

// The inner map + quick-tap component
const FieldModeInner = ({
  position,
  hasLocation,
  gpsError,
  refreshPosition,
  pins,
  loading,
  createPin,
  logVisit,
  fetchPins,
  dispositions,
  sessionId,
  sessionStats,
  setSessionStats,
  onEndSession,
}) => {
  const map = useMap();
  const [pendingPin, setPendingPin] = useState(null);
  const [showConversionForm, setShowConversionForm] = useState(null);
  const [dropping, setDropping] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const hasCentered = useRef(false);

  // Center on user once
  useEffect(() => {
    if (map && position && !hasCentered.current) {
      map.panTo({ lat: position.lat, lng: position.lng });
      map.setZoom(FIELD_MODE_ZOOM);
      hasCentered.current = true;
    }
  }, [map, position]);

  // Follow GPS in field mode — keep user centered
  useEffect(() => {
    if (map && position && hasCentered.current) {
      map.panTo({ lat: position.lat, lng: position.lng });
    }
  }, [map, position]);

  // Drop pin at GPS location
  const handleDropPin = useCallback(async () => {
    if (!position) {
      toast.error('Waiting for GPS...');
      return;
    }
    try {
      setDropping(true);
      const pin = await createPin({ lat: position.lat, lng: position.lng });
      setPendingPin(pin);
      toast.success('Pin dropped — tap a status');
    } catch {
      toast.error('Failed to drop pin');
    } finally {
      setDropping(false);
    }
  }, [position, createPin]);

  // Tap existing pin to re-status it
  const handlePinClick = useCallback((pin) => {
    setPendingPin(pin);
  }, []);

  // Quick-tap status assignment
  const handleQuickTap = useCallback(
    async (statusCode) => {
      if (!pendingPin) return;

      const tier = FIELD_MODE_PINS.find((p) => p.code === statusCode)?.tier;

      // Warm/hot pins need conversion form
      if (tier === 'warm' || tier === 'hot') {
        setShowConversionForm({ pin: pendingPin, status: statusCode });
        return;
      }

      // Cold pins — instant log
      try {
        const lat = position?.lat ?? pendingPin.lat;
        const lng = position?.lng ?? pendingPin.lng;
        await logVisit(pendingPin.id, statusCode, lat, lng);
        setSessionStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          [statusCode]: (prev[statusCode] || 0) + 1,
        }));
        setPendingPin(null);
        toast.success(FIELD_MODE_PINS.find((p) => p.code === statusCode)?.label || statusCode);
      } catch {
        toast.error('Failed to log');
      }
    },
    [pendingPin, position, logVisit, setSessionStats]
  );

  // Conversion form submit
  const handleConversionSubmit = useCallback(
    async (statusCode, notes) => {
      if (!showConversionForm?.pin) return;
      const pin = showConversionForm.pin;
      try {
        const lat = position?.lat ?? pin.lat;
        const lng = position?.lng ?? pin.lng;
        await logVisit(pin.id, statusCode, lat, lng, notes);
        setSessionStats((prev) => ({
          ...prev,
          total: prev.total + 1,
          [statusCode]: (prev[statusCode] || 0) + 1,
        }));
        setShowConversionForm(null);
        setPendingPin(null);
        toast.success(FIELD_MODE_PINS.find((p) => p.code === statusCode)?.label || statusCode);
      } catch {
        toast.error('Failed to log');
      }
    },
    [showConversionForm, position, logVisit, setSessionStats]
  );

  const handleCenterOnMe = useCallback(() => {
    if (map && position) {
      map.panTo({ lat: position.lat, lng: position.lng });
      map.setZoom(FIELD_MODE_ZOOM);
    }
    refreshPosition();
  }, [map, position, refreshPosition]);

  return (
    <div className="h-full w-full flex flex-col bg-zinc-900">
      {/* Top bar — session timer + end button */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
        <SessionTimer startTime={sessionStartTime} />

        <div className="flex items-center gap-2">
          {/* Session stats pill */}
          <div className="bg-zinc-900/80 backdrop-blur rounded-full px-3 py-1.5 text-xs text-zinc-300 font-mono">
            {sessionStats.total} doors
          </div>

          <button
            onClick={onEndSession}
            className="bg-red-600/90 backdrop-blur text-white rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all"
          >
            <Square className="w-3 h-3 fill-current" />
            END
          </button>
        </div>
      </div>

      {/* GPS Error */}
      {gpsError && (
        <div className="absolute top-14 left-3 right-3 z-10 bg-red-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          {gpsError}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <Map
          defaultCenter={position ? { lat: position.lat, lng: position.lng } : DEFAULT_CENTER}
          defaultZoom={FIELD_MODE_ZOOM}
          mapId="field-mode-map"
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          mapTypeId="hybrid"
          className="w-full h-full"
        >
          {/* GPS Dot */}
          {position && (
            <AdvancedMarker
              position={{ lat: position.lat, lng: position.lng }}
              zIndex={1000}
            >
              <GpsDot />
            </AdvancedMarker>
          )}

          {/* Existing pins */}
          {pins.map((pin) => (
            <AdvancedMarker
              key={pin.id}
              position={{ lat: pin.lat, lng: pin.lng }}
              onClick={() => handlePinClick(pin)}
            >
              <FieldPin status={pin.status} dispositions={dispositions} />
            </AdvancedMarker>
          ))}
        </Map>

        {/* Center on me FAB */}
        <button
          onClick={handleCenterOnMe}
          className="absolute bottom-32 right-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all"
        >
          <Navigation className="w-5 h-5 text-blue-600" />
        </button>
      </div>

      {/* Conversion Form overlay */}
      {showConversionForm && (
        <FieldModeConversionForm
          status={showConversionForm.status}
          pin={showConversionForm.pin}
          onSubmit={handleConversionSubmit}
          onCancel={() => {
            setShowConversionForm(null);
            setPendingPin(null);
          }}
        />
      )}

      {/* Bottom: Drop Pin + 6-Button Quick-Tap Bar */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-3 pt-2 pb-4 safe-area-inset-bottom">
        {/* Drop pin button — only when no pending pin */}
        {!pendingPin && (
          <button
            onClick={handleDropPin}
            disabled={!hasLocation || dropping}
            className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-2 transition-all active:scale-[0.98] ${
              hasLocation
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            {dropping ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                DROP PIN AT MY LOCATION
              </>
            )}
          </button>
        )}

        {/* Cancel selection */}
        {pendingPin && (
          <button
            onClick={() => setPendingPin(null)}
            className="w-full py-1.5 text-zinc-500 text-xs font-mono mb-1 flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" />
            CANCEL
          </button>
        )}

        {/* 6-button quick-tap bar */}
        <div className="grid grid-cols-6 gap-1.5">
          {FIELD_MODE_PINS.map(({ code, label, color, shortLabel }) => (
            <button
              key={code}
              onClick={() => handleQuickTap(code)}
              disabled={!pendingPin}
              className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-white font-bold transition-all active:scale-90 ${
                pendingPin ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ backgroundColor: pendingPin ? color : '#27272a' }}
              data-testid={`field-tap-${code}`}
            >
              <span className="text-base font-mono">{shortLabel}</span>
              <span className="text-[8px] font-normal opacity-80 mt-0.5 leading-tight">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Main FieldMode component
const FieldMode = ({ onEndSession, territoryId = null }) => {
  const { position, accuracy, error: gpsError, refreshPosition, hasLocation } = useGpsWatch();
  const {
    pins,
    loading,
    createPin,
    logVisit,
    fetchPins,
    dispositions,
  } = useHarvestPins({ territoryId });

  const [sessionId, setSessionId] = useState(null);
  const [sessionStats, setSessionStats] = useState({ total: 0 });

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const result = await harvestService.startFieldSession(territoryId);
        setSessionId(result.session_id);
      } catch (err) {
        console.warn('Failed to start field session:', err);
      }
    };
    startSession();
  }, [territoryId]);

  // End session handler
  const handleEndSession = useCallback(async () => {
    let summary = null;
    if (sessionId) {
      try {
        summary = await harvestService.endFieldSession(sessionId);
      } catch (err) {
        console.warn('Failed to end session:', err);
      }
    }
    onEndSession?.(summary || { ...sessionStats, session_id: sessionId });
  }, [sessionId, sessionStats, onEndSession]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-zinc-900">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white text-lg font-bold mb-2">Google Maps API Key Required</h3>
          <p className="text-zinc-400 text-sm">
            Set <code className="text-orange-400">VITE_GOOGLE_MAPS_API_KEY</code> in your .env file.
          </p>
          <button
            onClick={() => onEndSession?.(null)}
            className="mt-4 px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm"
          >
            Exit Field Mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <FieldModeInner
        position={position}
        hasLocation={hasLocation}
        gpsError={gpsError}
        refreshPosition={refreshPosition}
        pins={pins}
        loading={loading}
        createPin={createPin}
        logVisit={logVisit}
        fetchPins={fetchPins}
        dispositions={dispositions}
        sessionId={sessionId}
        sessionStats={sessionStats}
        setSessionStats={setSessionStats}
        onEndSession={handleEndSession}
      />
    </APIProvider>
  );
};

export default FieldMode;
