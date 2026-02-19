import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, RefreshCw, Loader2, Mail, Send, Reply, X, Forward,
  Paperclip, Plus, FileText, Download, Minus, Inbox,
  AlertCircle, ChevronUp, Star, Archive, Trash2, MailOpen,
  CheckSquare, Square, Eye, EyeOff, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiDelete, apiUpload, API_URL, getAuthToken } from '../../lib/api';
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES, SIGNATURE_BLOCK } from '../../config/emailTemplates';

/* ─── Constants ─── */
const FOLDERS = [
  { id: 'INBOX', label: 'Inbox', icon: Inbox },
  { id: 'STARRED', label: 'Starred', icon: Star },
  { id: 'SENT', label: 'Sent', icon: Send },
  { id: 'DRAFT', label: 'Drafts', icon: FileText },
  { id: 'SPAM', label: 'Spam', icon: AlertCircle },
  { id: 'TRASH', label: 'Trash', icon: Trash2 },
];

const SIG_DIVIDER = `\n\n--\n${SIGNATURE_BLOCK}`;

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-pink-600',
  'bg-teal-600', 'bg-orange-600', 'bg-violet-600', 'bg-lime-600',
];

/* ─── Helpers ─── */
const hashColor = (str) => {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const extractName = (fromStr) => {
  if (!fromStr) return '';
  const match = fromStr.match(/^([^<]+)/);
  return match ? match[1].trim().replace(/"/g, '') : fromStr;
};

const extractEmail = (fromStr) => {
  if (!fromStr) return '';
  const match = fromStr.match(/<([^>]+)>/);
  return match ? match[1] : fromStr;
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24 && d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
  } catch { return dateStr; }
};

const formatFullDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch { return dateStr; }
};

/* ─── Skeleton Loader ─── */
const SkeletonRow = () => (
  <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
    <div className="w-9 h-9 rounded-full bg-zinc-800" />
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-3 w-24 bg-zinc-800 rounded" />
        <div className="h-3 w-48 bg-zinc-800/60 rounded" />
      </div>
      <div className="h-2.5 w-64 bg-zinc-800/40 rounded" />
    </div>
    <div className="h-3 w-10 bg-zinc-800/50 rounded" />
  </div>
);

/* ─── Avatar ─── */
const SenderAvatar = ({ name }) => {
  const color = useMemo(() => hashColor(name), [name]);
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center flex-shrink-0 text-white text-xs font-bold select-none`}>
      {getInitials(name)}
    </div>
  );
};

/* ─── Compose Window (Gmail-style floating) ─── */
const ComposeWindow = ({
  composeData, setComposeData, attachments, setAttachments,
  onSend, sending, onClose, onMinimize, minimized,
  showTemplates, setShowTemplates, templateFilter, setTemplateFilter,
}) => {
  const fileInputRef = useRef(null);

  const handleAttachFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 25 * 1024 * 1024;
    const valid = files.filter(f => {
      if (f.size > maxSize) { toast.error(`"${f.name}" exceeds 25MB limit`); return false; }
      return true;
    });
    setAttachments(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredTemplates = templateFilter === 'all'
    ? EMAIL_TEMPLATES
    : EMAIL_TEMPLATES.filter(t => t.category === templateFilter);

  if (minimized) {
    return (
      <button
        onClick={onMinimize}
        className="fixed bottom-0 right-6 w-72 bg-zinc-800 border border-zinc-700 border-b-0 rounded-t-xl px-4 py-2.5 flex items-center justify-between shadow-2xl z-50 hover:bg-zinc-750 transition-colors"
      >
        <span className="text-sm font-medium text-white truncate">
          {composeData.subject || 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <ChevronUp className="w-4 h-4 text-zinc-400" />
          <X className="w-4 h-4 text-zinc-400 hover:text-red-400" onClick={(e) => { e.stopPropagation(); onClose(); }} />
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-6 w-[560px] max-h-[80vh] bg-zinc-900 border border-zinc-700 border-b-0 rounded-t-xl shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-800 rounded-t-xl border-b border-zinc-700 cursor-move">
        <span className="text-sm font-medium text-white">
          {composeData.reply_to_message_id ? 'Reply' : 'New Message'}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} className="p-1 hover:bg-zinc-700 rounded transition-colors">
            <Minus className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-zinc-700 rounded transition-colors">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Template sidebar */}
      {showTemplates && (
        <div className="border-b border-zinc-700 max-h-48 overflow-y-auto bg-zinc-850">
          <div className="px-3 py-2 flex gap-1 flex-wrap sticky top-0 bg-zinc-900 border-b border-zinc-800/50">
            <button onClick={() => setTemplateFilter('all')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${templateFilter === 'all' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>All</button>
            {TEMPLATE_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setTemplateFilter(cat.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${templateFilter === cat.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>{cat.label}</button>
            ))}
          </div>
          {filteredTemplates.map(tpl => (
            <button key={tpl.id} onClick={() => { setComposeData(p => ({ ...p, subject: tpl.subject, body: tpl.body })); setShowTemplates(false); }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30 flex items-center gap-2">
              <FileText className="w-3 h-3 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-zinc-300 truncate">{tpl.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase ml-auto">{tpl.category}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="px-4 py-1.5 space-y-0">
        <div className="flex items-center border-b border-zinc-800/50 py-1.5">
          <span className="text-xs text-zinc-500 w-10">To</span>
          <input value={composeData.to} onChange={e => setComposeData(p => ({ ...p, to: e.target.value }))}
            className="flex-1 bg-transparent text-sm text-white outline-none" placeholder="Recipients" />
        </div>
        <div className="flex items-center border-b border-zinc-800/50 py-1.5">
          <span className="text-xs text-zinc-500 w-10">Cc</span>
          <input value={composeData.cc} onChange={e => setComposeData(p => ({ ...p, cc: e.target.value }))}
            className="flex-1 bg-transparent text-sm text-white outline-none" placeholder="" />
        </div>
        <div className="flex items-center border-b border-zinc-800/50 py-1.5">
          <span className="text-xs text-zinc-500 w-10">Sub</span>
          <input value={composeData.subject} onChange={e => setComposeData(p => ({ ...p, subject: e.target.value }))}
            className="flex-1 bg-transparent text-sm text-white outline-none" placeholder="Subject" />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 px-4 py-2">
        <textarea
          value={composeData.body}
          onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
          placeholder="Write your message..."
          className="w-full h-48 bg-transparent text-sm text-zinc-200 resize-none outline-none leading-relaxed"
        />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1 text-[11px] text-zinc-300">
              <Paperclip className="w-3 h-3 text-zinc-500" />
              <span className="truncate max-w-[120px]">{file.name}</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800">
        <div className="flex items-center gap-1">
          <button onClick={onSend} disabled={sending}
            className="flex items-center gap-2 px-4 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-medium rounded-full transition-colors">
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowTemplates(!showTemplates)}
            className={`p-2 rounded-full hover:bg-zinc-800 transition-colors ${showTemplates ? 'text-orange-400 bg-zinc-800' : 'text-zinc-500'}`}
            title="Templates">
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2 text-zinc-500 rounded-full hover:bg-zinc-800 transition-colors" title="Attach files">
            <Paperclip className="w-4 h-4" />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachFiles} />
          <button onClick={onClose}
            className="p-2 text-zinc-500 rounded-full hover:bg-zinc-800 hover:text-red-400 transition-colors ml-2" title="Discard">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main GmailTab ─── */
const GmailTab = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [messageDetail, setMessageDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Folder & labels
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const [labelCounts, setLabelCounts] = useState({});

  // Batch selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '', cc: '', bcc: '' });
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('all');

  // Keyboard nav
  const [focusIndex, setFocusIndex] = useState(-1);
  const listRef = useRef(null);

  /* ─── Data fetching ─── */
  const fetchMessages = useCallback(async (query) => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (activeFolder) params.set('label_ids', activeFolder);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiGet(`/api/integrations/google/gmail/messages${qs}`, { cache: false });
      if (res.ok) setMessages(res.data.messages || []);
      else toast.error('Failed to load emails');
    } catch { toast.error('Failed to load emails'); }
    finally { setLoading(false); }
  }, [activeFolder]);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await apiGet('/api/integrations/google/gmail/labels');
      if (res.ok) {
        const counts = {};
        for (const lbl of res.data.labels || []) {
          counts[lbl.id] = { total: lbl.messagesTotal || 0, unread: lbl.messagesUnread || 0 };
        }
        setLabelCounts(counts);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { fetchLabels(); }, [fetchLabels]);

  /* ─── Folder switching ─── */
  const switchFolder = (folderId) => {
    setActiveFolder(folderId);
    setSelectedId(null);
    setMessageDetail(null);
    setSearchQuery('');
    setFocusIndex(-1);
  };

  /* ─── Open message ─── */
  const openMessage = useCallback(async (msg) => {
    setSelectedId(msg.id);
    setLoadingDetail(true);
    setMessageDetail(null);
    try {
      const res = await apiGet(`/api/integrations/google/gmail/messages/${msg.id}`);
      if (res.ok) setMessageDetail(res.data);
    } catch { toast.error('Failed to load email'); }
    finally { setLoadingDetail(false); }
  }, []);

  /* ─── Compose ─── */
  const openCompose = () => {
    setComposeData({ to: '', subject: '', body: SIG_DIVIDER, cc: '', bcc: '' });
    setAttachments([]);
    setShowCompose(true);
    setComposeMinimized(false);
  };

  const handleSend = async () => {
    if (!composeData.to || !composeData.subject) { toast.error('To and Subject are required'); return; }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', composeData.to);
      formData.append('subject', composeData.subject);
      formData.append('body', composeData.body || '');
      if (composeData.cc) formData.append('cc', composeData.cc);
      if (composeData.bcc) formData.append('bcc', composeData.bcc);
      if (composeData.reply_to_message_id) formData.append('reply_to_message_id', composeData.reply_to_message_id);
      attachments.forEach(file => formData.append('attachments', file));
      const res = await apiUpload('/api/integrations/google/gmail/send', formData);
      if (res.ok) {
        toast.success('Email sent');
        setShowCompose(false);
        setComposeMinimized(false);
        setComposeData({ to: '', subject: '', body: '', cc: '', bcc: '' });
        setAttachments([]);
        fetchMessages();
      } else toast.error(res.error || 'Failed to send');
    } catch { toast.error('Failed to send'); }
    finally { setSending(false); }
  };

  const handleReply = (msg) => {
    setComposeData({
      to: msg.from || '',
      subject: `Re: ${msg.subject || ''}`,
      body: `${SIG_DIVIDER}\n\n──────────\nOn ${formatFullDate(msg.date)}, ${extractName(msg.from)} wrote:\n> ${(msg.body_text || msg.snippet || '').split('\n').join('\n> ')}`,
      cc: '', bcc: '',
      reply_to_message_id: msg.threadId || '',
    });
    setAttachments([]);
    setShowCompose(true);
    setComposeMinimized(false);
  };

  const handleForward = (msg) => {
    setComposeData({
      to: '',
      subject: `Fwd: ${msg.subject || ''}`,
      body: `${SIG_DIVIDER}\n\n──────── Forwarded message ────────\nFrom: ${msg.from || ''}\nDate: ${formatFullDate(msg.date)}\nSubject: ${msg.subject || ''}\nTo: ${msg.to || ''}\n\n${msg.body_text || ''}`,
      cc: '', bcc: '',
    });
    setAttachments([]);
    setShowCompose(true);
    setComposeMinimized(false);
  };

  /* ─── Message actions ─── */
  const handleTrash = async (id) => {
    try {
      const res = await apiPost(`/api/integrations/google/gmail/messages/${id}/trash`);
      if (res.ok) {
        toast.success('Moved to trash');
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedId === id) { setSelectedId(null); setMessageDetail(null); }
        fetchLabels();
      } else toast.error('Failed to trash');
    } catch { toast.error('Failed to trash'); }
  };

  const handleUntrash = async (id) => {
    try {
      const res = await apiPost(`/api/integrations/google/gmail/messages/${id}/untrash`);
      if (res.ok) {
        toast.success('Moved out of trash');
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedId === id) { setSelectedId(null); setMessageDetail(null); }
        fetchLabels();
      } else toast.error('Failed to restore');
    } catch { toast.error('Failed to restore'); }
  };

  const handlePermanentDelete = async (id) => {
    try {
      const res = await apiDelete(`/api/integrations/google/gmail/messages/${id}`);
      if (res.ok) {
        toast.success('Permanently deleted');
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedId === id) { setSelectedId(null); setMessageDetail(null); }
        fetchLabels();
      } else toast.error('Failed to delete');
    } catch { toast.error('Failed to delete'); }
  };

  const handleArchive = async (id) => {
    try {
      const res = await apiPost(`/api/integrations/google/gmail/messages/${id}/modify`, { remove_labels: ['INBOX'] });
      if (res.ok) {
        toast.success('Archived');
        if (activeFolder === 'INBOX') setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedId === id) { setSelectedId(null); setMessageDetail(null); }
        fetchLabels();
      }
    } catch { toast.error('Failed to archive'); }
  };

  const handleToggleStar = async (id, isStarred) => {
    try {
      const body = isStarred ? { remove_labels: ['STARRED'] } : { add_labels: ['STARRED'] };
      const res = await apiPost(`/api/integrations/google/gmail/messages/${id}/modify`, body);
      if (res.ok) {
        setMessages(prev => prev.map(m => {
          if (m.id !== id) return m;
          const newLabels = isStarred
            ? m.labelIds.filter(l => l !== 'STARRED')
            : [...m.labelIds, 'STARRED'];
          return { ...m, labelIds: newLabels };
        }));
        if (activeFolder === 'STARRED' && isStarred) {
          setMessages(prev => prev.filter(m => m.id !== id));
        }
      }
    } catch {}
  };

  const handleToggleRead = async (id, isUnread) => {
    try {
      const body = isUnread ? { remove_labels: ['UNREAD'] } : { add_labels: ['UNREAD'] };
      const res = await apiPost(`/api/integrations/google/gmail/messages/${id}/modify`, body);
      if (res.ok) {
        setMessages(prev => prev.map(m => {
          if (m.id !== id) return m;
          const newLabels = isUnread
            ? m.labelIds.filter(l => l !== 'UNREAD')
            : [...m.labelIds, 'UNREAD'];
          return { ...m, labelIds: newLabels, isUnread: !isUnread };
        }));
        fetchLabels();
      }
    } catch {}
  };

  /* ─── Batch actions ─── */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === messages.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(messages.map(m => m.id)));
  };

  const handleBatchTrash = async () => {
    const ids = [...selectedIds];
    for (const id of ids) await apiPost(`/api/integrations/google/gmail/messages/${id}/trash`);
    toast.success(`${ids.length} moved to trash`);
    setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
    if (selectedIds.has(selectedId)) { setSelectedId(null); setMessageDetail(null); }
    setSelectedIds(new Set());
    fetchLabels();
  };

  const handleBatchArchive = async () => {
    const ids = [...selectedIds];
    for (const id of ids) await apiPost(`/api/integrations/google/gmail/messages/${id}/modify`, { remove_labels: ['INBOX'] });
    toast.success(`${ids.length} archived`);
    if (activeFolder === 'INBOX') setMessages(prev => prev.filter(m => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    fetchLabels();
  };

  const handleBatchRead = async () => {
    const ids = [...selectedIds];
    for (const id of ids) await apiPost(`/api/integrations/google/gmail/messages/${id}/modify`, { remove_labels: ['UNREAD'] });
    setMessages(prev => prev.map(m =>
      selectedIds.has(m.id) ? { ...m, isUnread: false, labelIds: m.labelIds.filter(l => l !== 'UNREAD') } : m
    ));
    setSelectedIds(new Set());
    toast.success('Marked as read');
    fetchLabels();
  };

  /* ─── Attachments ─── */
  const downloadAttachment = async (messageId, attachmentId, filename) => {
    try {
      const baseUrl = API_URL || '';
      const token = getAuthToken();
      const res = await fetch(
        `${baseUrl}/api/integrations/google/gmail/messages/${messageId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`,
        { headers: token ? { 'Authorization': `Bearer ${token}` } : {}, credentials: 'include' }
      );
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { toast.error('Failed to download attachment'); }
  };

  /* ─── Search ─── */
  const handleSearch = (e) => { e.preventDefault(); fetchMessages(searchQuery); };

  /* ─── Keyboard nav ─── */
  useEffect(() => {
    const handler = (e) => {
      if (showCompose || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j') setFocusIndex(p => Math.min(p + 1, messages.length - 1));
      if (e.key === 'k') setFocusIndex(p => Math.max(p - 1, 0));
      if (e.key === 'Enter' && focusIndex >= 0 && messages[focusIndex]) openMessage(messages[focusIndex]);
      if (e.key === 'c') { e.preventDefault(); openCompose(); }
      if (e.key === 'Escape') { setSelectedId(null); setMessageDetail(null); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [messages, focusIndex, showCompose, openMessage]);

  /* ─── Derived ─── */
  const isSentFolder = activeFolder === 'SENT';
  const isTrashFolder = activeFolder === 'TRASH';
  const isSpamFolder = activeFolder === 'SPAM';

  /* ─── Render ─── */
  return (
    <div className="h-full flex bg-zinc-950">
      {/* ── Folder Sidebar ── */}
      <div className="w-[200px] min-w-[200px] border-r border-zinc-800/70 flex flex-col bg-zinc-950">
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={openCompose}
            className="flex items-center gap-3 px-4 py-3 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 hover:border-zinc-600/50 rounded-2xl transition-all shadow-lg hover:shadow-xl group w-full"
          >
            <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium text-zinc-200">Compose</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {FOLDERS.map(folder => {
            const isActive = folder.id === activeFolder;
            const counts = labelCounts[folder.id] || {};
            const unread = counts.unread || 0;
            const Icon = folder.icon;
            return (
              <button
                key={folder.id}
                onClick={() => switchFolder(folder.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-100
                  ${isActive
                    ? 'bg-zinc-800/90 text-white font-medium border-l-2 border-orange-500 pl-2.5'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border-l-2 border-transparent'
                  }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-orange-400' : ''}`} />
                <span className="flex-1 text-left truncate">{folder.label}</span>
                {unread > 0 && (
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                    ${isActive ? 'bg-orange-600/20 text-orange-400' : 'bg-zinc-800 text-zinc-500'}`}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Keyboard hints */}
        <div className="px-3 py-2 border-t border-zinc-800/50 text-[10px] text-zinc-600 font-mono space-y-0.5">
          <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">j</kbd>/<kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">k</kbd> nav</div>
          <div><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">c</kbd> compose  <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500">esc</kbd> close</div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search + refresh bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-800/70 bg-zinc-950">
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Search ${FOLDERS.find(f => f.id === activeFolder)?.label || 'mail'}...`}
                className="w-full pl-11 pr-4 py-2.5 bg-zinc-900/80 hover:bg-zinc-800/80 focus:bg-zinc-800 border border-zinc-800 focus:border-zinc-600 rounded-full text-sm text-white outline-none transition-all placeholder:text-zinc-500"
              />
            </div>
          </form>
          <button onClick={() => fetchMessages(searchQuery)} disabled={loading}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-full transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Batch action toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/70 bg-zinc-900/50">
            <button onClick={selectAll} className="p-1 hover:bg-zinc-800 rounded transition-colors" title="Select all">
              {selectedIds.size === messages.length
                ? <CheckSquare className="w-4 h-4 text-orange-400" />
                : <Square className="w-4 h-4 text-zinc-500" />
              }
            </button>
            <span className="text-xs text-zinc-400 mr-2">{selectedIds.size} selected</span>
            <div className="h-4 w-px bg-zinc-700" />
            {activeFolder === 'INBOX' && (
              <button onClick={handleBatchArchive} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Archive">
                <Archive className="w-4 h-4" />
              </button>
            )}
            {!isTrashFolder && (
              <button onClick={handleBatchTrash} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors" title="Trash">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={handleBatchRead} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Mark read">
              <MailOpen className="w-4 h-4" />
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors" title="Clear selection">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Split pane: list + reading */}
        <div className="flex-1 flex min-h-0">
          {/* Message list */}
          <div ref={listRef} className={`${selectedId ? 'w-[400px] min-w-[360px] border-r border-zinc-800/70' : 'flex-1'} flex flex-col overflow-hidden transition-all duration-200`}>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="space-y-0">
                  {Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} />)}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 px-6">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                    {activeFolder === 'TRASH' ? <Trash2 className="w-8 h-8 text-zinc-600" /> :
                     activeFolder === 'SPAM' ? <AlertCircle className="w-8 h-8 text-zinc-600" /> :
                     activeFolder === 'STARRED' ? <Star className="w-8 h-8 text-zinc-600" /> :
                     <Inbox className="w-8 h-8 text-zinc-600" />}
                  </div>
                  <p className="text-sm font-medium text-zinc-400 mb-1">
                    {activeFolder === 'TRASH' ? 'Trash is empty' :
                     activeFolder === 'SPAM' ? 'No spam' :
                     activeFolder === 'STARRED' ? 'No starred messages' :
                     activeFolder === 'DRAFT' ? 'No drafts' :
                     'No emails found'}
                  </p>
                  <p className="text-xs text-zinc-600 text-center">
                    {searchQuery ? 'Try a different search' : `Nothing in ${FOLDERS.find(f => f.id === activeFolder)?.label || 'this folder'}`}
                  </p>
                </div>
              ) : (
                <div>
                  {messages.map((msg, idx) => {
                    const displayName = isSentFolder ? extractName(msg.to) : extractName(msg.from);
                    const isSelected = msg.id === selectedId;
                    const isFocused = idx === focusIndex;
                    const isStarred = (msg.labelIds || []).includes('STARRED');
                    const isChecked = selectedIds.has(msg.id);
                    return (
                      <div
                        key={msg.id}
                        className={`relative flex items-center gap-2 px-2 py-2.5 transition-all duration-100 group
                          ${isSelected ? 'bg-zinc-800/90' : ''}
                          ${isFocused && !isSelected ? 'bg-zinc-900/60' : ''}
                          ${!isSelected ? 'hover:bg-zinc-900/50' : ''}
                          ${isChecked ? 'bg-zinc-800/60' : ''}
                        `}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                          className={`p-0.5 flex-shrink-0 transition-opacity ${isChecked || 'opacity-0 group-hover:opacity-100'}`}
                        >
                          {isChecked
                            ? <CheckSquare className="w-4 h-4 text-orange-400" />
                            : <Square className="w-4 h-4 text-zinc-600" />
                          }
                        </button>

                        {/* Star */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleStar(msg.id, isStarred); }}
                          className="p-0.5 flex-shrink-0"
                        >
                          <Star className={`w-4 h-4 transition-colors ${isStarred ? 'fill-amber-400 text-amber-400' : 'text-zinc-700 hover:text-zinc-500'}`} />
                        </button>

                        {/* Message content — clickable */}
                        <button
                          onClick={() => openMessage(msg)}
                          className="flex-1 flex items-center gap-3 min-w-0 text-left"
                        >
                          <SenderAvatar name={displayName} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[13px] truncate max-w-[140px] ${msg.isUnread ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                                {isSentFolder && <span className="text-zinc-500 text-[11px] mr-1">To:</span>}
                                {displayName || '(unknown)'}
                              </span>
                              <span className="text-[11px] text-zinc-600 flex-shrink-0 ml-auto">{formatDate(msg.date)}</span>
                            </div>
                            <div className={`text-[12.5px] truncate ${msg.isUnread ? 'font-medium text-zinc-200' : 'text-zinc-400'}`}>
                              {msg.subject || '(no subject)'}
                            </div>
                            <div className="text-[11.5px] text-zinc-600 truncate mt-0.5 leading-snug">
                              {msg.snippet}
                            </div>
                          </div>
                        </button>

                        {/* Unread indicator */}
                        {msg.isUnread && (
                          <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                        )}

                        {/* Hover actions */}
                        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0 bg-zinc-900/90 rounded-lg px-1 py-0.5 absolute right-2 top-1/2 -translate-y-1/2 shadow-lg border border-zinc-800">
                          {activeFolder === 'INBOX' && (
                            <button onClick={(e) => { e.stopPropagation(); handleArchive(msg.id); }}
                              className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Archive">
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isTrashFolder ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleUntrash(msg.id); }}
                                className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 rounded transition-colors" title="Restore">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handlePermanentDelete(msg.id); }}
                                className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors" title="Delete forever">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button onClick={(e) => { e.stopPropagation(); handleTrash(msg.id); }}
                              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors" title="Trash">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleToggleRead(msg.id, msg.isUnread); }}
                            className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                            title={msg.isUnread ? 'Mark read' : 'Mark unread'}>
                            {msg.isUnread ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Reading Pane ── */}
          <div className={`flex-1 flex flex-col min-h-0 ${!selectedId ? 'hidden' : ''}`}>
            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              </div>
            ) : messageDetail ? (
              <>
                {/* Email header + actions */}
                <div className="px-6 py-4 border-b border-zinc-800/70">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h2 className="text-lg font-semibold text-white leading-tight flex-1">{messageDetail.subject}</h2>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleToggleStar(messageDetail.id, (messageDetail.labelIds || []).includes('STARRED'))}
                        className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors" title="Star">
                        <Star className={`w-4 h-4 ${(messageDetail.labelIds || []).includes('STARRED') ? 'fill-amber-400 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`} />
                      </button>
                      {activeFolder === 'INBOX' && (
                        <button onClick={() => handleArchive(messageDetail.id)}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors" title="Archive">
                          <Archive className="w-4 h-4" />
                        </button>
                      )}
                      {isTrashFolder ? (
                        <>
                          <button onClick={() => handleUntrash(messageDetail.id)}
                            className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 rounded-full transition-colors" title="Restore">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handlePermanentDelete(messageDetail.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-full transition-colors" title="Delete forever">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleTrash(messageDetail.id)}
                          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-full transition-colors" title="Trash">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleToggleRead(messageDetail.id, (messageDetail.labelIds || []).includes('UNREAD'))}
                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                        title={(messageDetail.labelIds || []).includes('UNREAD') ? 'Mark read' : 'Mark unread'}>
                        {(messageDetail.labelIds || []).includes('UNREAD')
                          ? <MailOpen className="w-4 h-4" />
                          : <Mail className="w-4 h-4" />
                        }
                      </button>
                      <div className="w-px h-5 bg-zinc-700 mx-1" />
                      <button onClick={() => { setSelectedId(null); setMessageDetail(null); }}
                        className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-4 h-4 text-zinc-500" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SenderAvatar name={extractName(messageDetail.from)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{extractName(messageDetail.from)}</span>
                        <span className="text-xs text-zinc-600">&lt;{extractEmail(messageDetail.from)}&gt;</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        to {messageDetail.to?.split(',').map(s => extractName(s.trim())).join(', ')}
                        {messageDetail.cc && <> cc {messageDetail.cc}</>}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500 flex-shrink-0">{formatFullDate(messageDetail.date)}</span>
                  </div>
                </div>

                {/* Email body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                  <div className="max-w-3xl">
                    {messageDetail.body_html ? (
                      <div
                        className="prose prose-invert prose-sm max-w-none [&_a]:text-orange-400 [&_img]:rounded-lg [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: messageDetail.body_html }}
                      />
                    ) : (
                      <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                        {messageDetail.body_text || '(no content)'}
                      </pre>
                    )}

                    {/* Attachments */}
                    {messageDetail.attachments?.length > 0 && (
                      <div className="mt-6 pt-4 border-t border-zinc-800">
                        <div className="text-xs text-zinc-500 mb-3 font-medium">
                          {messageDetail.attachments.length} attachment{messageDetail.attachments.length > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {messageDetail.attachments.map((a, i) => (
                            <button
                              key={i}
                              onClick={() => a.attachmentId && downloadAttachment(messageDetail.id, a.attachmentId, a.filename)}
                              className="flex items-center gap-3 p-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all text-left group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-600/20">
                                <Paperclip className="w-4 h-4 text-zinc-500 group-hover:text-orange-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-zinc-300 truncate font-medium">{a.filename}</p>
                                {a.size > 0 && <p className="text-[10px] text-zinc-600">{(a.size / 1024).toFixed(0)} KB</p>}
                              </div>
                              <Download className="w-3.5 h-3.5 text-zinc-600 group-hover:text-orange-400 flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reply/Forward bar */}
                <div className="px-6 py-3 border-t border-zinc-800/70 flex items-center gap-2">
                  <button onClick={() => handleReply(messageDetail)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-full text-sm text-zinc-300 transition-colors">
                    <Reply className="w-3.5 h-3.5" /> Reply
                  </button>
                  <button onClick={() => handleForward(messageDetail)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-full text-sm text-zinc-300 transition-colors">
                    <Forward className="w-3.5 h-3.5" /> Forward
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                <Mail className="w-12 h-12 mb-3 text-zinc-700" />
                <p className="text-sm">Select an email to read</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Floating Compose Window ── */}
      {showCompose && (
        <ComposeWindow
          composeData={composeData} setComposeData={setComposeData}
          attachments={attachments} setAttachments={setAttachments}
          onSend={handleSend} sending={sending}
          onClose={() => { setShowCompose(false); setComposeMinimized(false); }}
          onMinimize={() => setComposeMinimized(!composeMinimized)}
          minimized={composeMinimized}
          showTemplates={showTemplates} setShowTemplates={setShowTemplates}
          templateFilter={templateFilter} setTemplateFilter={setTemplateFilter}
        />
      )}
    </div>
  );
};

export default GmailTab;
