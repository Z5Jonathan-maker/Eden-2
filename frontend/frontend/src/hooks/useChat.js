/**
 * useChat — Central chat state hook
 *
 * Manages channels, messages, WebSocket real-time delivery,
 * polling fallback, unread counts, and all chat API calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, assertApiUrl, getAuthToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const POLL_INTERVAL = 15_000;

export default function useChat(initialChannelId = null) {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────
  const [channels, setChannels] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState(initialChannelId);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Thread
  const [threadParentId, setThreadParentId] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadParent, setThreadParent] = useState(null);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);

  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const skipNextPollRef = useRef(false);

  // ── Derived ────────────────────────────────────────────────────
  const activeChannel = channels.find((c) => c.id === activeChannelId) || null;
  const activeInboxItem = inbox.find((i) => i.channel?.id === activeChannelId) || null;

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  const canPost = (() => {
    if (!activeChannel) return false;
    if (canManage) return true;
    const role = activeInboxItem?.membership?.role;
    if (activeChannel.type === 'announcement_only') return role === 'owner' || role === 'admin';
    if (activeChannel.posting_policy === 'admins_only') return role === 'owner' || role === 'admin';
    return Boolean(activeInboxItem?.membership);
  })();

  const totalUnread = inbox.reduce((sum, item) => sum + (item.unread_count || 0), 0);

  // ── Loaders ────────────────────────────────────────────────────
  const loadInboxAndChannels = useCallback(async () => {
    const [inboxRes, channelsRes] = await Promise.all([
      apiGet('/api/comm/inbox', { cache: false }),
      apiGet('/api/comm/channels', { cache: false }),
    ]);
    if (inboxRes.ok) setInbox(inboxRes.data?.items || []);
    if (channelsRes.ok) setChannels(channelsRes.data?.channels || []);
  }, []);

  const loadMessages = useCallback(async (channelId) => {
    if (!channelId) { setMessages([]); return; }
    setMessagesLoading(true);
    const res = await apiGet(`/api/comm/channels/${channelId}/messages?limit=100`, { cache: false });
    if (res.ok) setMessages(res.data?.messages || []);
    setMessagesLoading(false);
    // mark read
    apiPost(`/api/comm/channels/${channelId}/mark-read`, {});
  }, []);

  const loadMembers = useCallback(async (channelId) => {
    if (!channelId) { setMembers([]); return; }
    const res = await apiGet(`/api/comm/channels/${channelId}/members`, { cache: false });
    if (res.ok) setMembers(res.data?.members || []);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await apiGet('/api/users/');
    if (res.ok) setAllUsers(res.data || []);
  }, []);

  // ── Initial boot ───────────────────────────────────────────────
  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      await Promise.all([loadInboxAndChannels(), loadUsers()]);
      setLoading(false);
    };
    boot();
  }, [loadInboxAndChannels, loadUsers]);

  // ── Channel selection ──────────────────────────────────────────
  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
      loadMembers(activeChannelId);
      setThreadParentId(null);
    }
  }, [activeChannelId, loadMessages, loadMembers]);

  // Auto-select first channel if none selected
  useEffect(() => {
    if (!activeChannelId && channels.length > 0 && !loading) {
      setActiveChannelId(channels[0].id);
    }
  }, [activeChannelId, channels, loading]);

  // ── WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const apiUrl = assertApiUrl();
    const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = apiUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/ws/notifications?token=${token}`;

    let ws;
    let reconnectTimer;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'chat_message') {
              const msg = data.data?.message;
              const chId = data.data?.channel_id;
              if (!msg || !chId) return;

              skipNextPollRef.current = true;

              if (chId === activeChannelId) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
              }
              // Refresh inbox for unread counts
              loadInboxAndChannels();
            }

            if (data.type === 'chat_reaction') {
              const { message_id, reactions } = data.data || {};
              if (!message_id) return;
              setMessages((prev) =>
                prev.map((m) => (m.id === message_id ? { ...m, reactions } : m))
              );
              // Also update thread messages if viewing thread
              setThreadMessages((prev) =>
                prev.map((m) => (m.id === message_id ? { ...m, reactions } : m))
              );
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          wsRef.current = null;
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [activeChannelId, loadInboxAndChannels]);

  // ── Polling fallback ───────────────────────────────────────────
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (skipNextPollRef.current) {
        skipNextPollRef.current = false;
        return;
      }
      if (activeChannelId) loadMessages(activeChannelId);
      loadInboxAndChannels();
    }, POLL_INTERVAL);

    return () => clearInterval(pollRef.current);
  }, [activeChannelId, loadMessages, loadInboxAndChannels]);

  // ── Actions ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (body, replyToId = null) => {
    if (!activeChannelId || !body.trim()) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/messages`, {
      body: body.trim(),
      reply_to_message_id: replyToId,
    });
    if (res.ok && res.data?.message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.message.id)) return prev;
        return [...prev, res.data.message];
      });
    }
    return res;
  }, [activeChannelId]);

  const sendGif = useCallback(async (gifUrl, caption = '', replyToId = null) => {
    if (!activeChannelId) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/messages/gif`, {
      gif_url: gifUrl,
      caption,
      reply_to_message_id: replyToId,
    });
    if (res.ok && res.data?.message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.message.id)) return prev;
        return [...prev, res.data.message];
      });
    }
    return res;
  }, [activeChannelId]);

  const uploadAttachment = useCallback(async (file) => {
    if (!activeChannelId || !file) return null;
    const formData = new FormData();
    formData.append('upload', file);
    const res = await apiUpload(`/api/comm/channels/${activeChannelId}/attachments`, formData);
    if (res.ok && res.data?.message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === res.data.message.id)) return prev;
        return [...prev, res.data.message];
      });
    }
    return res;
  }, [activeChannelId]);

  const editMessage = useCallback(async (messageId, body) => {
    if (!activeChannelId) return null;
    const res = await apiPatch(`/api/comm/channels/${activeChannelId}/messages/${messageId}`, { body });
    if (res.ok) {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, body, is_edited: true } : m));
    }
    return res;
  }, [activeChannelId]);

  const deleteMessage = useCallback(async (messageId) => {
    if (!activeChannelId) return null;
    const res = await apiDelete(`/api/comm/channels/${activeChannelId}/messages/${messageId}`);
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
    return res;
  }, [activeChannelId]);

  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!activeChannelId) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/messages/${messageId}/reactions`, { emoji });
    if (res.ok) {
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, reactions: res.data.reactions } : m)
      );
    }
    return res;
  }, [activeChannelId]);

  const createChannel = useCallback(async (name, type, memberIds = []) => {
    const res = await apiPost('/api/comm/channels', {
      name,
      type,
      member_user_ids: memberIds,
    });
    if (res.ok) {
      await loadInboxAndChannels();
      if (res.data?.channel?.id) setActiveChannelId(res.data.channel.id);
    }
    return res;
  }, [loadInboxAndChannels]);

  const deleteChannel = useCallback(async (channelId) => {
    const id = channelId || activeChannelId;
    if (!id) return null;
    const res = await apiDelete(`/api/comm/channels/${id}`);
    if (res.ok) {
      if (id === activeChannelId) setActiveChannelId(null);
      await loadInboxAndChannels();
    }
    return res;
  }, [activeChannelId, loadInboxAndChannels]);

  const createDM = useCallback(async (targetUserId) => {
    const res = await apiPost('/api/comm/dm', { user_id: targetUserId });
    if (res.ok) {
      await loadInboxAndChannels();
      if (res.data?.channel?.id) setActiveChannelId(res.data.channel.id);
    }
    return res;
  }, [loadInboxAndChannels]);

  const addMember = useCallback(async (userId, role = 'member') => {
    if (!activeChannelId) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/members`, {
      user_id: userId,
      role,
    });
    if (res.ok) loadMembers(activeChannelId);
    return res;
  }, [activeChannelId, loadMembers]);

  const removeMember = useCallback(async (userId) => {
    if (!activeChannelId) return null;
    const res = await apiDelete(`/api/comm/channels/${activeChannelId}/members/${userId}`);
    if (res.ok) loadMembers(activeChannelId);
    return res;
  }, [activeChannelId, loadMembers]);

  const postAnnouncement = useCallback(async (title, body) => {
    if (!activeChannelId) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/announcement`, { title, body });
    if (res.ok) loadMessages(activeChannelId);
    return res;
  }, [activeChannelId, loadMessages]);

  const ackAnnouncement = useCallback(async (messageId) => {
    if (!activeChannelId) return null;
    return apiPost(`/api/comm/channels/${activeChannelId}/announcement/${messageId}/ack`, {});
  }, [activeChannelId]);

  // ── Threads ────────────────────────────────────────────────────
  const openThread = useCallback(async (messageId) => {
    if (!activeChannelId) return;
    setThreadParentId(messageId);
    const res = await apiGet(`/api/comm/channels/${activeChannelId}/messages/${messageId}/thread`);
    if (res.ok) {
      setThreadParent(res.data.parent || null);
      setThreadMessages(res.data.replies || []);
    }
  }, [activeChannelId]);

  const closeThread = useCallback(() => {
    setThreadParentId(null);
    setThreadMessages([]);
    setThreadParent(null);
  }, []);

  const sendThreadReply = useCallback(async (body) => {
    if (!activeChannelId || !threadParentId || !body.trim()) return null;
    const res = await apiPost(`/api/comm/channels/${activeChannelId}/messages`, {
      body: body.trim(),
      reply_to_message_id: threadParentId,
    });
    if (res.ok && res.data?.message) {
      setThreadMessages((prev) => [...prev, res.data.message]);
      // Update reply count indicator in main messages
      setMessages((prev) =>
        prev.map((m) =>
          m.id === threadParentId
            ? { ...m, reply_count: (m.reply_count || 0) + 1 }
            : m
        )
      );
    }
    return res;
  }, [activeChannelId, threadParentId]);

  // ── Search ─────────────────────────────────────────────────────
  const searchMessages = useCallback(async (params) => {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.channelId) query.set('channel_id', params.channelId);
    if (params.sender) query.set('sender', params.sender);
    if (params.hasFile) query.set('has_file', 'true');
    if (params.fromDate) query.set('from_date', params.fromDate);
    if (params.toDate) query.set('to_date', params.toDate);
    return apiGet(`/api/comm/search?${query.toString()}`, { cache: false });
  }, []);

  return {
    // State
    channels,
    inbox,
    activeChannelId,
    activeChannel,
    activeInboxItem,
    messages,
    members,
    allUsers,
    loading,
    messagesLoading,
    canManage,
    canPost,
    totalUnread,

    // Thread
    threadParentId,
    threadMessages,
    threadParent,

    // Search
    searchOpen,
    setSearchOpen,

    // Actions
    setActiveChannelId,
    sendMessage,
    sendGif,
    uploadAttachment,
    editMessage,
    deleteMessage,
    toggleReaction,
    createChannel,
    deleteChannel,
    createDM,
    addMember,
    removeMember,
    postAnnouncement,
    ackAnnouncement,
    openThread,
    closeThread,
    sendThreadReply,
    searchMessages,
    refreshMessages: () => loadMessages(activeChannelId),
    refreshInbox: loadInboxAndChannels,
  };
}
