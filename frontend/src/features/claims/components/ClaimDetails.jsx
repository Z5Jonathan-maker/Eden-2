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
import ScheduleAppointmentModal from './ScheduleAppointmentModal';
import PhotoViewerModal from './PhotoViewerModal';
import ClaimEditModal from './ClaimEditModal';
import ClaimHeader from './ClaimHeader';
import ClaimQuickActions from './ClaimQuickActions';
import ClaimTabs from './ClaimTabs';
import ClaimFinancials from './ClaimFinancials';
import ClaimCarrierInfo from './ClaimCarrierInfo';
import ClaimTasksPanel from './ClaimTasksPanel';
import ClaimActivityLog from './ClaimActivityLog';
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
    setGeneratingReport(true);
    setActiveTab('reports');
    toast.success('Open Reports tab to generate a PDF report');
    setGeneratingReport(false);
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
    if (status === 'Approved') return 'badge-legendary';
    if (status === 'Denied') return 'badge-mythic';
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

  return (
    <div className="p-4 md:p-8 min-h-screen">
      {/* Header - Tactical Style */}
      <ClaimHeader
        claim={claim}
        navigate={navigate}
        gammaPage={gammaPage}
        creatingGammaPage={creatingGammaPage}
        createGammaStrategyPage={createGammaStrategyPage}
        handleEditClaim={handleEditClaim}
        getStatusColor={getStatusColor}
      />

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
        <ClaimQuickActions
          navigate={navigate}
          openScheduleModal={openScheduleModal}
          handleGenerateAIBrief={handleGenerateAIBrief}
          loadingAiBrief={loadingAiBrief}
          handleGenerateAIDraft={handleGenerateAIDraft}
          loadingAiDraft={loadingAiDraft}
          handleGenerateReport={handleGenerateReport}
          generatingReport={generatingReport}
          handleGenerateDemandManifest={handleGenerateDemandManifest}
          loadingDemandManifest={loadingDemandManifest}
          handleGenerateCopilotActions={handleGenerateCopilotActions}
          loadingCopilotActions={loadingCopilotActions}
          copilotActions={copilotActions}
          copilotEvidenceGaps={copilotEvidenceGaps}
          copilotMeta={copilotMeta}
          getCopilotGapSeverityClass={getCopilotGapSeverityClass}
          executeCopilotGapCta={executeCopilotGapCta}
          aiBrief={aiBrief}
          aiDraft={aiDraft}
          handoffAIDraftToComms={handoffAIDraftToComms}
          copyAIDraft={copyAIDraft}
          handleSendAIDraftEmail={handleSendAIDraftEmail}
          sendingAIDraftEmail={sendingAIDraftEmail}
          handleOpenClaimEditor={handleOpenClaimEditor}
          floridaReadiness={floridaReadiness}
          getDeadlineStatusColor={getDeadlineStatusColor}
          demandManifest={demandManifest}
          handleExportManifestChecklist={handleExportManifestChecklist}
          showDeckMenu={showDeckMenu}
          setShowDeckMenu={setShowDeckMenu}
          generatingDeck={generatingDeck}
          handleGenerateDeck={handleGenerateDeck}
        />
      </div>

      {/* Carrier Info + Financials Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-6">
        <ClaimCarrierInfo claim={claim} />
        <ClaimFinancials claim={claim} />
      </div>

      {/* Tasks Panel */}
      <div className="card-tactical p-5 mb-4 md:mb-6">
        <ClaimTasksPanel claimId={claimId} />
      </div>

      {/* Activity Log */}
      <div className="mb-4 md:mb-6">
        <ClaimActivityLog claimId={claimId} />
      </div>

      {/* Client Status Panel - Stage Progress and Eve Updates */}
      <div className="mb-4 md:mb-6">
        <ClientStatusPanel claimId={claimId} isClientView={false} />
      </div>

      {/* Tabs Section - Tactical Style */}
      <ClaimTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notes={notes}
        photos={photos}
        documents={documents}
        loadingPhotos={loadingPhotos}
        newNote={newNote}
        setNewNote={setNewNote}
        handleAddNote={handleAddNote}
        addingNote={addingNote}
        getInitials={getInitials}
        formatDate={formatDate}
        setSelectedPhoto={setSelectedPhoto}
        claimId={claimId}
        claim={claim}
        floridaReadiness={floridaReadiness}
        commsDraftPrefill={commsDraftPrefill}
        handleCommsDraftConsumed={handleCommsDraftConsumed}
        navigate={navigate}
        onDocumentsChange={(newDoc) => {
          if (newDoc) setDocuments(prev => [newDoc, ...prev]);
        }}
        onNotesChange={(updatedNotes) => setNotes(updatedNotes)}
      />

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
