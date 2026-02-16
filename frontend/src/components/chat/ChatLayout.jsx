/**
 * ChatLayout — Main 3-panel chat layout
 *
 * Sidebar (channels) + Messages + Thread/Details panel
 * Mobile: sidebar as slide-out drawer, thread as full-screen overlay
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Search, Users, Settings, Menu, X, Hash, Lock, Megaphone,
  MessageCircle, ChevronRight, Trash2, UserMinus,
} from 'lucide-react';
import { toast } from 'sonner';
import useChat from '@/hooks/useChat';
import ChatSidebar from './ChatSidebar';
import ChatMessages from './ChatMessages';
import ChatComposer from './ChatComposer';
import ChatThread from './ChatThread';
import ChatSearch from './ChatSearch';

const ChatLayout = () => {
  const { channelId: urlChannelId } = useParams();
  const { user } = useAuth();
  const userId = user?.id;

  const chat = useChat(urlChannelId || null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Sync URL channel ID
  useEffect(() => {
    if (urlChannelId && urlChannelId !== chat.activeChannelId) {
      chat.setActiveChannelId(urlChannelId);
    }
  }, [urlChannelId]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        chat.setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chat]);

  const handleSelectChannel = useCallback((channelId) => {
    chat.setActiveChannelId(channelId);
    setMobileSidebarOpen(false);
    setReplyTo(null);
    setEditingMessage(null);
  }, [chat]);

  const handleReply = useCallback((msg) => {
    setReplyTo(msg);
  }, []);

  const handleEdit = useCallback((msg) => {
    setEditingMessage(msg);
    // For simplicity, we prompt inline — could be a modal
    const newBody = window.prompt('Edit message:', msg.body);
    if (newBody !== null && newBody.trim() && newBody.trim() !== msg.body) {
      chat.editMessage(msg.id, newBody.trim());
    }
    setEditingMessage(null);
  }, [chat]);

  const handleDelete = useCallback((messageId) => {
    if (window.confirm('Delete this message?')) {
      chat.deleteMessage(messageId);
    }
  }, [chat]);

  const handleDeleteChannel = useCallback(async () => {
    if (!chat.activeChannel) return;
    if (!window.confirm(`Delete #${chat.activeChannel.name}? This cannot be undone.`)) return;
    const res = await chat.deleteChannel();
    if (res?.ok) {
      toast.success('Channel deleted');
    } else {
      toast.error(res?.error || 'Failed to delete channel');
    }
  }, [chat]);

  const handleRemoveMember = useCallback(async (userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this channel?`)) return;
    const res = await chat.removeMember(userId);
    if (res?.ok) {
      toast.success(`${userName} removed`);
    } else {
      toast.error(res?.error || 'Failed to remove member');
    }
  }, [chat]);

  const handleSearchNavigate = useCallback((channelId, messageId) => {
    chat.setActiveChannelId(channelId);
    // TODO: scroll to specific message
  }, [chat]);

  const channelTypeIcon = () => {
    if (!chat.activeChannel) return null;
    if (chat.activeChannel.is_dm) return <MessageCircle className="w-4 h-4 text-emerald-400" />;
    if (chat.activeChannel.type === 'announcement_only') return <Megaphone className="w-4 h-4 text-amber-400" />;
    if (chat.activeChannel.type === 'internal_private') return <Lock className="w-4 h-4 text-zinc-500" />;
    return <Hash className="w-4 h-4 text-cyan-400" />;
  };

  if (chat.loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="spinner-tactical w-10 h-10 mx-auto mb-3" />
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">Loading Comms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex bg-zinc-950 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        w-72 lg:w-72 transition-transform duration-300
        border-r border-zinc-800/50
      `}>
        <ChatSidebar
          channels={chat.channels}
          inbox={chat.inbox}
          activeChannelId={chat.activeChannelId}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={chat.createChannel}
          onCreateDM={chat.createDM}
          allUsers={chat.allUsers}
          canManage={chat.canManage}
          className="h-full"
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/50 bg-zinc-900/40 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 lg:hidden transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {chat.activeChannel ? (
              <div className="flex items-center gap-2 min-w-0">
                {channelTypeIcon()}
                <h2 className="text-sm font-semibold text-zinc-200 truncate">{chat.activeChannel.name}</h2>
                {chat.activeChannel.description && (
                  <>
                    <div className="w-px h-4 bg-zinc-700 hidden sm:block" />
                    <span className="text-xs text-zinc-500 truncate hidden sm:block max-w-[200px]">
                      {chat.activeChannel.description}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm text-zinc-500">Select a channel</span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => chat.setSearchOpen(true)}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>
            {chat.activeChannel && (
              <>
                <button
                  onClick={() => setShowMembers(!showMembers)}
                  className={`p-2 rounded-lg transition-colors ${
                    showMembers ? 'text-orange-400 bg-orange-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title="Members"
                >
                  <Users className="w-4 h-4" />
                </button>
                {chat.canManage && !chat.activeChannel.is_dm && (
                  <button
                    onClick={handleDeleteChannel}
                    className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Messages + Thread row */}
        <div className="flex-1 flex overflow-hidden">
          {/* Messages column */}
          <div className="flex-1 flex flex-col min-w-0">
            <ChatMessages
              messages={chat.messages}
              loading={chat.messagesLoading}
              activeChannel={chat.activeChannel}
              userId={userId}
              canManage={chat.canManage}
              onReply={handleReply}
              onThreadOpen={chat.openThread}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReaction={chat.toggleReaction}
            />

            {chat.activeChannel && (
              <ChatComposer
                onSend={chat.sendMessage}
                onSendGif={chat.sendGif}
                onUpload={chat.uploadAttachment}
                onPostAnnouncement={chat.postAnnouncement}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                members={chat.members}
                canPost={chat.canPost}
                isAnnouncement={chat.activeChannel.type === 'announcement_only' && chat.canManage}
                placeholder={
                  chat.activeChannel.type === 'announcement_only'
                    ? (chat.canManage ? 'Post announcement...' : 'Only admins can post here')
                    : `Message #${chat.activeChannel.name}`
                }
              />
            )}
          </div>

          {/* Thread panel (right side) */}
          {chat.threadParentId && (
            <div className={`
              ${chat.threadParentId ? 'w-full sm:w-96' : 'w-0'}
              fixed sm:relative inset-0 sm:inset-auto z-40 sm:z-auto
              transition-all duration-200
            `}>
              <ChatThread
                parentMessage={chat.threadParent}
                replies={chat.threadMessages}
                onClose={chat.closeThread}
                onSendReply={chat.sendThreadReply}
                onReaction={chat.toggleReaction}
                userId={userId}
                canManage={chat.canManage}
              />
            </div>
          )}

          {/* Members panel */}
          {showMembers && !chat.threadParentId && chat.activeChannel && (
            <div className="w-64 border-l border-zinc-800/50 bg-zinc-900/30 overflow-y-auto hidden sm:block">
              <div className="p-3 border-b border-zinc-800/30">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Members ({chat.members.length})
                </h3>
              </div>
              <div className="py-1">
                {chat.members.map((m) => {
                  const memberId = m.user_id || m.user?.id;
                  const memberName = m.user_name || m.full_name || m.user?.full_name || 'Unknown';
                  const isMe = memberId === userId;
                  return (
                    <div key={memberId || m.id} className="flex items-center gap-2 px-3 py-1.5 group">
                      <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                        {memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 truncate">{memberName}{isMe ? ' (you)' : ''}</p>
                      </div>
                      <span className="text-[9px] font-mono text-zinc-600">{m.role}</span>
                      {chat.canManage && !isMe && (
                        <button
                          onClick={() => handleRemoveMember(memberId, memberName)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-600 hover:text-red-400 transition-all"
                          title={`Remove ${memberName}`}
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {chat.members.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center py-4">No members</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search overlay */}
      {chat.searchOpen && (
        <ChatSearch
          onSearch={chat.searchMessages}
          onClose={() => chat.setSearchOpen(false)}
          onNavigate={handleSearchNavigate}
          channels={chat.channels}
        />
      )}
    </div>
  );
};

export default ChatLayout;
