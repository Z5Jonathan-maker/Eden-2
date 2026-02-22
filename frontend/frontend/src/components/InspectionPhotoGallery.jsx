/**
 * InspectionPhotoGallery — Photo gallery with bulk actions + PDF export
 *
 * Shows photos grouped by room with multi-select, AI captions,
 * bulk re-categorize / move / delete, and PDF export button.
 *
 * Features:
 *  1. Lightbox prev/next navigation with keyboard support + counter
 *  2. Before/After comparison panel (uses galleryData.before_after_pairs)
 *  3. PhotoAnnotator connected to lightbox via "Annotate" button
 *  4. Search/filter bar (caption, room, category)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Image as ImageIcon, CheckSquare, Square, Trash2,
  FolderOpen, Tag, Download, X, Loader2, Sparkles,
  Mic, MapPin, ChevronDown, Grid, List,
  ChevronLeft, ChevronRight, Pencil, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useInspectionPhotos } from '../features/inspections/hooks';
import PhotoAnnotator from './PhotoAnnotator';

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
  const [bulkMenuOpen, setBulkMenuOpen] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Search / filter state
  const [searchText, setSearchText] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Lightbox driven by index for prev/next support
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  const openLightbox = useCallback((photo) => {
    const idx = photos.findIndex((p) => p.id === photo.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setShowAnnotator(false);
  }, [photos]);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
    setShowAnnotator(false);
  }, []);

  const goToPrev = useCallback(() => {
    setLightboxIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setLightboxIndex((i) => (i < photos.length - 1 ? i + 1 : 0));
  }, [photos.length]);

  // Annotator toggle
  const [showAnnotator, setShowAnnotator] = useState(false);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goToPrev();
      else if (e.key === 'ArrowRight') goToNext();
      else if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, goToPrev, goToNext, closeLightbox]);

  const [viewMode, setViewMode] = useState('grid');

  const byRoom = useMemo(() => getPhotosByRoom(), [getPhotosByRoom]);
  const rooms = useMemo(() => getRooms(), [getRooms]);

  // FIX: reset selection only when the CLAIM changes, not every photo refetch
  useEffect(() => {
    setSelectedIds(new Set());
  }, [claimId]);

  // Filtered photo list
  const filteredPhotos = useMemo(() => {
    let result = photos;
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (p) =>
          (p.ai_caption || '').toLowerCase().includes(q) ||
          (p.room || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q)
      );
    }
    if (filterRoom) result = result.filter((p) => (p.room || 'Uncategorized') === filterRoom);
    if (filterCategory) result = result.filter((p) => p.category === filterCategory);
    return result;
  }, [photos, searchText, filterRoom, filterCategory]);

  const uniqueRooms = useMemo(
    () => Array.from(new Set(photos.map((p) => p.room || 'Uncategorized'))),
    [photos]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(photos.map((p) => p.category).filter(Boolean))),
    [photos]
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredPhotos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredPhotos.map((p) => p.id)));
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`Delete ${selectedIds.size} photo(s)? This cannot be undone.`)) return;
    setProcessing(true);
    const res = await bulkAction('delete', [...selectedIds]);
    setProcessing(false);
    if (res) { toast.success(`${res.affected} photo(s) deleted`); setSelectedIds(new Set()); setSelectMode(false); }
    else toast.error('Bulk delete failed');
  };

  const handleBulkMove = async (room) => {
    if (!selectedIds.size) return;
    setProcessing(true);
    const res = await bulkAction('move_room', [...selectedIds], { room });
    setProcessing(false); setBulkMenuOpen(null);
    if (res) { toast.success(`${res.affected} photo(s) moved to ${room}`); setSelectedIds(new Set()); }
    else toast.error('Move failed');
  };

  const handleBulkRecategorize = async (category) => {
    if (!selectedIds.size) return;
    setProcessing(true);
    const res = await bulkAction('recategorize', [...selectedIds], { category });
    setProcessing(false); setBulkMenuOpen(null);
    if (res) { toast.success(`${res.affected} photo(s) re-categorized`); setSelectedIds(new Set()); }
    else toast.error('Re-categorize failed');
  };

  const handleExportPdf = () => {
    const url = getExportPdfUrl();
    if (url) { window.open(url, '_blank'); toast.success('PDF export started'); }
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
            Photos ({filteredPhotos.length}{filteredPhotos.length !== photos.length ? ` of ${photos.length}` : ''})
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'room' : 'grid')}
            className="p-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
            title={viewMode === 'grid' ? 'Group by room' : 'Flat grid'}
          >
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid className="w-4 h-4" />}
          </button>
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
          <button
            onClick={handleExportPdf}
            className="px-3 py-1.5 rounded text-xs font-mono uppercase border border-zinc-700/50 text-zinc-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-colors flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="flex flex-wrap gap-2 items-center p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
        <div className="flex items-center gap-1.5 flex-1 min-w-[160px] bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 focus-within:border-orange-500/50">
          <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search captions, rooms, notes..."
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 font-mono focus:outline-none"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="text-zinc-600 hover:text-zinc-400">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <select
          value={filterRoom}
          onChange={(e) => setFilterRoom(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
        >
          <option value="">All Rooms</option>
          {uniqueRooms.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-orange-500/50"
        >
          <option value="">All Types</option>
          {uniqueCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex-wrap">
          <button onClick={selectAll} className="text-xs text-orange-400 font-mono underline">
            {selectedIds.size === filteredPhotos.length ? 'Deselect all' : 'Select all'}
          </button>
          <span className="text-xs text-zinc-400 font-mono">{selectedIds.size} selected</span>
          <div className="flex-1" />
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
      {filteredPhotos.length === 0 ? (
        <div className="py-8 text-center">
          <Search className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
          <p className="text-xs font-mono text-zinc-500">No photos match your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredPhotos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              selectMode={selectMode}
              selected={selectedIds.has(photo.id)}
              onToggleSelect={() => toggleSelect(photo.id)}
              onOpen={() => openLightbox(photo)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {rooms.map((room) => {
            const roomPhotos = (byRoom[room] || []).filter((p) => filteredPhotos.includes(p));
            if (!roomPhotos.length) return null;
            return (
              <div key={room}>
                <h4 className="text-xs font-mono text-orange-400 uppercase tracking-wider mb-2 border-b border-zinc-800/50 pb-1">
                  {room} ({roomPhotos.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {roomPhotos.map((photo) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      selectMode={selectMode}
                      selected={selectedIds.has(photo.id)}
                      onToggleSelect={() => toggleSelect(photo.id)}
                      onOpen={() => openLightbox(photo)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Before / After comparison panel */}
      {galleryData?.before_after_pairs?.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-1">
            <span className="text-xs font-mono font-bold text-orange-400 uppercase tracking-widest">
              Before / After
            </span>
            <span className="text-xs font-mono text-zinc-500">
              ({galleryData.before_after_pairs.length} pair{galleryData.before_after_pairs.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="space-y-4">
            {galleryData.before_after_pairs.map((pair, idx) => (
              <div key={pair.id || idx} className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg overflow-hidden bg-zinc-900 border border-orange-500/30 cursor-pointer group"
                  onClick={() => pair.before && openLightbox(pair.before)}
                >
                  <div className="relative aspect-video bg-zinc-800">
                    {pair.before ? (
                      <img
                        src={pair.before.thumbnail_url || pair.before.url}
                        alt={pair.before.ai_caption || 'Before'}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/20 border border-amber-500/40 text-amber-400 tracking-wider">
                      Before
                    </span>
                  </div>
                  <div className="px-2 py-1.5">
                    {pair.before?.captured_at && (
                      <p className="text-[10px] font-mono text-zinc-500">
                        {new Date(pair.before.captured_at).toLocaleDateString()}
                      </p>
                    )}
                    {pair.before?.ai_caption && (
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.before.ai_caption}</p>
                    )}
                  </div>
                </div>

                <div
                  className="rounded-lg overflow-hidden bg-zinc-900 border border-orange-500/30 cursor-pointer group"
                  onClick={() => pair.after && openLightbox(pair.after)}
                >
                  <div className="relative aspect-video bg-zinc-800">
                    {pair.after ? (
                      <img
                        src={pair.after.thumbnail_url || pair.after.url}
                        alt={pair.after.ai_caption || 'After'}
                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-zinc-600" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 tracking-wider">
                      After
                    </span>
                  </div>
                  <div className="px-2 py-1.5">
                    {pair.after?.captured_at && (
                      <p className="text-[10px] font-mono text-zinc-500">
                        {new Date(pair.after.captured_at).toLocaleDateString()}
                      </p>
                    )}
                    {pair.after?.ai_caption && (
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">{pair.after.ai_caption}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox with prev/next + annotate */}
      {lightboxPhoto && !showAnnotator && (
        <PhotoLightbox
          photo={lightboxPhoto}
          currentIndex={lightboxIndex}
          totalCount={photos.length}
          onClose={closeLightbox}
          onPrev={goToPrev}
          onNext={goToNext}
          onAnnotate={() => setShowAnnotator(true)}
        />
      )}

      {/* PhotoAnnotator overlay */}
      {lightboxPhoto && showAnnotator && (
        <PhotoAnnotator
          imageUrl={lightboxPhoto.url}
          photoId={lightboxPhoto.id}
          initialAnnotations={lightboxPhoto.annotations || []}
          onSave={() => {
            toast.success('Annotations saved');
            setShowAnnotator(false);
          }}
          onClose={() => setShowAnnotator(false)}
        />
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
      {selectMode && (
        <div className="absolute top-2 left-2">
          {selected ? (
            <CheckSquare className="w-5 h-5 text-orange-400 drop-shadow" />
          ) : (
            <Square className="w-5 h-5 text-white/70 drop-shadow" />
          )}
        </div>
      )}
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


const PhotoLightbox = ({ photo, currentIndex, totalCount, onClose, onPrev, onNext, onAnnotate }) => (
  <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col" onClick={onClose}>
    {/* Header */}
    <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
      <span className="text-sm font-mono text-zinc-400 tabular-nums">
        {currentIndex + 1} / {totalCount}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onAnnotate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors text-xs font-mono uppercase"
        >
          <Pencil className="w-3.5 h-3.5" />
          Annotate
        </button>
        <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-zinc-800 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>

    {/* Image with flanking nav buttons */}
    <div className="flex-1 flex items-center justify-center p-4 relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onPrev}
        className="absolute left-4 z-10 p-2 rounded-full bg-zinc-900/80 border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 hover:bg-zinc-800/90 transition-all"
        title="Previous (←)"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <img
        src={photo.url}
        alt={photo.ai_caption || ''}
        className="max-w-full max-h-[70vh] object-contain rounded-lg"
      />

      <button
        onClick={onNext}
        className="absolute right-4 z-10 p-2 rounded-full bg-zinc-900/80 border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/40 hover:bg-zinc-800/90 transition-all"
        title="Next (→)"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>

    {/* Metadata footer */}
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
