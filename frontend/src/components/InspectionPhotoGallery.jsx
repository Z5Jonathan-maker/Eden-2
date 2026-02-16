/**
 * InspectionPhotoGallery — Photo gallery with bulk actions + PDF export
 *
 * Shows photos grouped by room with multi-select, AI captions,
 * bulk re-categorize / move / delete, and PDF export button.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon, CheckSquare, Square, Trash2,
  FolderOpen, Tag, Download, X, Loader2, Sparkles,
  Mic, MapPin, ChevronDown, Grid, List,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInspectionPhotos } from '../features/inspections/hooks';

const ROOM_OPTIONS = [
  'Exterior - Front', 'Exterior - Back', 'Exterior - Left Side', 'Exterior - Right Side',
  'Roof', 'Living Room', 'Kitchen', 'Master Bedroom', 'Bedroom 2', 'Bedroom 3',
  'Master Bathroom', 'Bathroom 2', 'Garage', 'Attic', 'Basement',
  'Laundry Room', 'HVAC System', 'Electrical Panel', 'Plumbing', 'Pool/Spa',
  'Fence', 'Landscaping', 'Other',
];

const CATEGORY_OPTIONS = [
  { id: 'overview', name: 'Overview', color: '#3B82F6' },
  { id: 'damage', name: 'Damage', color: '#EF4444' },
  { id: 'before', name: 'Before', color: '#F59E0B' },
  { id: 'after', name: 'After', color: '#10B981' },
  { id: 'measurement', name: 'Measurement', color: '#8B5CF6' },
  { id: 'detail', name: 'Detail/Close-up', color: '#EC4899' },
  { id: 'documentation', name: 'Documentation', color: '#6B7280' },
];

const InspectionPhotoGallery = ({ claimId, sessionId }) => {
  const {
    photos, isLoading, galleryData, fetchPhotos,
    getPhotosByRoom, getRooms, bulkAction, getExportPdfUrl,
  } = useInspectionPhotos({ claimId, sessionId, autoFetch: true });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(null); // 'room' | 'category' | null
  const [processing, setProcessing] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'room'

  const byRoom = useMemo(() => getPhotosByRoom(), [getPhotosByRoom]);
  const rooms = useMemo(() => getRooms(), [getRooms]);

  // Reset selection when photos change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [photos.length]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(photos.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} photo(s)? This cannot be undone.`)) return;
    setProcessing(true);
    const res = await bulkAction('delete', [...selectedIds]);
    setProcessing(false);
    if (res) {
      toast.success(`${res.affected} photo(s) deleted`);
      setSelectedIds(new Set());
      setSelectMode(false);
    } else {
      toast.error('Bulk delete failed');
    }
  };

  const handleBulkMove = async (room) => {
    if (!selectedIds.size) return;
    setProcessing(true);
    const res = await bulkAction('move_room', [...selectedIds], { room });
    setProcessing(false);
    setBulkMenuOpen(null);
    if (res) {
      toast.success(`${res.affected} photo(s) moved to ${room}`);
      setSelectedIds(new Set());
    } else {
      toast.error('Move failed');
    }
  };

  const handleBulkRecategorize = async (category) => {
    if (!selectedIds.size) return;
    setProcessing(true);
    const res = await bulkAction('recategorize', [...selectedIds], { category });
    setProcessing(false);
    setBulkMenuOpen(null);
    if (res) {
      toast.success(`${res.affected} photo(s) re-categorized`);
      setSelectedIds(new Set());
    } else {
      toast.error('Re-categorize failed');
    }
  };

  const handleExportPdf = () => {
    const url = getExportPdfUrl();
    if (url) {
      window.open(url, '_blank');
      toast.success('PDF export started');
    }
  };

  if (isLoading) {
    return (
      <div className="card-tactical p-6 flex items-center justify-center">
        <div className="spinner-tactical w-6 h-6" />
        <span className="ml-3 text-sm text-zinc-500 font-mono">Loading photos...</span>
      </div>
    );
  }

  if (!photos.length) {
    return (
      <div className="card-tactical p-8 text-center">
        <ImageIcon className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
        <p className="text-sm text-zinc-500 font-mono">No photos captured yet</p>
      </div>
    );
  }

  return (
    <div className="card-tactical p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Photos ({photos.length})
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'room' : 'grid')}
            className="p-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            title={viewMode === 'grid' ? 'Group by room' : 'Flat grid'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>

          {/* Select mode */}
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); setBulkMenuOpen(null); }}
            className={`px-3 py-1.5 rounded text-xs font-mono uppercase border transition-colors ${
              selectMode
                ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                : 'border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30'
            }`}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded text-xs font-mono uppercase border border-zinc-700/50 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex-wrap">
          <button onClick={selectAll} className="text-xs text-orange-400 font-mono underline">
            {selectedIds.size === photos.length ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs text-zinc-400 font-mono">{selectedIds.size} selected</span>
          <div className="flex-1" />

          {/* Move to room */}
          <div className="relative">
            <button
              onClick={() => setBulkMenuOpen(bulkMenuOpen === 'room' ? null : 'room')}
              className="px-2 py-1 rounded text-xs font-mono uppercase border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 flex items-center gap-1"
              disabled={processing}
            >
              <FolderOpen className="w-3.5 h-3.5" /> Room <ChevronDown className="w-3 h-3" />
            </button>
            {bulkMenuOpen === 'room' && (
              <div className="absolute right-0 top-full mt-1 w-48 max-h-60 overflow-y-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl z-20">
                {ROOM_OPTIONS.map((r) => (
                  <button key={r} onClick={() => handleBulkMove(r)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-orange-500/10 hover:text-orange-400 font-mono">
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Re-categorize */}
          <div className="relative">
            <button
              onClick={() => setBulkMenuOpen(bulkMenuOpen === 'category' ? null : 'category')}
              className="px-2 py-1 rounded text-xs font-mono uppercase border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 flex items-center gap-1"
              disabled={processing}
            >
              <Tag className="w-3.5 h-3.5" /> Tag <ChevronDown className="w-3 h-3" />
            </button>
            {bulkMenuOpen === 'category' && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-zinc-800 border border-zinc-700 shadow-xl z-20">
                {CATEGORY_OPTIONS.map((c) => (
                  <button key={c.id} onClick={() => handleBulkRecategorize(c.id)} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-purple-500/10 hover:text-purple-400 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            disabled={processing}
            className="px-2 py-1 rounded text-xs font-mono uppercase border border-red-700/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
          >
            {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      )}

      {/* Photo grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              selectMode={selectMode}
              selected={selectedIds.has(photo.id)}
              onToggleSelect={() => toggleSelect(photo.id)}
              onOpen={() => setLightboxPhoto(photo)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {rooms.map((room) => (
            <div key={room}>
              <h4 className="text-xs font-mono text-orange-400 uppercase tracking-wider mb-2 border-b border-zinc-800/50 pb-1">
                {room} ({byRoom[room]?.length || 0})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(byRoom[room] || []).map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    selectMode={selectMode}
                    selected={selectedIds.has(photo.id)}
                    onToggleSelect={() => toggleSelect(photo.id)}
                    onOpen={() => setLightboxPhoto(photo)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
};


const PhotoCard = ({ photo, selectMode, selected, onToggleSelect, onOpen }) => {
  const handleClick = () => {
    if (selectMode) onToggleSelect();
    else onOpen();
  };

  return (
    <div
      onClick={handleClick}
      className={`relative aspect-square rounded-lg overflow-hidden bg-zinc-800 cursor-pointer group transition-all ${
        selected ? 'ring-2 ring-orange-500 ring-offset-1 ring-offset-zinc-900' : 'hover:ring-1 hover:ring-zinc-600'
      }`}
    >
      <img
        src={photo.thumbnail_url || photo.url}
        alt={photo.ai_caption || ''}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Select checkbox */}
      {selectMode && (
        <div className="absolute top-2 left-2">
          {selected ? (
            <CheckSquare className="w-5 h-5 text-orange-400 drop-shadow" />
          ) : (
            <Square className="w-5 h-5 text-white/70 drop-shadow" />
          )}
        </div>
      )}

      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {photo.room && (
              <span className="text-[9px] font-mono text-zinc-300 bg-zinc-900/60 px-1 rounded truncate max-w-[80px]">
                {photo.room}
              </span>
            )}
            {photo.category && (
              <span className="text-[9px] font-mono text-purple-300 bg-purple-900/40 px-1 rounded">
                {photo.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {photo.ai_caption && <Sparkles className="w-3 h-3 text-amber-400" />}
            {photo.voice_snippet && <Mic className="w-3 h-3 text-purple-400" />}
            {photo.latitude && <MapPin className="w-3 h-3 text-green-400" />}
          </div>
        </div>
      </div>
    </div>
  );
};


const PhotoLightbox = ({ photo, onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col" onClick={onClose}>
    <div className="flex items-center justify-between p-4">
      <div />
      <button className="p-2 rounded-full text-white hover:bg-zinc-800 transition-colors">
        <X className="w-6 h-6" />
      </button>
    </div>

    <div className="flex-1 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <img
        src={photo.url}
        alt={photo.ai_caption || ''}
        className="max-w-full max-h-[70vh] object-contain rounded-lg"
      />
    </div>

    <div className="p-4 max-w-2xl mx-auto w-full space-y-2" onClick={(e) => e.stopPropagation()}>
      {photo.ai_caption && (
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-zinc-300">{photo.ai_caption}</p>
        </div>
      )}
      {photo.voice_snippet && (
        <div className="flex items-start gap-2">
          <Mic className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-zinc-400 italic">"{photo.voice_snippet}"</p>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
        {photo.room && <span>{photo.room}</span>}
        {photo.category && <span className="text-purple-400">{photo.category}</span>}
        {photo.latitude && <span className="text-green-400">GPS</span>}
        {photo.original_name && <span>{photo.original_name}</span>}
      </div>
    </div>
  </div>
);


export default InspectionPhotoGallery;
