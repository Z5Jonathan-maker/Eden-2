import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  Camera, Image as ImageIcon, Upload, MapPin, Clock, 
  FolderOpen, Grid, List, ArrowLeftRight, Pencil, 
  Trash2, X, Check, ChevronLeft, ChevronRight, 
  Download, ZoomIn, Loader2, Plus, Home, Droplet,
  Wind, Zap, Car, Layers, Archive, TreeDeciduous,
  Mic, Wand2, FileText, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import PhotoAnnotator from './PhotoAnnotator';
import RapidCapture from './RapidCapture';
import InspectionReportPanel from './InspectionReportPanel';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function getToken() {
  return localStorage.getItem('eden_token');
}

// Room icon mapping
const ROOM_ICONS = {
  home: Home,
  roof: Home,
  sofa: Home,
  utensils: Home,
  bed: Home,
  bath: Droplet,
  car: Car,
  archive: Archive,
  layers: Layers,
  droplet: Droplet,
  wind: Wind,
  zap: Zap,
  tree: TreeDeciduous,
  grid: Grid,
  folder: FolderOpen
};

const InspectionsEnhanced = () => {
  const [activeView, setActiveView] = useState('capture'); // capture, gallery, timeline, compare
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [claimId, setClaimId] = useState(null);
  const [claims, setClaims] = useState([]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [galleryData, setGalleryData] = useState(null);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [photoAnnotations, setPhotoAnnotations] = useState([]);
  const [showRapidCapture, setShowRapidCapture] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch claims on mount
  useEffect(() => {
    fetchClaims();
    fetchPresets();
  }, []);

  // Fetch sessions when claim changes
  useEffect(() => {
    if (claimId) {
      fetchClaimSessions(claimId);
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [claimId]);

  const fetchClaimSessions = async (cid) => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`${API_URL}/api/inspections/sessions?claim_id=${cid}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        // Auto-select most recent completed session for reports
        const completedSession = (data.sessions || []).find(s => s.status === 'completed');
        if (completedSession) {
          setSelectedSession(completedSession);
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchClaims = async () => {
    try {
      const res = await fetch(`${API_URL}/api/claims/`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClaims(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch claims:', err);
    }
  };

  const handleClaimSelect = (selectedClaimId) => {
    setClaimId(selectedClaimId);
    const claim = claims.find(c => c.id === selectedClaimId);
    setSelectedClaim(claim || null);
    if (selectedClaimId) {
      fetchClaimPhotos(selectedClaimId);
    } else {
      setGalleryData(null);
      setPhotos([]);
    }
  };

  const saveAnnotations = async (annotations) => {
    if (!selectedPhoto) return;
    
    try {
      const res = await fetch(`${API_URL}/api/inspections/photos/${selectedPhoto.id}/annotations`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(annotations)
      });
      
      if (res.ok) {
        setShowAnnotator(false);
        // Refresh to show annotated badge
        if (claimId) fetchClaimPhotos(claimId);
      }
    } catch (err) {
      console.error('Failed to save annotations:', err);
      alert('Failed to save annotations');
    }
  };

  const loadAnnotations = async (photoId) => {
    try {
      const res = await fetch(`${API_URL}/api/inspections/photos/${photoId}/annotations`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPhotoAnnotations(data.annotations || []);
      }
    } catch (err) {
      console.error('Failed to load annotations:', err);
      setPhotoAnnotations([]);
    }
  };

  useEffect(() => {
    fetchPresets();
    // Try to get claim ID from URL or context
    const urlParams = new URLSearchParams(window.location.search);
    const cid = urlParams.get('claim_id');
    if (cid) {
      setClaimId(cid);
      fetchClaimPhotos(cid);
    }
  }, []);

  const fetchPresets = async () => {
    try {
      const [roomsRes, catsRes] = await Promise.all([
        fetch(`${API_URL}/api/inspections/presets/rooms`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/inspections/presets/categories`, {
          headers: { Authorization: `Bearer ${getToken()}` }
        })
      ]);
      
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data.rooms);
      }
      if (catsRes.ok) {
        const data = await catsRes.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };

  const fetchClaimPhotos = async (cid) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/inspections/claim/${cid}/photos`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        const token = getToken();
        const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
        // Ensure photo URLs have the API_URL prefix and token for img tag auth
        const photosWithUrls = (data.photos || []).map(photo => ({
          ...photo,
          url: photo.url?.startsWith('http') ? photo.url : `${API_URL}${photo.url}${tokenParam}`,
          thumbnail_url: photo.thumbnail_url?.startsWith('http') ? photo.thumbnail_url : `${API_URL}${photo.thumbnail_url}${tokenParam}`
        }));
        setGalleryData({ ...data, photos: photosWithUrls });
        setPhotos(photosWithUrls);
      }
    } catch (err) {
      console.error('[InspectionsEnhanced] Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const uploadPhoto = async (file, metadata = {}) => {
    setUploading(true);
    
    try {
      // Get GPS location if available
      let latitude = null;
      let longitude = null;
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoErr) {
          // console.log('GPS not available:', geoErr);
        }
      }
      
      const formData = new FormData();
      formData.append('file', file);
      if (claimId) formData.append('claim_id', claimId);
      if (latitude) formData.append('latitude', latitude.toString());
      if (longitude) formData.append('longitude', longitude.toString());
      if (selectedRoom) formData.append('room', selectedRoom);
      if (selectedCategory) formData.append('category', selectedCategory);
      if (metadata.is_before) formData.append('is_before', 'true');
      if (metadata.is_after) formData.append('is_after', 'true');
      
      const res = await fetch(`${API_URL}/api/inspections/photos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        // Add to local state
        const newPhoto = {
          id: data.id,
          url: `${API_URL}${data.url}`,
          room: selectedRoom,
          category: selectedCategory,
          captured_at: new Date().toISOString(),
          ...data.metadata
        };
        setPhotos(prev => [newPhoto, ...prev]);
        
        // Refresh gallery if we have a claim
        if (claimId) {
          fetchClaimPhotos(claimId);
        }
        
        return data;
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload photo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoCapture = async (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      for (const file of files) {
        await uploadPhoto(file);
      }
    }
    event.target.value = '';
  };

  const deletePhoto = async (photoId) => {
    if (!window.confirm('Delete this photo?')) return;
    
    try {
      const res = await fetch(`${API_URL}/api/inspections/photos/${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
        if (selectedPhoto?.id === photoId) {
          setSelectedPhoto(null);
        }
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const pairBeforeAfter = async () => {
    if (!beforePhoto || !afterPhoto) return;
    
    try {
      const formData = new FormData();
      formData.append('paired_photo_id', afterPhoto.id);
      
      const res = await fetch(`${API_URL}/api/inspections/photos/${beforePhoto.id}/pair`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      
      if (res.ok) {
        alert('Photos paired as before/after!');
        setCompareMode(false);
        setBeforePhoto(null);
        setAfterPhoto(null);
        if (claimId) fetchClaimPhotos(claimId);
      }
    } catch (err) {
      console.error('Pairing failed:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Inspection Photos</h1>
            <p className="text-gray-600 text-sm md:text-base">Capture, organize, and annotate property inspection photos</p>
          </div>
          
          {/* View Toggles */}
          <div className="flex space-x-2">
            <Button
              variant={activeView === 'capture' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('capture')}
              className={activeView === 'capture' ? 'bg-orange-600' : ''}
            >
              <Camera className="w-4 h-4 mr-1" />
              Capture
            </Button>
            <Button
              variant={activeView === 'gallery' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('gallery')}
              className={activeView === 'gallery' ? 'bg-orange-600' : ''}
            >
              <Grid className="w-4 h-4 mr-1" />
              Gallery
            </Button>
            <Button
              variant={activeView === 'compare' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('compare')}
              className={activeView === 'compare' ? 'bg-orange-600' : ''}
            >
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              Compare
            </Button>
          </div>
        </div>
      </div>

      {/* Claim Selector - REQUIRED for all operations */}
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <Label className="text-sm font-semibold text-gray-700 mb-2 block">
              Select Claim <span className="text-red-500">*</span>
            </Label>
            <select
              className="w-full p-3 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={claimId || ''}
              onChange={(e) => handleClaimSelect(e.target.value || null)}
              data-testid="claim-selector"
            >
              <option value="">-- Select a claim to begin --</option>
              {claims.map(claim => (
                <option key={claim.id} value={claim.id}>
                  {claim.claim_number || claim.id.slice(0,8)} - {claim.client_name || claim.insured_name || 'Unknown'} ({claim.property_address || claim.loss_location || 'No address'})
                </option>
              ))}
            </select>
          </div>
          
          {/* Selected Claim Info */}
          {selectedClaim && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {selectedClaim.client_name || selectedClaim.insured_name}
                </p>
                <p className="text-xs text-green-600">
                  {selectedClaim.property_address || selectedClaim.loss_location}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rapid Capture Modal */}
      {showRapidCapture && (
        <RapidCapture
          claimId={claimId}
          claimInfo={selectedClaim || galleryData?.claim || null}
          onClose={() => setShowRapidCapture(false)}
          onComplete={(capturedPhotos) => {
            setShowRapidCapture(false);
            if (claimId) {
              fetchClaimPhotos(claimId);
              fetchClaimSessions(claimId);
            }
            toast.success('Inspection session completed!');
          }}
        />
      )}

      {/* Sessions & Reports Section */}
      {claimId && sessions.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Session Selector */}
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-purple-900 mb-2 block flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Inspection Sessions ({sessions.length})
                  </Label>
                  <select
                    className="w-full p-3 border border-purple-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    value={selectedSession?.id || ''}
                    onChange={(e) => {
                      const session = sessions.find(s => s.id === e.target.value);
                      setSelectedSession(session || null);
                    }}
                    data-testid="session-selector"
                  >
                    <option value="">-- Select a session --</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.name || 'Unnamed Session'} - {session.type || 'initial'} ({session.status}) - {session.photo_count || 0} photos
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Session Status Badge */}
                {selectedSession && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      className={selectedSession.status === 'completed' 
                        ? 'bg-green-500' 
                        : selectedSession.status === 'in_progress'
                        ? 'bg-amber-500'
                        : 'bg-gray-400'
                      }
                    >
                      {selectedSession.status}
                    </Badge>
                    <span className="text-sm text-purple-700">
                      {selectedSession.photo_count || 0} photos
                    </span>
                    {selectedSession.voice_transcript && (
                      <Badge variant="outline" className="text-purple-600 border-purple-300">
                        <Mic className="w-3 h-3 mr-1" />
                        Voice
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Report Panel for selected session */}
          {selectedSession && (
            <InspectionReportPanel
              sessionId={selectedSession.id}
              sessionStatus={selectedSession.status}
            />
          )}
        </div>
      )}

      {/* Capture View */}
      {activeView === 'capture' && (
        <div className="space-y-6">
          {/* RAPID CAPTURE - Voice Annotated Mode */}
          <Card className={`bg-gradient-to-r ${claimId ? 'from-orange-50 to-amber-50 border-orange-200' : 'from-gray-50 to-gray-100 border-gray-300'}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${claimId ? 'bg-orange-500' : 'bg-gray-400'}`}>
                  <Mic className="w-8 h-8 text-gray-900" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-1">Rapid Capture Mode</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Voice-annotated inspection capture. Speak your notes while taking photos - 
                    AI automatically matches your audio to each photo based on timestamps.
                  </p>
                  
                  {/* Claim Selection Warning */}
                  {!claimId && (
                    <div className="bg-amber-100 border border-amber-300 rounded-lg p-3 mb-4 flex items-start gap-2">
                      <Camera className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-amber-800 text-sm font-medium">Claim Required</p>
                        <p className="text-amber-700 text-xs">Select a claim from the dropdown above to enable photo capture. All photos must be associated with a claim.</p>
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    onClick={() => setShowRapidCapture(true)}
                    className={claimId ? "bg-orange-600 hover:bg-orange-700" : "bg-gray-400 cursor-not-allowed"}
                    disabled={!claimId}
                    data-testid="rapid-capture-btn"
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    {claimId ? 'Start Rapid Capture' : 'Select Claim First'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Capture Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Camera className="w-5 h-5 mr-2 text-orange-600" />
                Single Photo Capture
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Room & Category Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Room/Area</Label>
                  <select
                    className="w-full p-2 border rounded-lg"
                    value={selectedRoom}
                    onChange={(e) => setSelectedRoom(e.target.value)}
                  >
                    <option value="">Select room...</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.name}>{room.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <Badge
                        key={cat.id}
                        className={`cursor-pointer ${selectedCategory === cat.id ? 'ring-2 ring-offset-1' : ''}`}
                        style={{ backgroundColor: cat.color }}
                        onClick={() => setSelectedCategory(selectedCategory === cat.id ? '' : cat.id)}
                      >
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Capture Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  className="flex-1 h-20 bg-orange-600 hover:bg-orange-700 text-lg"
                  onClick={handleCameraCapture}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 mr-2" />
                  )}
                  Take Photo
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-20 text-lg"
                  onClick={handleFileUpload}
                  disabled={uploading}
                >
                  <Upload className="w-6 h-6 mr-2" />
                  Upload from Gallery
                </Button>
              </div>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoCapture}
              />
            </CardContent>
          </Card>

          {/* Recent Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <ImageIcon className="w-5 h-5 mr-2 text-orange-600" />
                  Recent Photos
                </span>
                <Badge variant="outline">{photos.length} photos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Camera className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No photos captured yet</p>
                  <p className="text-sm">Use the buttons above to start capturing</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {photos.slice(0, 12).map(photo => (
                    <div
                      key={photo.id}
                      className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-orange-500 transition-all"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={photo.url?.startsWith('http') ? photo.url : `${API_URL}/api/inspections/photos/${photo.id}/image`}
                        alt={photo.room || 'Inspection'}
                        className="w-full h-full object-cover bg-gray-100"
                        onError={(e) => {
                          console.error('Photo load error:', photo.id);
                          e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50" y="50" font-size="12" text-anchor="middle" fill="%239ca3af">No Image</text></svg>';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                      {photo.room && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                          {photo.room}
                        </div>
                      )}
                      {(photo.is_before || photo.is_after) && (
                        <Badge 
                          className={`absolute top-1 left-1 text-xs ${photo.is_before ? 'bg-yellow-500' : 'bg-green-500'}`}
                        >
                          {photo.is_before ? 'Before' : 'After'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gallery View */}
      {activeView === 'gallery' && (
        <div className="space-y-6">
          {/* Room Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={`cursor-pointer ${!selectedRoom ? 'bg-orange-600' : 'bg-gray-200 text-gray-700'}`}
                  onClick={() => setSelectedRoom('')}
                >
                  All Rooms
                </Badge>
                {galleryData?.rooms?.map(room => (
                  <Badge
                    key={room}
                    className={`cursor-pointer ${selectedRoom === room ? 'bg-orange-600' : 'bg-gray-200 text-gray-700'}`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    {room}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Photos Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{selectedRoom || 'All Photos'}</span>
                <Badge variant="outline">{galleryData?.total || 0} photos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {(selectedRoom ? galleryData?.by_room?.[selectedRoom] : photos)?.map(photo => (
                    <div
                      key={photo.id}
                      className="relative group aspect-square rounded-lg overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={`${API_URL}/api/inspections/photos/${photo.id}/image`}
                        alt={photo.room || 'Inspection'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-2 left-2 right-2 text-gray-900">
                          <p className="text-sm font-medium truncate">{photo.room || 'Uncategorized'}</p>
                          <p className="text-xs opacity-80">{formatDate(photo.captured_at)}</p>
                        </div>
                      </div>
                      {photo.latitude && photo.longitude && (
                        <MapPin className="absolute top-2 right-2 w-4 h-4 text-gray-900 drop-shadow" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Compare View (Before/After) */}
      {activeView === 'compare' && (
        <div className="space-y-6">
          {/* Before/After Pairs */}
          {galleryData?.before_after_pairs?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Before & After Comparisons</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {galleryData.before_after_pairs.map((pair, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Badge className="bg-yellow-500">Before</Badge>
                        <img
                          src={`${API_URL}/api/inspections/photos/${pair.before.id}/image`}
                          alt="Before"
                          className="w-full rounded-lg shadow"
                        />
                        <p className="text-sm text-gray-500">{formatDate(pair.before.captured_at)}</p>
                      </div>
                      <div className="space-y-2">
                        <Badge className="bg-green-500">After</Badge>
                        <img
                          src={`${API_URL}/api/inspections/photos/${pair.after.id}/image`}
                          alt="After"
                          className="w-full rounded-lg shadow"
                        />
                        <p className="text-sm text-gray-500">{formatDate(pair.after.captured_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create New Pair */}
          <Card>
            <CardHeader>
              <CardTitle>Create Before/After Pair</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label>Select Before Photo</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-4 min-h-[200px] flex items-center justify-center cursor-pointer ${beforePhoto ? 'border-yellow-500' : 'border-gray-300'}`}
                    onClick={() => {
                      // Open photo selector for before
                    }}
                  >
                    {beforePhoto ? (
                      <img
                        src={`${API_URL}/api/inspections/photos/${beforePhoto.id}/image`}
                        alt="Before"
                        className="max-h-[180px] rounded"
                      />
                    ) : (
                      <div className="text-center text-gray-600">
                        <Plus className="w-8 h-8 mx-auto mb-2" />
                        <p>Select before photo</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Select After Photo</Label>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-4 min-h-[200px] flex items-center justify-center cursor-pointer ${afterPhoto ? 'border-green-500' : 'border-gray-300'}`}
                  >
                    {afterPhoto ? (
                      <img
                        src={`${API_URL}/api/inspections/photos/${afterPhoto.id}/image`}
                        alt="After"
                        className="max-h-[180px] rounded"
                      />
                    ) : (
                      <div className="text-center text-gray-600">
                        <Plus className="w-8 h-8 mx-auto mb-2" />
                        <p>Select after photo</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {beforePhoto && afterPhoto && (
                <Button 
                  className="w-full mt-4 bg-orange-600 hover:bg-orange-700"
                  onClick={pairBeforeAfter}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Create Comparison Pair
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full">
            {/* Close Button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-gray-900 hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Photo */}
            <img
              src={`${API_URL}/api/inspections/photos/${selectedPhoto.id}/image`}
              alt={selectedPhoto.room || 'Inspection'}
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />

            {/* Metadata */}
            <div className="mt-4 bg-white rounded-lg p-4">
              <div className="flex flex-wrap gap-4 text-sm">
                {selectedPhoto.room && (
                  <div className="flex items-center">
                    <Home className="w-4 h-4 mr-1 text-gray-500" />
                    {selectedPhoto.room}
                  </div>
                )}
                {selectedPhoto.captured_at && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-gray-500" />
                    {formatDate(selectedPhoto.captured_at)}
                  </div>
                )}
                {selectedPhoto.latitude && selectedPhoto.longitude && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                    {selectedPhoto.latitude.toFixed(4)}, {selectedPhoto.longitude.toFixed(4)}
                  </div>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => {
                  loadAnnotations(selectedPhoto.id);
                  setShowAnnotator(true);
                }}>
                  <Pencil className="w-4 h-4 mr-1" />
                  Annotate
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setBeforePhoto(selectedPhoto);
                  setSelectedPhoto(null);
                  setActiveView('compare');
                }}>
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  Set as Before
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  setAfterPhoto(selectedPhoto);
                  setSelectedPhoto(null);
                  setActiveView('compare');
                }}>
                  <ArrowLeftRight className="w-4 h-4 mr-1" />
                  Set as After
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    deletePhoto(selectedPhoto.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Annotator */}
      {showAnnotator && selectedPhoto && (
        <PhotoAnnotator
          imageUrl={`${API_URL}/api/inspections/photos/${selectedPhoto.id}/image`}
          photoId={selectedPhoto.id}
          initialAnnotations={photoAnnotations}
          onSave={saveAnnotations}
          onClose={() => setShowAnnotator(false)}
        />
      )}
    </div>
  );
};

export default InspectionsEnhanced;
