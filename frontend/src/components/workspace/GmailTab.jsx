import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Loader2, Mail, Send, Reply, X,
  Paperclip, Circle, ArrowLeft, Plus, FileText, ChevronDown, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { apiGet, apiUpload, API_URL, getAuthToken } from '../../lib/api';
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES, TONE_LABELS } from '../../config/emailTemplates';

const GmailTab = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageDetail, setMessageDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '', cc: '', bcc: '' });
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateFilter, setTemplateFilter] = useState('all');

  const fetchMessages = useCallback(async (query) => {
    setLoading(true);
    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : '';
      const res = await apiGet(`/api/integrations/google/gmail/messages${params}`);
      if (res.ok) {
        setMessages(res.data.messages || []);
      } else {
        toast.error('Failed to load emails');
      }
    } catch {
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchMessages(searchQuery);
  };

  const openMessage = async (msg) => {
    setSelectedMessage(msg);
    setLoadingDetail(true);
    try {
      const res = await apiGet(`/api/integrations/google/gmail/messages/${msg.id}`);
      if (res.ok) {
        setMessageDetail(res.data);
      }
    } catch {
      toast.error('Failed to load email');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSend = async () => {
    if (!composeData.to || !composeData.subject) {
      toast.error('To and Subject are required');
      return;
    }
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
        setComposeData({ to: '', subject: '', body: '', cc: '', bcc: '' });
        setAttachments([]);
        fetchMessages();
      } else {
        toast.error(res.error || 'Failed to send email');
      }
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleReply = (msg) => {
    setComposeData({
      to: msg.from || '',
      subject: `Re: ${msg.subject || ''}`,
      body: '',
      cc: '',
      bcc: '',
      reply_to_message_id: msg.threadId || '',
    });
    setAttachments([]);
    setShowCompose(true);
  };

  const handleAttachFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 25 * 1024 * 1024; // 25MB per file (Gmail limit)
    const valid = files.filter(f => {
      if (f.size > maxSize) {
        toast.error(`"${f.name}" is too large (max 25MB)`);
        return false;
      }
      return true;
    });
    setAttachments(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = async (messageId, attachmentId, filename) => {
    try {
      const baseUrl = API_URL || '';
      const token = getAuthToken();
      const res = await fetch(
        `${baseUrl}/api/integrations/google/gmail/messages/${messageId}/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`,
        {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error('Failed to download attachment');
    }
  };

  const applyTemplate = (template) => {
    setComposeData(p => ({
      ...p,
      subject: template.subject,
      body: template.body,
    }));
    setShowTemplates(false);
  };

  const filteredTemplates = templateFilter === 'all'
    ? EMAIL_TEMPLATES
    : EMAIL_TEMPLATES.filter(t => t.category === templateFilter);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const extractName = (fromStr) => {
    if (!fromStr) return '';
    const match = fromStr.match(/^([^<]+)/);
    return match ? match[1].trim().replace(/"/g, '') : fromStr;
  };

  // Compose modal
  if (showCompose) {
    return (
      <div className="h-full flex bg-zinc-950">
        {/* Template Sidebar */}
        {showTemplates && (
          <div className="w-80 border-r border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Templates</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </Button>
            </div>

            {/* Category filter */}
            <div className="px-3 py-2 border-b border-zinc-800/50 flex gap-1">
              <button
                onClick={() => setTemplateFilter('all')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  templateFilter === 'all' ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                All
              </button>
              {TEMPLATE_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setTemplateFilter(cat.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    templateFilter === cat.id ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto">
              {filteredTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30 group"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                    <span className="text-sm text-zinc-200 font-medium">{tpl.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 uppercase">
                      {tpl.category}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {TONE_LABELS[tpl.tone] || tpl.tone}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Compose Form */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">New Message</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className={`text-zinc-400 hover:text-white ${showTemplates ? 'bg-zinc-800 text-orange-400' : ''}`}
              >
                <FileText className="w-4 h-4 mr-1" /> Templates
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowCompose(false)}>
                <X className="w-4 h-4 text-zinc-400" />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3 max-w-3xl">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-zinc-500 mb-1 block">To</label>
                <Input
                  value={composeData.to}
                  onChange={e => setComposeData(p => ({ ...p, to: e.target.value }))}
                  placeholder="recipient@example.com"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">CC</label>
                <Input
                  value={composeData.cc}
                  onChange={e => setComposeData(p => ({ ...p, cc: e.target.value }))}
                  placeholder="cc@example.com"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">BCC</label>
                <Input
                  value={composeData.bcc}
                  onChange={e => setComposeData(p => ({ ...p, bcc: e.target.value }))}
                  placeholder="bcc@example.com"
                  className="bg-zinc-900 border-zinc-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Subject</label>
              <Input
                value={composeData.subject}
                onChange={e => setComposeData(p => ({ ...p, subject: e.target.value }))}
                placeholder="Subject"
                className="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Message</label>
              <textarea
                value={composeData.body}
                onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
                placeholder="Write your message..."
                className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-md p-3 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
              />
            </div>
            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-300">
                    <Paperclip className="w-3 h-3 text-zinc-500" />
                    <span className="truncate max-w-[160px]">{file.name}</span>
                    <span className="text-zinc-600">({(file.size / 1024).toFixed(0)}KB)</span>
                    <button onClick={() => removeAttachment(i)} className="text-zinc-500 hover:text-red-400 ml-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-zinc-400 hover:text-white"
                >
                  <Paperclip className="w-4 h-4 mr-1" /> Attach Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachFiles}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCompose(false)}
                  className="border-zinc-700 text-zinc-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send{attachments.length > 0 && ` (${attachments.length} file${attachments.length > 1 ? 's' : ''})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Message detail view
  if (selectedMessage && messageDetail) {
    return (
      <div className="h-full flex flex-col bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedMessage(null); setMessageDetail(null); }}>
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </Button>
          <h2 className="text-white font-medium truncate flex-1">{messageDetail.subject}</h2>
          <Button
            variant="ghost" size="sm"
            onClick={() => handleReply(messageDetail)}
            className="text-zinc-400 hover:text-white"
          >
            <Reply className="w-4 h-4 mr-1" /> Reply
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium">{extractName(messageDetail.from)}</span>
                <span className="text-xs text-zinc-500">{formatDate(messageDetail.date)}</span>
              </div>
              <div className="text-xs text-zinc-500">
                To: {messageDetail.to}
                {messageDetail.cc && <> | Cc: {messageDetail.cc}</>}
              </div>
            </div>

            {messageDetail.attachments?.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-zinc-500 mb-2">{messageDetail.attachments.length} attachment{messageDetail.attachments.length > 1 ? 's' : ''}</div>
                <div className="flex flex-wrap gap-2">
                  {messageDetail.attachments.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => a.attachmentId && downloadAttachment(messageDetail.id, a.attachmentId, a.filename)}
                      className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer"
                      title={`Download ${a.filename}`}
                    >
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate max-w-[160px]">{a.filename}</span>
                      {a.size > 0 && <span className="text-zinc-600">({(a.size / 1024).toFixed(0)}KB)</span>}
                      <Download className="w-3 h-3 text-orange-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-4">
              {messageDetail.body_html ? (
                <div
                  className="prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: messageDetail.body_html }}
                />
              ) : (
                <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">
                  {messageDetail.body_text || '(no content)'}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading detail
  if (selectedMessage && loadingDetail) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  // Message list
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
              placeholder="Search emails..."
              className="pl-9 bg-zinc-900 border-zinc-700 text-white text-sm"
            />
          </div>
        </form>
        <Button
          variant="ghost" size="sm"
          onClick={() => fetchMessages(searchQuery)}
          disabled={loading}
          className="text-zinc-400"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          size="sm"
          onClick={() => setShowCompose(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" /> Compose
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
            <Mail className="w-12 h-12 mb-3 text-zinc-600" />
            <p className="text-sm">No emails found</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => openMessage(msg)}
                className={`w-full text-left px-4 py-3 hover:bg-zinc-900/50 transition-colors flex items-start gap-3 ${
                  msg.isUnread ? 'bg-zinc-900/30' : ''
                }`}
              >
                {msg.isUnread && (
                  <Circle className="w-2 h-2 mt-2 fill-orange-500 text-orange-500 flex-shrink-0" />
                )}
                {!msg.isUnread && <div className="w-2 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${msg.isUnread ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                      {extractName(msg.from)}
                    </span>
                    <span className="text-xs text-zinc-500 flex-shrink-0">{formatDate(msg.date)}</span>
                  </div>
                  <div className={`text-sm truncate ${msg.isUnread ? 'font-medium text-zinc-200' : 'text-zinc-400'}`}>
                    {msg.subject}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">
                    {msg.snippet}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GmailTab;
