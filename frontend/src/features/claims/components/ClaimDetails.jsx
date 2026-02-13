import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../shared/ui/dialog';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import {
  ArrowLeft,
  Edit,
  MessageSquare,
  FileText,
  Camera,
  User,
  Calendar,
  MapPin,
  DollarSign,
  FileCheck,
  Loader2,
  Upload,
  Download,
  X,
  ExternalLink,
  Presentation,
  ChevronDown,
  Clock,
  CalendarPlus,
  Phone,
  Target,
  Shield,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import ClaimCommsPanel from './ClaimCommsPanel';
import ScheduleAppointmentModal from './ScheduleAppointmentModal';
import PhotoViewerModal from './PhotoViewerModal';
import ClaimEditModal from './ClaimEditModal';
import { Textarea } from '../../../shared/ui/textarea';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { toast } from 'sonner';
import { useGamma, GAMMA_AUDIENCES } from '../../../hooks/useGamma';
import ClientStatusPanel from '../../../components/ClientStatusPanel';
import { FEATURE_ICONS } from '../../../assets/badges';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

const ClaimDetails = () => {
  const { claimId } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [notes, setNotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [gammaPage, setGammaPage] = useState(null);
  const [creatingGammaPage, setCreatingGammaPage] = useState(false);
  const [showDeckMenu, setShowDeckMenu] = useState(false);
  const [generatingDeck, setGeneratingDeck] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activeTab, setActiveTab] = useState('notes');
  const [commsDraftPrefill, setCommsDraftPrefill] = useState(null);
  const [aiBrief, setAiBrief] = useState(null);
  const [loadingAiBrief, setLoadingAiBrief] = useState(false);
  const [aiDraft, setAiDraft] = useState(null);
  const [loadingAiDraft, setLoadingAiDraft] = useState(false);
  const [sendingAIDraftEmail, setSendingAIDraftEmail] = useState(false);
  const [copilotActions, setCopilotActions] = useState([]);
  const [copilotEvidenceGaps, setCopilotEvidenceGaps] = useState([]);
  const [copilotMeta, setCopilotMeta] = useState(null);
  const [loadingCopilotActions, setLoadingCopilotActions] = useState(false);
  const [floridaReadiness, setFloridaReadiness] = useState(null);
  const [demandManifest, setDemandManifest] = useState(null);
  const [loadingDemandManifest, setLoadingDemandManifest] = useState(false);

  // Gamma hook for presentation generation
  const { createDeckForAudience, loading: gammaLoading } = useGamma();

  // Calendar scheduling state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedulingAppointment, setSchedulingAppointment] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState({
    title: '',
    date: '',
    time: '',
    duration: 60,
    location: '',
    description: '',
  });

  const fetchClaimPhotos = useCallback(async () => {
    setLoadingPhotos(true);
    try {
      const res = await apiGet(`/api/inspections/claim/${claimId}/photos`);
      if (res.ok) {
        setPhotos(res.data.photos || []);
      }
    } catch (err) {
      console.error('Failed to fetch claim photos:', err);
    } finally {
      setLoadingPhotos(false);
    }
  }, [claimId]);

  const fetchGammaPage = useCallback(async () => {
    try {
      const res = await apiGet(`/api/gamma/claim-page/${claimId}`);
      if (res.ok) {
        if (res.data.exists) {
          setGammaPage(res.data);
        }
      }
    } catch (err) {
      // console.log('Gamma page not found');
    }
  }, [claimId]);

  const createGammaStrategyPage = async () => {
    setCreatingGammaPage(true);
    try {
      const res = await apiPost('/api/gamma/claim-page/create', { claim_id: claimId });

      if (res.ok && (res.data.success || res.data.exists)) {
        setGammaPage({ exists: true, url: res.data.url, page_id: res.data.page_id });
        toast.success('Strategy page created in Gamma!');
        // Open the page
        if (res.data.url) {
          window.open(res.data.url, '_blank');
        }
      } else {
        toast.error(res.error?.detail || res.error || 'Failed to create Gamma page');
      }
    } catch (err) {
      toast.error('Failed to create Gamma page');
    } finally {
      setCreatingGammaPage(false);
    }
  };

  const fetchClaimData = useCallback(async () => {
    try {
      setLoading(true);
      const [claimRes, notesRes, docsRes, readinessRes] = await Promise.all([
        apiGet(`/api/claims/${claimId}`),
        apiGet(`/api/claims/${claimId}/notes`).catch(() => ({ ok: false, data: [] })),
        apiGet(`/api/claims/${claimId}/documents`).catch(() => ({ ok: false, data: [] })),
        apiGet(`/api/claims/${claimId}/florida-readiness`).catch(() => ({ ok: false, data: null })),
      ]);

      if (!claimRes.ok) {
        throw new Error(claimRes.error || 'Failed to fetch claim');
      }

      setClaim(claimRes.data);
      setEditForm(claimRes.data);
      setNotes(notesRes.ok ? notesRes.data : []);
      setDocuments(docsRes.ok ? docsRes.data : []);
      setFloridaReadiness(readinessRes.ok ? readinessRes.data : null);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    fetchClaimData();
    fetchClaimPhotos();
    fetchGammaPage();
  }, [fetchClaimData, fetchClaimPhotos, fetchGammaPage]);

  // Open schedule modal with pre-filled data
  const openScheduleModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    setAppointmentForm({
      title: `Inspection - ${claim?.client_name || 'Client'}`,
      date: dateStr,
      time: '10:00',
      duration: 60,
      location: claim?.property_address || '',
      description: `Claim: ${claim?.claim_number}\nType: ${claim?.claim_type || 'Property'}\n\nScheduled inspection for ${claim?.client_name}`,
    });
    setShowScheduleModal(true);
  };

  // Schedule appointment via Google Calendar API
  const handleScheduleAppointment = async () => {
    if (!appointmentForm.date || !appointmentForm.time || !appointmentForm.title) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSchedulingAppointment(true);
    try {
      // Build start and end times
      const startDateTime = new Date(`${appointmentForm.date}T${appointmentForm.time}`);
      const endDateTime = new Date(startDateTime.getTime() + appointmentForm.duration * 60 * 1000);

      const eventPayload = {
        title: appointmentForm.title,
        description: appointmentForm.description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        location: appointmentForm.location,
        attendees: claim?.client_email ? [claim.client_email] : [],
        reminder_minutes: 30,
      };

      const res = await apiPost(
        `/api/integrations/google/calendar/events?claim_id=${claimId}`,
        eventPayload
      );

      if (res.ok) {
        toast.success('Appointment scheduled!', {
          description: `${appointmentForm.title} on ${new Date(appointmentForm.date).toLocaleDateString()}`,
        });
        setShowScheduleModal(false);

        // Add note about the scheduled appointment
        const appointmentNote = `📅 Appointment scheduled: ${appointmentForm.title} on ${new Date(appointmentForm.date).toLocaleDateString()} at ${appointmentForm.time}`;
        try {
          const noteRes = await apiPost(`/api/claims/${claimId}/notes`, {
            claim_id: claimId,
            content: appointmentNote,
            tags: [],
          });
          if (noteRes.ok) {
            setNotes([noteRes.data, ...notes]);
          }
        } catch (e) {
          // Note failed, but appointment was created
        }
      } else if (res.status === 401) {
        toast.error('Google Calendar not connected', {
          description: 'Connect your Google account in Settings > Integrations',
          action: {
            label: 'Connect',
            onClick: () => navigate('/settings/integrations'),
          },
        });
      } else {
        toast.error(res.error?.detail || res.error || 'Failed to schedule appointment');
      }
    } catch (err) {
      console.error('Schedule error:', err);
      toast.error('Failed to schedule appointment');
    } finally {
      setSchedulingAppointment(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setAddingNote(true);
      const res = await apiPost(`/api/claims/${claimId}/notes`, {
        claim_id: claimId,
        content: newNote.trim(),
        tags: [],
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to add note');
      }

      setNotes([res.data, ...notes]);
      setNewNote('');
    } catch (err) {
      toast.error('Failed to add note: ' + err.message);
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditClaim = () => {
    setIsEditing(true);
    setEditForm({ ...claim });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({ ...claim });
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      const res = await apiPut(`/api/claims/${claimId}`, editForm);

      if (!res.ok) {
        throw new Error(res.error || 'Failed to update claim');
      }

      setClaim(res.data);
      setIsEditing(false);
      toast.success('Claim updated successfully');
    } catch (err) {
      toast.error('Failed to update claim: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);

      // Generate a PDF report (client-side for now)
      const reportContent = `
CLAIM REPORT
============

Claim Number: ${claim.claim_number}
Status: ${claim.status}
Priority: ${claim.priority}

CLIENT INFORMATION
------------------
Client Name: ${claim.client_name}
Client Email: ${claim.client_email || 'N/A'}
Client Phone: ${claim.client_phone || 'N/A'}

PROPERTY INFORMATION
--------------------
Property Address: ${claim.property_address}
Date of Loss: ${claim.date_of_loss}
Claim Type: ${claim.claim_type}

POLICY INFORMATION
------------------
Policy Number: ${claim.policy_number}
Insurance Company: ${claim.insurance_company || 'N/A'}
Estimated Value: $${(claim.estimated_value || 0).toLocaleString()}

DESCRIPTION
-----------
${claim.description || 'No description provided'}

NOTES (${notes.length})
-----------
${notes.map((n) => `[${new Date(n.created_at).toLocaleDateString()}] ${n.author_name}: ${n.content}`).join('\n\n') || 'No notes'}

Generated on: ${new Date().toLocaleString()}
      `.trim();

      // Download as text file
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claim-report-${claim.claim_number}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleGenerateAIBrief = async () => {
    try {
      setLoadingAiBrief(true);
      const res = await apiPost('/api/ai/task', {
        task: 'claim_brief',
        claim_id: claimId,
        payload: {
          include_docs: true,
          include_notes: true,
        },
      });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to generate AI brief');
      }

      setAiBrief(res.data.output || res.data);
      toast.success('AI brief generated');
    } catch (err) {
      toast.error(err.message || 'Failed to generate AI brief');
    } finally {
      setLoadingAiBrief(false);
    }
  };

  const handleGenerateAIDraft = async (audience = 'client', channel = 'email') => {
    try {
      setLoadingAiDraft(true);
      const res = await apiPost('/api/ai/task', {
        task: 'draft_communication',
        claim_id: claimId,
        payload: {
          audience,
          channel,
          intent: 'request documents and provide status update',
          tone: 'professional',
        },
      });

      if (!res.ok) {
        throw new Error(res.error?.detail || res.error || 'Failed to generate AI draft');
      }

      const output = res.data.output || res.data;
      setAiDraft({
        ...output,
        audience,
        channel,
      });
      toast.success(`AI ${channel.toUpperCase()} draft ready`);
    } catch (err) {
      toast.error(err.message || 'Failed to generate AI draft');
    } finally {
      setLoadingAiDraft(false);
    }
  };

  const copyAIDraft = async () => {
    if (!aiDraft?.body) return;
    const payload = aiDraft.subject
      ? `Subject: ${aiDraft.subject}\n\n${aiDraft.body}`
      : aiDraft.body;
    try {
      await navigator.clipboard.writeText(payload);
      toast.success('Draft copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy draft');
    }
  };

  const resolveAIDraftRecipientEmail = useCallback(() => {
    if (!claim || !aiDraft) return '';
    const audience = String(aiDraft.audience || 'client').toLowerCase();
    if (audience === 'client') {
      return claim.client_email || '';
    }
    return claim.adjuster_email || claim.carrier_email || claim.insurance_company_email || '';
  }, [aiDraft, claim]);

  const handleSendAIDraftEmail = async () => {
    if (!aiDraft?.body || aiDraft?.channel !== 'email') {
      toast.info('Generate an AI email draft first');
      return;
    }
    const recipient = resolveAIDraftRecipientEmail();
    if (!recipient) {
      toast.error('No recipient email found on this claim for the selected audience');
      return;
    }

    const confirmed = window.confirm(`Send AI-generated email to ${recipient}?`);
    if (!confirmed) return;

    setSendingAIDraftEmail(true);
    try {
      const rawUser = localStorage.getItem('eden_user');
      let parsedUser = {};
      try {
        parsedUser = rawUser ? JSON.parse(rawUser) : {};
      } catch (_err) {
        parsedUser = {};
      }
      const userId = parsedUser?.id || parsedUser?.email || 'unknown';

      const confirmPayload = new FormData();
      confirmPayload.append('recipient', recipient);
      confirmPayload.append('context_type', 'claim');
      confirmPayload.append('context_id', claimId);

      const tokenRes = await apiPost('/api/integrations/gmail/confirm-token', confirmPayload);
      if (!tokenRes.ok) {
        throw new Error(tokenRes.error?.detail || tokenRes.error || 'Failed to issue email confirmation token');
      }

      const sendPayload = new FormData();
      sendPayload.append('recipient', recipient);
      sendPayload.append(
        'subject',
        aiDraft.subject || `Claim ${claim?.claim_number || claimId} Update`
      );
      sendPayload.append('body', aiDraft.body);
      sendPayload.append('user_id', String(userId));
      sendPayload.append('ai_generated', 'true');
      sendPayload.append('confirmation_token', tokenRes.data.confirmation_token || '');
      sendPayload.append('context_type', 'claim');
      sendPayload.append('context_id', claimId);

      const sendRes = await apiPost('/api/integrations/gmail/send-email', sendPayload);
      if (!sendRes.ok) {
        throw new Error(sendRes.error?.detail || sendRes.error || 'Failed to send AI email');
      }

      toast.success('AI email sent successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to send AI email');
    } finally {
      setSendingAIDraftEmail(false);
    }
  };

  const handoffAIDraftToComms = (autoSend = false) => {
    if (!aiDraft?.body) {
      toast.info('Generate an AI draft first');
      return;
    }
    const handoffId = `${Date.now()}`;
    setCommsDraftPrefill({
      id: handoffId,
      body: aiDraft.body,
      intent: 'status update',
      tone: 'professional',
      phone: claim?.client_phone || '',
      autoSend,
    });
    setActiveTab('messages');
    toast.success(
      autoSend ? 'Draft sent to Comms for confirmation + send' : 'Draft loaded into Comms composer'
    );
  };

  const handleCommsDraftConsumed = (id) => {
    setCommsDraftPrefill((prev) => (prev && prev.id === id ? null : prev));
  };

  const handleOpenClaimEditor = () => {
    handleEditClaim();
    toast.info('Claim editor opened. Complete missing core fields and save.');
  };

  const handleGenerateDemandManifest = async () => {
    try {
      setLoadingDemandManifest(true);
      const res = await apiGet(`/api/claims/${claimId}/demand-package-manifest`);

      if (!res.ok) {
        throw new Error(res.error || 'Failed to generate demand package manifest');
      }

      setDemandManifest(res.data);
      toast.success('Demand package manifest generated');
    } catch (err) {
      toast.error(err.message || 'Failed to generate demand package manifest');
    } finally {
      setLoadingDemandManifest(false);
    }
  };

  const handleGenerateCopilotActions = async () => {
    try {
      setLoadingCopilotActions(true);
      const res = await apiPost(`/api/ai/claims/${claimId}/copilot-next-actions`, {});

      if (!res.ok) {
        throw new Error(res.error || 'Failed to generate copilot actions');
      }

      const result = res.data;
      setCopilotActions(Array.isArray(result?.actions) ? result.actions : []);
      setCopilotEvidenceGaps(Array.isArray(result?.evidence_gaps) ? result.evidence_gaps : []);
      setCopilotMeta({
        provider: result?.provider || 'unknown',
        model: result?.model || 'unknown',
        confidence: result?.confidence || 'medium',
      });
      toast.success('Copilot next actions ready');
    } catch (err) {
      toast.error(err.message || 'Failed to generate copilot actions');
    } finally {
      setLoadingCopilotActions(false);
    }
  };

  const handleExportManifestChecklist = () => {
    if (!demandManifest) return;
    const payload = demandManifest.export_payload || demandManifest;
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const claimNumber = demandManifest?.claim_summary?.claim_number || claimId;
    anchor.href = url;
    anchor.download = `demand-package-${claimNumber}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success('Demand package checklist exported');
  };

  // Handle Gamma deck generation - uses claim ID, backend fetches all data
  const handleGenerateDeck = async (audience) => {
    try {
      setGeneratingDeck(audience);
      setShowDeckMenu(false);

      // Use the new endpoint that fetches data from DB
      const result = await createDeckForAudience(claim.id, audience);

      if (result.edit_url) {
        toast.success(`${GAMMA_AUDIENCES[audience]?.name || 'Presentation'} deck created!`, {
          action: {
            label: 'Open in Gamma',
            onClick: () => window.open(result.edit_url, '_blank'),
          },
        });
        // Auto-open the deck
        window.open(result.edit_url, '_blank');
      } else {
        toast.success('Deck created successfully');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate deck');
    } finally {
      setGeneratingDeck(null);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'In Progress') return 'badge-rare';
    if (status === 'Under Review') return 'badge-epic';
    if (status === 'Completed') return 'badge-uncommon';
    return 'badge-common';
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCopilotGapSeverityClass = (severity) => {
    const normalized = String(severity || 'medium').toLowerCase();
    if (normalized === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-300';
    if (normalized === 'high') return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
    if (normalized === 'low') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    return 'border-violet-500/30 bg-violet-500/10 text-violet-300';
  };

  const executeCopilotGapCta = async (gap) => {
    const cta = String(gap?.cta || '').toLowerCase();
    if (cta === 'edit_claim') {
      handleOpenClaimEditor();
      return;
    }
    if (cta === 'upload_documents') {
      navigate('/documents');
      return;
    }
    if (cta === 'add_note') {
      setActiveTab('notes');
      toast.info('Notes tab opened. Log the latest claim milestone.');
      return;
    }
    if (cta === 'request_client_docs') {
      await handleGenerateAIDraft('client', 'sms');
      return;
    }
    toast.info('No automated action available for this evidence gap yet.');
  };

  const getDeadlineStatusColor = (status) => {
    if (status === 'overdue') return 'text-red-300 border-red-500/30 bg-red-500/10';
    if (status === 'due_soon') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
            Loading mission data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
            <X className="w-8 h-8 text-zinc-600" />
          </div>
          <p className="text-zinc-400 mb-4 font-mono">{error || 'Mission not found'}</p>
          <button onClick={() => navigate('/claims')} className="btn-tactical px-6 py-2.5 text-sm">
            Return to Garden
          </button>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(claim.status);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      {/* Header - Tactical Style */}
      <div className="mb-4 md:mb-6 animate-fade-in-up">
        <button
          onClick={() => navigate('/claims')}
          className="mb-4 px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
          data-testid="back-to-claims"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Garden
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h1
                className="text-xl md:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange"
                data-testid="claim-number"
              >
                {claim.claim_number}
              </h1>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${statusColor}`}
                data-testid="claim-status"
              >
                {claim.status}
              </span>
            </div>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
              {claim.claim_type}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {gammaPage?.exists ? (
              <button
                className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                onClick={() => window.open(gammaPage.url, '_blank')}
                data-testid="notion-page-btn"
              >
                <ExternalLink className="w-4 h-4" />
                Strategy Page
              </button>
            ) : (
              <button
                className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
                onClick={createGammaStrategyPage}
                disabled={creatingGammaPage}
                data-testid="create-notion-btn"
              >
                {creatingGammaPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                Create Strategy
              </button>
            )}
            <button
              className="px-4 py-2 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={async () => {
                const address = claim?.property_address || 'No address';
                const text = `Claim ${claim?.claim_number}: ${claim?.client_name}\nProperty: ${address}`;

                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const mapLink = `https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`;
                      const fullText = `${text}\nGPS: ${mapLink}`;

                      if (navigator.share) {
                        navigator
                          .share({ title: `Claim ${claim?.claim_number}`, text: fullText })
                          .catch(() => {
                            navigator.clipboard.writeText(fullText);
                            toast.success('Location copied to clipboard');
                          });
                      } else {
                        navigator.clipboard.writeText(fullText);
                        toast.success('Location + claim info copied!');
                      }
                    },
                    () => {
                      if (navigator.share) {
                        navigator
                          .share({ title: `Claim ${claim?.claim_number}`, text })
                          .catch(() => {});
                      } else {
                        navigator.clipboard.writeText(text);
                        toast.success('Claim info copied (GPS unavailable)');
                      }
                    },
                    { timeout: 5000 }
                  );
                } else {
                  navigator.clipboard.writeText(text);
                  toast.success('Claim info copied');
                }
              }}
              data-testid="share-location-btn"
            >
              <MapPin className="w-4 h-4" />
              Share Location
            </button>
            <button
              className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
              onClick={handleEditClaim}
              data-testid="edit-claim-btn"
            >
              <Edit className="w-4 h-4" />
              Edit Mission
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal - Tactical Style */}
      <ClaimEditModal
        isOpen={isEditing}
        editForm={editForm}
        setEditForm={setEditForm}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
        isSaving={saving}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Claim Information - Tactical Style */}
        <div className="lg:col-span-2 card-tactical p-5">
          <div className="flex items-center gap-3 mb-5">
            <Target className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">
              Mission Intel
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
                <User className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Client Name</p>
                <p className="font-medium text-zinc-200 truncate" data-testid="client-name">
                  {claim.client_name}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Date of Loss</p>
                <p className="font-medium text-zinc-200">{claim.date_of_loss}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex-shrink-0">
                <MapPin className="w-4 h-4 text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">
                  Property Address
                </p>
                <p className="font-medium text-zinc-200 break-words">{claim.property_address}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                <DollarSign className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">
                  Estimated Value
                </p>
                <p className="font-tactical font-bold text-orange-400 text-lg">
                  ${(claim.estimated_value || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                <FileCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Policy Number</p>
                <p className="font-medium text-zinc-200 font-mono">{claim.policy_number}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-zinc-500/10 border border-zinc-500/20 flex-shrink-0">
                <User className="w-4 h-4 text-zinc-400" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Assigned To</p>
                <p className="font-medium text-zinc-200">{claim.assigned_to || 'Unassigned'}</p>
              </div>
            </div>
          </div>
          {claim.description && (
            <div className="mt-6 pt-6 border-t border-zinc-700/50">
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-2">Description</p>
              <p className="text-zinc-300 break-words">{claim.description}</p>
            </div>
          )}
        </div>

        {/* Quick Actions - Tactical Style */}
        <div className="card-tactical p-5">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wide">
              Quick Deploy
            </h2>
          </div>
          <div className="space-y-3">
            {/* Schedule Appointment */}
            <button
              className="w-full px-4 py-3 rounded bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={openScheduleModal}
              data-testid="schedule-appointment-btn"
            >
              <CalendarPlus className="w-4 h-4" />
              Schedule Appointment
            </button>

            <button
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={() => navigate('/inspections')}
              data-testid="start-inspection-btn"
            >
              <Camera className="w-4 h-4" />
              Start Recon
            </button>
            <button
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-blue-400 hover:border-blue-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={() => navigate('/eve')}
              data-testid="ask-eve-btn"
            >
              <MessageSquare className="w-4 h-4" />
              Agent Eve
            </button>
            <button
              className="w-full px-4 py-3 rounded border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={handleGenerateAIBrief}
              disabled={loadingAiBrief}
              data-testid="generate-ai-brief-btn"
            >
              {loadingAiBrief ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Brief...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI Claim Brief
                </>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                className="px-3 py-2 rounded border border-blue-500/30 text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                onClick={() => handleGenerateAIDraft('client', 'email')}
                disabled={loadingAiDraft}
                data-testid="generate-ai-client-email-btn"
              >
                {loadingAiDraft ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Client Email
              </button>
              <button
                className="px-3 py-2 rounded border border-purple-500/30 text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                onClick={() => handleGenerateAIDraft('carrier', 'email')}
                disabled={loadingAiDraft}
                data-testid="generate-ai-carrier-email-btn"
              >
                {loadingAiDraft ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Carrier Email
              </button>
              <button
                className="px-3 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                onClick={() => handleGenerateAIDraft('client', 'sms')}
                disabled={loadingAiDraft}
                data-testid="generate-ai-client-sms-btn"
              >
                {loadingAiDraft ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Client SMS
              </button>
              <button
                className="px-3 py-2 rounded border border-amber-500/30 text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 font-mono text-[10px] uppercase flex items-center justify-center gap-1 transition-all disabled:opacity-60"
                onClick={() => handleGenerateAIDraft('carrier', 'sms')}
                disabled={loadingAiDraft}
                data-testid="generate-ai-carrier-sms-btn"
              >
                {loadingAiDraft ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Carrier SMS
              </button>
            </div>
            <button
              className="w-full px-4 py-3 rounded border border-zinc-700/50 text-zinc-300 hover:text-purple-400 hover:border-purple-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={handleGenerateReport}
              disabled={generatingReport}
              data-testid="generate-report-btn"
            >
              {generatingReport ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
            <button
              className="w-full px-4 py-3 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all"
              onClick={handleGenerateDemandManifest}
              disabled={loadingDemandManifest}
              data-testid="generate-demand-manifest-btn"
            >
              {loadingDemandManifest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building Manifest...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  Demand Package
                </>
              )}
            </button>
            <button
              className="w-full px-4 py-3 rounded border border-violet-500/30 text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 font-mono text-xs uppercase flex items-center gap-2 transition-all disabled:opacity-60"
              onClick={handleGenerateCopilotActions}
              disabled={loadingCopilotActions}
              data-testid="generate-copilot-actions-btn"
            >
              {loadingCopilotActions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking Next Steps...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Copilot Next Actions
                </>
              )}
            </button>

            {Array.isArray(copilotActions) && copilotActions.length > 0 && (
              <div
                className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2"
                data-testid="copilot-actions-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase text-violet-300">Claim Copilot</p>
                  <p className="text-[10px] text-zinc-500">
                    {copilotMeta?.provider || 'unknown'} / {copilotMeta?.model || 'unknown'} /{' '}
                    {copilotMeta?.confidence || 'medium'}
                  </p>
                </div>
                <ul className="space-y-2">
                  {copilotActions.map((action, idx) => (
                    <li
                      key={`copilot-action-${idx}`}
                      className="rounded border border-violet-500/20 bg-zinc-900/50 p-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-zinc-100">{action.title}</p>
                        <span className="text-[10px] uppercase font-mono text-violet-300">
                          {action.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{action.rationale}</p>
                      <p className="text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                        Owner: {action.owner || 'adjuster'} | ETA: {action.eta_hours || 4}h
                      </p>
                    </li>
                  ))}
                </ul>
                {Array.isArray(copilotEvidenceGaps) && copilotEvidenceGaps.length > 0 && (
                  <div className="pt-2 border-t border-violet-500/20 space-y-2">
                    <p className="text-[10px] uppercase font-mono text-zinc-500">Evidence Gaps</p>
                    <ul className="space-y-2">
                      {copilotEvidenceGaps.slice(0, 4).map((gap, idx) => (
                        <li
                          key={`copilot-gap-${idx}`}
                          className="rounded border border-violet-500/20 bg-zinc-900/50 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-medium text-zinc-100">
                                {gap.title || 'Evidence gap'}
                              </p>
                              <p className="text-[11px] text-zinc-400 mt-1">
                                {gap.rationale || gap.recommended_action}
                              </p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-mono ${getCopilotGapSeverityClass(gap.severity)}`}
                            >
                              {String(gap.severity || 'medium')}
                            </span>
                          </div>
                          {gap.recommended_action && (
                            <p className="text-[10px] text-zinc-500 mt-1 uppercase font-mono">
                              {gap.recommended_action}
                            </p>
                          )}
                          <button
                            onClick={() => executeCopilotGapCta(gap)}
                            className="mt-2 px-2 py-1 rounded border border-violet-500/30 text-violet-200 hover:bg-violet-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                          >
                            <ChevronRight className="w-3 h-3" />
                            Resolve
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {aiBrief && (
              <div
                className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2"
                data-testid="ai-brief-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase text-cyan-300">AI Brief</p>
                  <p className="text-[10px] text-zinc-500">
                    {aiBrief.provider} / {aiBrief.model}
                  </p>
                </div>
                <p className="text-xs text-zinc-200 whitespace-pre-wrap">{aiBrief.summary}</p>
                {Array.isArray(aiBrief.blockers) && aiBrief.blockers.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">Blockers</p>
                    <ul className="space-y-1">
                      {aiBrief.blockers.slice(0, 3).map((item, idx) => (
                        <li key={`blocker-${idx}`} className="text-[11px] text-amber-300">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="pt-2 border-t border-cyan-500/20">
                  <p className="text-[10px] uppercase font-mono text-zinc-500 mb-2">
                    AI Suggested Actions
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => handleGenerateAIDraft('client', 'sms')}
                      disabled={loadingAiDraft}
                      className="px-2.5 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-[10px] uppercase font-mono flex items-center gap-1 disabled:opacity-60"
                      data-testid="ai-action-client-followup"
                    >
                      <Sparkles className="w-3 h-3" />
                      Draft client follow-up SMS
                    </button>
                    <button
                      onClick={() => handleGenerateAIDraft('carrier', 'email')}
                      disabled={loadingAiDraft}
                      className="px-2.5 py-2 rounded border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 text-[10px] uppercase font-mono flex items-center gap-1 disabled:opacity-60"
                      data-testid="ai-action-carrier-update"
                    >
                      <Sparkles className="w-3 h-3" />
                      Draft carrier status email
                    </button>
                    {Array.isArray(aiBrief.blockers) &&
                      aiBrief.blockers.some((b) =>
                        String(b).toLowerCase().includes('missing core claim fields')
                      ) && (
                        <button
                          onClick={handleOpenClaimEditor}
                          className="px-2.5 py-2 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                          data-testid="ai-action-fix-missing-fields"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Fix missing core claim fields
                        </button>
                      )}
                    {Array.isArray(aiBrief.blockers) &&
                      aiBrief.blockers.some((b) =>
                        String(b).toLowerCase().includes('no claim documents uploaded')
                      ) && (
                        <button
                          onClick={() => navigate('/documents')}
                          className="px-2.5 py-2 rounded border border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-[10px] uppercase font-mono flex items-center gap-1"
                          data-testid="ai-action-upload-documents"
                        >
                          <FileText className="w-3 h-3" />
                          Upload supporting documents
                        </button>
                      )}
                  </div>
                </div>
              </div>
            )}
            {aiDraft && (
              <div
                className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2"
                data-testid="ai-draft-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase text-blue-300">
                    AI Draft ({aiDraft.audience} / {aiDraft.channel})
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handoffAIDraftToComms}
                      className="px-2 py-1 rounded border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10 text-[10px] uppercase font-mono"
                      data-testid="use-ai-draft-in-comms-btn"
                    >
                      Use In Comms
                    </button>
                    <button
                      onClick={() => handoffAIDraftToComms(true)}
                      className="px-2 py-1 rounded border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 text-[10px] uppercase font-mono"
                      data-testid="use-ai-draft-send-now-btn"
                    >
                      Use & Send
                    </button>
                    <button
                      onClick={copyAIDraft}
                      className="px-2 py-1 rounded border border-blue-500/30 text-blue-200 hover:bg-blue-500/10 text-[10px] uppercase font-mono"
                      data-testid="copy-ai-draft-btn"
                    >
                      Copy
                    </button>
                    {aiDraft.channel === 'email' && (
                      <button
                        onClick={handleSendAIDraftEmail}
                        disabled={sendingAIDraftEmail}
                        className="px-2 py-1 rounded border border-indigo-500/30 text-indigo-200 hover:bg-indigo-500/10 text-[10px] uppercase font-mono disabled:opacity-60"
                        data-testid="send-ai-draft-email-btn"
                      >
                        {sendingAIDraftEmail ? 'Sending...' : 'Send AI Email'}
                      </button>
                    )}
                  </div>
                </div>
                {aiDraft.subject && (
                  <p className="text-[11px] text-zinc-300">
                    <span className="text-zinc-500">Subject:</span> {aiDraft.subject}
                  </p>
                )}
                <p className="text-xs text-zinc-200 whitespace-pre-wrap">{aiDraft.body}</p>
                {Array.isArray(aiDraft.bullets) && aiDraft.bullets.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                      Included facts
                    </p>
                    <ul className="space-y-1">
                      {aiDraft.bullets.slice(0, 3).map((item, idx) => (
                        <li key={`draft-bullet-${idx}`} className="text-[11px] text-zinc-300">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {floridaReadiness && (
              <div
                className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-3 space-y-3"
                data-testid="florida-readiness-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase text-orange-300">
                    Florida Readiness
                  </p>
                  <p className="text-[11px] font-mono text-orange-200">
                    {floridaReadiness.readiness_score || 0}/100
                  </p>
                </div>

                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, floridaReadiness.readiness_score || 0))}%`,
                    }}
                  />
                </div>

                {Array.isArray(floridaReadiness.missing_fields) &&
                  floridaReadiness.missing_fields.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                        Missing Critical Fields
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {floridaReadiness.missing_fields.map((field) => (
                          <span
                            key={field}
                            className="px-2 py-0.5 rounded border border-red-500/30 bg-red-500/10 text-[10px] text-red-300"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {Array.isArray(floridaReadiness.deadlines) &&
                  floridaReadiness.deadlines.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-mono text-zinc-500">Deadlines</p>
                      {floridaReadiness.deadlines.slice(0, 2).map((deadline) => (
                        <div
                          key={deadline.id}
                          className={`rounded border px-2 py-1 text-[11px] ${getDeadlineStatusColor(deadline.status)}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{deadline.label}</span>
                            <span className="font-mono">
                              {typeof deadline.days_remaining === 'number'
                                ? `${deadline.days_remaining}d`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {Array.isArray(floridaReadiness.evidence_checklist) &&
                  floridaReadiness.evidence_checklist.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-mono text-zinc-500">
                        Evidence Checklist
                      </p>
                      {floridaReadiness.evidence_checklist.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-[11px] text-zinc-300"
                        >
                          <span className="truncate pr-2">{item.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded border ${item.complete ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-zinc-400 border-zinc-600/40 bg-zinc-800/50'}`}
                          >
                            {item.complete ? 'OK' : 'MISSING'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {Array.isArray(floridaReadiness.recommended_next_actions) &&
                  floridaReadiness.recommended_next_actions.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                        Next Action
                      </p>
                      <p className="text-[11px] text-zinc-300">
                        {floridaReadiness.recommended_next_actions[0]}
                      </p>
                    </div>
                  )}

                <div className="flex items-start gap-1.5 text-[10px] text-zinc-500">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-zinc-500" />
                  <span>
                    {floridaReadiness.disclaimer ||
                      'Operational guidance only. Confirm legal deadlines with counsel.'}
                  </span>
                </div>
              </div>
            )}

            {demandManifest && (
              <div
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-3"
                data-testid="demand-manifest-panel"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-mono uppercase text-emerald-300">
                    Demand Package Manifest
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-emerald-200">
                      {demandManifest.package_score || 0}/100
                    </p>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${demandManifest.ready_for_submission ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}
                    >
                      {demandManifest.ready_for_submission ? 'READY' : 'NOT READY'}
                    </span>
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, demandManifest.package_score || 0))}%`,
                    }}
                  />
                </div>

                {Array.isArray(demandManifest.section_status) &&
                  demandManifest.section_status.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase font-mono text-zinc-500">
                        Section Status
                      </p>
                      {demandManifest.section_status.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between text-[11px] text-zinc-300"
                        >
                          <span className="truncate pr-2">{section.label}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded border ${section.complete ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}
                          >
                            {section.current_count}/{section.required_count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                {Array.isArray(demandManifest.missing_sections) &&
                  demandManifest.missing_sections.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                        Missing Sections
                      </p>
                      <p className="text-[11px] text-amber-300">
                        {demandManifest.missing_sections.join(', ')}
                      </p>
                    </div>
                  )}

                {Array.isArray(demandManifest.submission_gate?.reasons) &&
                  demandManifest.submission_gate.reasons.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                        Submission Gate
                      </p>
                      {demandManifest.submission_gate.reasons.slice(0, 2).map((reason, idx) => (
                        <p key={`gate-reason-${idx}`} className="text-[11px] text-amber-300">
                          - {reason}
                        </p>
                      ))}
                    </div>
                  )}

                <button
                  className="w-full px-3 py-2 rounded border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 font-mono text-[11px] uppercase transition-all"
                  onClick={handleExportManifestChecklist}
                  data-testid="export-demand-manifest-btn"
                >
                  Export Checklist JSON
                </button>

                <div className="flex items-start gap-1.5 text-[10px] text-zinc-500">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-zinc-500" />
                  <span>{demandManifest.disclaimer || 'Operational packaging guidance only.'}</span>
                </div>
              </div>
            )}

            {/* Gamma Presentation Decks */}
            <div className="relative">
              <button
                className="w-full px-4 py-3 rounded bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-blue-400 hover:from-blue-600/30 hover:to-purple-600/30 font-mono text-xs uppercase flex items-center justify-between transition-all"
                onClick={() => setShowDeckMenu(!showDeckMenu)}
                disabled={!!generatingDeck}
                data-testid="gamma-deck-btn"
              >
                <span className="flex items-center gap-2">
                  {generatingDeck ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Presentation className="w-4 h-4" />
                  )}
                  {generatingDeck
                    ? `Creating ${GAMMA_AUDIENCES[generatingDeck]?.name}...`
                    : 'Generate Deck'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showDeckMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showDeckMenu && (
                <div className="absolute z-50 mt-1 w-full bg-zinc-900 border border-zinc-700/50 rounded-lg shadow-xl overflow-hidden">
                  <div className="p-2 text-[10px] font-mono text-zinc-500 uppercase border-b border-zinc-700/50">
                    Select Deck Type
                  </div>

                  {/* Client-Facing Decks */}
                  <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50">
                    Client Decks
                  </div>
                  <button
                    onClick={() => handleGenerateDeck('client_update')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-client-update"
                  >
                    <span>📋</span>
                    <div>
                      <div className="font-medium">Client Update</div>
                      <div className="text-[10px] text-zinc-500">Status update for homeowner</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('client_approval')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-client-approval"
                  >
                    <span>✅</span>
                    <div>
                      <div className="font-medium">Settlement Review</div>
                      <div className="text-[10px] text-zinc-500">For client approval</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('settlement')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-settlement"
                  >
                    <span>🎉</span>
                    <div>
                      <div className="font-medium">Final Settlement</div>
                      <div className="text-[10px] text-zinc-500">Celebratory closing deck</div>
                    </div>
                  </button>

                  {/* Internal Decks */}
                  <div className="p-1.5 text-[10px] font-mono text-zinc-600 uppercase bg-zinc-800/50 border-t border-zinc-700/50">
                    Internal Decks
                  </div>
                  <button
                    onClick={() => handleGenerateDeck('rep_performance')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-rep-performance"
                  >
                    <span>📊</span>
                    <div>
                      <div className="font-medium">Rep Performance</div>
                      <div className="text-[10px] text-zinc-500">Sales/adjuster review</div>
                    </div>
                  </button>
                  <button
                    onClick={() => handleGenerateDeck('pastor_report')}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-zinc-800 flex items-center gap-2 text-zinc-300"
                    data-testid="deck-pastor-report"
                  >
                    <span>✝️</span>
                    <div>
                      <div className="font-medium">Ministry Report</div>
                      <div className="text-[10px] text-zinc-500">Kingdom impact report</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Status Panel - Stage Progress and Eve Updates */}
      <div className="mb-4 md:mb-6">
        <ClientStatusPanel claimId={claimId} isClientView={false} />
      </div>

      {/* Tabs Section - Tactical Style */}
      <div className="card-tactical p-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1">
            <TabsTrigger
              value="notes"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
              data-testid="notes-tab"
            >
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger
              value="photos"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
              data-testid="photos-tab"
            >
              <Camera className="w-4 h-4 mr-1" />({photos.length})
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
              data-testid="messages-tab"
            >
              <Phone className="w-4 h-4 mr-1" />
              Comms
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 font-mono text-xs uppercase"
              data-testid="documents-tab"
            >
              Docs ({documents.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="mt-4 md:mt-6">
            <div className="mb-4 md:mb-6">
              <textarea
                placeholder="Add a note... Use @name to tag team members"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="input-tactical w-full px-3 py-3 text-sm min-h-[80px] mb-3"
                rows={3}
                data-testid="new-note-input"
              />
              <button
                onClick={handleAddNote}
                className="btn-tactical px-5 py-2.5 text-sm w-full sm:w-auto flex items-center justify-center gap-2"
                disabled={addingNote || !newNote.trim()}
                data-testid="add-note-btn"
              >
                {addingNote ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Note'
                )}
              </button>
            </div>

            <div className="space-y-4">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30"
                    data-testid={`note-${note.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-orange-500/20 border border-orange-500/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-400 text-xs font-tactical font-medium">
                            {getInitials(note.author_name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-200 text-sm truncate">
                            {note.author_name}
                          </p>
                          <p className="text-[10px] text-zinc-600 font-mono">
                            {formatDate(note.created_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-zinc-300 break-words text-sm">{note.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 text-center py-4 font-mono text-sm">
                  No notes yet. Add the first note above.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="messages" className="mt-4 md:mt-6">
            <ClaimCommsPanel
              claimId={claimId}
              clientPhone={claim.client_phone}
              clientName={claim.client_name}
              claimReadiness={floridaReadiness}
              prefillDraft={commsDraftPrefill}
              onPrefillConsumed={handleCommsDraftConsumed}
            />
          </TabsContent>

          <TabsContent value="photos" className="mt-4 md:mt-6">
            {loadingPhotos ? (
              <div className="flex items-center justify-center py-8">
                <div className="spinner-tactical w-6 h-6" />
              </div>
            ) : photos.length > 0 ? (
              <div className="space-y-4">
                {/* Photo Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700/50 cursor-pointer hover:border-orange-500/50 transition-all group"
                      onClick={() => setSelectedPhoto(photo)}
                      data-testid={`photo-${photo.id}`}
                    >
                      <img
                        src={`${API_URL}/api/inspections/photos/${photo.id}/image`}
                        alt={photo.room || 'Inspection photo'}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay with info */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-medium truncate">
                            {photo.room || 'No room'}
                          </p>
                          {photo.category && (
                            <p className="text-white/70 text-[10px] truncate">{photo.category}</p>
                          )}
                        </div>
                      </div>
                      {/* Voice note indicator */}
                      {photo.voice_transcript && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="w-3 h-3 text-white"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Photo count summary */}
                <div className="text-xs text-zinc-500 text-center font-mono">
                  {photos.length} photo{photos.length !== 1 ? 's' : ''} from inspections
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
                  <Camera className="w-8 h-8 text-zinc-600" />
                </div>
                <p className="text-zinc-400 mb-2 font-tactical">No Photos Captured</p>
                <p className="text-xs text-zinc-600 mb-4 font-mono">
                  Start an inspection to capture photos
                </p>
                <button
                  onClick={() => navigate(`/inspections`)}
                  className="btn-tactical px-5 py-2.5 text-sm"
                  data-testid="start-inspection-from-photos-btn"
                >
                  <Camera className="w-4 h-4 mr-2 inline" />
                  Deploy Recon
                </button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4 md:mt-6">
            <div className="space-y-3">
              {documents.length > 0 ? (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-500/30 transition-colors"
                    data-testid={`doc-${doc.id}`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                        <FileText className="w-6 h-6 text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-200 truncate">{doc.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {doc.type} • {doc.size}
                        </p>
                        <p className="text-[10px] text-zinc-600 font-mono">
                          Uploaded by {doc.uploaded_by} on {formatDate(doc.uploaded_at)}
                        </p>
                      </div>
                    </div>
                    <button className="px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all w-full sm:w-auto justify-center">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 text-center py-4 font-mono text-sm">
                  No documents uploaded yet.
                </p>
              )}
            </div>
            <button
              className="w-full mt-4 px-4 py-3 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center justify-center gap-2 transition-all"
              data-testid="upload-document-btn"
            >
              <Upload className="w-4 h-4" />
              Upload Document
            </button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Appointment Modal */}
      <ScheduleAppointmentModal
        open={showScheduleModal}
        onOpenChange={setShowScheduleModal}
        appointmentForm={appointmentForm}
        setAppointmentForm={setAppointmentForm}
        onSchedule={handleScheduleAppointment}
        isScheduling={schedulingAppointment}
      />

      {/* Photo Viewer Modal */}
      <PhotoViewerModal
        photo={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
      />
    </div>
  );
};

export default ClaimDetails;
