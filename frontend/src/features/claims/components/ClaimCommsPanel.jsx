/**
 * ClaimCommsPanel - SMS Communication Panel for Claims
 *
 * A chat-style interface for viewing and sending SMS messages for a claim.
 * Features:
 * - Chronological message display (chat-style)
 * - Outbound message aligned right (Eden → Client)
 * - Inbound message aligned left (Client → Eden)
 * - Status indicators (sent, delivered, failed, received)
 * - Template selector for common messages
 * - Auto-scroll to latest message
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Textarea } from '../../../shared/ui/textarea';
import { Badge } from '../../../shared/ui/badge';
import {
  Send,
  MessageSquare,
  Loader2,
  ChevronDown,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, API_URL } from '@/lib/api';
const COMMS_PREFS_KEY = 'eden_comms_followup_prefs';

// Status badge colors
const STATUS_COLORS = {
  queued: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  received: 'bg-purple-100 text-purple-700',
};

// Status icons
const STATUS_ICONS = {
  queued: Clock,
  sent: CheckCircle2,
  delivered: CheckCircle2,
  failed: XCircle,
  received: MessageSquare,
};

const ClaimCommsPanel = ({
  claimId,
  clientPhone,
  clientName,
  claimReadiness = null,
  prefillDraft = null,
  onPrefillConsumed = null,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [smsBody, setSmsBody] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(clientPhone || '');
  const [templates, setTemplates] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null);
  const [draftIntent, setDraftIntent] = useState('status update');
  const [draftTone, setDraftTone] = useState('professional');
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [summarizingThread, setSummarizingThread] = useState(false);
  const [threadSummary, setThreadSummary] = useState('');
  const [generatingFollowupSuggestion, setGeneratingFollowupSuggestion] = useState(false);
  const [generatingCommsCopilot, setGeneratingCommsCopilot] = useState(false);
  const [commsCopilot, setCommsCopilot] = useState(null);
  const [smsBodyIsAIDraft, setSmsBodyIsAIDraft] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [createFollowupNote, setCreateFollowupNote] = useState(true);
  const [followupWindow, setFollowupWindow] = useState('24h');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMMS_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.createFollowupNote === 'boolean') {
        setCreateFollowupNote(parsed.createFollowupNote);
      }
      if (
        parsed.followupWindow === '24h' ||
        parsed.followupWindow === '72h' ||
        parsed.followupWindow === '7d'
      ) {
        setFollowupWindow(parsed.followupWindow);
      }
    } catch (_err) {
      // Ignore invalid local storage data.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COMMS_PREFS_KEY, JSON.stringify({ createFollowupNote, followupWindow }));
  }, [createFollowupNote, followupWindow]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiGet(`/api/claims/${claimId}/messages`);

      if (res.ok) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiGet('/api/sms/templates');

      if (res.ok) {
        setTemplates(res.data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  const fetchSmsStatus = useCallback(async () => {
    try {
      const res = await apiGet('/api/sms/status');

      if (res.ok) {
        setSmsStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch SMS status:', err);
    }
  }, []);

  // Fetch messages on mount and periodically
  useEffect(() => {
    fetchMessages();
    fetchTemplates();
    fetchSmsStatus();

    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [fetchMessages, fetchTemplates, fetchSmsStatus]);

  const buildFollowupDate = useCallback((windowKey) => {
    const now = new Date();
    if (windowKey === '72h') now.setHours(now.getHours() + 72);
    else if (windowKey === '7d') now.setDate(now.getDate() + 7);
    else now.setHours(now.getHours() + 24);
    return now;
  }, []);

  const createFollowupClaimNote = useCallback(
    async (bodyText) => {
      try {
        const dueDate = buildFollowupDate(followupWindow);
        const preview = String(bodyText || '')
          .replace(/\s+/g, ' ')
          .slice(0, 120);
        const noteContent = [
          'Comms Follow-up Scheduled',
          `Due: ${dueDate.toLocaleString()}`,
          `Channel: SMS`,
          `Client: ${clientName || 'Client'}`,
          `Message preview: "${preview}${preview.length >= 120 ? '...' : ''}"`,
        ].join('\n');

        const res = await apiPost(`/api/claims/${claimId}/notes`, {
          claim_id: claimId,
          content: noteContent,
          tags: ['follow-up', 'comms'],
        });

        if (res.ok) {
          toast.success('Follow-up note created');
        } else {
          toast.warning('SMS sent, but follow-up note was not created');
        }
      } catch (_err) {
        toast.warning('SMS sent, but follow-up note was not created');
      }
    },
    [buildFollowupDate, claimId, clientName, followupWindow]
  );

  const requestAiSmsConfirmToken = useCallback(async () => {
    const res = await apiPost(`/api/claims/${claimId}/messages/sms/confirm-token`, {});

    if (!res.ok) {
      throw new Error(res.error?.detail || res.error || 'Unable to issue confirmation token for AI-generated SMS');
    }

    return res.data;
  }, [claimId]);

  const sendSMSMessage = useCallback(
    async (bodyText, phoneText, options = {}) => {
      const aiGenerated = Boolean(options?.aiGenerated);
      const preflightMissingFields = Array.isArray(claimReadiness?.missing_fields)
        ? claimReadiness.missing_fields
        : [];
      if (preflightMissingFields.length > 0) {
        toast.error(`Communication blocked: missing ${preflightMissingFields.join(', ')}`);
        return;
      }

      if (!bodyText?.trim()) {
        toast.error('Please enter a message');
        return;
      }

      if (!phoneText?.trim()) {
        toast.error('Please enter a phone number');
        return;
      }

      setSending(true);
      try {
        let confirmationToken = null;
        if (aiGenerated) {
          const tokenResult = await requestAiSmsConfirmToken();
          confirmationToken = tokenResult?.confirmation_token || null;
        }

        const res = await apiPost(`/api/claims/${claimId}/messages/sms/send`, {
          to: phoneText.startsWith('+') ? phoneText : `+1${phoneText.replace(/\D/g, '')}`,
          body: bodyText,
          ai_generated: aiGenerated,
          confirmation_token: confirmationToken,
          risk_acknowledged: aiGenerated ? riskAcknowledged : null,
          risk_level: commsCopilot?.risk_level || null,
          risk_flags: Array.isArray(commsCopilot?.risk_flags) ? commsCopilot.risk_flags : [],
          thread_intent: commsCopilot?.thread_intent || null,
        });

        if (res.ok) {
          // Add to messages list immediately
          setMessages((prev) => [
            ...prev,
            {
              ...res.data,
              direction: 'outbound',
              channel: 'sms',
              created_by_name: 'You',
            },
          ]);
          setSmsBody((prev) => (prev === bodyText ? '' : prev));
          if (aiGenerated) setSmsBodyIsAIDraft(false);
          toast.success('SMS sent successfully');
          if (createFollowupNote) {
            await createFollowupClaimNote(bodyText);
          }
        } else {
          const detail = res.error?.detail || res.error;
          if (detail && typeof detail === 'object') {
            const message = detail.message || 'Failed to send SMS';
            const missing = Array.isArray(detail.missing_fields)
              ? detail.missing_fields.join(', ')
              : '';
            toast.error(missing ? `${message} Missing: ${missing}` : message);
          } else {
            toast.error(detail || 'Failed to send SMS');
          }
        }
      } catch (err) {
        toast.error(err?.message || 'Failed to send SMS');
      } finally {
        setSending(false);
      }
    },
    [
      claimId,
      claimReadiness?.missing_fields,
      commsCopilot,
      createFollowupClaimNote,
      createFollowupNote,
      requestAiSmsConfirmToken,
      riskAcknowledged,
    ]
  );

  useEffect(() => {
    if (!prefillDraft || !prefillDraft.id) return;
    const nextBody = prefillDraft.body || '';
    const nextPhone = prefillDraft.phone || phoneNumber || '';
    if (prefillDraft.body) {
      setSmsBody(prefillDraft.body);
      setSmsBodyIsAIDraft(true);
    }
    if (prefillDraft.intent) {
      setDraftIntent(prefillDraft.intent);
    }
    if (prefillDraft.tone) {
      setDraftTone(prefillDraft.tone);
    }
    if (prefillDraft.phone && !phoneNumber) {
      setPhoneNumber(prefillDraft.phone);
    }
    if (prefillDraft.autoSend && nextBody.trim() && nextPhone.trim()) {
      if (typeof onPrefillConsumed === 'function') {
        onPrefillConsumed(prefillDraft.id);
      }
      const timer = setTimeout(() => {
        const confirmed = window.confirm('Send this AI draft SMS now?');
        if (confirmed) {
          sendSMSMessage(nextBody, nextPhone, { aiGenerated: true });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
    if (typeof onPrefillConsumed === 'function') {
      onPrefillConsumed(prefillDraft.id);
    }
  }, [prefillDraft, onPrefillConsumed, phoneNumber, sendSMSMessage]);

  const handleSendSMS = async () => {
    const legalRiskTriggered =
      String(commsCopilot?.risk_level || '').toLowerCase() === 'high' && smsBodyIsAIDraft;
    if (legalRiskTriggered && !riskAcknowledged) {
      toast.error('High-risk AI draft: acknowledge risk flags before sending.');
      return;
    }
    await sendSMSMessage(smsBody, phoneNumber, { aiGenerated: smsBodyIsAIDraft });
    setRiskAcknowledged(false);
  };

  const handleTemplateSelect = (template) => {
    setSmsBody(template.template);
    setSmsBodyIsAIDraft(false);
    setShowTemplates(false);
  };

  const handleGenerateAIDraft = async () => {
    try {
      setGeneratingDraft(true);

      const res = await apiPost('/api/ai/task', {
        task: 'draft_communication',
        claim_id: claimId,
        payload: {
          audience: 'client',
          channel: 'sms',
          intent: draftIntent,
          tone: draftTone,
        },
      });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to generate draft');
      }
      setSmsBody(res.data.output?.body || res.data.body || '');
      setSmsBodyIsAIDraft(true);
      toast.success('AI draft generated');
    } catch (err) {
      toast.error(err.message || 'Failed to generate AI draft');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const buildLocalThreadSummary = () => {
    if (!messages.length) return `No messages yet for ${clientName || 'this client'}.`;
    const recent = messages.slice(-5);
    const latest = recent[recent.length - 1];
    const inboundCount = recent.filter((m) => m.direction === 'inbound').length;
    const outboundCount = recent.filter((m) => m.direction === 'outbound').length;
    const latestSnippet = String(latest?.body || '')
      .replace(/\s+/g, ' ')
      .slice(0, 140);

    return [
      `Recent thread snapshot with ${clientName || 'client'}:`,
      `- Last ${recent.length} messages: ${outboundCount} outbound, ${inboundCount} inbound`,
      `- Latest message (${latest?.direction || 'unknown'}): "${latestSnippet}${latestSnippet.length >= 140 ? '...' : ''}"`,
      '- Suggested next step: confirm open items and expected timeline in one concise SMS.',
    ].join('\n');
  };

  const buildFallbackFollowupSuggestion = () => {
    const missing = Array.isArray(claimReadiness?.missing_fields)
      ? claimReadiness.missing_fields
      : [];
    if (missing.length > 0) {
      return `Hi ${clientName || ''}, quick update from Eden. Before we proceed, we still need: ${missing.join(', ')}. Reply here and we will move your file forward today.`;
    }
    return `Hi ${clientName || ''}, quick status update from Eden: we are actively progressing your claim and will send your next milestone update shortly. If you have any questions, reply here anytime.`;
  };

  const handleSummarizeThread = async () => {
    if (!messages.length) {
      const local = buildLocalThreadSummary();
      setThreadSummary(local);
      toast.info('No thread history yet. Showing local summary.');
      return;
    }

    try {
      setSummarizingThread(true);

      const payloadMessages = messages.slice(-20).map((m) => ({
        direction: m.direction,
        body: m.body,
        created_at: m.created_at,
      }));

      const res = await apiPost('/api/ai/task', {
        task: 'summarize_communication_thread',
        claim_id: claimId,
        payload: {
          channel: 'sms',
          audience: 'internal_operator',
          messages: payloadMessages,
        },
      });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to summarize thread');
      }
      const summary = res.data.output?.summary || res.data.output?.body || res.data.summary || res.data.body || '';
      if (!summary.trim()) {
        throw new Error('Empty AI summary');
      }
      setThreadSummary(summary);
      toast.success('Thread summary generated');
    } catch (_err) {
      const local = buildLocalThreadSummary();
      setThreadSummary(local);
      toast.warning('Using local summary fallback');
    } finally {
      setSummarizingThread(false);
    }
  };

  const handleSuggestFollowup = async () => {
    try {
      setGeneratingFollowupSuggestion(true);

      const res = await apiPost('/api/ai/task', {
        task: 'suggest_follow_up_sms',
        claim_id: claimId,
        payload: {
          audience: 'client',
          channel: 'sms',
          tone: draftTone,
          intent: draftIntent,
          summary_context: threadSummary || buildLocalThreadSummary(),
        },
      });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to suggest follow-up');
      }
      const suggestion =
        res.data.output?.body ||
        res.data.output?.suggested_message ||
        res.data.body ||
        res.data.suggested_message ||
        '';
      if (!suggestion.trim()) {
        throw new Error('Empty AI follow-up suggestion');
      }
      setSmsBody(suggestion);
      setSmsBodyIsAIDraft(true);
      toast.success('Follow-up suggestion inserted');
    } catch (_err) {
      const fallback = buildFallbackFollowupSuggestion();
      setSmsBody(fallback);
      setSmsBodyIsAIDraft(true);
      toast.warning('Using local follow-up fallback');
    } finally {
      setGeneratingFollowupSuggestion(false);
    }
  };

  const handleGenerateCommsCopilot = async () => {
    try {
      setGeneratingCommsCopilot(true);
      const payloadMessages = messages.slice(-20).map((m) => ({
        direction: m.direction,
        body: m.body,
        created_at: m.created_at,
      }));
      const res = await apiPost(`/api/ai/claims/${claimId}/comms-copilot`, {
        intent: draftIntent,
        tone: draftTone,
        channel: 'sms',
        messages: payloadMessages,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to generate comms copilot');
      }

      const result = res.data;
      setCommsCopilot(result);
      if (result?.suggested_reply) {
        setSmsBody(result.suggested_reply);
        setSmsBodyIsAIDraft(true);
      }
      if (result?.summary) {
        setThreadSummary(result.summary);
      }
      toast.success('Comms copilot ready');
    } catch (err) {
      toast.error(err.message || 'Failed to run comms copilot');
    } finally {
      setGeneratingCommsCopilot(false);
    }
  };

  const applyAiReplyOption = (replyText) => {
    const text = String(replyText || '').trim();
    if (!text) return;
    setSmsBody(text);
    setSmsBodyIsAIDraft(true);
    setRiskAcknowledged(false);
  };

  const getRiskBadgeClass = (riskLevel) => {
    const level = String(riskLevel || '').toLowerCase();
    if (level === 'high') return 'border-red-500/40 bg-red-500/15 text-red-300';
    if (level === 'low') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
    return 'border-amber-500/40 bg-amber-500/15 text-amber-300';
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(msg);
    return groups;
  }, {});

  const StatusIcon = ({ status }) => {
    const Icon = STATUS_ICONS[status] || Clock;
    return <Icon className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* SMS Status Banner */}
      {smsStatus && !smsStatus.configured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Twilio Not Configured</p>
            <p className="text-amber-700">
              {smsStatus.dry_run_mode
                ? 'Running in dry-run mode. Messages will be logged but not sent.'
                : 'Add Twilio credentials to send real SMS messages.'}
            </p>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div
        className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-4 space-y-4"
        data-testid="messages-container"
      >
        {Object.keys(groupedMessages).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Start a conversation by sending an SMS below</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {formatDate(msgs[0].created_at)}
                </div>
              </div>

              {/* Messages for this date */}
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'} mb-3`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.direction === 'outbound'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}
                  >
                    {/* Sender info for inbound */}
                    {msg.direction === 'inbound' && (
                      <div className="flex items-center gap-2 mb-1">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{msg.from || 'Client'}</span>
                      </div>
                    )}

                    {/* Message body */}
                    <p className="break-words whitespace-pre-wrap">{msg.body}</p>

                    {/* Footer: time + status */}
                    <div
                      className={`flex items-center justify-end gap-2 mt-2 text-xs ${
                        msg.direction === 'outbound' ? 'text-orange-100' : 'text-gray-400'
                      }`}
                    >
                      <span>{formatTime(msg.created_at)}</span>
                      {msg.direction === 'outbound' && (
                        <div className="flex items-center gap-1">
                          <StatusIcon status={msg.status} />
                          <span className="capitalize">{msg.status}</span>
                        </div>
                      )}
                    </div>

                    {/* Sender name for outbound */}
                    {msg.direction === 'outbound' && msg.created_by_name && (
                      <div className="text-xs text-orange-100 mt-1">
                        Sent by {msg.created_by_name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Compose Area */}
      <div className="mt-4 space-y-3">
        {Array.isArray(claimReadiness?.missing_fields) &&
          claimReadiness.missing_fields.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
              <div className="text-xs text-red-700">
                <p className="font-semibold">Communication QA Gate Active</p>
                <p>Complete missing claim fields before outbound SMS:</p>
                <p className="mt-1">{claimReadiness.missing_fields.join(', ')}</p>
              </div>
            </div>
          )}

        {/* AI Draft Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="text"
            value={draftIntent}
            onChange={(e) => setDraftIntent(e.target.value)}
            placeholder="Intent (status update, docs request...)"
            className="md:col-span-2 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            data-testid="ai-draft-intent-input"
          />
          <select
            value={draftTone}
            onChange={(e) => setDraftTone(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            data-testid="ai-draft-tone-select"
          >
            <option value="professional">Professional</option>
            <option value="firm">Firm</option>
            <option value="friendly">Friendly</option>
          </select>
          <Button
            variant="outline"
            onClick={handleGenerateAIDraft}
            disabled={generatingDraft || !draftIntent.trim()}
            className="w-full"
            data-testid="generate-ai-draft-btn"
          >
            {generatingDraft ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                AI Draft
              </>
            )}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button
            variant="outline"
            onClick={handleSummarizeThread}
            disabled={summarizingThread}
            className="w-full"
            data-testid="summarize-thread-btn"
          >
            {summarizingThread ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Summarize Thread</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleSuggestFollowup}
            disabled={generatingFollowupSuggestion}
            className="w-full"
            data-testid="suggest-followup-btn"
          >
            {generatingFollowupSuggestion ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Suggest Follow-up</>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleGenerateCommsCopilot}
            disabled={generatingCommsCopilot}
            className="w-full"
            data-testid="comms-copilot-btn"
          >
            {generatingCommsCopilot ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Comms Copilot</>
            )}
          </Button>
        </div>
        {threadSummary.trim() && (
          <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Thread Summary</p>
            <p className="text-xs text-zinc-200 whitespace-pre-wrap">{threadSummary}</p>
          </div>
        )}
        {commsCopilot && (
          <div
            className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2"
            data-testid="comms-copilot-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wide text-violet-300">Comms Copilot</p>
              <p className="text-[10px] text-zinc-500">
                {commsCopilot.provider || 'unknown'} / {commsCopilot.model || 'unknown'} /{' '}
                {commsCopilot.confidence || 'medium'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-[10px] uppercase text-violet-300">
                Intent: {String(commsCopilot.thread_intent || 'status_update').replace(/_/g, ' ')}
              </span>
              <span
                className={`px-2 py-0.5 rounded border text-[10px] uppercase ${getRiskBadgeClass(commsCopilot.risk_level)}`}
              >
                Risk: {commsCopilot.risk_level || 'medium'}
              </span>
            </div>
            {Array.isArray(commsCopilot.risk_flags) && commsCopilot.risk_flags.length > 0 && (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2 space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-amber-300">Risk Flags</p>
                {commsCopilot.risk_flags.slice(0, 4).map((flag, idx) => (
                  <p
                    key={`comms-risk-${idx}`}
                    className="text-xs text-amber-200 flex items-start gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400 flex-shrink-0" />
                    <span>{flag}</span>
                  </p>
                ))}
              </div>
            )}
            <p className="text-xs text-zinc-200 whitespace-pre-wrap">{commsCopilot.next_action}</p>
            {!!commsCopilot.suggested_reply && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">Suggested Reply</p>
                <p className="text-xs text-zinc-200 whitespace-pre-wrap">
                  {commsCopilot.suggested_reply}
                </p>
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => applyAiReplyOption(commsCopilot.suggested_reply)}
                    data-testid="comms-copilot-apply-btn"
                  >
                    Apply Suggested Reply
                  </Button>
                </div>
              </div>
            )}
            {Array.isArray(commsCopilot.reply_options) && commsCopilot.reply_options.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                  Smart Reply Options
                </p>
                <div className="space-y-2">
                  {commsCopilot.reply_options.slice(0, 3).map((option, idx) => (
                    <div
                      key={`copilot-reply-${idx}`}
                      className="rounded border border-violet-500/20 bg-zinc-900/50 p-2"
                    >
                      <p className="text-xs text-zinc-200 whitespace-pre-wrap">{option}</p>
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => applyAiReplyOption(option)}
                          data-testid={`comms-copilot-option-${idx}`}
                        >
                          Use Option {idx + 1}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post-send Follow-up Automation */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 rounded-lg border border-zinc-700/50 bg-zinc-900/40 p-2.5">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={createFollowupNote}
              onChange={(e) => setCreateFollowupNote(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800"
              data-testid="auto-followup-note-toggle"
            />
            Auto-create follow-up note after send
          </label>
          <select
            value={followupWindow}
            onChange={(e) => setFollowupWindow(e.target.value)}
            disabled={!createFollowupNote}
            className="md:ml-auto px-2 py-1.5 border border-zinc-700 bg-zinc-900 rounded text-xs text-zinc-200 disabled:opacity-50"
            data-testid="auto-followup-window-select"
          >
            <option value="24h">Due in 24h</option>
            <option value="72h">Due in 72h</option>
            <option value="7d">Due in 7d</option>
          </select>
        </div>

        {/* Phone Number Input */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <input
              type="tel"
              placeholder="Client phone number (+1...)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              data-testid="sms-phone-input"
            />
          </div>

          {/* Template Selector */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              data-testid="template-selector-btn"
            >
              Templates
              <ChevronDown className="w-4 h-4 ml-1" />
            </Button>

            {showTemplates && (
              <div className="absolute right-0 bottom-full mb-2 w-72 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {templates.map((template) => (
                  <button
                    key={template.key}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                    onClick={() => handleTemplateSelect(template)}
                    data-testid={`template-${template.key}`}
                  >
                    <p className="font-medium text-sm text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-500 truncate">{template.template}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        {String(commsCopilot?.risk_level || '').toLowerCase() === 'high' && smsBodyIsAIDraft && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
            <label className="flex items-start gap-2 text-xs text-red-200">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(e) => setRiskAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-red-500/40 bg-zinc-900"
                data-testid="high-risk-acknowledge-toggle"
              />
              <span>
                High-risk comms draft detected. I reviewed the risk flags and approve sending this
                message.
              </span>
            </label>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Type your message..."
            value={smsBody}
            onChange={(e) => {
              setSmsBody(e.target.value);
              setSmsBodyIsAIDraft(false);
              setRiskAcknowledged(false);
            }}
            className="flex-1 min-h-[80px] max-h-[120px]"
            data-testid="sms-body-input"
          />
          <Button
            onClick={handleSendSMS}
            disabled={
              sending ||
              !smsBody.trim() ||
              (String(commsCopilot?.risk_level || '').toLowerCase() === 'high' &&
                smsBodyIsAIDraft &&
                !riskAcknowledged)
            }
            className="bg-orange-600 hover:bg-orange-700 h-auto"
            data-testid="send-sms-btn"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>

        {/* Character count */}
        <div className="text-xs text-gray-500 text-right">
          {smsBody.length} / 1600 characters
          {smsBodyIsAIDraft && (
            <span className="ml-2 text-violet-600">AI draft (confirmation required)</span>
          )}
          {smsBody.length > 160 && (
            <span className="ml-2">({Math.ceil(smsBody.length / 160)} SMS segments)</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimCommsPanel;
