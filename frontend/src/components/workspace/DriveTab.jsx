import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Loader2, Upload, Trash2, ExternalLink,
  File, FileText, Image, Film, Music, Archive, Table, Presentation,
  HardDrive, X, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { apiGet, apiDelete, getAuthToken } from '../../lib/api';

const MIME_ICONS = {
  'application/pdf': FileText,
  'application/vnd.google-apps.document': FileText,
  'application/vnd.google-apps.spreadsheet': Table,
  'application/vnd.google-apps.presentation': Presentation,
  'application/vnd.google-apps.folder': HardDrive,
  'text/plain': FileText,
  'text/csv': Table,
};

const getMimeIcon = (mimeType) => {
  if (!mimeType) return File;
  if (MIME_ICONS[mimeType]) return MIME_ICONS[mimeType];
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compress')) return Archive;
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return Table;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return Presentation;
  if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return FileText;
  return File;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === '0') return '-';
  const num = parseInt(bytes, 10);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
};

const DriveTab = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const fetchFiles = useCallback(async (query) => {
    setLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await apiGet(`/api/integrations/google/drive/files${params}`);
      if (res.ok) {
        setFiles(res.data.files || []);
      } else {
        toast.error('Failed to load files');
      }
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchFiles(searchQuery);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large (max 50MB)');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const resp = await fetch('/api/integrations/google/drive/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (resp.ok) {
        toast.success(`Uploaded "${file.name}"`);
        fetchFiles(searchQuery);
      } else {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.detail || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId, fileName) => {
    try {
      const res = await apiDelete(`/api/integrations/google/drive/files/${fileId}`);
      if (res.ok) {
        toast.success(`Deleted "${fileName}"`);
        setDeleteConfirm(null);
        fetchFiles(searchQuery);
      }
    } catch {
      toast.error('Failed to delete file');
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="border-b border-zinc-800 px-4 py-2 flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="pl-9 bg-zinc-900 border-zinc-700 text-white text-sm"
            />
          </div>
        </form>
        <Button
          variant="ghost" size="sm"
          onClick={() => fetchFiles(searchQuery)}
          disabled={loading}
          className="text-zinc-400"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <HardDrive className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="text-sm mb-1">No files found</p>
            <p className="text-xs text-zinc-600">Upload files to your Eden Documents folder in Google Drive</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/50">
              <div>Name</div>
              <div>Modified</div>
              <div>Size</div>
              <div className="text-right">Actions</div>
            </div>

            {/* File rows */}
            <div className="divide-y divide-zinc-800/30">
              {files.map(file => {
                const Icon = getMimeIcon(file.mimeType);
                return (
                  <div
                    key={file.id}
                    className="grid grid-cols-[1fr_120px_120px_80px] gap-4 px-4 py-2.5 items-center hover:bg-zinc-900/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                      <span className="text-sm text-zinc-200 truncate">{file.name}</span>
                    </div>
                    <div className="text-xs text-zinc-500">{formatDate(file.modifiedTime)}</div>
                    <div className="text-xs text-zinc-500">{formatFileSize(file.size)}</div>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                          title="Open in Google"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(file)}
                        className="p-1 text-zinc-500 hover:text-red-400 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-white font-semibold mb-2">Delete File</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Are you sure you want to delete "{deleteConfirm.name}"? This will also remove it from Google Drive.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-zinc-700 text-zinc-300">
                Cancel
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriveTab;
