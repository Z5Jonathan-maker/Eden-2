/**
 * MessageBubble — Single chat message renderer
 *
 * Handles text, GIF, attachment, and announcement message types.
 * Includes reactions bar, thread indicator, edit/delete, and @mention highlighting.
 */

import React, { useState, memo } from 'react';
import {
  Reply, Pencil, Trash2, SmilePlus, MessageSquare,
  FileText, Download, Image as ImageIcon, Check, CheckCheck,
} from 'lucide-react';
import { assertApiUrl } from '@/lib/api';
import ReactionBar from './ReactionBar';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👀', '🙌'];

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/** Highlight @mentions in message body */
const renderBody = (body) => {
  if (!body) return null;
  const parts = body.split(/(@\w[\w ]*\w|@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-orange-400 font-semibold bg-orange-500/10 px-0.5 rounded">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

const isImageMime = (mime) => mime && mime.startsWith('image/');

const MessageBubble = memo(({
  message,
  isOwn,
  showAvatar = true,
  showDateSeparator = false,
  dateSeparatorLabel = '',
  canManage = false,
  onReply,
  onThreadOpen,
  onEdit,
  onDelete,
  onReaction,
  userId,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const apiUrl = assertApiUrl();
  const isDeleted = message.is_deleted;
  const isAnnouncement = message.type === 'announcement';
  const isGif = message.type === 'gif';
  const isAttachment = message.type === 'attachment';
  const replyCount = message.reply_count || 0;

  // Group reactions by emoji
  const reactionGroups = {};
  (message.reactions || []).forEach((r) => {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { emoji: r.emoji, users: [], hasOwn: false };
    reactionGroups[r.emoji].users.push(r.user_name || r.user_id);
    if (r.user_id === userId) reactionGroups[r.emoji].hasOwn = true;
  });

  return (
    <>
      {showDateSeparator && (
        <div className="flex items-center gap-3 py-3">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{dateSeparatorLabel}</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>
      )}

      <div
        className={`group relative flex gap-3 px-4 py-1.5 hover:bg-zinc-800/30 transition-colors ${isAnnouncement ? 'bg-amber-500/5 border-l-2 border-amber-500/40 pl-5' : ''}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
      >
        {/* Avatar */}
        {showAvatar ? (
          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-zinc-400 uppercase mt-0.5">
            {(message.sender_name || '?').slice(0, 2)}
          </div>
        ) : (
          <div className="w-8 flex-shrink-0" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Sender + Time */}
          {showAvatar && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-zinc-200">{message.sender_name || 'Unknown'}</span>
              <span className="text-[10px] text-zinc-600 font-mono">{formatTime(message.created_at)}</span>
              {message.is_edited && <span className="text-[9px] text-zinc-600 font-mono">(edited)</span>}
            </div>
          )}

          {/* Deleted */}
          {isDeleted ? (
            <p className="text-sm text-zinc-600 italic">This message was deleted</p>
          ) : isAnnouncement ? (
            /* Announcement */
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                  Announcement
                </span>
              </div>
              {message.announcement_title && (
                <h4 className="text-sm font-bold text-zinc-100 mb-1">{message.announcement_title}</h4>
              )}
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{renderBody(message.body)}</p>
            </div>
          ) : isGif ? (
            /* GIF */
            <div>
              {message.body && <p className="text-sm text-zinc-300 mb-1">{renderBody(message.body)}</p>}
              <img
                src={message.gif_url}
                alt="GIF"
                className="max-w-[280px] rounded-lg border border-zinc-800"
                loading="lazy"
              />
            </div>
          ) : isAttachment ? (
            /* Attachment */
            <div>
              {isImageMime(message.attachment_mime_type) ? (
                <div className="max-w-[320px]">
                  <img
                    src={`${apiUrl}/api/comm/uploads/${message.attachment_id}`}
                    alt={message.attachment_name}
                    className="rounded-lg border border-zinc-800 max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    loading="lazy"
                    onClick={() => window.open(`${apiUrl}/api/comm/uploads/${message.attachment_id}`, '_blank')}
                  />
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">{message.attachment_name}</p>
                </div>
              ) : (
                <a
                  href={`${apiUrl}/api/comm/uploads/${message.attachment_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-600 transition-colors max-w-[300px]"
                >
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-zinc-300 truncate">{message.attachment_name || message.body}</span>
                  <Download className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                </a>
              )}
            </div>
          ) : (
            /* Regular message */
            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{renderBody(message.body)}</p>
          )}

          {/* Reactions */}
          {Object.keys(reactionGroups).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {Object.values(reactionGroups).map((g) => (
                <button
                  key={g.emoji}
                  onClick={() => onReaction?.(message.id, g.emoji)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs transition-colors ${
                    g.hasOwn
                      ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                      : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-400 hover:border-zinc-600'
                  }`}
                  title={g.users.join(', ')}
                >
                  <span>{g.emoji}</span>
                  <span className="font-mono text-[10px]">{g.users.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Thread indicator */}
          {replyCount > 0 && (
            <button
              onClick={() => onThreadOpen?.(message.id)}
              className="flex items-center gap-1.5 mt-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="font-medium">{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
            </button>
          )}
        </div>

        {/* Hover action bar */}
        {showActions && !isDeleted && (
          <div className="absolute -top-3 right-4 flex items-center gap-0.5 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-lg px-1 py-0.5 z-10">
            {QUICK_EMOJIS.slice(0, 3).map((e) => (
              <button
                key={e}
                onClick={() => onReaction?.(message.id, e)}
                className="p-1 hover:bg-zinc-800 rounded text-sm transition-colors"
                title={e}
              >
                {e}
              </button>
            ))}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="More reactions"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-0.5" />
            <button
              onClick={() => onThreadOpen?.(message.id)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Reply in thread"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onReply?.(message)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
            {(canManage || message.sender_user_id === userId) && (
              <>
                <button
                  onClick={() => onEdit?.(message)}
                  className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete?.(message.id)}
                  className="p-1 hover:bg-red-500/10 rounded text-zinc-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Full emoji picker dropdown */}
        {showEmojiPicker && (
          <div className="absolute -top-12 right-4 bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl px-2 py-1.5 z-20 flex gap-1">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => { onReaction?.(message.id, e); setShowEmojiPicker(false); }}
                className="p-1.5 hover:bg-zinc-800 rounded text-lg transition-colors"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
});

MessageBubble.displayName = 'MessageBubble';
export default MessageBubble;
