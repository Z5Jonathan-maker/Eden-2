/**
 * ChatThread — Slide-over panel for threaded replies
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, MessageSquare } from 'lucide-react';
import MessageBubble from './MessageBubble';

const ChatThread = ({
  parentMessage,
  replies,
  onClose,
  onSendReply,
  onReaction,
  userId,
  canManage,
}) => {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [parentMessage?.id]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    const res = await onSendReply(body.trim());
    if (res?.ok) setBody('');
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!parentMessage) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-200">Thread</h3>
          <span className="text-[10px] font-mono text-zinc-500">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      <div className="border-b border-zinc-800/30 bg-zinc-900/20">
        <MessageBubble
          message={parentMessage}
          isOwn={parentMessage.sender_user_id === userId}
          showAvatar={true}
          canManage={false}
          userId={userId}
          onReaction={onReaction}
        />
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {replies.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-zinc-600 font-mono">No replies yet. Start the thread!</p>
          </div>
        ) : (
          <div className="py-2">
            {replies.map((msg, i) => {
              const prev = replies[i - 1];
              const showAvatar = !prev || prev.sender_user_id !== msg.sender_user_id;
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.sender_user_id === userId}
                  showAvatar={showAvatar}
                  canManage={canManage || msg.sender_user_id === userId}
                  userId={userId}
                  onReaction={onReaction}
                />
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Thread composer */}
      <div className="border-t border-zinc-800/50 bg-zinc-900/40 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply in thread..."
            rows={1}
            className="flex-1 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 resize-none max-h-[80px] scrollbar-hide"
            style={{ minHeight: '36px' }}
            onInput={(e) => {
              e.target.style.height = '36px';
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="p-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatThread;
