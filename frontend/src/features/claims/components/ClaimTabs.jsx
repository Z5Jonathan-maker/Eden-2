import React, { useRef, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import {
  Camera,
  Phone,
  FileText,
  Loader2,
  Download,
  Upload,
  History,
  ShieldCheck,
  Presentation,
  Edit2,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { apiUpload, apiPut, apiDelete } from '@/lib/api';
import { toast } from 'sonner';
import ClaimCommsPanel from './ClaimCommsPanel';
import ClaimTimelineTab from './ClaimTimelineTab';
import ClaimEvidenceReviewTab from './ClaimEvidenceReviewTab';
import ClaimReportsTab from './ClaimReportsTab';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL ?? '';

const ClaimTabs = ({
  activeTab,
  setActiveTab,
  notes,
  photos,
  documents,
  loadingPhotos,
  newNote,
  setNewNote,
  handleAddNote,
  addingNote,
  getInitials,
  formatDate,
  setSelectedPhoto,
  claimId,
  claim,
  floridaReadiness,
  commsDraftPrefill,
  handleCommsDraftConsumed,
  navigate,
  onDocumentsChange,
  onNotesChange,
}) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const handleDocUpload = async (e) => {
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
      formData.append('doc_type', 'General');
      const res = await apiUpload(`/api/claims/${claimId}/documents`, formData);
      if (res.ok) {
        toast.success(`"${file.name}" uploaded`);
        if (onDocumentsChange) onDocumentsChange(res.data);
      } else {
        toast.error(res.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDocDownload = (doc) => {
    const url = `${API_URL}/api/claims/${claimId}/documents/${doc.id}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name || 'download';
    // Attach auth token for download
    const token = localStorage.getItem('eden_token');
    if (token) {
      // Use fetch + blob for authenticated downloads
      fetch(url, { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then(r => {
          if (!r.ok) throw new Error('Download failed');
          return r.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = doc.name || 'download';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => toast.error('Download failed'));
    } else {
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditNoteContent(note.content);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteContent('');
  };

  const handleSaveNote = async (noteId) => {
    if (!editNoteContent.trim()) return;
    setSavingNote(true);
    try {
      const res = await apiPut(`/api/claims/${claimId}/notes/${noteId}`, { content: editNoteContent.trim() });
      if (res.ok) {
        toast.success('Note updated');
        if (onNotesChange) onNotesChange(notes.map(n => n.id === noteId ? { ...n, content: editNoteContent.trim(), edited_at: new Date().toISOString() } : n));
        setEditingNoteId(null);
        setEditNoteContent('');
      } else {
        toast.error(res.error || 'Failed to update note');
      }
    } catch {
      toast.error('Failed to update note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const res = await apiDelete(`/api/claims/${claimId}/notes/${noteId}`);
      if (res.ok) {
        toast.success('Note deleted');
        if (onNotesChange) onNotesChange(notes.filter(n => n.id !== noteId));
      } else {
        toast.error(res.error || 'Failed to delete note');
      }
    } catch {
      toast.error('Failed to delete note');
    }
  };

  return (
    <div className="card-tactical p-5">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1">
          <TabsTrigger
            value="notes"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="notes-tab"
          >
            Notes ({notes.length})
          </TabsTrigger>
          <TabsTrigger
            value="photos"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="photos-tab"
          >
            <Camera className="w-4 h-4 mr-1" />({photos.length})
          </TabsTrigger>
          <TabsTrigger
            value="messages"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="messages-tab"
          >
            <Phone className="w-4 h-4 mr-1" />
            Comms
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="documents-tab"
          >
            Docs ({documents.length})
          </TabsTrigger>
          <TabsTrigger
            value="timeline"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="timeline-tab"
          >
            <History className="w-4 h-4 mr-1" />
            Timeline
          </TabsTrigger>
          <TabsTrigger
            value="review"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="review-tab"
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            Review
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
            data-testid="reports-tab"
          >
            <Presentation className="w-4 h-4 mr-1" />
            Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-4 md:mt-6">
          <div className="mb-4 md:mb-6">
            <textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="input-tactical w-full px-3 py-3 text-sm min-h-[80px] mb-3"
              rows={3}
              data-testid="new-note-input"
            />
            <button
              onClick={handleAddNote}
              className="btn-tactical px-5 py-2.5 text-sm w-full sm:w-auto flex items-center justify-center gap-2"
              disabled={addingNote || !newNote.trim()}
              data-testid="add-note-btn"
            >
              {addingNote ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Note'
              )}
            </button>
          </div>

          <div className="space-y-4">
            {notes.length > 0 ? (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30 group"
                  data-testid={`note-${note.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-400 text-xs font-tactical font-medium">
                          {getInitials(note.author_name)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-200 text-sm truncate">
                          {note.author_name}
                        </p>
                        <p className="text-[10px] text-zinc-600 font-mono">
                          {formatDate(note.created_at)}
                          {note.edited_at && <span className="ml-1 text-zinc-500">(edited)</span>}
                        </p>
                      </div>
                    </div>
                    {/* Edit/Delete buttons - visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditNote(note)}
                        className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-blue-400 transition-colors"
                        title="Edit note"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editNoteContent}
                        onChange={(e) => setEditNoteContent(e.target.value)}
                        className="input-tactical w-full px-3 py-2 text-sm min-h-[60px]"
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSaveNote(note.id)}
                          disabled={savingNote || !editNoteContent.trim()}
                          className="px-3 py-1.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/50 text-xs font-mono uppercase flex items-center gap-1.5 hover:bg-orange-500/30 transition-colors disabled:opacity-50"
                        >
                          {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditNote}
                          className="px-3 py-1.5 rounded text-zinc-400 border border-zinc-700/50 text-xs font-mono uppercase flex items-center gap-1.5 hover:text-zinc-200 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-300 break-words text-sm">{note.content}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-center py-4 font-mono text-sm">
                No notes yet. Add the first note above.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-4 md:mt-6">
          <ClaimCommsPanel
            claimId={claimId}
            clientPhone={claim.client_phone}
            clientName={claim.client_name}
            claimReadiness={floridaReadiness}
            prefillDraft={commsDraftPrefill}
            onPrefillConsumed={handleCommsDraftConsumed}
          />
        </TabsContent>

        <TabsContent value="photos" className="mt-4 md:mt-6">
          {loadingPhotos ? (
            <div className="flex items-center justify-center py-8">
              <div className="spinner-tactical w-6 h-6" />
            </div>
          ) : photos.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700/50 cursor-pointer hover:border-orange-500/50 transition-all group"
                    onClick={() => setSelectedPhoto(photo)}
                    data-testid={`photo-${photo.id}`}
                  >
                    <img
                      src={`${API_URL}/api/inspections/photos/${photo.id}/image`}
                      alt={photo.room || 'Inspection photo'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-xs font-medium truncate">
                          {photo.room || 'No room'}
                        </p>
                        {photo.category && (
                          <p className="text-white/70 text-[10px] truncate">{photo.category}</p>
                        )}
                      </div>
                    </div>
                    {photo.voice_transcript && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3 h-3 text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="text-xs text-zinc-500 text-center font-mono">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} from inspections
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                <Camera className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 mb-2 font-tactical">No Photos Captured</p>
              <p className="text-xs text-zinc-600 mb-4 font-mono">
                Start an inspection to capture photos
              </p>
              <button
                onClick={() => navigate(`/inspections`)}
                className="btn-tactical px-5 py-2.5 text-sm"
                data-testid="start-inspection-from-photos-btn"
              >
                <Camera className="w-4 h-4 mr-2 inline" />
                Deploy Recon
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4 md:mt-6">
          <div className="space-y-3">
            {documents.length > 0 ? (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-500/30 transition-colors"
                  data-testid={`doc-${doc.id}`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                      <FileText className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-200 truncate">{doc.name}</p>
                      <p className="text-xs text-zinc-500 font-mono">
                        {doc.type} • {doc.size}
                      </p>
                      <p className="text-[10px] text-zinc-600 font-mono">
                        Uploaded by {doc.uploaded_by} on {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDocDownload(doc)}
                    className="px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all w-full sm:w-auto justify-center"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 text-center py-4 font-mono text-sm">
                No documents uploaded yet.
              </p>
            )}
          </div>
          <button
            className="w-full mt-4 px-4 py-3 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all"
            data-testid="upload-document-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleDocUpload}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 md:mt-6">
          <ClaimTimelineTab claimId={claimId} />
        </TabsContent>

        <TabsContent value="review" className="mt-4 md:mt-6">
          <ClaimEvidenceReviewTab claimId={claimId} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 md:mt-6">
          <ClaimReportsTab claimId={claimId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClaimTabs;
