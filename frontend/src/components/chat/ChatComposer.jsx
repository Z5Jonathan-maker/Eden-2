/**
 * ChatComposer — Message input with @mention autocomplete, file attach, GIF picker
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send, Paperclip, Image as ImageIcon, X, Reply, Smile,
  Loader2, Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';
import GifPicker from './GifPicker';

const ChatComposer = ({
  onSend,
  onSendGif,
  onUpload,
  onPostAnnouncement,
  replyTo,
  onCancelReply,
  members = [],
  canPost = true,
  isAnnouncement = false,
  placeholder = 'Type a message...',
}) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Announcement fields
  const [announcementTitle, setAnnouncementTitle] = useState('');

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Focus input on mount and when reply changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [replyTo]);

  // Filtered mention candidates
  const mentionCandidates = members.filter((m) => {
    const name = (m.user_name || m.full_name || '').toLowerCase();
    return name.includes(mentionQuery.toLowerCase());
  }).slice(0, 6);

  // Handle input changes with @mention detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setBody(val);

    // Detect @mention trigger
    const cursor = e.target.selectionStart;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (member) => {
    const name = member.user_name || member.full_name || 'unknown';
    const cursor = inputRef.current?.selectionStart || body.length;
    const textBefore = body.slice(0, cursor);
    const textAfter = body.slice(cursor);
    const beforeAt = textBefore.replace(/@(\w*)$/, '');
    setBody(`${beforeAt}@${name} ${textAfter}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (showMentions && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, mentionCandidates.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!body.trim() && !isAnnouncement) return;
    if (isAnnouncement && (!announcementTitle.trim() || !body.trim())) {
      toast.error('Announcement needs a title and body');
      return;
    }

    setSending(true);
    try {
      if (isAnnouncement) {
        const res = await onPostAnnouncement(announcementTitle.trim(), body.trim());
        if (res?.ok) {
          setBody('');
          setAnnouncementTitle('');
        } else {
          toast.error(res?.error || 'Failed to post announcement');
        }
      } else {
        const res = await onSend(body.trim(), replyTo?.id || null);
        if (res?.ok) {
          setBody('');
          onCancelReply?.();
        } else {
          toast.error(res?.error || 'Failed to send message');
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleGifSelect = async (gifUrl, caption) => {
    const res = await onSendGif(gifUrl, caption, replyTo?.id || null);
    if (res?.ok) {
      setShowGifPicker(false);
      onCancelReply?.();
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 15MB limit`);
        continue;
      }
      const res = await onUpload(file);
      if (!res?.ok) toast.error(`Failed to upload ${file.name}`);
    }
    e.target.value = '';
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 15MB limit`);
        continue;
      }
      const res = await onUpload(file);
      if (!res?.ok) toast.error(`Failed to upload ${file.name}`);
    }
  }, [onUpload]);

  if (!canPost) {
    return (
      <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-900/40">
        <p className="text-xs text-zinc-500 text-center font-mono">You don't have permission to post in this channel</p>
      </div>
    );
  }

  return (
    <div
      className={`relative border-t border-zinc-800/50 bg-zinc-900/40 ${dragOver ? 'ring-2 ring-orange-500/40 bg-orange-500/5' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <Reply className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-zinc-400">
            Replying to <strong className="text-zinc-300">{replyTo.sender_name}</strong>
          </span>
          <button onClick={onCancelReply} className="ml-auto text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Announcement title */}
      {isAnnouncement && (
        <div className="px-4 pt-2">
          <input
            type="text"
            value={announcementTitle}
            onChange={(e) => setAnnouncementTitle(e.target.value)}
            placeholder="Announcement title..."
            className="w-full px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-amber-500/30 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      )}

      {/* Mention autocomplete */}
      {showMentions && mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl overflow-hidden z-20">
          {mentionCandidates.map((m, i) => (
            <button
              key={m.user_id || i}
              onClick={() => insertMention(m)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                i === mentionIndex ? 'bg-orange-500/10 text-orange-300' : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                {(m.user_name || m.full_name || '?').slice(0, 2).toUpperCase()}
              </div>
              <span className="text-sm">{m.user_name || m.full_name}</span>
              <span className="text-[10px] text-zinc-500 font-mono ml-auto">{m.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          multiple
        />

        {/* GIF button */}
        <button
          onClick={() => setShowGifPicker(!showGifPicker)}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            showGifPicker
              ? 'text-orange-400 bg-orange-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title="Send GIF"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={body}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 resize-none max-h-[120px] scrollbar-hide"
            style={{ minHeight: '36px' }}
            onInput={(e) => {
              e.target.style.height = '36px';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || (!body.trim() && !(isAnnouncement && announcementTitle.trim()))}
          className="p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          title="Send"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* GIF Picker */}
      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-orange-500/10 border-2 border-dashed border-orange-500/40 rounded-lg flex items-center justify-center z-30 pointer-events-none">
          <p className="text-sm font-semibold text-orange-400">Drop files to upload</p>
        </div>
      )}
    </div>
  );
};

export default ChatComposer;
