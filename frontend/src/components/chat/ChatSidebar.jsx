/**
 * ChatSidebar — Channel list grouped by type, DMs, unread counts, channel creation
 */

import React, { useState, useMemo } from 'react';
import {
  Hash, Lock, Megaphone, MessageCircle, Plus, Search, Users,
  ChevronDown, ChevronRight, X, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

const typeIcon = (channel) => {
  if (channel.is_dm) return <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />;
  if (channel.type === 'announcement_only') return <Megaphone className="w-3.5 h-3.5 text-amber-400" />;
  if (channel.type === 'internal_private') return <Lock className="w-3.5 h-3.5 text-zinc-500" />;
  return <Hash className="w-3.5 h-3.5 text-cyan-400" />;
};

const ChatSidebar = ({
  channels,
  inbox,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
  onCreateDM,
  allUsers,
  canManage,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDMModal, setShowDMModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('internal_public');
  const [creating, setCreating] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [dmSearch, setDmSearch] = useState('');

  // Build unread count map
  const unreadMap = useMemo(() => {
    const m = {};
    (inbox || []).forEach((item) => {
      if (item.channel?.id) m[item.channel.id] = item.unread_count || 0;
    });
    return m;
  }, [inbox]);

  // Group channels
  const grouped = useMemo(() => {
    const filtered = channels.filter((c) =>
      c.name?.toLowerCase().includes(query.toLowerCase().trim())
    );

    const groups = {
      announcements: { label: 'Announcements', items: [] },
      channels: { label: 'Channels', items: [] },
      dms: { label: 'Direct Messages', items: [] },
    };

    filtered.forEach((ch) => {
      if (ch.is_dm) groups.dms.items.push(ch);
      else if (ch.type === 'announcement_only') groups.announcements.items.push(ch);
      else groups.channels.items.push(ch);
    });

    return Object.entries(groups).filter(([, g]) => g.items.length > 0);
  }, [channels, query]);

  const toggleSection = (key) => {
    setCollapsedSections((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Enter a channel name'); return; }
    setCreating(true);
    const res = await onCreateChannel(newName.trim(), newType);
    if (res?.ok) {
      setShowCreateModal(false);
      setNewName('');
      toast.success('Channel created');
    } else {
      toast.error(res?.error || 'Failed to create channel');
    }
    setCreating(false);
  };

  const handleDM = async (userId) => {
    const res = await onCreateDM(userId);
    if (res?.ok) {
      setShowDMModal(false);
      setDmSearch('');
    } else {
      toast.error(res?.error || 'Failed to start DM');
    }
  };

  const filteredDMUsers = allUsers.filter((u) =>
    (u.full_name || u.email || '').toLowerCase().includes(dmSearch.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-zinc-900/60 ${className}`}>
      {/* Header */}
      <div className="p-3 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-zinc-200 font-tactical tracking-wide uppercase">Messages</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setShowDMModal(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="New DM"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            {canManage && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                title="New Channel"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-1">
        {grouped.map(([key, group]) => {
          const collapsed = collapsedSections[key];
          return (
            <div key={key} className="mb-1">
              <button
                onClick={() => toggleSection(key)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-mono font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
              >
                <span>{group.label}</span>
                {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {!collapsed && group.items.map((ch) => {
                const isActive = ch.id === activeChannelId;
                const unread = unreadMap[ch.id] || 0;
                return (
                  <button
                    key={ch.id}
                    onClick={() => onSelectChannel(ch.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                      isActive
                        ? 'bg-orange-500/10 text-orange-300'
                        : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                    }`}
                  >
                    {typeIcon(ch)}
                    <span className="text-sm truncate flex-1 font-medium">{ch.name}</span>
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white px-1">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {grouped.length === 0 && (
          <div className="px-4 py-8 text-center">
            <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500 font-mono">No channels found</p>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-200">New Channel</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Channel name"
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 mb-3"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-zinc-200 focus:outline-none focus:border-orange-500/40 mb-4"
            >
              <option value="internal_public">Public</option>
              <option value="internal_private">Private</option>
              <option value="announcement_only">Announcement</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Creating...' : 'Create Channel'}
            </button>
          </div>
        </div>
      )}

      {/* DM Modal */}
      {showDMModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowDMModal(false)}>
          <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-5 w-full max-w-sm mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-zinc-200">New Message</h3>
              <button onClick={() => setShowDMModal(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={dmSearch}
              onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700/50 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500/40 mb-3"
              autoFocus
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredDMUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleDM(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                    {(u.full_name || u.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{u.full_name || u.email}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{u.role}</p>
                  </div>
                </button>
              ))}
              {filteredDMUsers.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
