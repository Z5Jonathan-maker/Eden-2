import React, { useState, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  GeoJSON,
  CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/tabs';
import { Card, CardContent } from '../shared/ui/card';
import { Input } from '../shared/ui/input';
import { toast } from 'sonner';
import {
  Map,
  Trophy,
  Flame,
  Award,
  Plus,
  Target,
  Home,
  Phone,
  Mail,
  X,
  Check,
  RefreshCw,
  MapPin,
  Presentation,
  Layers,
  Copy,
  LocateFixed,
  User,
  Calendar,
  Satellite,
  Square,
  Building2,
  MessageSquare,
  Footprints,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_ICONS } from '../assets/badges';
import { getKnockMetricsSummary, recordKnockMetric } from '../lib/harvestMetrics';
import { apiGet } from '../lib/api';
import { harvestService } from '../services/harvestService';

// Import from harvest submodules directly
import { STATUSES, TILE_LAYERS, DEFAULT_CENTER } from './harvest/constants';
import { createEnzyPin, userBeacon, getDistance } from './harvest/utils';
import { findTerritoryForPoint, normalizeTerritoryCoordinates } from './harvest/geometry';
import { MapController, FlyTo } from './harvest/MapComponents';
import LeaderboardTab from './harvest/LeaderboardTab';
import HarvestTodayTab from './HarvestTodayTab';
import HarvestChallengesTab from './HarvestChallengesTab';
import HarvestProfileTab from './HarvestProfileTab';
import { useOfflineSync } from './harvest/useOfflineSync';

// Define copyUtil locally to avoid module export issues
const copyUtil = async (text, notificationToast) => {
  try {
    await navigator.clipboard.writeText(text);
    notificationToast?.success('Copied!', { duration: 1000 });
  } catch (err) {
    notificationToast?.error('Failed to copy');
  }
};

const coerceNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

const buildStablePinId = (pin = {}) => {
  return (
    pin?.id ||
    pin?._id ||
    pin?.pin_id ||
    pin?.idempotency_key ||
    `${pin?.latitude ?? pin?.lat}:${pin?.longitude ?? pin?.lng}:${pin?.created_at || pin?.updated_at || ''}`
  );
};

const safeFixed = (value, digits = 2, fallback = 'N/A') => {
  const numericValue = coerceNumber(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(digits) : fallback;
};

const normalizePinCoords = (pin) => {
  if (!pin) return pin;
  const latitude = coerceNumber(pin.latitude ?? pin.lat);
  const longitude = coerceNumber(pin.longitude ?? pin.lng);
  return {
    ...pin,
    id: buildStablePinId(pin),
    latitude,
    longitude,
    lat: latitude ?? pin.lat,
    lng: longitude ?? pin.lng,
    disposition: pin?.disposition || 'unmarked',
  };
};

const getPinCoordsLabel = (pin) => {
  const latitude = coerceNumber(pin?.latitude ?? pin?.lat);
  const longitude = coerceNumber(pin?.longitude ?? pin?.lng);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${safeFixed(latitude, 5)}, ${safeFixed(longitude, 5)}`;
  }
  return 'Unknown location';
};

const hasValidCoords = (pin) => {
  const latitude = coerceNumber(pin?.latitude ?? pin?.lat);
  const longitude = coerceNumber(pin?.longitude ?? pin?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
};

const formatParcelValueK = (value) => {
  const numericValue = coerceNumber(value);
  if (!Number.isFinite(numericValue)) return null;
  return `$${safeFixed(numericValue / 1000, 0)}K`;
};

const formatParcelAcres = (squareFeet) => {
  const numericSqft = coerceNumber(squareFeet);
  if (!Number.isFinite(numericSqft)) return null;
  return `${safeFixed(numericSqft / 43560, 2)} ac`;
};

const toRadians = (deg) => deg * (Math.PI / 180);

const distanceMiles = (lat1, lng1, lat2, lng2) => {
  const R = 3959;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getTerritoryCentroid = (territory) => {
  const points = normalizeTerritoryCoordinates(territory);
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 }
  );
  return {
    lat: sum.lat / points.length,
    lng: sum.lng / points.length,
  };
};

const findNearestTerritory = (lat, lng, territories = []) => {
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const territory of territories) {
    const centroid = getTerritoryCentroid(territory);
    if (!centroid) continue;
    const miles = distanceMiles(lat, lng, centroid.lat, centroid.lng);
    if (Number.isFinite(miles) && miles < nearestDistance) {
      nearest = territory;
      nearestDistance = miles;
    }
  }

  if (!nearest) return null;
  return { territory: nearest, miles: nearestDistance };
};

const getTerritoryAssignments = (territory) =>
  territory?.assigned_users || territory?.assignments || [];

const getTerritoryLoadScore = (territory) => {
  const assignedCount = getTerritoryAssignments(territory).length;
  const pinCount = coerceNumber(territory?.stats?.total_pins) ?? 0;
  return pinCount / Math.max(assignedCount, 1);
};

const getRoleValue = (roleValue) => {
  if (roleValue && typeof roleValue === 'object') {
    const nestedRole = roleValue.name || roleValue.role || roleValue.value || roleValue.label;
    if (typeof nestedRole === 'string') return nestedRole.toLowerCase();
  }
  if (typeof roleValue === 'string') return roleValue.toLowerCase();
  if (Array.isArray(roleValue)) {
    return roleValue
      .map((entry) => getRoleValue(entry))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return String(roleValue || '').toLowerCase();
};

const decodeJwtPayload = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (_err) {
    return null;
  }
};

// Token claims no longer accessible with httpOnly cookies
// User object from AuthContext contains necessary permissions
const getTokenClaims = () => null;

const hasTurfAdminAccess = (user, tokenClaims = null) => {
  // Emergency local override for field ops triage:
  // localStorage.setItem('eden_force_turf_admin', 'true')
  // Remove after backend role payloads are consistent.
  try {
    if (window?.localStorage?.getItem('eden_force_turf_admin') === 'true') {
      return true;
    }
  } catch (_err) {
    // no-op
  }

  if (
    user?.is_admin === true ||
    user?.isAdmin === true ||
    user?.is_superuser === true ||
    user?.isSuperuser === true
  ) {
    return true;
  }

  const privilegedRoleTokens = [
    'admin',
    'manager',
    'owner',
    'super_admin',
    'superadmin',
    'administrator',
  ];
  const roleSources = [
    user?.role,
    user?.user_type,
    user?.account_type,
    user?.type,
    user?.profile?.role,
    user?.profile?.user_type,
    user?.metadata?.role,
    user?.meta?.role,
    tokenClaims?.role,
    tokenClaims?.user_role,
    tokenClaims?.account_role,
    tokenClaims?.type,
  ];
  const mergedRoleValues = roleSources.map((source) => getRoleValue(source)).join(' ');
  if (privilegedRoleTokens.some((token) => mergedRoleValues.includes(token))) {
    return true;
  }

  const extraRoleFields = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.groups) ? user.groups : []),
    ...(Array.isArray(user?.authorities) ? user.authorities : []),
    ...(Array.isArray(user?.profile?.roles) ? user.profile.roles : []),
    ...(Array.isArray(user?.profile?.groups) ? user.profile.groups : []),
    ...(Array.isArray(user?.profile?.authorities) ? user.profile.authorities : []),
    ...(Array.isArray(tokenClaims?.roles) ? tokenClaims.roles : []),
    ...(Array.isArray(tokenClaims?.groups) ? tokenClaims.groups : []),
    ...(Array.isArray(tokenClaims?.authorities) ? tokenClaims.authorities : []),
  ];
  const mergedRoles = extraRoleFields.map((entry) => getRoleValue(entry)).join(' ');
  if (privilegedRoleTokens.some((token) => mergedRoles.includes(token))) {
    return true;
  }

  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.map((entry) => String(entry || '').toLowerCase())
    : [];
  const profilePermissions = Array.isArray(user?.profile?.permissions)
    ? user.profile.permissions.map((entry) => String(entry || '').toLowerCase())
    : [];
  const scopes = Array.isArray(user?.scopes)
    ? user.scopes.map((entry) => String(entry || '').toLowerCase())
    : [];
  const profileScopes = Array.isArray(user?.profile?.scopes)
    ? user.profile.scopes.map((entry) => String(entry || '').toLowerCase())
    : [];
  const tokenPermissions = Array.isArray(tokenClaims?.permissions)
    ? tokenClaims.permissions.map((entry) => String(entry || '').toLowerCase())
    : [];
  const tokenScopes = Array.isArray(tokenClaims?.scopes)
    ? tokenClaims.scopes.map((entry) => String(entry || '').toLowerCase())
    : [];
  const grants = permissions.concat(scopes);
  const mergedGrants = grants
    .concat(profilePermissions)
    .concat(profileScopes)
    .concat(tokenPermissions)
    .concat(tokenScopes);
  return (
    mergedGrants.includes('territories.write') ||
    mergedGrants.includes('harvest.territories.manage') ||
    mergedGrants.includes('harvest:territories:manage') ||
    mergedGrants.includes('admin:*')
  );
};

const getUserId = (entry) =>
  entry?.id || entry?._id || entry?.user_id || entry?.user?.id || entry?.user?._id || '';
const AUTO_ASSIGN_NEAREST_THRESHOLD_MILES = 0.1;
const HARVEST_AUTO_REPAIR_PREF_KEY = 'eden_harvest_auto_repair_invalid_pins_v1';
const AUTO_REPAIR_COOLDOWN_MS = 60 * 1000;
const DROP_PIN_DEBOUNCE_MS = 800;
const GPS_STALE_MS = 2 * 60 * 1000;
const GPS_MAX_ACCURACY_METERS = 80;
const GPS_DISTANCE_WARN_MILES = 0.35;

const formatCoord = (value, digits = 4) => {
  return safeFixed(value, digits, 'N/A');
};

const isValidLatLngPair = (lat, lng) =>
  Number.isFinite(coerceNumber(lat)) && Number.isFinite(coerceNumber(lng));

const createPinIdempotencyKey = (lat, lng) =>
  `pin_${Date.now()}_${String(lat)}_${String(lng)}_${Math.random().toString(36).slice(2, 10)}`;

// ============================================
// MAIN COMPONENT
// ============================================
const Harvest = () => {
  // Auth context
  const { user } = useAuth();
  const tokenClaims = React.useMemo(() => getTokenClaims(), []);

  // Offline sync hook
  const {
    isOnline,
    isSyncing,
    unsyncedCount,
    fetchPins: fetchPinsOffline,
    createPin: createPinOffline,
    syncToServer,
  } = useOfflineSync();

  // Core state
  const [pins, setPins] = useState([]);
  const pinsRef = React.useRef([]); // Ref for DOM click handler
  const [leaderboard, setLeaderboard] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [badges, setBadges] = useState({ badges: [], earned_count: 0, total_count: 0 });
  const [territories, setTerritories] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState(null);
  const [gpsLastFixAt, setGpsLastFixAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Map state
  const [mapLayer, setMapLayer] = useState('satellite');
  const [showTerritories, setShowTerritories] = useState(true);
  const [showTurfOps, setShowTurfOps] = useState(false);
  const [selectedDropTerritoryId, setSelectedDropTerritoryId] = useState('auto');
  const [selectedManageTerritoryId, setSelectedManageTerritoryId] = useState('');
  const [turfUsers, setTurfUsers] = useState([]);
  const [turfUsersError, setTurfUsersError] = useState('');
  const [selectedAssignUserId, setSelectedAssignUserId] = useState('');
  const [selectedBulkUserIds, setSelectedBulkUserIds] = useState([]);
  const [loadingTurfUsers, setLoadingTurfUsers] = useState(false);
  const [assigningTurfUser, setAssigningTurfUser] = useState(false);
  const [turfCutMode, setTurfCutMode] = useState(false);
  const [draftTurfPoints, setDraftTurfPoints] = useState([]);
  const [savingTurf, setSavingTurf] = useState(false);
  const [lastTurfMatch, setLastTurfMatch] = useState(null);
  const [flyToPos, setFlyToPos] = useState(null);
  const [addPinMode, setAddPinMode] = useState(false);

  // Selection state
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

  // Parcel layer state
  const [showParcels, setShowParcels] = useState(false);
  const [selectedParcelGeometry, setSelectedParcelGeometry] = useState(null);
  const [parcelLoading, setParcelLoading] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNote, setContactNote] = useState('');

  // GPS Trail
  const [gpsTrail, setGpsTrail] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('map');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('day');
  const [myStats, setMyStats] = useState(null);
  const [pinHealthSession, setPinHealthSession] = useState({
    dropped: 0,
    synced: 0,
    queued: 0,
    failed: 0,
    lastDropAt: null,
  });
  const [repairingPins, setRepairingPins] = useState(false);
  const [unresolvedPinIds, setUnresolvedPinIds] = useState([]);
  const [showUnresolvedPins, setShowUnresolvedPins] = useState(false);
  const [syncingQueueNow, setSyncingQueueNow] = useState(false);
  const [autoRepairInvalidPins, setAutoRepairInvalidPins] = useState(() => {
    try {
      const raw = localStorage.getItem(HARVEST_AUTO_REPAIR_PREF_KEY);
      return raw === null ? true : raw === 'true';
    } catch (_err) {
      return true;
    }
  });
  const lastAutoRepairAtRef = React.useRef(0);
  const lastDropAtRef = React.useRef(0);

  const [knockMetrics, setKnockMetrics] = useState(() => getKnockMetricsSummary());
  const canManageTurf = hasTurfAdminAccess(user, tokenClaims);
  const normalizedPins = React.useMemo(() => (pins || []).map(normalizePinCoords), [pins]);
  const validPins = normalizedPins.filter(hasValidCoords);
  const invalidPinCount = normalizedPins.length - validPins.length;
  const renderablePinCount = normalizedPins.length - invalidPinCount;
  const recoveredPinCount = normalizedPins.filter(
    (pin) => hasValidCoords(pin) && ['lat_lng', 'history'].includes(pin?.coords_source)
  ).length;
  const safeUserLocation = isValidLatLngPair(userLocation?.lat, userLocation?.lng)
    ? { lat: coerceNumber(userLocation.lat), lng: coerceNumber(userLocation.lng) }
    : null;
  const safeMapCenter = safeUserLocation
    ? [safeUserLocation.lat, safeUserLocation.lng]
    : DEFAULT_CENTER;
  const safeFlyToPos =
    Array.isArray(flyToPos) && isValidLatLngPair(flyToPos[0], flyToPos[1])
      ? [coerceNumber(flyToPos[0]), coerceNumber(flyToPos[1])]
      : null;
  const safeGpsTrail = (gpsTrail || [])
    .filter((entry) => Array.isArray(entry) && isValidLatLngPair(entry[0], entry[1]))
    .map((entry) => [coerceNumber(entry[0]), coerceNumber(entry[1])]);
  const safeDraftTurfPoints = (draftTurfPoints || [])
    .filter((point) => isValidLatLngPair(point?.lat, point?.lng))
    .map((point) => ({ lat: coerceNumber(point.lat), lng: coerceNumber(point.lng) }));
  const invalidPinSamples = normalizedPins
    .filter((pin) => !hasValidCoords(pin))
    .slice(0, 3)
    .map((pin) => ({
      id: pin?.id || 'unknown',
      source: pin?.coords_source || 'invalid',
      label: pin?.address || 'No address',
    }));
  const gpsAgeMs = gpsLastFixAt ? Date.now() - gpsLastFixAt : Number.POSITIVE_INFINITY;
  const gpsStale = !gpsLastFixAt || gpsAgeMs > GPS_STALE_MS;

  // Use copyUtil with toast
  const copyToClipboard = (text) => copyUtil(text, toast);

  // Fetch parcel data for selected pin
  const fetchParcelForPin = useCallback(async (pin) => {
    if (!pin?.latitude || !pin?.longitude) return;

    // If pin already has parcel geometry, use it
    if (pin.parcel_geometry) {
      setSelectedParcelGeometry(pin.parcel_geometry);
      return;
    }

    setParcelLoading(true);
    try {
      const data = await apiGet(
        `/api/regrid/parcel/point?lat=${pin.latitude}&lon=${pin.longitude}`,
        { cache: false }
      );
      if (data?.ok && data.data?.success && data.data?.parcel?.geometry) {
        setSelectedParcelGeometry(data.data.parcel.geometry);
      }
    } catch (err) {
      console.error('Error fetching parcel:', err);
    } finally {
      setParcelLoading(false);
    }
  }, []);

  // Fetch all data (with offline support for pins)
  const fetchData = useCallback(async () => {
    try {
      // Fetch pins with offline support
      const { pins: fetchedPins, source } = await fetchPinsOffline();
      const normalizedPins = (fetchedPins || []).map(normalizePinCoords);
      setPins(normalizedPins);
      const invalidCount = normalizedPins.length - normalizedPins.filter(hasValidCoords).length;
      if (source === 'cache') {
        toast.info('Showing cached pins (offline)', { duration: 2000 });
      }
      if (
        canManageTurf &&
        autoRepairInvalidPins &&
        isOnline &&
        invalidCount > 0 &&
        Date.now() - lastAutoRepairAtRef.current > AUTO_REPAIR_COOLDOWN_MS
      ) {
        lastAutoRepairAtRef.current = Date.now();
        try {
          const repairResult = await harvestService.repairInvalidPins();
          if ((repairResult?.repaired || 0) > 0) {
            toast.info(
              `Auto-repaired ${repairResult.repaired} invalid pin${repairResult.repaired > 1 ? 's' : ''}.`
            );
            const refetched = await fetchPinsOffline();
            setPins((refetched.pins || []).map(normalizePinCoords));
          }
        } catch (_err) {
          // Silent fail: manual repair remains available.
        }
      }

      // Fetch other data (online only)
      if (isOnline) {
        const [
          nextStats,
          nextTerritories,
          nextLeaderboard,
          nextCompetitions,
          nextBadges,
          nextMyStats,
        ] = await Promise.all([
          harvestService.getMapOverviewStats(),
          harvestService.getTerritories(),
          harvestService.getScoringLeaderboard(leaderboardPeriod, 20),
          harvestService.getCompetitions(),
          harvestService.getScoringBadges(),
          harvestService.getMyScoringStats(),
        ]);
        setStats(nextStats);
        setTerritories(nextTerritories);
        setLeaderboard(nextLeaderboard?.entries || nextLeaderboard || []);
        setCompetitions(nextCompetitions?.competitions || nextCompetitions || []);
        setBadges(nextBadges || { badges: [], earned_count: 0, total_count: 0 });
        setMyStats(nextMyStats || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [leaderboardPeriod, isOnline, fetchPinsOffline, canManageTurf, autoRepairInvalidPins]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Keep ref in sync with pins state
  useEffect(() => {
    pinsRef.current = normalizedPins;
  }, [normalizedPins]);

  useEffect(() => {
    const refreshMetrics = () => setKnockMetrics(getKnockMetricsSummary());
    refreshMetrics();
    window.addEventListener('harvest:knock-metric', refreshMetrics);
    return () => window.removeEventListener('harvest:knock-metric', refreshMetrics);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HARVEST_AUTO_REPAIR_PREF_KEY, String(Boolean(autoRepairInvalidPins)));
    } catch (_err) {
      // Ignore localStorage write errors.
    }
  }, [autoRepairInvalidPins]);

  useEffect(() => {
    if (!canManageTurf || !showTurfOps) return;
    if (turfUsers.length > 0) return;

    let active = true;
    const loadUsers = async () => {
      setLoadingTurfUsers(true);
      try {
        const users = await harvestService.getAdminUsers();
        if (active) {
          const reps = users.filter((entry) => getRoleValue(entry.role) !== 'client');
          setTurfUsers(reps);
          setTurfUsersError('');
        }
      } catch (err) {
        if (active) {
          setTurfUsersError(err?.message || 'Failed to load assignable users');
          toast.error('Failed to load assignable users');
        }
      } finally {
        if (active) setLoadingTurfUsers(false);
      }
    };

    loadUsers();
    return () => {
      active = false;
    };
  }, [canManageTurf, showTurfOps, turfUsers.length]);

  useEffect(() => {
    if (!selectedManageTerritoryId && territories.length > 0) {
      setSelectedManageTerritoryId(territories[0].id);
    }
  }, [territories, selectedManageTerritoryId]);

  // Global click handler for pins (workaround for Leaflet divIcon click issues)
  useEffect(() => {
    const handlePinDOMClick = (e) => {
      // Check if clicked element is inside a pin
      const pinInner = e.target.closest('.enzy-pin-inner');
      const pinWrapper = e.target.closest('.enzy-pin');

      if (pinInner || pinWrapper) {
        e.stopPropagation();
        const pinElement = pinInner || pinWrapper.querySelector('.enzy-pin-inner');
        if (pinElement) {
          const pinId = pinElement.getAttribute('data-pin-id');
          if (pinId) {
            const pin = pinsRef.current.find((p) => p.id === pinId);
            if (pin) {
              // console.log('Pin clicked via DOM:', pin.id);
              setSelectedPin(normalizePinCoords(pin));
              setShowPanel(true);
              if (hasValidCoords(pin)) {
                setFlyToPos([pin.latitude ?? pin.lat, pin.longitude ?? pin.lng]);
              }
              setContactName(pin.homeowner_name || pin.parcel_owner || '');
              setContactPhone(pin.phone || '');
              setContactEmail(pin.email || '');
              setContactNote(pin.notes || '');
              // Load parcel boundary if available
              if (pin.parcel_geometry) {
                setSelectedParcelGeometry(pin.parcel_geometry);
              } else {
                setSelectedParcelGeometry(null);
                // Fetch parcel data in background
                fetchParcelForPin(pin);
              }
              if (navigator.vibrate) navigator.vibrate(10);
            }
          }
        }
      }
    };

    // Use capture phase to get event before Leaflet
    document.addEventListener('click', handlePinDOMClick, true);
    return () => document.removeEventListener('click', handlePinDOMClick, true);
  }, [fetchParcelForPin]);

  // GPS tracking
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          setGpsAccuracyMeters(coerceNumber(pos.coords.accuracy));
          setGpsLastFixAt(Date.now());
          setGpsTrail((prev) => [...prev.slice(-50), [loc.lat, loc.lng]]);

          harvestService
            .updateRepLocation({ latitude: loc.lat, longitude: loc.lng })
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Quick status update - Enzy style (one-tap, auto-dismiss, points toast)
  const updateStatus = async (status) => {
    if (!selectedPin) return;
    const startedAt = performance.now();

    // Optimistic UI update - instant color change
    setPins((prev) =>
      prev.map((p) => (p.id === selectedPin.id ? { ...p, disposition: status } : p))
    );

    // Haptic feedback immediately
    if (navigator.vibrate) navigator.vibrate(15);

    // Auto-dismiss panel after status change (Enzy behavior)
    setShowPanel(false);
    setSelectedPin(null);

    try {
      const data = await harvestService.updatePin(selectedPin.id, {
        disposition: status,
        homeowner_name: contactName || selectedPin.homeowner_name,
        phone: contactPhone || selectedPin.phone,
        email: contactEmail || selectedPin.email,
        notes: contactNote || selectedPin.notes,
      });

      recordKnockMetric({
        type: 'status_update',
        durationMs: performance.now() - startedAt,
        status,
        success: true,
      });

      // Show points earned if any
      if (data.points_earned > 0) {
        toast.success(`${STATUSES[status]?.label} +${data.points_earned} pts`, {
          duration: 1200,
          icon: '🎯',
        });
      } else {
        toast.success(`${STATUSES[status]?.label}`, { duration: 800 });
      }

      // Update stats
      setStats((prev) => ({
        ...prev,
        by_disposition: {
          ...prev?.by_disposition,
          [status]: (prev?.by_disposition?.[status] || 0) + 1,
          [selectedPin.disposition]: Math.max(
            0,
            (prev?.by_disposition?.[selectedPin.disposition] || 1) - 1
          ),
        },
      }));
    } catch (err) {
      recordKnockMetric({
        type: 'status_update',
        durationMs: performance.now() - startedAt,
        status,
        success: false,
        error: err.message,
      });
      // Revert optimistic update on error
      setPins((prev) =>
        prev.map((p) =>
          p.id === selectedPin.id ? { ...p, disposition: selectedPin.disposition } : p
        )
      );
      toast.error('Update failed — pin reverted', { duration: 3000 });
      // Vibrate to signal failure (distinct pattern from success)
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }
  };

  // Add new pin - One-tap instant (Enzy style) with offline support
  const addPin = async (latlng) => {
    const nowMs = Date.now();
    if (nowMs - lastDropAtRef.current < DROP_PIN_DEBOUNCE_MS) {
      return;
    }
    lastDropAtRef.current = nowMs;

    const lat = coerceNumber(latlng?.lat);
    const lng = coerceNumber(latlng?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Pin drop failed: invalid map coordinates');
      return;
    }

    const gpsGuardReasons = [];
    if (!userLocation) {
      gpsGuardReasons.push('No live GPS lock detected.');
    } else {
      const driftMiles = coerceNumber(distanceMiles(userLocation.lat, userLocation.lng, lat, lng));
      if (Number.isFinite(driftMiles) && driftMiles > GPS_DISTANCE_WARN_MILES) {
        gpsGuardReasons.push(`Pin is ${safeFixed(driftMiles, 2)} mi from your current location.`);
      }
    }
    if (gpsStale) {
      const staleSeconds = Number.isFinite(gpsAgeMs) ? Math.round(gpsAgeMs / 1000) : null;
      gpsGuardReasons.push(
        staleSeconds !== null
          ? `GPS fix is stale (${staleSeconds}s old).`
          : 'GPS fix timestamp unavailable.'
      );
    }
    if (Number.isFinite(gpsAccuracyMeters) && gpsAccuracyMeters > GPS_MAX_ACCURACY_METERS) {
      gpsGuardReasons.push(`GPS accuracy is low (${Math.round(gpsAccuracyMeters)}m).`);
    }
    if (gpsGuardReasons.length > 0) {
      const proceed = window.confirm(
        `GPS quality warning:\n- ${gpsGuardReasons.join('\n- ')}\n\nDrop pin anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    const matchedTerritory = findTerritoryForPoint(lat, lng, territories);
    const manuallySelectedTerritory =
      selectedDropTerritoryId !== 'auto'
        ? territories.find((territory) => territory.id === selectedDropTerritoryId)
        : null;
    const nearest =
      !manuallySelectedTerritory && !matchedTerritory && selectedDropTerritoryId === 'auto'
        ? findNearestTerritory(lat, lng, territories)
        : null;
    const nearestFallbackTerritory =
      nearest &&
      Number.isFinite(nearest.miles) &&
      nearest.miles <= AUTO_ASSIGN_NEAREST_THRESHOLD_MILES
        ? nearest.territory
        : null;
    const assignedTerritory =
      manuallySelectedTerritory || matchedTerritory || nearestFallbackTerritory || null;
    setLastTurfMatch({
      mode: selectedDropTerritoryId,
      assigned: assignedTerritory?.name || null,
      matched: matchedTerritory?.name || null,
      fallbackAssigned: nearestFallbackTerritory?.name || null,
      lat,
      lng,
      nearestName: nearest?.territory?.name || null,
      nearestMiles: Number.isFinite(nearest?.miles) ? nearest.miles : null,
      at: new Date().toISOString(),
    });
    if (selectedDropTerritoryId === 'auto' && !assignedTerritory) {
      toast.info('No turf match found for this pin. Pin saved without a turf assignment.');
    } else if (
      selectedDropTerritoryId === 'auto' &&
      !matchedTerritory &&
      nearestFallbackTerritory
    ) {
      toast.info(`Assigned to nearest turf (${nearestFallbackTerritory.name})`);
    }

    const pinData = {
      latitude: lat,
      longitude: lng,
      disposition: 'unmarked',
      address: 'Loading...',
      territory_id: assignedTerritory?.id || null,
      idempotency_key: createPinIdempotencyKey(lat, lng),
    };

    // Haptic feedback immediately
    if (navigator.vibrate) navigator.vibrate(10);

    // Use offline sync hook
    const { success, pin, synced } = await createPinOffline(pinData);

    if (success) {
      const normalizedPin = normalizePinCoords({
        ...pin,
        latitude: pin?.latitude ?? pin?.lat ?? lat,
        longitude: pin?.longitude ?? pin?.lng ?? lng,
      });
      setPins((prev) => {
        const existingIndex = prev.findIndex((entry) => entry.id === normalizedPin.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...normalizedPin,
          };
          return updated;
        }
        return [...prev, normalizedPin];
      });
      setPinHealthSession((prev) => ({
        ...prev,
        dropped: prev.dropped + 1,
        synced: prev.synced + (synced ? 1 : 0),
        queued: prev.queued + (synced ? 0 : 1),
        lastDropAt: new Date().toISOString(),
      }));
      const territorySuffix = assignedTerritory?.name ? ` - ${assignedTerritory.name}` : '';
      if (normalizedPin?.duplicate) {
        toast.info(`Existing pin reused${territorySuffix}`, { duration: 1200 });
      } else {
        toast.success(
          synced ? `Pin added${territorySuffix}` : `Pin saved offline${territorySuffix}`,
          { duration: 900 }
        );
      }

      // Select the new pin and open panel
      setSelectedPin(normalizedPin);
      setShowPanel(true);
      setFlyToPos([lat, lng]);
    } else {
      setPinHealthSession((prev) => ({
        ...prev,
        failed: prev.failed + 1,
        lastDropAt: new Date().toISOString(),
      }));
      toast.error('Failed to add pin');
    }
  };

  const handleSyncQueueNow = async () => {
    if (!isOnline || syncingQueueNow || unsyncedCount <= 0) return;
    setSyncingQueueNow(true);
    try {
      await syncToServer();
      await fetchData();
      toast.success('Sync complete');
    } catch (err) {
      toast.error(err?.message || 'Sync failed');
    } finally {
      setSyncingQueueNow(false);
    }
  };

  const saveDraftTurf = async () => {
    if (draftTurfPoints.length < 3) {
      toast.error('Need at least 3 points to cut turf');
      return;
    }

    const proposedName = window.prompt('Name this turf', `Turf ${new Date().toLocaleDateString()}`);
    if (!proposedName) return;

    setSavingTurf(true);
    try {
      await harvestService.createTerritory({
        name: proposedName,
        description: 'Created from Harvest map',
        polygon: draftTurfPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
        color: '#3B82F6',
        priority: 2,
        meta: { source: 'harvest-map' },
      });

      const refreshedTerritories = await harvestService.getTerritories();
      setTerritories(refreshedTerritories);
      setTurfCutMode(false);
      setDraftTurfPoints([]);
      toast.success(`Turf created: ${proposedName}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to create turf');
    } finally {
      setSavingTurf(false);
    }
  };

  const handleRepairInvalidPins = async () => {
    if (!canManageTurf || repairingPins) return;
    setRepairingPins(true);
    try {
      const result = await harvestService.repairInvalidPins();
      const unresolvedIds = Array.isArray(result?.unresolved_pin_ids)
        ? result.unresolved_pin_ids
        : [];
      setUnresolvedPinIds(unresolvedIds);
      toast.success(
        `Pin repair complete: repaired ${result?.repaired ?? 0}, unresolved ${result?.unresolved_count ?? 0}`
      );
      await fetchData();
      if ((result?.unresolved_count || 0) > 0) {
        setShowUnresolvedPins(true);
      }
    } catch (err) {
      toast.error(err?.message || 'Pin repair failed');
    } finally {
      setRepairingPins(false);
    }
  };

  const focusUnresolvedPin = (pinId) => {
    if (!pinId) return;
    const target = pins.find((entry) => entry?.id === pinId);
    if (!target) {
      toast.error('Unresolved pin not found in current dataset');
      return;
    }
    setSelectedPin(target);
    setShowPanel(true);
    if (hasValidCoords(target)) {
      setFlyToPos([target.latitude ?? target.lat, target.longitude ?? target.lng]);
    }
  };

  const assignRepToTerritory = async () => {
    if (!selectedManageTerritoryId || !selectedAssignUserId) {
      toast.error('Select a turf and rep');
      return;
    }

    setAssigningTurfUser(true);
    try {
      await harvestService.assignTerritoryUser(
        selectedManageTerritoryId,
        selectedAssignUserId,
        'Assigned from Harvest map'
      );
      const refreshed = await harvestService.getTerritories();
      setTerritories(refreshed);
      setSelectedAssignUserId('');
      setSelectedBulkUserIds([]);
      toast.success('Rep assigned to turf');
    } catch (err) {
      toast.error(err?.message || 'Failed to assign rep');
    } finally {
      setAssigningTurfUser(false);
    }
  };

  const unassignRepFromTerritory = async (userId) => {
    if (!selectedManageTerritoryId || !userId) return;
    setAssigningTurfUser(true);
    try {
      await harvestService.unassignTerritoryUser(selectedManageTerritoryId, userId);
      const refreshed = await harvestService.getTerritories();
      setTerritories(refreshed);
      toast.success('Rep unassigned');
    } catch (err) {
      toast.error(err?.message || 'Failed to unassign rep');
    } finally {
      setAssigningTurfUser(false);
    }
  };

  const bulkAssignRepsToTerritory = async (userIds) => {
    if (!selectedManageTerritoryId) {
      toast.error('Select a turf first');
      return;
    }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      toast.error('Select at least one rep');
      return;
    }

    setAssigningTurfUser(true);
    let assignedCount = 0;
    try {
      for (const userId of userIds) {
        await harvestService.assignTerritoryUser(
          selectedManageTerritoryId,
          userId,
          'Bulk assigned from Harvest map'
        );
        assignedCount += 1;
      }
      const refreshed = await harvestService.getTerritories();
      setTerritories(refreshed);
      setSelectedBulkUserIds([]);
      setSelectedAssignUserId('');
      toast.success(`Assigned ${assignedCount} rep${assignedCount === 1 ? '' : 's'} to turf`);
    } catch (err) {
      toast.error(err?.message || 'Bulk assignment failed');
    } finally {
      setAssigningTurfUser(false);
    }
  };

  const autoBalanceSelectedRepsAcrossTurfs = async () => {
    if (!Array.isArray(selectedBulkUserIds) || selectedBulkUserIds.length === 0) {
      toast.error('Select reps to auto-balance');
      return;
    }

    const activeTerritories = territories.filter((territory) => territory?.is_active !== false);
    if (activeTerritories.length === 0) {
      toast.error('No active turfs available');
      return;
    }

    const territoryRuntime = activeTerritories.map((territory) => ({
      id: territory.id,
      assignedUserIds: new Set(
        getTerritoryAssignments(territory)
          .map((assignment) => getUserId(assignment))
          .filter(Boolean)
      ),
      assignedCount: getTerritoryAssignments(territory).length,
      pinCount: coerceNumber(territory?.stats?.total_pins) ?? 0,
    }));

    setAssigningTurfUser(true);
    let assignedCount = 0;
    try {
      for (const userId of selectedBulkUserIds) {
        const candidate = territoryRuntime
          .filter((entry) => !entry.assignedUserIds.has(userId))
          .sort(
            (a, b) =>
              b.pinCount / Math.max(b.assignedCount, 1) - a.pinCount / Math.max(a.assignedCount, 1)
          )[0];

        if (!candidate) continue;

        await harvestService.assignTerritoryUser(
          candidate.id,
          userId,
          'Auto-balanced from Harvest map'
        );
        candidate.assignedUserIds.add(userId);
        candidate.assignedCount += 1;
        assignedCount += 1;
      }

      const refreshed = await harvestService.getTerritories();
      setTerritories(refreshed);
      setSelectedBulkUserIds([]);
      toast.success(
        `Auto-balanced ${assignedCount} rep${assignedCount === 1 ? '' : 's'} across turfs`
      );
    } catch (err) {
      toast.error(err?.message || 'Auto-balance failed');
    } finally {
      setAssigningTurfUser(false);
    }
  };

  // Handle map click
  const handleMapClick = (latlng) => {
    const lat = coerceNumber(latlng?.lat);
    const lng = coerceNumber(latlng?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error('Map click ignored: invalid coordinates');
      return;
    }

    if (canManageTurf && turfCutMode) {
      setDraftTurfPoints((prev) => [...prev, { lat, lng }]);
      return;
    }
    if (addPinMode) {
      addPin({ lat, lng });
      setAddPinMode(false);
    }
  };

  // Handle pin click
  const handlePinClick = (pin) => {
    // console.log('Pin clicked:', pin.id, pin.address);
    setSelectedPin(normalizePinCoords(pin));
    setShowPanel(true);
    if (hasValidCoords(pin)) {
      setFlyToPos([pin.latitude ?? pin.lat, pin.longitude ?? pin.lng]);
    }
    setContactName(pin.homeowner_name || '');
    setContactPhone(pin.phone || '');
    setContactEmail(pin.email || '');
    setContactNote(pin.notes || '');
    if (navigator.vibrate) navigator.vibrate(10);
  };

  // Save contact info
  const saveContact = async () => {
    if (!selectedPin) return;
    try {
      await harvestService.updatePin(selectedPin.id, {
        homeowner_name: contactName,
        phone: contactPhone,
        email: contactEmail,
        notes: contactNote,
      });
      toast.success('Saved', { duration: 800 });
      setPins((prev) =>
        prev.map((p) =>
          p.id === selectedPin.id
            ? {
                ...p,
                homeowner_name: contactName,
                phone: contactPhone,
                email: contactEmail,
                notes: contactNote,
              }
            : p
        )
      );
    } catch (err) {
      toast.error('Save failed');
    }
  };

  // Competition functions
  const createCompetition = async (compData) => {
    try {
      await harvestService.createCompetition(compData);

      toast.success('Competition created!');
      fetchData(); // Refresh competitions
    } catch (err) {
      toast.error('Failed to create competition');
      console.error(err);
    }
  };

  const joinCompetition = async (competitionId) => {
    try {
      await harvestService.joinCompetition(competitionId);

      toast.success('Joined competition!');
      fetchData(); // Refresh competitions
    } catch (err) {
      toast.error('Failed to join competition');
      console.error(err);
    }
  };

  const canCreateCompetition = hasTurfAdminAccess(user);
  const activeManageTerritory =
    territories.find((territory) => territory.id === selectedManageTerritoryId) || null;
  const activeAssignments =
    activeManageTerritory?.assigned_users || activeManageTerritory?.assignments || [];
  const activeAssignedUserIds = activeAssignments
    .map((assignment) => getUserId(assignment))
    .filter(Boolean);
  const availableUsersForActiveTurf = turfUsers.filter(
    (entry) => !activeAssignedUserIds.includes(getUserId(entry))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-white font-tactical">Loading Harvest...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="h-screen flex flex-col bg-zinc-950" data-testid="harvest-page">
      {/* Compact Header - Tactical */}
      <div className="bg-zinc-900 border-b border-zinc-700/50 px-3 sm:px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <img
            src={NAV_ICONS.harvest}
            alt="Harvest"
            className="w-8 h-8 object-contain icon-3d-shadow"
          />
          <div>
            <h1 className="text-white font-tactical font-bold text-base sm:text-lg">HARVEST</h1>
            <p className="text-zinc-500 font-mono text-[10px] sm:text-xs">
              {pins.length} doors • {stats?.by_disposition?.signed || 0} signed
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {import.meta.env.NODE_ENV !== 'production' && (
            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-[10px]">
              Lat {knockMetrics.avgMs}ms p95 {knockMetrics.p95Ms}ms ok {knockMetrics.successRate}%
            </Badge>
          )}
          {/* Unsynced count */}
          {unsyncedCount > 0 && (
            <Badge
              className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 cursor-pointer text-xs"
              onClick={syncToServer}
            >
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <span className="mr-1">{unsyncedCount}</span>
              )}
              {isSyncing ? 'Sync' : 'pending'}
            </Badge>
          )}

          {/* Online/Offline status */}
          <Badge
            className={
              isOnline
                ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                : 'bg-red-500/20 text-red-400 border-red-500/30 text-xs'
            }
          >
            <div
              className={`w-2 h-2 rounded-full mr-1.5 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
            />
            {isOnline ? 'Live' : 'Off'}
          </Badge>
        </div>
      </div>

      {/* Tabs - Tactical */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="bg-zinc-900 border-b border-zinc-700/50">
          <TabsList className="h-10 bg-transparent w-full justify-start px-2 gap-1 overflow-x-auto">
            <TabsTrigger
              value="map"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical"
            >
              <Satellite className="w-4 h-4 mr-1" /> Map
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical"
            >
              <Trophy className="w-4 h-4 mr-1" /> Ranks
            </TabsTrigger>
            <TabsTrigger
              value="today"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical"
            >
              <Calendar className="w-4 h-4 mr-1" /> Today
            </TabsTrigger>
            <TabsTrigger
              value="challenges"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical"
            >
              <Target className="w-4 h-4 mr-1" /> Challenges
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical"
            >
              <User className="w-4 h-4 mr-1" /> Profile
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ============================================ */}
        {/* MAP TAB - Enzy-style Interface */}
        {/* ============================================ */}
        <TabsContent value="map" className="flex-1 m-0 relative">
          {/* Layer Switcher - Top Left */}
          <div className="absolute top-3 left-3 z-[1000] flex gap-1 bg-black/70 backdrop-blur rounded-lg p-1">
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button
                key={key}
                onClick={() => setMapLayer(key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                  mapLayer === key ? 'bg-orange-500 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {layer.name}
              </button>
            ))}
          </div>

          {/* Add Pin Mode Indicator */}
          {addPinMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-orange-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Tap to drop pin</span>
              <button
                onClick={() => setAddPinMode(false)}
                className="ml-1 hover:bg-orange-600 rounded-full p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Map Controls - Right Side */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            {!canManageTurf && (
              <div className="max-w-[170px] rounded-lg border border-zinc-700/60 bg-zinc-900/90 px-2 py-1 text-[10px] text-zinc-400">
                Turf Cut/Assign is admin-only.
              </div>
            )}
            {canManageTurf && (
              <button
                onClick={() => setShowTurfOps((prev) => !prev)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                  showTurfOps
                    ? 'bg-cyan-500 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700'
                }`}
                data-testid="turf-ops-btn"
                title="Turf Ops"
              >
                <Target className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => {
                setTurfCutMode(false);
                setAddPinMode(!addPinMode);
              }}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                addPinMode
                  ? 'bg-orange-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700'
              }`}
              data-testid="add-pin-btn"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => userLocation && setFlyToPos([userLocation.lat, userLocation.lng])}
              className="w-10 h-10 sm:w-11 sm:h-11 bg-zinc-800 border border-zinc-700/50 rounded-xl shadow-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
              data-testid="locate-btn"
            >
              <LocateFixed className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowTerritories(!showTerritories)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                showTerritories
                  ? 'bg-orange-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
              }`}
              data-testid="territories-btn"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowParcels(!showParcels)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                showParcels
                  ? 'bg-blue-500 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
              }`}
              data-testid="parcels-btn"
              title="Toggle parcel boundaries"
            >
              <Square className="w-5 h-5" />
            </button>
            <button
              onClick={fetchData}
              className="w-10 h-10 sm:w-11 sm:h-11 bg-zinc-800 border border-zinc-700/50 rounded-xl shadow-lg flex items-center justify-center text-zinc-300 hover:bg-zinc-700"
              data-testid="refresh-btn"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {canManageTurf && showTurfOps && (
            <div className="absolute top-14 right-3 z-[1000] w-72 bg-zinc-900/95 backdrop-blur border border-zinc-700/60 rounded-xl shadow-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono uppercase tracking-wide text-zinc-400">Turf Ops</p>
                <button
                  className="text-zinc-500 hover:text-zinc-200"
                  onClick={() => setShowTurfOps(false)}
                  aria-label="Close turf ops"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-1">
                  Drop Pin Territory Mode
                </label>
                <select
                  value={selectedDropTerritoryId}
                  onChange={(e) => setSelectedDropTerritoryId(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-2 text-sm text-zinc-200"
                >
                  <option value="auto">Auto (from polygon)</option>
                  {territories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territory.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Auto assigns by map point-in-polygon. Override forces all dropped pins into one
                  turf.
                </p>
              </div>

              <div className="pt-2 border-t border-zinc-700/60 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                  Cut Turf
                </p>
                <button
                  onClick={() => {
                    setAddPinMode(false);
                    setTurfCutMode((prev) => !prev);
                    if (turfCutMode) setDraftTurfPoints([]);
                  }}
                  className={`w-full rounded-lg border py-2 text-sm ${
                    turfCutMode
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                  }`}
                >
                  {turfCutMode ? 'Stop Cut Mode' : 'Start Cut Turf'}
                </button>

                <div className="text-[11px] text-zinc-500 font-mono">
                  Points: <span className="text-zinc-300">{draftTurfPoints.length}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDraftTurfPoints((prev) => prev.slice(0, -1))}
                    disabled={draftTurfPoints.length === 0 || savingTurf}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs text-zinc-300 disabled:opacity-40"
                  >
                    Undo Point
                  </button>
                  <button
                    onClick={() => setDraftTurfPoints([])}
                    disabled={draftTurfPoints.length === 0 || savingTurf}
                    className="rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs text-zinc-300 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>

                <button
                  onClick={saveDraftTurf}
                  disabled={draftTurfPoints.length < 3 || savingTurf}
                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2 text-sm text-white disabled:opacity-40"
                >
                  {savingTurf ? 'Saving Turf...' : 'Save Turf Polygon'}
                </button>
              </div>

              <div className="pt-2 border-t border-zinc-700/60 space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                  Assign Reps
                </p>
                <select
                  value={selectedManageTerritoryId}
                  onChange={(e) => setSelectedManageTerritoryId(e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-2 text-sm text-zinc-200"
                >
                  <option value="">Select turf to manage</option>
                  {territories.map((territory) => (
                    <option key={territory.id} value={territory.id}>
                      {territory.name}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={selectedAssignUserId}
                    onChange={(e) => setSelectedAssignUserId(e.target.value)}
                    className="col-span-2 rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-2 text-sm text-zinc-200 disabled:opacity-40"
                    disabled={!selectedManageTerritoryId || loadingTurfUsers || assigningTurfUser}
                  >
                    <option value="">{loadingTurfUsers ? 'Loading reps...' : 'Select rep'}</option>
                    {availableUsersForActiveTurf.map((entry) => (
                      <option key={getUserId(entry)} value={getUserId(entry)}>
                        {entry.full_name || entry.email || getUserId(entry)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assignRepToTerritory}
                    disabled={
                      !selectedManageTerritoryId || !selectedAssignUserId || assigningTurfUser
                    }
                    className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm disabled:opacity-40"
                  >
                    Assign
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-mono uppercase tracking-wide text-zinc-500">
                    Bulk Select Reps
                  </label>
                  <select
                    multiple
                    value={selectedBulkUserIds}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                      setSelectedBulkUserIds(values);
                    }}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-2 text-xs text-zinc-200 min-h-[90px] disabled:opacity-40"
                    disabled={!selectedManageTerritoryId || loadingTurfUsers || assigningTurfUser}
                  >
                    {availableUsersForActiveTurf.map((entry) => (
                      <option key={`bulk-${getUserId(entry)}`} value={getUserId(entry)}>
                        {entry.full_name || entry.email || getUserId(entry)}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => bulkAssignRepsToTerritory(selectedBulkUserIds)}
                      disabled={
                        !selectedManageTerritoryId ||
                        selectedBulkUserIds.length === 0 ||
                        assigningTurfUser
                      }
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 disabled:opacity-40"
                    >
                      Bulk Assign Selected
                    </button>
                    <button
                      onClick={() =>
                        bulkAssignRepsToTerritory(
                          availableUsersForActiveTurf
                            .map((entry) => getUserId(entry))
                            .filter(Boolean)
                        )
                      }
                      disabled={
                        !selectedManageTerritoryId ||
                        availableUsersForActiveTurf.length === 0 ||
                        assigningTurfUser
                      }
                      className="rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-xs py-2 disabled:opacity-40"
                    >
                      Assign All Available
                    </button>
                  </div>
                  <button
                    onClick={autoBalanceSelectedRepsAcrossTurfs}
                    disabled={selectedBulkUserIds.length === 0 || assigningTurfUser}
                    className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 disabled:opacity-40"
                  >
                    Auto-Balance Selected Across Turfs
                  </button>
                  <p className="text-[10px] text-zinc-500">
                    Balancer uses turf load score: total pins / assigned reps.
                  </p>
                </div>

                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                  {activeAssignments.length === 0 ? (
                    <p className="text-[11px] text-zinc-500">No reps assigned to this turf.</p>
                  ) : (
                    activeAssignments.map((assignment) => {
                      const assignmentUserId = getUserId(assignment);
                      const matchedUser = turfUsers.find(
                        (entry) => getUserId(entry) === assignmentUserId
                      );
                      const label =
                        assignment.user_name ||
                        matchedUser?.full_name ||
                        matchedUser?.email ||
                        assignmentUserId;
                      return (
                        <div
                          key={`${selectedManageTerritoryId}-${assignmentUserId}`}
                          className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs"
                        >
                          <span className="text-zinc-300 truncate pr-2">{label}</span>
                          <button
                            onClick={() => unassignRepFromTerritory(assignmentUserId)}
                            disabled={assigningTurfUser}
                            className="text-red-300 hover:text-red-200 disabled:opacity-40"
                            title="Unassign"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={() => {
                  window.location.href = '/harvest-admin';
                }}
                className="w-full rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2 text-sm text-zinc-200"
              >
                Open Full Turf Admin
              </button>
            </div>
          )}

          {/* Map */}
          <MapContainer
            center={safeMapCenter}
            zoom={17}
            className={`h-full w-full ${addPinMode || turfCutMode ? 'cursor-crosshair' : ''}`}
            zoomControl={false}
          >
            <TileLayer
              key={mapLayer}
              url={TILE_LAYERS[mapLayer].url}
              {...(TILE_LAYERS[mapLayer].subdomains && {
                subdomains: TILE_LAYERS[mapLayer].subdomains,
              })}
              maxZoom={21}
            />

            <MapController onLocationFound={setUserLocation} onMapClick={handleMapClick} />
            {safeFlyToPos && <FlyTo position={safeFlyToPos} zoom={19} />}

            {/* Selected Parcel Boundary */}
            {selectedParcelGeometry && selectedParcelGeometry.type && (
              <GeoJSON
                key={selectedPin?.id || 'parcel'}
                data={selectedParcelGeometry}
                style={{
                  color: '#F97316',
                  weight: 3,
                  fillColor: '#F97316',
                  fillOpacity: 0.15,
                }}
              />
            )}

            {/* GPS Trail */}
            {safeGpsTrail.length > 1 && (
              <Polyline
                positions={safeGpsTrail}
                pathOptions={{ color: '#3B82F6', weight: 3, opacity: 0.6 }}
              />
            )}

            {/* Territories */}
            {showTerritories &&
              territories.map((territory) => {
                const polygonPoints = normalizeTerritoryCoordinates(territory);
                if (polygonPoints.length < 3) return null;
                return (
                  <Polygon
                    key={territory.id}
                    positions={polygonPoints.map((point) => [point.lat, point.lng])}
                    pathOptions={{
                      color: territory.color || '#F97316',
                      weight: 2,
                      fillOpacity: 0.1,
                    }}
                  />
                );
              })}

            {/* Draft Turf Cut Geometry */}
            {canManageTurf && safeDraftTurfPoints.length > 1 && (
              <Polyline
                positions={safeDraftTurfPoints.map((point) => [point.lat, point.lng])}
                pathOptions={{ color: '#22D3EE', weight: 3, opacity: 0.9, dashArray: '6 6' }}
              />
            )}
            {canManageTurf && safeDraftTurfPoints.length >= 3 && (
              <Polygon
                positions={safeDraftTurfPoints.map((point) => [point.lat, point.lng])}
                pathOptions={{ color: '#22D3EE', weight: 2, fillOpacity: 0.12 }}
              />
            )}
            {canManageTurf &&
              safeDraftTurfPoints.map((point, idx) => (
                <CircleMarker
                  key={`draft-point-${idx}`}
                  center={[point.lat, point.lng]}
                  radius={5}
                  pathOptions={{ color: '#22D3EE', fillColor: '#22D3EE', fillOpacity: 0.9 }}
                />
              ))}

            {/* Pins */}
            {validPins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.latitude ?? pin.lat, pin.longitude ?? pin.lng]}
                icon={createEnzyPin(pin.disposition, pin.id, selectedPin?.id === pin.id)}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    handlePinClick(pin);
                  },
                }}
              />
            ))}

            {/* User Location */}
            {safeUserLocation && (
              <Marker position={[safeUserLocation.lat, safeUserLocation.lng]} icon={userBeacon} />
            )}
          </MapContainer>

          {/* Bottom Stats Bar - Tactical Theme */}
          {!showPanel && (
            <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-[1000]">
              <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-2xl shadow-xl p-2 sm:p-3 flex items-center justify-around">
                {Object.entries(STATUSES)
                  .filter(([k]) => k !== 'unmarked')
                  .slice(0, 6)
                  .map(([key, s]) => {
                    const IconComponent = s.icon;
                    return (
                      <div key={key} className="text-center">
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 ${s.bgClass} rounded-full flex items-center justify-center mx-auto mb-1`}
                        >
                          <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-900" />
                        </div>
                        <p className="text-white text-xs sm:text-sm font-tactical font-bold">
                          {stats?.by_disposition?.[key] || 0}
                        </p>
                        <p className="text-zinc-500 text-[9px] sm:text-[10px] font-mono">{s.key}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* TACTICAL BOTTOM PANEL */}
          {/* ============================================ */}
          {showPanel && selectedPin && (
            <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-zinc-900 border-t border-zinc-700/50 rounded-t-3xl shadow-2xl animate-slideUp max-h-[70vh] overflow-y-auto">
              {/* Drag Handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 bg-zinc-600 rounded-full" />
              </div>

              {/* Header with Address & Distance */}
              <div className="px-3 sm:px-4 pb-3 border-b border-zinc-700/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-white font-tactical font-bold text-base sm:text-lg truncate">
                      {selectedPin.address || getPinCoordsLabel(selectedPin)}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        className={`${STATUSES[selectedPin.disposition]?.bgClass || 'bg-zinc-500'} text-zinc-900 text-xs`}
                      >
                        {STATUSES[selectedPin.disposition]?.label || 'Unmarked'}
                      </Badge>
                      {userLocation && hasValidCoords(selectedPin) && (
                        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-xs">
                          {getDistance(
                            userLocation.lat,
                            userLocation.lng,
                            selectedPin.latitude ?? selectedPin.lat,
                            selectedPin.longitude ?? selectedPin.lng
                          )}{' '}
                          mi away
                        </Badge>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="p-2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick Status Buttons - Tactical */}
              <div className="px-3 sm:px-4 py-3 border-b border-zinc-700/50">
                <div className="flex justify-between gap-1.5 sm:gap-2">
                  {[
                    { key: 'not_home', label: 'Not Home' },
                    { key: 'not_interested', label: 'Not Int.' },
                    { key: 'callback', label: 'Callback' },
                    { key: 'appointment', label: 'Appt' },
                    { key: 'signed', label: 'Signed' },
                    { key: 'do_not_knock', label: 'DNK' },
                  ].map(({ key, label }) => {
                    const config = STATUSES[key];
                    const IconComponent = config.icon;
                    const isActive = selectedPin.disposition === key;
                    return (
                      <button
                        key={key}
                        onClick={() => updateStatus(key)}
                        className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all active:scale-95 ${
                          isActive
                            ? `${config.bgClass} ring-2 ring-white`
                            : 'bg-zinc-800 hover:bg-zinc-700'
                        }`}
                        data-testid={`status-${key}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                            isActive ? 'bg-white/20' : config.bgClass
                          }`}
                        >
                          <IconComponent className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] text-white font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contact Form */}
              <div className="px-4 py-3 space-y-3 border-b border-zinc-700/50">
                {/* Name */}
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  <Input
                    placeholder="Contact name..."
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                  {contactName && (
                    <button
                      onClick={() => copyToClipboard(contactName)}
                      className="p-2 text-zinc-500 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  <Input
                    placeholder="Phone number..."
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                  {contactPhone && (
                    <button
                      onClick={() => copyToClipboard(contactPhone)}
                      className="p-2 text-zinc-500 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Email */}
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                  <Input
                    placeholder="Email address..."
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="flex-1 bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500"
                  />
                  {contactEmail && (
                    <button
                      onClick={() => copyToClipboard(contactEmail)}
                      className="p-2 text-zinc-500 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Note */}
                <div className="flex items-start gap-3">
                  <MessageSquare className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-2" />
                  <textarea
                    placeholder="Add note..."
                    value={contactNote}
                    onChange={(e) => setContactNote(e.target.value)}
                    rows={2}
                    className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder:text-zinc-500 text-sm resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-4 py-3 grid grid-cols-2 gap-3 border-b border-zinc-700/50">
                <Button
                  onClick={saveContact}
                  className="bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save Contact
                </Button>
                <Button
                  onClick={() => (window.location.href = '/sales')}
                  className="bg-orange-500 hover:bg-orange-600 text-white h-12"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Start Pitch
                </Button>
              </div>

              {/* Property Intelligence (Parcel Data) */}
              {(selectedPin.parcel_owner ||
                selectedPin.parcel_address ||
                selectedPin.parcel_value ||
                parcelLoading) && (
                <div className="px-4 py-3 border-b border-zinc-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-zinc-600 text-xs font-semibold uppercase flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Property Intelligence
                    </h3>
                    {parcelLoading && (
                      <div className="flex items-center gap-1 text-blue-400 text-xs">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Loading...
                      </div>
                    )}
                  </div>

                  <div className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                    {/* Owner */}
                    {selectedPin.parcel_owner && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-orange-400" />
                          <span className="text-white text-sm font-medium">
                            {selectedPin.parcel_owner}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedPin.parcel_owner)}
                          className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-700"
                          title="Copy owner name"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Parcel Address */}
                    {selectedPin.parcel_address && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          <span className="text-zinc-300 text-sm truncate">
                            {selectedPin.parcel_address}
                          </span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedPin.parcel_address)}
                          className="p-1.5 text-zinc-500 hover:text-white rounded hover:bg-zinc-700"
                          title="Copy address"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Property Details Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      {/* Year Built */}
                      {selectedPin.parcel_year_built && (
                        <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                          <p className="text-zinc-500 text-[10px] uppercase">Built</p>
                          <p className="text-white font-bold">{selectedPin.parcel_year_built}</p>
                        </div>
                      )}

                      {/* Property Value */}
                      {formatParcelValueK(selectedPin.parcel_value) && (
                        <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                          <p className="text-zinc-500 text-[10px] uppercase">Value</p>
                          <p className="text-green-400 font-bold text-sm">
                            {formatParcelValueK(selectedPin.parcel_value)}
                          </p>
                        </div>
                      )}

                      {/* Lot Size */}
                      {formatParcelAcres(selectedPin.parcel_sqft) && (
                        <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                          <p className="text-zinc-500 text-[10px] uppercase">Lot</p>
                          <p className="text-white font-bold text-sm">
                            {formatParcelAcres(selectedPin.parcel_sqft)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* City/State/Zip */}
                    {(selectedPin.parcel_city ||
                      selectedPin.parcel_state ||
                      selectedPin.parcel_zip) && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-zinc-500 text-xs">
                          {[
                            selectedPin.parcel_city,
                            selectedPin.parcel_state,
                            selectedPin.parcel_zip,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Parcel Number */}
                    {selectedPin.parcel_number && (
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-600/50">
                        <span className="text-zinc-500 text-xs">
                          Parcel: {selectedPin.parcel_number}
                        </span>
                        <button
                          onClick={() => copyToClipboard(selectedPin.parcel_number)}
                          className="p-1 text-zinc-600 hover:text-white"
                          title="Copy parcel number"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Knock History */}
              <div className="px-4 py-3">
                <h3 className="text-zinc-600 text-xs font-semibold uppercase mb-2">
                  Knock History
                </h3>
                <div className="space-y-2">
                  {selectedPin.history?.length > 0 ? (
                    selectedPin.history.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                        <div
                          className={`w-8 h-8 ${STATUSES[h.disposition]?.bgClass || 'bg-zinc-600'} rounded-full flex items-center justify-center`}
                        >
                          {React.createElement(STATUSES[h.disposition]?.icon || Home, {
                            className: 'w-4 h-4 text-white',
                          })}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">
                            {STATUSES[h.disposition]?.label || 'Unknown'}
                          </p>
                          <p className="text-zinc-500 text-xs">{h.timestamp || 'Recently'}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <Footprints className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                      <p className="text-zinc-500 text-sm">First knock at this address</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* LEADERBOARD TAB */}
        <TabsContent value="leaderboard" className="flex-1 m-0">
          <LeaderboardTab
            leaderboard={leaderboard}
            leaderboardPeriod={leaderboardPeriod}
            setLeaderboardPeriod={setLeaderboardPeriod}
            myStats={myStats}
          />
        </TabsContent>

        {/* TODAY TAB */}
        <TabsContent value="today" className="flex-1 m-0 overflow-auto bg-zinc-900">
          <HarvestTodayTab dailyGoal={75} />
        </TabsContent>

        {/* CHALLENGES TAB */}
        <TabsContent value="challenges" className="flex-1 m-0 overflow-auto bg-zinc-900">
          <HarvestChallengesTab />
        </TabsContent>

        {/* PROFILE TAB */}
        <TabsContent value="profile" className="flex-1 m-0 overflow-auto bg-zinc-900">
          <HarvestProfileTab />
        </TabsContent>
      </Tabs>

      {/* Global Styles */}
      <style>{`
        @keyframes userPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
          50% { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
        }
        @keyframes selectedPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default Harvest;
