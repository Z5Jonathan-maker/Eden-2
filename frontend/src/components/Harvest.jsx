import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { 
  Map, Trophy, Flame, Award, Plus, Target,
  Home, Phone, Mail, X, Check, RefreshCw,
  MapPin, Presentation, Layers, Copy,
  LocateFixed, User, Calendar, Satellite,
  Square, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NAV_ICONS } from '../assets/badges';

// Import from harvest submodules directly
import { STATUSES, TILE_LAYERS, DEFAULT_CENTER } from './harvest/constants';
import { createEnzyPin, userBeacon, getDistance } from './harvest/utils';
import { MapController, FlyTo } from './harvest/MapComponents';
import LeaderboardTab from './harvest/LeaderboardTab';
import BadgesTab from './harvest/BadgesTab';
import CompetitionsTab from './harvest/CompetitionsTab';
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

const API = process.env.REACT_APP_BACKEND_URL;

// ============================================
// MAIN COMPONENT
// ============================================
const Harvest = () => {
  // Auth context
  const { user } = useAuth();
  
  // Offline sync hook
  const { isOnline, isSyncing, unsyncedCount, offlineReady, fetchPins: fetchPinsOffline, createPin: createPinOffline, updatePin: updatePinOffline, syncToServer } = useOfflineSync();

  // Core state
  const [pins, setPins] = useState([]);
  const pinsRef = React.useRef([]);  // Ref for DOM click handler
  const [leaderboard, setLeaderboard] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [badges, setBadges] = useState({ badges: [], earned_count: 0, total_count: 0 });
  const [territories, setTerritories] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Map state
  const [mapLayer, setMapLayer] = useState('satellite');
  const [showTerritories, setShowTerritories] = useState(true);
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
  
  const token = localStorage.getItem('eden_token');

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
      const res = await fetch(
        `${API}/api/regrid/parcel/point?lat=${pin.latitude}&lon=${pin.longitude}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.parcel?.geometry) {
          setSelectedParcelGeometry(data.parcel.geometry);
        }
      }
    } catch (err) {
      console.error('Error fetching parcel:', err);
    } finally {
      setParcelLoading(false);
    }
  }, [token]);

  // Fetch all data (with offline support for pins)
  const fetchData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      // Fetch pins with offline support
      const { pins: fetchedPins, source } = await fetchPinsOffline();
      setPins(fetchedPins);
      if (source === 'cache') {
        toast.info('Showing cached pins (offline)', { duration: 2000 });
      }
      
      // Fetch other data (online only)
      if (isOnline) {
        const [statsRes, terrRes, lbRes, compRes, badgesRes, myStatsRes] = await Promise.all([
          fetch(`${API}/api/canvassing-map/stats/overview`, { headers }),
          fetch(`${API}/api/canvassing-map/territories`, { headers }),
          fetch(`${API}/api/harvest/scoring/leaderboard?period=${leaderboardPeriod}&limit=20`, { headers }),
          fetch(`${API}/api/harvest/competitions`, { headers }),
          fetch(`${API}/api/harvest/scoring/badges`, { headers }),
          fetch(`${API}/api/harvest/scoring/stats/me`, { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (terrRes.ok) setTerritories(await terrRes.json());
        if (lbRes.ok) {
          const data = await lbRes.json();
          setLeaderboard(data.entries || []);
        }
        if (compRes.ok) {
          const data = await compRes.json();
          setCompetitions(data.competitions || []);
        }
        if (badgesRes.ok) setBadges(await badgesRes.json());
        if (myStatsRes.ok) setMyStats(await myStatsRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, leaderboardPeriod, isOnline, fetchPinsOffline]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep ref in sync with pins state
  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

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
            const pin = pinsRef.current.find(p => p.id === pinId);
            if (pin) {
              // console.log('Pin clicked via DOM:', pin.id);
              setSelectedPin(pin);
              setShowPanel(true);
              setFlyToPos([pin.latitude, pin.longitude]);
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
          setGpsTrail(prev => [...prev.slice(-50), [loc.lat, loc.lng]]);
          
          fetch(`${API}/api/canvassing-map/location`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: loc.lat, longitude: loc.lng })
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [token]);

  // Quick status update - Enzy style (one-tap, auto-dismiss, points toast)
  const updateStatus = async (status) => {
    if (!selectedPin) return;
    
    // Optimistic UI update - instant color change
    setPins(prev => prev.map(p => 
      p.id === selectedPin.id ? { ...p, disposition: status } : p
    ));
    
    // Haptic feedback immediately
    if (navigator.vibrate) navigator.vibrate(15);
    
    // Auto-dismiss panel after status change (Enzy behavior)
    setShowPanel(false);
    setSelectedPin(null);
    
    try {
      const res = await fetch(`${API}/api/canvassing-map/pins/${selectedPin.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          disposition: status,
          homeowner_name: contactName || selectedPin.homeowner_name,
          phone: contactPhone || selectedPin.phone,
          email: contactEmail || selectedPin.email,
          notes: contactNote || selectedPin.notes
        })
      });
      
      const data = await res.json();
      
      // Show points earned if any
      if (data.points_earned > 0) {
        toast.success(`${STATUSES[status]?.label} +${data.points_earned} pts`, { 
          duration: 1200,
          icon: '🎯'
        });
      } else {
        toast.success(`${STATUSES[status]?.label}`, { duration: 800 });
      }
      
      // Update stats
      setStats(prev => ({
        ...prev,
        by_disposition: {
          ...prev?.by_disposition,
          [status]: (prev?.by_disposition?.[status] || 0) + 1,
          [selectedPin.disposition]: Math.max(0, (prev?.by_disposition?.[selectedPin.disposition] || 1) - 1)
        }
      }));
      
    } catch (err) {
      // Revert optimistic update on error
      setPins(prev => prev.map(p => 
        p.id === selectedPin.id ? { ...p, disposition: selectedPin.disposition } : p
      ));
      toast.error('Update failed');
    }
  };

  // Add new pin - One-tap instant (Enzy style) with offline support
  const addPin = async (latlng) => {
    const pinData = {
      latitude: latlng.lat,
      longitude: latlng.lng,
      disposition: 'unmarked',
      address: 'Loading...'
    };
    
    // Haptic feedback immediately
    if (navigator.vibrate) navigator.vibrate(10);
    
    // Use offline sync hook
    const { success, pin, synced } = await createPinOffline(pinData);
    
    if (success) {
      setPins(prev => [...prev, pin]);
      toast.success(synced ? 'Pin added' : 'Pin saved offline', { duration: 600, icon: '📍' });
      
      // Select the new pin and open panel
      setSelectedPin(pin);
      setShowPanel(true);
      setFlyToPos([latlng.lat, latlng.lng]);
    } else {
      toast.error('Failed to add pin');
    }
  };

  // Handle map click
  const handleMapClick = (latlng) => {
    if (addPinMode) {
      addPin(latlng);
      setAddPinMode(false);
    }
  };

  // Handle pin click
  const handlePinClick = (pin) => {
    // console.log('Pin clicked:', pin.id, pin.address);
    setSelectedPin(pin);
    setShowPanel(true);
    setFlyToPos([pin.latitude, pin.longitude]);
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
      await fetch(`${API}/api/canvassing-map/pins/${selectedPin.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          homeowner_name: contactName,
          phone: contactPhone,
          email: contactEmail,
          notes: contactNote
        })
      });
      toast.success('Saved', { duration: 800 });
      setPins(prev => prev.map(p => 
        p.id === selectedPin.id ? { ...p, homeowner_name: contactName, phone: contactPhone, email: contactEmail, notes: contactNote } : p
      ));
    } catch (err) {
      toast.error('Save failed');
    }
  };

  // Competition functions
  const createCompetition = async (compData) => {
    try {
      const res = await fetch(`${API}/api/harvest/competitions`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(compData)
      });
      
      if (!res.ok) throw new Error('Failed to create competition');
      
      toast.success('Competition created!');
      fetchData(); // Refresh competitions
    } catch (err) {
      toast.error('Failed to create competition');
      console.error(err);
    }
  };

  const joinCompetition = async (competitionId) => {
    try {
      const res = await fetch(`${API}/api/harvest/competitions/${competitionId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to join competition');
      
      toast.success('Joined competition!');
      fetchData(); // Refresh competitions
    } catch (err) {
      toast.error('Failed to join competition');
      console.error(err);
    }
  };

  const canCreateCompetition = user?.role === 'admin' || user?.role === 'manager';

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
    <div className="h-screen flex flex-col bg-zinc-950" data-testid="harvest">
      {/* Compact Header - Tactical */}
      <div className="bg-zinc-900 border-b border-zinc-700/50 px-3 sm:px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src={NAV_ICONS.harvest} alt="Harvest" className="w-8 h-8 object-contain icon-3d-shadow" />
          <div>
            <h1 className="text-white font-tactical font-bold text-base sm:text-lg">HARVEST</h1>
            <p className="text-zinc-500 font-mono text-[10px] sm:text-xs">
              {pins.length} doors • {stats?.by_disposition?.signed || 0} signed
            </p>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-2">
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
          <Badge className={isOnline 
            ? "bg-green-500/20 text-green-400 border-green-500/30 text-xs" 
            : "bg-red-500/20 text-red-400 border-red-500/30 text-xs"
          }>
            <div className={`w-2 h-2 rounded-full mr-1.5 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            {isOnline ? 'Live' : 'Off'}
          </Badge>
        </div>
      </div>

      {/* Tabs - Tactical */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="bg-zinc-900 border-b border-zinc-700/50">
          <TabsList className="h-10 bg-transparent w-full justify-start px-2 gap-1 overflow-x-auto">
            <TabsTrigger value="map" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical">
              <Satellite className="w-4 h-4 mr-1" /> Map
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical">
              <Trophy className="w-4 h-4 mr-1" /> Ranks
            </TabsTrigger>
            <TabsTrigger value="competitions" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical">
              <Flame className="w-4 h-4 mr-1" /> Compete
            </TabsTrigger>
            <TabsTrigger value="badges" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-zinc-500 text-xs sm:text-sm font-tactical">
              <Award className="w-4 h-4 mr-1" /> Badges
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
                  mapLayer === key 
                    ? 'bg-orange-500 text-white' 
                    : 'text-zinc-300 hover:bg-zinc-700'
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
              <button onClick={() => setAddPinMode(false)} className="ml-1 hover:bg-orange-600 rounded-full p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Map Controls - Right Side */}
          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setAddPinMode(!addPinMode)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                addPinMode ? 'bg-orange-500 text-zinc-900' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50 hover:bg-zinc-700'
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
                showTerritories ? 'bg-orange-500 text-zinc-900' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
              }`}
              data-testid="territories-btn"
            >
              <Layers className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowParcels(!showParcels)}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-lg flex items-center justify-center transition-all ${
                showParcels ? 'bg-blue-500 text-zinc-900' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'
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

          {/* Map */}
          <MapContainer
            center={userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER}
            zoom={17}
            className={`h-full w-full ${addPinMode ? 'cursor-crosshair' : ''}`}
            zoomControl={false}
          >
            <TileLayer
              key={mapLayer}
              url={TILE_LAYERS[mapLayer].url}
              {...(TILE_LAYERS[mapLayer].subdomains && { subdomains: TILE_LAYERS[mapLayer].subdomains })}
              maxZoom={21}
            />
            
            <MapController onLocationFound={setUserLocation} onMapClick={handleMapClick} />
            {flyToPos && <FlyTo position={flyToPos} zoom={19} />}

            {/* Selected Parcel Boundary */}
            {selectedParcelGeometry && selectedParcelGeometry.type && (
              <GeoJSON
                key={selectedPin?.id || 'parcel'}
                data={selectedParcelGeometry}
                style={{
                  color: '#F97316',
                  weight: 3,
                  fillColor: '#F97316',
                  fillOpacity: 0.15
                }}
              />
            )}

            {/* GPS Trail */}
            {gpsTrail.length > 1 && (
              <Polyline 
                positions={gpsTrail} 
                pathOptions={{ color: '#3B82F6', weight: 3, opacity: 0.6 }} 
              />
            )}

            {/* Territories */}
            {showTerritories && territories.map(t => (
              <Polygon
                key={t.id}
                positions={t.coordinates}
                pathOptions={{ color: t.color || '#F97316', weight: 2, fillOpacity: 0.1 }}
              />
            ))}

            {/* Pins */}
            {pins.map(pin => (
              <Marker
                key={pin.id}
                position={[pin.latitude, pin.longitude]}
                icon={createEnzyPin(pin.disposition, pin.id, selectedPin?.id === pin.id)}
                eventHandlers={{ 
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    handlePinClick(pin);
                  }
                }}
              />
            ))}

            {/* User Location */}
            {userLocation && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userBeacon} />
            )}
          </MapContainer>

          {/* Bottom Stats Bar - Tactical Theme */}
          {!showPanel && (
            <div className="absolute bottom-4 left-3 right-3 sm:left-4 sm:right-4 z-[1000]">
              <div className="bg-zinc-900/95 backdrop-blur border border-zinc-700/50 rounded-2xl shadow-xl p-2 sm:p-3 flex items-center justify-around">
                {Object.entries(STATUSES).filter(([k]) => k !== 'unmarked').slice(0, 6).map(([key, s]) => {
                  const IconComponent = s.icon;
                  return (
                    <div key={key} className="text-center">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${s.bgClass} rounded-full flex items-center justify-center mx-auto mb-1`}>
                        <IconComponent className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-900" />
                      </div>
                      <p className="text-white text-xs sm:text-sm font-tactical font-bold">{stats?.by_disposition?.[key] || 0}</p>
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
                      {selectedPin.address || `${selectedPin.latitude.toFixed(5)}, ${selectedPin.longitude.toFixed(5)}`}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`${STATUSES[selectedPin.disposition]?.bgClass || 'bg-zinc-500'} text-zinc-900 text-xs`}>
                        {STATUSES[selectedPin.disposition]?.label || 'Unmarked'}
                      </Badge>
                      {userLocation && (
                        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 text-xs">
                          {getDistance(userLocation.lat, userLocation.lng, selectedPin.latitude, selectedPin.longitude)} mi away
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                          isActive ? 'bg-white/20' : config.bgClass
                        }`}>
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
                    <button onClick={() => copyToClipboard(contactName)} className="p-2 text-zinc-500 hover:text-white">
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
                    <button onClick={() => copyToClipboard(contactPhone)} className="p-2 text-zinc-500 hover:text-white">
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
                    <button onClick={() => copyToClipboard(contactEmail)} className="p-2 text-zinc-500 hover:text-white">
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
                  onClick={() => window.location.href = '/sales'}
                  className="bg-orange-500 hover:bg-orange-600 text-white h-12"
                >
                  <Presentation className="w-4 h-4 mr-2" />
                  Start Pitch
                </Button>
              </div>

              {/* Property Intelligence (Parcel Data) */}
              {(selectedPin.parcel_owner || selectedPin.parcel_address || selectedPin.parcel_value || parcelLoading) && (
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
                          <span className="text-white text-sm font-medium">{selectedPin.parcel_owner}</span>
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
                          <span className="text-zinc-300 text-sm truncate">{selectedPin.parcel_address}</span>
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
                      {selectedPin.parcel_value && (
                        <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                          <p className="text-zinc-500 text-[10px] uppercase">Value</p>
                          <p className="text-green-400 font-bold text-sm">
                            ${(selectedPin.parcel_value / 1000).toFixed(0)}K
                          </p>
                        </div>
                      )}

                      {/* Lot Size */}
                      {selectedPin.parcel_sqft && (
                        <div className="bg-zinc-900/50 rounded-lg p-2 text-center">
                          <p className="text-zinc-500 text-[10px] uppercase">Lot</p>
                          <p className="text-white font-bold text-sm">
                            {(selectedPin.parcel_sqft / 43560).toFixed(2)} ac
                          </p>
                        </div>
                      )}
                    </div>

                    {/* City/State/Zip */}
                    {(selectedPin.parcel_city || selectedPin.parcel_state || selectedPin.parcel_zip) && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-zinc-500 text-xs">
                          {[selectedPin.parcel_city, selectedPin.parcel_state, selectedPin.parcel_zip]
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
                <h3 className="text-zinc-600 text-xs font-semibold uppercase mb-2">Knock History</h3>
                <div className="space-y-2">
                  {selectedPin.history?.length > 0 ? (
                    selectedPin.history.slice(0, 3).map((h, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                        <div className={`w-8 h-8 ${STATUSES[h.disposition]?.bgClass || 'bg-zinc-600'} rounded-full flex items-center justify-center`}>
                          {React.createElement(STATUSES[h.disposition]?.icon || Home, { className: 'w-4 h-4 text-white' })}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{STATUSES[h.disposition]?.label || 'Unknown'}</p>
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

        {/* ============================================ */}
        {/* COMPETITIONS TAB */}
        {/* ============================================ */}
        <TabsContent value="competitions" className="flex-1 m-0 overflow-auto bg-zinc-900">
          <CompetitionsTab 
            competitions={competitions}
            canCreate={canCreateCompetition}
            onCreateCompetition={createCompetition}
            onJoinCompetition={joinCompetition}
            currentUserId={user?.id}
          />
        </TabsContent>

        {/* BADGES TAB */}
        <TabsContent value="badges" className="flex-1 m-0">
          <BadgesTab badges={badges} />
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
