/**
 * AddBookModal — Upload an EPUB/PDF to the shared library
 *
 * Two-step flow:
 *  1. Pick & upload the book file (via /api/uploads/file)
 *  2. Fill in metadata (title, author, category, description)
 */

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  X, Upload, Loader2, BookOpen, FileText,
} from 'lucide-react';
import { apiPost, apiGet } from '@/lib/api';

const CATEGORIES = [
  { id: 'insurance', label: 'Insurance' },
  { id: 'sales', label: 'Sales' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'legal', label: 'Legal' },
  { id: 'industry', label: 'Industry' },
  { id: 'other', label: 'Other' },
];

const AddBookModal = ({ show, onClose, onBookAdded }) => {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null); // { id, original_name, size, file_type }

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');

  const reset = () => {
    setUploadedFile(null);
    setTitle('');
    setAuthor('');
    setDescription('');
    setCategory('other');
    setUploading(false);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Step 1: Upload the file
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['epub', 'pdf'].includes(ext)) {
      toast.error('Only EPUB and PDF files are supported');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large (max 50 MB)');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiPost('/api/uploads/file', formData);
      if (!res.ok) throw new Error(res.error || 'Upload failed');

      setUploadedFile({
        id: res.data.id,
        original_name: res.data.original_name,
        size: res.data.size,
        file_type: ext,
      });

      // Pre-fill title from filename (strip extension)
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
      if (!title) setTitle(baseName);

      toast.success('File uploaded');
    } catch (err) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Step 2: Save book metadata
  const handleSave = async () => {
    if (!uploadedFile) { toast.error('Upload a file first'); return; }
    if (!title.trim()) { toast.error('Enter a title'); return; }

    setSaving(true);
    try {
      const res = await apiPost('/api/university/library/books', {
        title: title.trim(),
        author: author.trim() || 'Unknown',
        description: description.trim(),
        category,
        file_id: uploadedFile.id,
        file_type: uploadedFile.file_type,
        tags: [],
      });

      if (!res.ok) throw new Error(res.error || 'Failed to save');

      toast.success(`"${title}" added to library`);
      handleClose();
      onBookAdded?.();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-base font-mono uppercase text-zinc-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-400" /> Add Book to Library
          </h3>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* File upload */}
          {!uploadedFile ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500/40 transition-colors"
            >
              <input
                ref={fileRef}
                type="file"
                accept=".epub,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {uploading ? (
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-2" />
              ) : (
                <Upload className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
              )}
              <p className="text-sm text-zinc-400 font-mono">
                {uploading ? 'Uploading...' : 'Click to upload EPUB or PDF'}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1">Max 50 MB · Kindle books → export as EPUB</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-zinc-950/40 border border-zinc-800/60 rounded-lg px-4 py-3">
              <FileText className="w-5 h-5 text-orange-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-mono truncate">{uploadedFile.original_name}</p>
                <p className="text-[10px] text-zinc-500">
                  {uploadedFile.file_type?.toUpperCase()} · {formatSize(uploadedFile.size)}
                </p>
              </div>
              <button
                onClick={() => setUploadedFile(null)}
                className="text-zinc-600 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Metadata */}
          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Art of the Supplement"
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Author</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="e.g., John Smith"
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Category</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase border transition-all ${
                    category === c.id
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                      : 'text-zinc-500 border-zinc-800/40 hover:text-zinc-300'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-mono text-zinc-500 uppercase">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description or notes for the team..."
              className="mt-1 w-full bg-zinc-950/40 border border-zinc-800/70 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 border border-zinc-700 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !uploadedFile || !title.trim()}
            className="px-5 py-2 rounded-lg text-sm font-mono uppercase bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
            Add to Library
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddBookModal;
