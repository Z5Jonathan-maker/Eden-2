/**
 * ChatMessages — Scrollable message list for the active channel
 */

import React, { useEffect, useRef } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble';

const isSameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
};

const formatDateLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const ChatMessages = ({
  messages,
  loading,
  activeChannel,
  userId,
  canManage,
  onReply,
  onThreadOpen,
  onEdit,
  onDelete,
  onReaction,
}) => {
  const endRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Only auto-scroll if user is near bottom already
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Always scroll to bottom on channel change
  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [activeChannel?.id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-2" />
          <p className="text-xs text-zinc-500 font-mono">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!activeChannel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-400 mb-1">Select a channel</h3>
          <p className="text-xs text-zinc-600 max-w-[240px]">
            Pick a channel from the sidebar to start messaging your team.
          </p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <MessageSquare className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-zinc-400 mb-1">No messages yet</h3>
          <p className="text-xs text-zinc-600 max-w-[240px]">
            Start the conversation! Send a message, GIF, or file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="py-2">
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const showDateSep = !prev || !isSameDay(prev.created_at, msg.created_at);
          // Collapse avatar if same sender within 5 minutes
          const showAvatar =
            showDateSep ||
            !prev ||
            prev.sender_user_id !== msg.sender_user_id ||
            (new Date(msg.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_user_id === userId}
              showAvatar={showAvatar}
              showDateSeparator={showDateSep}
              dateSeparatorLabel={showDateSep ? formatDateLabel(msg.created_at) : ''}
              canManage={canManage || msg.sender_user_id === userId}
              userId={userId}
              onReply={onReply}
              onThreadOpen={onThreadOpen}
              onEdit={onEdit}
              onDelete={onDelete}
              onReaction={onReaction}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ChatMessages;
