import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Users,
  Search,
  Plus,
  Megaphone,
  Hash,
  Lock,
  Paperclip,
  Image as ImageIcon,
  Reply,
  Pencil,
  Trash2,
  X,
  UserPlus,
  PhoneCall,
  FileText,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, API_URL } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CHANNEL_TYPES = [
  { value: 'internal_public', label: 'Internal Public' },
  { value: 'internal_private', label: 'Internal Private' },
  { value: 'announcement_only', label: 'Announcement Only' },
  { value: 'claim_internal', label: 'Claim Internal' },
];

const GIF_LIBRARY = [
  {
    id: 'thumbs-up',
    label: 'Thumbs Up',
    tags: ['approval', 'good', 'done'],
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    id: 'great-job',
    label: 'Great Job',
    tags: ['win', 'great', 'success'],
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
  },
  {
    id: 'celebrate',
    label: 'Celebrate',
    tags: ['celebrate', 'hype', 'team'],
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  },
  {
    id: 'on-it',
    label: 'On It',
    tags: ['working', 'confirm', 'roger'],
    url: 'https://media.giphy.com/media/l0HlvtIPzPdt2usKs/giphy.gif',
  },
  {
    id: 'wow',
    label: 'Wow',
    tags: ['wow', 'reaction', 'surprised'],
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  {
    id: 'let-go',
    label: "Let's Go",
    tags: ['go', 'push', 'energy'],
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  },
];

const typeIcon = (type) => {
  if (type === 'announcement_only') return <Megaphone className="w-3 h-3 text-amber-400" />;
  if (type === 'internal_private') return <Lock className="w-3 h-3 text-zinc-400" />;
  return <Hash className="w-3 h-3 text-cyan-400" />;
};

const attachmentKey = (file) =>
  `${file?.name || 'unknown'}__${file?.size || 0}__${file?.lastModified || 0}`;
const nowIso = () => new Date().toISOString();

const CommCenterChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const endRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchClaims, setSearchClaims] = useState('');

  const [inbox, setInbox] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [messages, setMessages] = useState([]);
  const [channelMembers, setChannelMembers] = useState([]);

  const [messageInput, setMessageInput] = useState('');
  const [gifUrlInput, setGifUrlInput] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [sending, setSending] = useState(false);
  const [runningTeamCopilot, setRunningTeamCopilot] = useState(false);
  const [teamCopilot, setTeamCopilot] = useState(null);
  const [teamCopilotIntent, setTeamCopilotIntent] = useState('status update');
  const [teamCopilotTone, setTeamCopilotTone] = useState('professional');
  const [sharingAttachmentId, setSharingAttachmentId] = useState('');
  const [copyingAttachmentId, setCopyingAttachmentId] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadQueueIndex, setUploadQueueIndex] = useState(0);
  const [uploadQueueTotal, setUploadQueueTotal] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [failedAttachments, setFailedAttachments] = useState([]);
  const [failedAttachmentErrors, setFailedAttachmentErrors] = useState({});
  const [pendingAttachmentPreviewUrl, setPendingAttachmentPreviewUrl] = useState('');
  const [dragOverUpload, setDragOverUpload] = useState(false);
  const [uploadActivity, setUploadActivity] = useState([]);
  const activeUploadXhrRef = useRef(null);
  const cancelUploadRequestedRef = useRef(false);
  const fileInputRef = useRef(null);

  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('internal_public');
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [addingMember, setAddingMember] = useState(false);

  const canManageChannels = user?.role === 'admin' || user?.role === 'manager';

  const selectedChannel = useMemo(
    () => channels.find((ch) => ch.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  const selectedInboxItem = useMemo(
    () => inbox.find((item) => item.channel?.id === selectedChannelId) || null,
    [inbox, selectedChannelId]
  );

  const canPostInSelected = useMemo(() => {
    if (!selectedChannel) return false;
    if (canManageChannels) return true;
    const membershipRole = selectedInboxItem?.membership?.role;
    if (selectedChannel.type === 'announcement_only') {
      return membershipRole === 'owner' || membershipRole === 'admin';
    }
    if (selectedChannel.posting_policy === 'admins_only') {
      return membershipRole === 'owner' || membershipRole === 'admin';
    }
    return Boolean(selectedInboxItem?.membership);
  }, [canManageChannels, selectedChannel, selectedInboxItem]);

  const canManageMessage = useCallback(
    (msg) => {
      if (!msg) return false;
      if (canManageChannels) return true;
      if (msg.sender_user_id === user?.id) return true;
      const membershipRole = selectedInboxItem?.membership?.role;
      return membershipRole === 'owner' || membershipRole === 'admin';
    },
    [canManageChannels, selectedInboxItem?.membership?.role, user?.id]
  );

  const loadClaims = useCallback(async () => {
    const res = await apiGet('/api/claims/');
    if (res.ok) {
      setClaims(res.data || []);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await apiGet('/api/users/');
    if (res.ok) {
      setUsers(res.data || []);
    } else {
      setUsers([]);
    }
  }, []);

  const loadInboxAndChannels = useCallback(async () => {
    const [inboxRes, channelsRes] = await Promise.all([
      apiGet('/api/comm/inbox', { cache: false }),
      apiGet('/api/comm/channels', { cache: false }),
    ]);

    if (!inboxRes.ok) {
      toast.error(inboxRes.error || 'Failed to load inbox');
      return;
    }
    if (!channelsRes.ok) {
      toast.error(channelsRes.error || 'Failed to load channels');
      return;
    }

    const nextInbox = inboxRes.data?.items || [];
    const nextChannels = channelsRes.data?.channels || [];

    setInbox(nextInbox);
    setChannels(nextChannels);

    if (!selectedChannelId && nextChannels.length > 0) {
      setSelectedChannelId(nextChannels[0].id);
    }
  }, [selectedChannelId]);

  const loadChannelMessages = useCallback(async (channelId) => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    const res = await apiGet(`/api/comm/channels/${channelId}/messages?limit=100`, {
      cache: false,
    });
    if (!res.ok) {
      toast.error(res.error || 'Failed to load channel messages');
      return;
    }
    setMessages(res.data?.messages || []);
    await apiPost(`/api/comm/channels/${channelId}/mark-read`, {});
  }, []);

  const loadChannelMembers = useCallback(async (channelId) => {
    if (!channelId) {
      setChannelMembers([]);
      return;
    }
    const res = await apiGet(`/api/comm/channels/${channelId}/members`, { cache: false });
    if (res.ok) {
      setChannelMembers(res.data?.members || []);
    } else {
      setChannelMembers([]);
    }
  }, []);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      await Promise.all([loadClaims(), loadUsers(), loadInboxAndChannels()]);
      setLoading(false);
    };
    boot();
  }, [loadClaims, loadUsers, loadInboxAndChannels]);

  useEffect(() => {
    loadChannelMessages(selectedChannelId);
    loadChannelMembers(selectedChannelId);
  }, [selectedChannelId, loadChannelMessages, loadChannelMembers]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (selectedChannelId) {
        loadChannelMessages(selectedChannelId);
        loadChannelMembers(selectedChannelId);
      }
      loadInboxAndChannels();
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedChannelId, loadChannelMessages, loadChannelMembers, loadInboxAndChannels]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('Channel name is required');
      return;
    }
    setCreatingChannel(true);
    const res = await apiPost('/api/comm/channels', {
      name: newChannelName.trim(),
      type: newChannelType,
      posting_policy: newChannelType === 'announcement_only' ? 'admins_only' : 'all_members',
    });
    setCreatingChannel(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to create channel');
      return;
    }

    setNewChannelName('');
    setNewChannelType('internal_public');
    await loadInboxAndChannels();
    const createdId = res.data?.channel?.id;
    if (createdId) setSelectedChannelId(createdId);
    toast.success('Channel created');
  };

  const handleAddMember = async () => {
    if (!selectedChannelId || !newMemberUserId) {
      toast.error('Select a user to add');
      return;
    }
    setAddingMember(true);
    const res = await apiPost(`/api/comm/channels/${selectedChannelId}/members`, {
      user_id: newMemberUserId,
      role: newMemberRole,
    });
    setAddingMember(false);
    if (!res.ok) {
      toast.error(res.error || 'Failed to add member');
      return;
    }
    setNewMemberUserId('');
    setNewMemberRole('member');
    await loadChannelMembers(selectedChannelId);
    toast.success('Member added');
  };

  const handleSendMessage = async () => {
    if (!selectedChannelId || !messageInput.trim()) return;
    setSending(true);
    const res = await apiPost(`/api/comm/channels/${selectedChannelId}/messages`, {
      body: messageInput.trim(),
      reply_to_message_id: replyToMessage?.id || null,
    });
    setSending(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to send message');
      return;
    }

    setMessageInput('');
    setReplyToMessage(null);
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
  };

  const handleSendGif = async () => {
    if (!selectedChannelId || !gifUrlInput.trim()) return;
    setSending(true);
    const res = await apiPost(`/api/comm/channels/${selectedChannelId}/messages/gif`, {
      gif_url: gifUrlInput.trim(),
      caption: messageInput.trim(),
      reply_to_message_id: replyToMessage?.id || null,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error || 'Failed to send GIF');
      return;
    }
    setGifUrlInput('');
    setMessageInput('');
    setReplyToMessage(null);
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
  };

  const stageAttachment = (file) => {
    if (!file) return false;
    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`${file.name || 'Attachment'} must be 15MB or less`);
      return false;
    }
    setPendingAttachments((prev) => {
      const exists = prev.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified
      );
      if (exists) return prev;
      return [...prev, file];
    });
    return true;
  };

  const stageAttachments = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setFailedAttachments([]);
    setFailedAttachmentErrors({});
    let accepted = 0;
    files.forEach((file) => {
      if (stageAttachment(file)) accepted += 1;
    });
    if (accepted > 0) {
      toast.success(`${accepted} file${accepted > 1 ? 's' : ''} staged. Click Send File.`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickAttachment = (event) => {
    stageAttachments(event.target.files);
  };

  const handleUploadDrop = (event) => {
    event.preventDefault();
    setDragOverUpload(false);
    stageAttachments(event.dataTransfer?.files);
  };

  const handleUploadDragOver = (event) => {
    event.preventDefault();
    setDragOverUpload(true);
  };

  const handleUploadDragLeave = () => {
    setDragOverUpload(false);
  };

  useEffect(() => {
    const firstAttachment = pendingAttachments[0];
    if (!firstAttachment) {
      setPendingAttachmentPreviewUrl('');
      return undefined;
    }
    if (!firstAttachment.type?.startsWith('image/')) {
      setPendingAttachmentPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(firstAttachment);
    setPendingAttachmentPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pendingAttachments]);

  const clearPendingAttachments = () => {
    setPendingAttachments([]);
    setFailedAttachments([]);
    setFailedAttachmentErrors({});
    setPendingAttachmentPreviewUrl('');
    setUploadProgress(0);
    setUploadQueueIndex(0);
    setUploadQueueTotal(0);
    setUploadingFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingAttachment = (indexToRemove) => {
    setPendingAttachments((prev) => {
      const removed = prev[indexToRemove];
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (removed) {
        const key = attachmentKey(removed);
        setFailedAttachmentErrors((prevErrors) => {
          const copy = { ...prevErrors };
          delete copy[key];
          return copy;
        });
      }
      if (next.length === 0) {
        setFailedAttachments([]);
        setFailedAttachmentErrors({});
      }
      return next;
    });
  };

  const pushUploadActivity = useCallback((type, text) => {
    setUploadActivity((prev) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, text, at: nowIso() },
        ...prev,
      ].slice(0, 8)
    );
  }, []);

  const uploadAttachmentWithProgress = (channelId, file) =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('upload', file);
      const xhr = new XMLHttpRequest();
      activeUploadXhrRef.current = xhr;
      xhr.open('POST', `${API_URL}/api/comm/channels/${channelId}/attachments`);
      xhr.withCredentials = true; // Send httpOnly cookies for authentication
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(true);
        } else {
          try {
            const payload = JSON.parse(xhr.responseText || '{}');
            reject(new Error(payload.detail || `Upload failed (${xhr.status})`));
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload canceled'));
      xhr.send(formData);
    });

  const handleCancelUpload = () => {
    cancelUploadRequestedRef.current = true;
    if (activeUploadXhrRef.current) {
      activeUploadXhrRef.current.abort();
    }
  };

  const handleUploadAttachment = async () => {
    if (!selectedChannelId || pendingAttachments.length === 0) return;
    const queue = [...pendingAttachments];
    const failed = [];
    const failedErrors = {};
    let uploadedCount = 0;
    cancelUploadRequestedRef.current = false;
    setFailedAttachments([]);
    setFailedAttachmentErrors({});
    setUploadingAttachment(true);
    setUploadQueueTotal(queue.length);
    for (let idx = 0; idx < queue.length; idx += 1) {
      const file = queue[idx];
      setUploadQueueIndex(idx + 1);
      setUploadingFileName(file.name);
      setUploadProgress(0);
      try {
        await uploadAttachmentWithProgress(selectedChannelId, file);
        uploadedCount += 1;
      } catch (error) {
        activeUploadXhrRef.current = null;
        if (cancelUploadRequestedRef.current) {
          const remaining = queue.slice(idx);
          setPendingAttachments(remaining);
          setFailedAttachmentErrors({});
          setUploadingAttachment(false);
          setUploadProgress(0);
          setUploadQueueIndex(0);
          setUploadQueueTotal(remaining.length);
          setUploadingFileName('');
          toast.info('Upload canceled. Remaining files are still queued.');
          pushUploadActivity('warning', 'Upload canceled. Remaining files kept in queue.');
          return;
        }
        failed.push(file);
        failedErrors[attachmentKey(file)] = error.message || 'Failed to upload attachment';
        toast.error(`${file.name}: ${failedErrors[attachmentKey(file)]}`);
        pushUploadActivity('error', `${file.name}: ${failedErrors[attachmentKey(file)]}`);
        continue;
      }
      activeUploadXhrRef.current = null;
    }
    setUploadingAttachment(false);
    setUploadProgress(0);
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
    if (failed.length > 0) {
      setPendingAttachments(failed);
      setFailedAttachments(failed);
      setFailedAttachmentErrors(failedErrors);
      if (uploadedCount > 0) {
        toast.info(`${uploadedCount} uploaded, ${failed.length} failed. Use Retry Failed.`);
        pushUploadActivity('warning', `${uploadedCount} uploaded, ${failed.length} failed.`);
      } else {
        toast.error(
          `${failed.length} attachment${failed.length > 1 ? 's' : ''} failed. Use Retry Failed.`
        );
        pushUploadActivity(
          'error',
          `${failed.length} upload${failed.length > 1 ? 's' : ''} failed.`
        );
      }
      return;
    }
    setFailedAttachmentErrors({});
    toast.success(`${uploadedCount} attachment${uploadedCount > 1 ? 's' : ''} uploaded`);
    pushUploadActivity(
      'success',
      `${uploadedCount} attachment${uploadedCount > 1 ? 's' : ''} uploaded.`
    );
    clearPendingAttachments();
  };

  const handlePostAnnouncement = async () => {
    if (!selectedChannelId || !announcementTitle.trim() || !announcementBody.trim()) {
      toast.error('Title and body are required');
      return;
    }

    setSending(true);
    const res = await apiPost(`/api/comm/channels/${selectedChannelId}/announcement`, {
      title: announcementTitle.trim(),
      body: announcementBody.trim(),
    });
    setSending(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to post announcement');
      return;
    }

    setAnnouncementTitle('');
    setAnnouncementBody('');
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
    toast.success('Announcement posted');
  };

  const handleAcknowledgeAnnouncement = async (messageId) => {
    if (!selectedChannelId || !messageId) return;
    const res = await apiPost(
      `/api/comm/channels/${selectedChannelId}/announcement/${messageId}/ack`,
      {}
    );
    if (!res.ok) {
      toast.error(res.error || 'Failed to acknowledge');
      return;
    }
    await loadChannelMessages(selectedChannelId);
  };

  const handleStartEdit = (msg) => {
    setEditingMessageId(msg.id);
    setEditingBody(msg.body || '');
  };

  const handleSaveEdit = async (messageId) => {
    if (!editingBody.trim()) {
      toast.error('Message cannot be empty');
      return;
    }
    const res = await apiPatch(`/api/comm/channels/${selectedChannelId}/messages/${messageId}`, {
      body: editingBody.trim(),
    });
    if (!res.ok) {
      toast.error(res.error || 'Failed to edit message');
      return;
    }
    setEditingMessageId('');
    setEditingBody('');
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
  };

  const handleRunTeamCopilot = async () => {
    if (!selectedChannelId || !selectedChannel) return;
    setRunningTeamCopilot(true);
    const mode = selectedChannel.type === 'announcement_only' ? 'announcement' : 'message';
    const recentMessages = messages.slice(-25).map((msg) => ({
      type: msg.type,
      sender_name: msg.sender_name || msg.sender_user_id || 'unknown',
      body: msg.body || '',
      created_at: msg.created_at || null,
    }));

    const res = await apiPost('/api/ai/comms/team-copilot', {
      channel_id: selectedChannelId,
      channel_name: selectedChannel.name,
      channel_type: selectedChannel.type,
      mode,
      intent: teamCopilotIntent,
      tone: teamCopilotTone,
      recent_messages: recentMessages,
    });
    setRunningTeamCopilot(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to run Team Copilot');
      return;
    }

    const output = res.data || {};
    setTeamCopilot(output);
    if (mode === 'announcement') {
      if (output.suggested_title) setAnnouncementTitle(output.suggested_title);
      if (output.suggested_body) setAnnouncementBody(output.suggested_body);
    } else if (output.suggested_body) {
      setMessageInput(output.suggested_body);
    }
    toast.success('Team Copilot ready');
  };

  const handleDeleteMessage = async (messageId) => {
    const res = await apiDelete(`/api/comm/channels/${selectedChannelId}/messages/${messageId}`);
    if (!res.ok) {
      toast.error(res.error || 'Failed to delete message');
      return;
    }
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
  };

  const filteredClaims = claims.filter((claim) => {
    const query = searchClaims.toLowerCase();
    return (
      (claim.claim_number || '').toLowerCase().includes(query) ||
      (claim.client_name || claim.insured_name || '').toLowerCase().includes(query) ||
      (claim.property_address || claim.loss_location || '').toLowerCase().includes(query)
    );
  });

  const filteredGifs = GIF_LIBRARY.filter((item) => {
    const query = gifSearch.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${item.label} ${item.tags.join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });

  const recentAttachments = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const msg of messages) {
      if (msg.type !== 'attachment' || !msg.attachment_id || msg.is_deleted) continue;
      if (seen.has(msg.attachment_id)) continue;
      seen.add(msg.attachment_id);
      list.push({
        id: msg.attachment_id,
        name: msg.attachment_name || msg.body || 'Attachment',
        sender: msg.sender_name || 'Unknown',
        createdAt: msg.created_at,
      });
    }
    return list.reverse().slice(0, 6);
  }, [messages]);

  const handleShareAttachmentLink = async (attachment) => {
    if (!selectedChannelId || !attachment?.id) return;
    setSharingAttachmentId(attachment.id);
    const url = `${API_URL}/api/comm/uploads/${attachment.id}`;
    const res = await apiPost(`/api/comm/channels/${selectedChannelId}/messages`, {
      body: `Shared file: ${attachment.name}\n${url}`,
      reply_to_message_id: replyToMessage?.id || null,
    });
    setSharingAttachmentId('');
    if (!res.ok) {
      toast.error(res.error || 'Failed to share file link');
      return;
    }
    toast.success('File link shared');
    pushUploadActivity('info', `Shared link in channel: ${attachment.name}`);
    await Promise.all([loadChannelMessages(selectedChannelId), loadInboxAndChannels()]);
  };

  const handleCopyAttachmentLink = async (attachment) => {
    if (!attachment?.id) return;
    const url = `${API_URL}/api/comm/uploads/${attachment.id}`;
    setCopyingAttachmentId(attachment.id);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const tempInput = document.createElement('textarea');
        tempInput.value = url;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }
      toast.success('Attachment link copied');
      pushUploadActivity('info', `Copied link: ${attachment.name}`);
    } catch {
      toast.error('Failed to copy link');
    } finally {
      setCopyingAttachmentId('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="spinner-tactical w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 page-enter">
      <div className="lg:col-span-3 card-tactical p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">Inbox</h2>
          </div>
        </div>

        {canManageChannels && (
          <div className="border border-zinc-700/50 rounded-lg p-3 space-y-2 bg-zinc-900/40">
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Create Channel</div>
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="input-tactical w-full px-3 py-2 text-sm"
              placeholder="Channel name"
            />
            <select
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value)}
              className="input-tactical w-full px-3 py-2 text-sm"
            >
              {CHANNEL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleCreateChannel}
              disabled={creatingChannel}
              className="btn-tactical w-full px-3 py-2 text-xs flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> {creatingChannel ? 'Creating...' : 'Create'}
            </button>
          </div>
        )}

        <div className="max-h-[520px] overflow-y-auto space-y-2">
          {inbox.length === 0 ? (
            <p className="text-xs text-zinc-500">No channels yet.</p>
          ) : (
            inbox.map((item) => {
              const ch = item.channel || {};
              const active = selectedChannelId === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all ${active ? 'border-orange-500/60 bg-zinc-800/60' : 'border-zinc-700/40 bg-zinc-900/30 hover:border-orange-500/40'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {typeIcon(ch.type)}
                      <span className="text-sm text-zinc-200 truncate">{ch.name || 'Unnamed'}</span>
                    </div>
                    {(item.unread_count || 0) > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                        {item.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1 truncate">
                    {item.last_message?.type === 'announcement' ? '[Announcement] ' : ''}
                    {item.last_message?.body || 'No messages yet'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="lg:col-span-6 card-tactical p-4 flex flex-col min-h-[620px]">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-orange-400" />
          <h1 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
            {selectedChannel ? selectedChannel.name : 'Select a Channel'}
          </h1>
          {selectedChannel?.type === 'announcement_only' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 uppercase tracking-wide">
              Announcement Only
            </span>
          )}
        </div>
        <div className="mb-3 rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
            Comms Quick Start
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-[10px] px-2 py-1 rounded border border-cyan-500/30 text-cyan-300">
              Text Chat
            </span>
            <span className="text-[10px] px-2 py-1 rounded border border-fuchsia-500/30 text-fuchsia-300 inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> GIF
            </span>
            <span className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-300 inline-flex items-center gap-1">
              <FileText className="w-3 h-3" /> File Upload
            </span>
            <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 text-emerald-300 inline-flex items-center gap-1">
              <PhoneCall className="w-3 h-3" /> Voice + SMS
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            1) Choose an inbox channel for team chat. 2) Use message, GIF URL, or attachment actions
            below. 3) For client voice and SMS, open a Client Thread from the right panel.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-900/40 border border-zinc-700/40 rounded-lg p-3 space-y-3">
          {!selectedChannel ? (
            <p className="text-sm text-zinc-500">Select a channel from inbox.</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages yet.</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono">
                  {msg.sender_name || msg.sender_user_id || 'system'}
                </span>
                <div
                  className={`border rounded-lg p-2 text-sm ${msg.type === 'announcement' ? 'bg-amber-500/10 border-amber-500/30 text-amber-100' : 'bg-zinc-800/70 border-zinc-700/40 text-zinc-200'}`}
                >
                  {msg.reply_to_message && (
                    <div className="mb-2 text-[10px] px-2 py-1 rounded border border-zinc-600/40 bg-zinc-900/40">
                      Replying to {msg.reply_to_message.sender_name}: {msg.reply_to_message.body}
                    </div>
                  )}
                  {msg.type === 'announcement' && msg.title && (
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1">
                      {msg.title}
                    </div>
                  )}
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2">
                      <input
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="input-tactical w-full px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          className="btn-tactical px-2 py-1 text-xs"
                          onClick={() => handleSaveEdit(msg.id)}
                        >
                          Save
                        </button>
                        <button
                          className="btn-tactical px-2 py-1 text-xs"
                          onClick={() => {
                            setEditingMessageId('');
                            setEditingBody('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : msg.type === 'gif' ? (
                    <div className="space-y-2">
                      {msg.body ? <div>{msg.body}</div> : null}
                      <img
                        src={msg.gif_url}
                        alt="GIF"
                        className="max-h-56 rounded border border-zinc-700/50"
                        loading="lazy"
                      />
                    </div>
                  ) : msg.type === 'attachment' ? (
                    <a
                      href={`${API_URL}/api/comm/uploads/${msg.attachment_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 underline"
                    >
                      <Paperclip className="w-3 h-3" />
                      {msg.attachment_name || msg.body || 'Attachment'}
                    </a>
                  ) : (
                    msg.body
                  )}
                  {msg.is_edited && !msg.is_deleted && (
                    <div className="mt-1 text-[10px] text-zinc-400">(edited)</div>
                  )}
                  {msg.type === 'announcement' && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-200/80">
                        Acked by {msg.ack_count || 0}
                      </span>
                      {!msg.acked_by_me ? (
                        <button
                          onClick={() => handleAcknowledgeAnnouncement(msg.id)}
                          className="text-[10px] px-2 py-0.5 rounded border border-amber-300/30 hover:border-amber-200/60"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          Acknowledged
                        </span>
                      )}
                    </div>
                  )}
                  {!msg.is_deleted && msg.type !== 'announcement' && (
                    <div className="mt-2 flex items-center gap-2 text-[10px]">
                      <button
                        onClick={() =>
                          setReplyToMessage({
                            id: msg.id,
                            sender_name: msg.sender_name || 'Unknown',
                            body: msg.body || '',
                          })
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-600/40 hover:border-zinc-500/70"
                      >
                        <Reply className="w-3 h-3" />
                        Reply
                      </button>
                      {canManageMessage(msg) && (
                        <>
                          {(msg.type === 'message' || msg.type === 'gif') && (
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-600/40 hover:border-zinc-500/70"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-600/40 text-red-300 hover:border-red-500/70"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 font-mono">
                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ''}
                </span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {selectedChannel && (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <input
                  value={teamCopilotIntent}
                  onChange={(e) => setTeamCopilotIntent(e.target.value)}
                  className="input-tactical md:col-span-2 px-3 py-2 text-xs"
                  placeholder="Copilot intent (status update, blockers, handoff...)"
                />
                <select
                  value={teamCopilotTone}
                  onChange={(e) => setTeamCopilotTone(e.target.value)}
                  className="input-tactical px-3 py-2 text-xs"
                >
                  <option value="professional">Professional</option>
                  <option value="firm">Firm</option>
                  <option value="direct">Direct</option>
                  <option value="friendly">Friendly</option>
                </select>
                <button
                  onClick={handleRunTeamCopilot}
                  disabled={runningTeamCopilot || !canPostInSelected}
                  className="btn-tactical px-3 py-2 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  data-testid="team-copilot-btn"
                >
                  {runningTeamCopilot ? (
                    'Thinking...'
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" /> Team Copilot
                    </>
                  )}
                </button>
              </div>
              {teamCopilot && (
                <div
                  className="rounded border border-violet-500/20 bg-zinc-900/50 p-2 text-xs space-y-1"
                  data-testid="team-copilot-panel"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="uppercase tracking-wide text-[10px] text-violet-300">Copilot</p>
                    <p className="text-[10px] text-zinc-500">
                      {teamCopilot.provider || 'unknown'} / {teamCopilot.model || 'unknown'} /{' '}
                      {teamCopilot.confidence || 'medium'}
                    </p>
                  </div>
                  <p className="text-zinc-300">{teamCopilot.summary}</p>
                  <p className="text-zinc-400">Next: {teamCopilot.next_action}</p>
                </div>
              )}
            </div>
            {selectedChannel.type === 'announcement_only' ? (
              canPostInSelected ? (
                <>
                  <input
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="input-tactical w-full px-3 py-2 text-sm"
                    placeholder="Announcement title"
                  />
                  <textarea
                    value={announcementBody}
                    onChange={(e) => setAnnouncementBody(e.target.value)}
                    className="input-tactical w-full px-3 py-2 text-sm min-h-[90px]"
                    placeholder="Write announcement..."
                  />
                  <button
                    onClick={handlePostAnnouncement}
                    disabled={sending}
                    className="btn-tactical px-4 py-2 text-sm"
                  >
                    {sending ? 'Posting...' : 'Post Announcement'}
                  </button>
                </>
              ) : (
                <p className="text-xs text-zinc-500">
                  Read-only channel. Only admins can post announcements.
                </p>
              )
            ) : canPostInSelected ? (
              <div className="space-y-2">
                {replyToMessage && (
                  <div className="text-xs rounded border border-zinc-700/50 bg-zinc-900/50 p-2 flex items-center justify-between">
                    <span>
                      Replying to {replyToMessage.sender_name}: {replyToMessage.body}
                    </span>
                    <button
                      className="inline-flex items-center gap-1"
                      onClick={() => setReplyToMessage(null)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="input-tactical flex-1 px-3 py-2 text-sm"
                    placeholder="Type a message..."
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending}
                    className="btn-tactical px-4 py-2 text-sm"
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
                <div
                  className={`rounded-lg border p-2 transition-all ${dragOverUpload ? 'border-cyan-400/60 bg-cyan-500/10' : 'border-zinc-700/40 bg-zinc-900/20'}`}
                  onDrop={handleUploadDrop}
                  onDragOver={handleUploadDragOver}
                  onDragLeave={handleUploadDragLeave}
                >
                  <div className="flex gap-2 items-center">
                    <input
                      value={gifUrlInput}
                      onChange={(e) => setGifUrlInput(e.target.value)}
                      className="input-tactical flex-1 px-3 py-2 text-xs"
                      placeholder="Paste GIF URL (giphy/tenor direct URL)"
                    />
                    <button
                      onClick={handleSendGif}
                      disabled={sending || !gifUrlInput.trim()}
                      className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3" />
                      GIF
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xlsx,.csv,.txt"
                      className="hidden"
                      onChange={handlePickAttachment}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      {pendingAttachments.length > 0 ? 'Add Files' : 'Attach'}
                    </button>
                    <button
                      onClick={handleUploadAttachment}
                      disabled={uploadingAttachment || pendingAttachments.length === 0}
                      className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1"
                    >
                      <Paperclip className="w-3 h-3" />
                      {uploadingAttachment
                        ? `Uploading ${uploadProgress}%`
                        : `Send File${pendingAttachments.length > 1 ? 's' : ''}`}
                    </button>
                    {!uploadingAttachment && failedAttachments.length > 0 && (
                      <button
                        onClick={handleUploadAttachment}
                        className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1 border-amber-500/50 text-amber-300 hover:border-amber-400/80"
                      >
                        Retry Failed ({failedAttachments.length})
                      </button>
                    )}
                    {uploadingAttachment && (
                      <button
                        onClick={handleCancelUpload}
                        className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1 border-red-600/50 text-red-300 hover:border-red-500/80"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-500">
                    Drop file(s) here or use Attach. Then click Send File.
                  </p>
                  {failedAttachments.length > 0 && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      {failedAttachments.length} file{failedAttachments.length > 1 ? 's' : ''}{' '}
                      failed in last run. Retry uses only failed files.
                    </p>
                  )}
                </div>
                {pendingAttachments.length > 0 && (
                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-2 text-[10px] text-zinc-400">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="truncate">
                        Ready to upload: {pendingAttachments.length} file
                        {pendingAttachments.length > 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={clearPendingAttachments}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="max-h-20 overflow-y-auto space-y-1">
                      {pendingAttachments.map((file, index) => (
                        <div
                          key={`${file.name}-${file.size}-${index}`}
                          className="flex items-center justify-between gap-2 rounded border border-zinc-700/40 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="truncate">
                              {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                            </div>
                            {failedAttachmentErrors[attachmentKey(file)] && (
                              <div className="truncate text-[10px] text-red-300">
                                {failedAttachmentErrors[attachmentKey(file)]}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removePendingAttachment(index)}
                            disabled={uploadingAttachment}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {pendingAttachmentPreviewUrl && (
                      <img
                        src={pendingAttachmentPreviewUrl}
                        alt="First attachment preview"
                        className="mt-2 h-16 w-16 object-cover rounded border border-zinc-700/60"
                      />
                    )}
                    {uploadingAttachment && (
                      <div className="mt-2">
                        <div className="h-1.5 w-full rounded bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 transition-all duration-150"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          Uploading {uploadQueueIndex}/{uploadQueueTotal}: {uploadingFileName} (
                          {uploadProgress}%)
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 p-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                      GIF Picker
                    </span>
                    <input
                      value={gifSearch}
                      onChange={(e) => setGifSearch(e.target.value)}
                      placeholder="Search quick GIFs..."
                      className="input-tactical px-2 py-1 text-[10px] w-40"
                    />
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {filteredGifs.slice(0, 12).map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        onClick={() => setGifUrlInput(gif.url)}
                        className={`relative overflow-hidden rounded border transition-all ${gifUrlInput === gif.url ? 'border-cyan-400/60' : 'border-zinc-700/60 hover:border-cyan-400/40'}`}
                        title={gif.label}
                      >
                        <img
                          src={gif.url}
                          alt={gif.label}
                          className="h-14 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-500">
                  Pick from GIF library or paste a direct GIF URL. Choose a file, review it, then
                  click Send File (15MB max).
                </div>
                {recentAttachments.length > 0 && (
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">
                      Recent Attachments
                    </div>
                    <div className="space-y-1">
                      {recentAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-2 rounded border border-zinc-700/40 px-2 py-1"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-[11px] text-zinc-300">
                              {attachment.name}
                            </div>
                            <div className="truncate text-[10px] text-zinc-500">
                              {attachment.sender}{' '}
                              {attachment.createdAt
                                ? `- ${new Date(attachment.createdAt).toLocaleString()}`
                                : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={`${API_URL}/api/comm/uploads/${attachment.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-tactical px-2 py-1 text-[10px]"
                            >
                              Open
                            </a>
                            <button
                              onClick={() => handleCopyAttachmentLink(attachment)}
                              disabled={copyingAttachmentId === attachment.id}
                              className="btn-tactical px-2 py-1 text-[10px]"
                            >
                              {copyingAttachmentId === attachment.id ? 'Copying...' : 'Copy Link'}
                            </button>
                            <button
                              onClick={() => handleShareAttachmentLink(attachment)}
                              disabled={sharingAttachmentId === attachment.id}
                              className="btn-tactical px-2 py-1 text-[10px]"
                            >
                              {sharingAttachmentId === attachment.id ? 'Sharing...' : 'Share Link'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {uploadActivity.length > 0 && (
                  <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/40 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">
                      Upload Activity
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {uploadActivity.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-[10px] border border-zinc-700/30 rounded px-2 py-1"
                        >
                          <span
                            className={`truncate ${
                              item.type === 'error'
                                ? 'text-red-300'
                                : item.type === 'warning'
                                  ? 'text-amber-300'
                                  : item.type === 'success'
                                    ? 'text-emerald-300'
                                    : 'text-zinc-300'
                            }`}
                          >
                            {item.text}
                          </span>
                          <span className="text-zinc-500 shrink-0">
                            {new Date(item.at).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                You do not have posting permissions in this channel.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-3 card-tactical p-4">
        <div className="mb-4 pb-4 border-b border-zinc-700/40">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
              Channel Members
            </h2>
          </div>
          {!selectedChannel ? (
            <p className="text-xs text-zinc-500">Select a channel to view members.</p>
          ) : (
            <div className="space-y-2">
              {canManageChannels && (
                <div className="space-y-2 border border-zinc-700/40 rounded-lg p-2 bg-zinc-900/40">
                  <select
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    className="input-tactical w-full px-2 py-2 text-xs"
                  >
                    <option value="">Select user...</option>
                    {users
                      .filter((u) => !channelMembers.some((m) => m.user_id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || u.email} ({u.role})
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="input-tactical flex-1 px-2 py-2 text-xs"
                    >
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={handleAddMember}
                      disabled={addingMember || !newMemberUserId}
                      className="btn-tactical px-3 py-2 text-xs inline-flex items-center gap-1"
                    >
                      <UserPlus className="w-3 h-3" />
                      {addingMember ? 'Adding...' : 'Add'}
                    </button>
                  </div>
                </div>
              )}
              <div className="max-h-40 overflow-y-auto space-y-1">
                {channelMembers.length === 0 ? (
                  <p className="text-xs text-zinc-500">No members found.</p>
                ) : (
                  channelMembers.map((m) => (
                    <div
                      key={m.id}
                      className="text-xs p-2 rounded border border-zinc-700/40 bg-zinc-900/30"
                    >
                      <div className="text-zinc-200">
                        {m.user?.full_name || m.user?.email || m.user_id}
                      </div>
                      <div className="text-zinc-500 uppercase">{m.role}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
            Client Threads
          </h2>
        </div>
        <p className="text-[11px] text-zinc-500 mb-2">
          Open a claim thread for client SMS history and voice call actions.
        </p>
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchClaims}
            onChange={(e) => setSearchClaims(e.target.value)}
            className="input-tactical w-full pl-9 pr-3 py-2 text-sm"
            placeholder="Search claims..."
          />
        </div>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {filteredClaims.slice(0, 30).map((claim) => (
            <button
              key={claim.id}
              onClick={() => navigate(`/comms/claim/${claim.id}`)}
              className="w-full text-left p-2 rounded-lg border border-zinc-700/40 bg-zinc-900/40 hover:border-orange-500/40 transition-all"
            >
              <div className="text-sm text-zinc-200 truncate">
                {claim.client_name || claim.insured_name || 'Unknown'}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono truncate">
                {claim.claim_number ? `#${claim.claim_number}` : 'No claim #'} -{' '}
                {claim.property_address || claim.loss_location || 'No address'}
              </div>
            </button>
          ))}
          {filteredClaims.length === 0 && (
            <p className="text-xs text-zinc-500">No matching claims.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommCenterChat;
