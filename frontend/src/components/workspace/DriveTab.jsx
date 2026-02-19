import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Loader2, Upload, Trash2, ExternalLink,
  File, FileText, Image, Film, Music, Archive, Table, Presentation,
  HardDrive, X, Download, LayoutGrid, List, FolderOpen,
  MoreVertical, Eye, Cloud, CloudOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiDelete, apiUpload, API_URL, getAuthToken } from '../../lib/api';

/* ─── File type config with colors (Google-style) ─── */
const FILE_TYPES = {
  'application/pdf':                          { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10', label: 'PDF' },
  'application/vnd.google-apps.document':     { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Doc' },
  'application/vnd.google-apps.spreadsheet':  { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Sheet' },
  'application/vnd.google-apps.presentation': { icon: Presentation, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Slides' },
  'application/vnd.google-apps.folder':       { icon: FolderOpen, color: 'text-zinc-300', bg: 'bg-zinc-500/10', label: 'Folder' },
  'text/plain':                               { icon: FileText, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'Text' },
  'text/csv':                                 { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', label: 'CSV' },
};

const getFileType = (mimeType) => {
  if (!mimeType) return { icon: File, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'File' };
  if (FILE_TYPES[mimeType]) return FILE_TYPES[mimeType];
  if (mimeType.startsWith('image/')) return { icon: Image, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Image' };
  if (mimeType.startsWith('video/')) return { icon: Film, color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Video' };
  if (mimeType.startsWith('audio/')) return { icon: Music, color: 'text-pink-400', bg: 'bg-pink-500/10', label: 'Audio' };
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compress'))
    return { icon: Archive, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Archive' };
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return { icon: Table, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Sheet' };
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return { icon: Presentation, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Slides' };
  if (mimeType.includes('document') || mimeType.includes('word'))
    return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'Doc' };
  return { icon: File, color: 'text-zinc-400', bg: 'bg-zinc-500/10', label: 'File' };
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === '0') return '—';
  const num = parseInt(bytes, 10);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    if (diffMs < 86400000 && d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
};

/* ─── Main DriveTab ─── */
const DriveTab = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('eden-drive-view') || 'list');
  const [dragging, setDragging] = useState(false);
  const [driveError, setDriveError] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // Persist view mode
  const changeView = (mode) => {
    setViewMode(mode);
    localStorage.setItem('eden-drive-view', mode);
  };

  const fetchFiles = useCallback(async (query) => {
    setLoading(true);
    setDriveError(null);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await apiGet(`/api/integrations/google/drive/files${params}`, { cache: false });
      if (res.ok) setFiles(res.data.files || []);
      else { setDriveError(res.error || 'Failed to load files'); toast.error(res.error || 'Failed to load files'); }
    } catch { setDriveError('Failed to connect to Google Drive'); toast.error('Failed to load files'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleSearch = (e) => { e.preventDefault(); fetchFiles(searchQuery); };

  const uploadFile = async (file) => {
    if (file.size > 50 * 1024 * 1024) { toast.error('File too large (max 50MB)'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload('/api/integrations/google/drive/upload', formData);
      if (res.ok) { toast.success(`Uploaded "${file.name}"`); fetchFiles(searchQuery); }
      else toast.error(res.error || 'Upload failed');
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDelete = async (fileId, fileName) => {
    try {
      const res = await apiDelete(`/api/integrations/google/drive/files/${fileId}`);
      if (res.ok) { toast.success(`Deleted "${fileName}"`); setDeleteConfirm(null); fetchFiles(searchQuery); }
      else toast.error(res.error || 'Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const baseUrl = API_URL || '';
      const token = getAuthToken();
      const res = await fetch(`${baseUrl}/api/integrations/google/drive/files/${fileId}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include',
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { toast.error('Failed to download file'); }
  };

  // Drag and drop
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div ref={dropRef} className="h-full flex flex-col bg-zinc-950 relative"
      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 bg-orange-600/10 border-2 border-dashed border-orange-500/50 rounded-xl z-40 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="w-12 h-12 text-orange-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-white">Drop file to upload</p>
            <p className="text-sm text-zinc-400">Max 50MB per file</p>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/70">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in Drive"
              className="w-full pl-11 pr-4 py-2 bg-zinc-900/80 hover:bg-zinc-800/80 focus:bg-zinc-800 border border-zinc-800 focus:border-zinc-600 rounded-full text-sm text-white outline-none transition-all placeholder:text-zinc-500"
            />
          </div>
        </form>

        {/* View toggle */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          <button onClick={() => changeView('list')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => changeView('grid')}
            className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => fetchFiles(searchQuery)} disabled={loading}
          className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-orange-600/20">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Upload
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {/* ── File content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : files.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 px-6">
            {driveError ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <CloudOff className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-sm font-medium text-red-400 mb-1">Google Drive Error</p>
                <p className="text-xs text-zinc-500 max-w-md text-center">{driveError}</p>
                {driveError.toLowerCase().includes('permission') && (
                  <p className="text-xs text-orange-400 mt-2">Try reconnecting Google in Settings to grant Drive access.</p>
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                  <Cloud className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-sm font-medium text-zinc-400 mb-1">No files yet</p>
                <p className="text-xs text-zinc-600 mb-4">Drag and drop files here or click Upload</p>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                  <Upload className="w-4 h-4" /> Upload your first file
                </button>
              </>
            )}
          </div>
        ) : viewMode === 'list' ? (
          /* ── List View ── */
          <div>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-5 py-2.5 text-[11px] text-zinc-500 font-medium uppercase tracking-wider border-b border-zinc-800/50 sticky top-0 bg-zinc-950 z-10">
              <div>Name</div>
              <div>Modified</div>
              <div>Size</div>
              <div className="text-right">Actions</div>
            </div>

            {/* File rows */}
            {files.map(file => {
              const ft = getFileType(file.mimeType);
              const Icon = ft.icon;
              return (
                <div key={file.id}
                  className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-5 py-2.5 items-center hover:bg-zinc-900/50 transition-colors group border-b border-zinc-800/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg ${ft.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-4.5 h-4.5 ${ft.color}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-zinc-200 truncate block">{file.name}</span>
                      <span className="text-[10px] text-zinc-600">{ft.label}</span>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{formatDate(file.modifiedTime)}</div>
                  <div className="text-xs text-zinc-500">{formatFileSize(file.size)}</div>
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!file.mimeType?.startsWith('application/vnd.google-apps.') && (
                      <button onClick={() => handleDownload(file.id, file.name)}
                        className="p-1.5 text-zinc-500 hover:text-orange-400 rounded-md hover:bg-zinc-800 transition-colors" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {file.webViewLink && (
                      <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors" title="Open in Google">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button onClick={() => setDeleteConfirm(file)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-zinc-800 transition-colors" title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Grid View ── */
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {files.map(file => {
              const ft = getFileType(file.mimeType);
              const Icon = ft.icon;
              return (
                <div key={file.id}
                  className="group relative bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800/50 hover:border-zinc-700/50 rounded-xl transition-all duration-150 overflow-hidden">
                  {/* Preview area */}
                  <div className={`h-28 ${ft.bg} flex items-center justify-center relative`}>
                    <Icon className={`w-10 h-10 ${ft.color} opacity-60`} />
                    {/* Hover actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!file.mimeType?.startsWith('application/vnd.google-apps.') && (
                        <button onClick={() => handleDownload(file.id, file.name)}
                          className="p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-orange-400 transition-colors backdrop-blur-sm">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {file.webViewLink && (
                        <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors backdrop-blur-sm">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => setDeleteConfirm(file)}
                        className="p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 transition-colors backdrop-blur-sm">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2.5">
                    <p className="text-xs text-zinc-200 font-medium truncate mb-0.5">{file.name}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-600">{ft.label}</span>
                      <span className="text-[10px] text-zinc-600">{formatDate(file.modifiedTime)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* File count footer */}
      {!loading && files.length > 0 && (
        <div className="px-5 py-2 border-t border-zinc-800/50 text-[11px] text-zinc-600 font-medium">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Delete file?</h3>
                <p className="text-xs text-zinc-500">This will also remove it from Google Drive</p>
              </div>
            </div>
            <p className="text-sm text-zinc-300 mb-5 px-1 truncate">
              "{deleteConfirm.name}"
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name)}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriveTab;
