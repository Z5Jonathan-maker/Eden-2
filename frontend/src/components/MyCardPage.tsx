// @ts-nocheck
/**
 * MyCard.jsx - Enzy-style digital business card operations hub
 * Modular tactical card builder with live preview, share distribution,
 * engagement hooks, feedback capture, and local draft persistence.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Loader2,
  Shield,
  Edit2,
  Share2,
  BarChart3,
  Users,
  X,
  Target,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PAGE_ICONS } from '../assets/badges';
import { API_URL } from '../lib/api';
import {
  TemplateSelector,
  HeadshotUploader,
  ShareModal,
  FeedbackModule,
  EngagementPanel,
  PerformanceSummary,
  LivePreviewPanel,
  ReviewsPanel,
  useAnalyticsHooks,
  updateLeaderboardWithCardEvent,
  DEFAULT_FORM,
} from './mycard_modules/index';
import { TEMPLATES, TEMPLATE_FALLBACK_ID, toTemplateKey } from './mycard_modules/TemplateThemes';
import { TemplateKey } from './mycard_modules/types';

const DRAFT_KEY = 'eden.mycard.draft.v2';

const MyCardPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState(null);
  const [hasCard, setHasCard] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>(TEMPLATE_FALLBACK_ID);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [headshotFile, setHeadshotFile] = useState(null);
  const [headshotPreview, setHeadshotPreview] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [cardUrl, setCardUrl] = useState('');
  const [teamCards, setTeamCards] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);

  const {
    metrics,
    summary,
    trackCardView,
    trackCardOpen,
    trackCardSend,
    trackCardShare,
    trackCardFeedback,
    setMetrics,
  } = useAnalyticsHooks();

  const trackCardViewEvent = useCallback((cardId) => {
    trackCardView(cardId);
  }, [trackCardView]);

  const trackCardOpenEvent = useCallback((cardId) => {
    trackCardOpen(cardId);
  }, [trackCardOpen]);

  const trackCardSendEvent = useCallback((cardId) => {
    trackCardSend(cardId);
  }, [trackCardSend]);

  const trackCardShareEvent = useCallback((cardId) => {
    trackCardShare(cardId);
  }, [trackCardShare]);

  const trackCardFeedbackEvent = useCallback((cardId, feedback) => {
    trackCardFeedback(cardId, feedback);
  }, [trackCardFeedback]);

  const hydrateFromDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.formData) setFormData(prev => ({ ...prev, ...draft.formData }));
      if (draft.selectedTemplate) setSelectedTemplate(toTemplateKey(draft.selectedTemplate));
      if (draft.headshotPreview) setHeadshotPreview(draft.headshotPreview);
    } catch {
      // Ignore corrupted local draft payloads.
    }
  }, []);

  const persistDraft = useCallback((nextForm, nextTemplate, nextHeadshotPreview) => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      formData: nextForm,
      selectedTemplate: nextTemplate,
      headshotPreview: nextHeadshotPreview,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  useEffect(() => {
    hydrateFromDraft();
  }, [hydrateFromDraft]);

  useEffect(() => {
    persistDraft(formData, selectedTemplate, headshotPreview);
  }, [formData, selectedTemplate, headshotPreview, persistDraft]);

  useEffect(() => {
    if (!headshotFile) return;
    const reader = new FileReader();
    reader.onloadend = () => setHeadshotPreview(String(reader.result || ''));
    reader.readAsDataURL(headshotFile);
  }, [headshotFile]);

  const validateField = useCallback((field, value, nextState = formData) => {
    const next = { ...errors };
    const trimmed = typeof value === 'string' ? value.trim() : value;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const licensePattern = /^[A-Za-z0-9-]+$/;

    if (field === 'full_name') {
      if (!trimmed) next.full_name = 'Operator name is required.';
      else delete next.full_name;
    }

    if (field === 'phone') {
      if (!trimmed) next.phone = 'Phone is required.';
      else delete next.phone;
    }

    if (field === 'email') {
      if (!trimmed) next.email = 'Email is required.';
      else if (!emailPattern.test(trimmed)) next.email = 'Enter a valid email.';
      else delete next.email;
    }

    if (field === 'license_number') {
      if (!trimmed) next.license_number = 'License number is required.';
      else if (!licensePattern.test(trimmed)) next.license_number = 'Use letters, numbers, and dashes only.';
      else delete next.license_number;
    }

    const hasHeadshot = Boolean(headshotFile || headshotPreview || nextState?.profile_photo_url || card?.profile_photo_url);
    if (!hasHeadshot) next.headshot = 'Headshot is required.';
    else delete next.headshot;

    setErrors(next);
    return next;
  }, [card, errors, formData, headshotFile, headshotPreview]);

  const validateAll = useCallback((nextState = formData) => {
    const fields = ['full_name', 'phone', 'email', 'license_number'];
    let merged = { ...errors };
    fields.forEach((field) => {
      merged = { ...merged, ...validateField(field, nextState[field], nextState) };
    });
    setErrors(merged);
    return merged;
  }, [errors, formData, validateField]);

  const isFormValid = useMemo(() => {
    const hasRequired = formData.full_name && formData.phone && formData.email && formData.license_number;
    const hasHeadshot = Boolean(headshotFile || headshotPreview || card?.profile_photo_url);
    const noErrors = Object.keys(errors).length === 0;
    return Boolean(hasRequired && hasHeadshot && noErrors);
  }, [card, errors, formData, headshotFile, headshotPreview]);

  const buildSubmissionPayload = useCallback(() => {
    const jsonPayload = {
      ...formData,
      card_style: selectedTemplate,
      accent_color: TEMPLATES[selectedTemplate]?.accentColor || '#22d3ee',
      template_id: selectedTemplate,
      profile_photo_url: headshotPreview || card?.profile_photo_url || null,
      headshot_file_name: headshotFile?.name || null,
      headshot_mime_type: headshotFile?.type || null,
    };

    const multipart = new FormData();
    Object.entries(jsonPayload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) multipart.append(key, value);
    });
    if (headshotFile) multipart.append('headshot_file', headshotFile);

    return { jsonPayload, multipart };
  }, [card, formData, headshotFile, headshotPreview, selectedTemplate]);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mycard/me`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();

      setCard(data.card || null);
      setHasCard(Boolean(data.has_card));
      setQrCode(data.qr_code || '');
      setCardUrl(data.card_url || '');
      if (data.analytics) {
        setMetrics(prev => ({
          ...prev,
          views: data.analytics.total_views || 0,
          opens: data.analytics.unique_visitors || 0,
          sends: data.analytics.shares || 0,
        }));
      }

      if (data.card) {
        const hydrated = {
          full_name: data.card.full_name || '',
          title: data.card.title || '',
          company: data.card.company || '',
          phone: data.card.phone || '',
          email: data.card.email || '',
          bio: data.card.bio || '',
          tagline: data.card.tagline || '',
          license_number: data.card.license_number || '',
        };
        setFormData(hydrated);
        setSelectedTemplate(toTemplateKey(data.card.card_style));
        if (data.card.profile_photo_url) setHeadshotPreview(data.card.profile_photo_url);
      }
    } catch (error) {
      console.error('mycard fetch failed', error);
      toast.error('Failed to load My Card data');
    } finally {
      setLoading(false);
    }
  }, [setMetrics]);

  const fetchTeamCards = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/mycard/team`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setTeamCards(data.team_cards || []);
    } catch {
      toast.error('Failed to load team cards');
    }
  }, []);

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  useEffect(() => {
    const id = card?.user_id || 'draft';
    trackCardViewEvent(id);
    trackCardOpenEvent(id);
  }, [card?.user_id, trackCardOpenEvent, trackCardViewEvent]);

  const submitCard = async (method) => {
    const nextErrors = validateAll(formData);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Complete all required fields before deploy.');
      return;
    }

    const endpoint = method === 'POST' ? 'create' : 'update';
    const payload = buildSubmissionPayload();

    setSaving(true);
    try {
      let uploadedPhotoUrl = payload.jsonPayload.profile_photo_url;
      if (headshotFile) {
        const form = new FormData();
        form.append('file', headshotFile);
        const uploadRes = await fetch(`${API_URL}/api/mycard/upload-headshot`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json().catch(() => ({}));
          throw new Error(uploadErr.detail || 'Headshot upload failed');
        }
        const uploadData = await uploadRes.json();
        uploadedPhotoUrl = uploadData.profile_photo_url || uploadedPhotoUrl;
      }

      const res = await fetch(`${API_URL}/api/mycard/${endpoint}`, {
        method,
        headers: {
          credentials: 'include',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload.jsonPayload,
          profile_photo_url: uploadedPhotoUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Unable to deploy card');
      }

      toast.success('Card deployed successfully');
      setIsEditing(false);
      localStorage.removeItem(DRAFT_KEY);
      await fetchCard();
    } catch (error) {
      toast.error(error.message || 'Deploy failed');
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (cardUrl) return `${window.location.origin}${cardUrl}`;
    if (card?.slug) return `${window.location.origin}/card/${card.slug}`;
    return `${window.location.origin}/card/draft`;
  }, [card?.slug, cardUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    trackCardShareEvent(card?.user_id || 'draft');
    updateLeaderboardWithCardEvent('share', { cardId: card?.user_id || 'draft', shareUrl });
    toast.success('Card link copied');
  };

  const handleShareOption = (channel) => {
    trackCardSendEvent(card?.user_id || 'draft');
    updateLeaderboardWithCardEvent('send', { cardId: card?.user_id || 'draft', channel });
    toast.success(`Send queued: ${channel}`);
  };

  const submitFeedback = (feedback) => {
    trackCardFeedbackEvent(card?.user_id || 'draft', feedback);
    updateLeaderboardWithCardEvent('feedback', { cardId: card?.user_id || 'draft', feedback });
    toast.success('Feedback received');
  };

  const currentTemplate = TEMPLATES[selectedTemplate] || TEMPLATES[TEMPLATE_FALLBACK_ID];

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-tactical-animated">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading MyCard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-tactical-animated page-enter" data-testid="mycard-page">
      <div className="mb-6 animate-fade-in-up">
        <div className="flex items-center gap-4 mb-2">
          <img
            src={PAGE_ICONS.my_card}
            alt="My Card"
            className="w-12 h-12 sm:w-16 sm:h-16 object-contain animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 15px rgba(249, 115, 22, 0.5))' }}
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">MY CARD</h1>
            <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Tactical Commander Card Operations</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: 'builder', label: 'Builder', icon: Target },
          { id: 'engagement', label: 'Engagement', icon: BarChart3 },
          { id: 'team', label: 'Team', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'team') fetchTeamCards();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm uppercase transition-all ${activeTab === tab.id
              ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
              : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 card-tactical p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-tactical font-bold text-white text-xl uppercase">Create Your Card</h2>
              {hasCard && !isEditing ? (
                <Button variant="outline" className="border-zinc-700/40 text-zinc-300" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : hasCard ? (
                <Button variant="ghost" className="text-zinc-400" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              ) : null}
            </div>

            {(isEditing || !hasCard) && (
              <>
                <TemplateSelector selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate} />

                <div className="space-y-4">
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4">
                    <h3 className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-3">Operator Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">OPERATOR NAME *</label>
                        <Input
                          value={formData.full_name}
                          className="input-tactical"
                          onChange={(e) => {
                            const next = { ...formData, full_name: e.target.value };
                            setFormData(next);
                            validateField('full_name', e.target.value, next);
                          }}
                        />
                        {errors.full_name && <p className="text-red-400 text-xs mt-1">{errors.full_name}</p>}
                      </div>
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">RANK / TITLE</label>
                        <Input value={formData.title} className="input-tactical" onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">ORGANIZATION</label>
                        <Input value={formData.company} className="input-tactical" onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">CALLSIGN / TAGLINE</label>
                        <Input value={formData.tagline} className="input-tactical" onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4">
                    <h3 className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">COMMS (PHONE) *</label>
                        <Input
                          value={formData.phone}
                          className="input-tactical"
                          onChange={(e) => {
                            const next = { ...formData, phone: e.target.value };
                            setFormData(next);
                            validateField('phone', e.target.value, next);
                          }}
                        />
                        {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                      </div>
                      <div>
                        <label className="text-zinc-300 font-mono text-sm">SECURE EMAIL *</label>
                        <Input
                          value={formData.email}
                          className="input-tactical"
                          onChange={(e) => {
                            const next = { ...formData, email: e.target.value };
                            setFormData(next);
                            validateField('email', e.target.value, next);
                          }}
                        />
                        {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/60 p-4">
                    <h3 className="text-xs text-orange-400 font-mono uppercase tracking-wider mb-3">Credentials</h3>
                    <div>
                      <label className="text-zinc-300 font-mono text-sm">PUBLIC ADJUSTER LICENSE NUMBER *</label>
                      <Input
                        value={formData.license_number}
                        className="input-tactical"
                        onChange={(e) => {
                          const next = { ...formData, license_number: e.target.value };
                          setFormData(next);
                          validateField('license_number', e.target.value, next);
                        }}
                      />
                      {errors.license_number && <p className="text-red-400 text-xs mt-1">{errors.license_number}</p>}
                    </div>
                  </div>

                  <HeadshotUploader
                    error={errors.headshot}
                    previewUrl={headshotPreview || card?.profile_photo_url || ''}
                    onFileSelected={(file) => {
                      setHeadshotFile(file);
                      if (!file) return;
                      setErrors(prev => {
                        const next = { ...prev };
                        delete next.headshot;
                        return next;
                      });
                    }}
                  />

                  <div>
                    <label className="text-zinc-300 font-mono text-sm">OPERATOR BIO</label>
                    <Textarea
                      rows={4}
                      className="input-tactical resize-none"
                      value={formData.bio}
                      onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      className="btn-tactical flex-1"
                      disabled={saving || !isFormValid}
                      onClick={() => submitCard(hasCard ? 'PUT' : 'POST')}
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deploying...</>
                      ) : (
                        <><Shield className="w-4 h-4 mr-2" />Deploy Business Card</>
                      )}
                    </Button>
                    {hasCard && (
                      <Button className="flex-1" variant="outline" onClick={() => setShareOpen(true)}>
                        <Share2 className="w-4 h-4 mr-2" />Share & Distribute
                      </Button>
                    )}
                  </div>
                  {!isFormValid && <p className="text-xs font-mono text-zinc-500">Complete required fields to deploy.</p>}
                </div>
              </>
            )}

            {hasCard && !isEditing && (
              <div className="space-y-4">
                <div className="card-tactical p-4 border border-zinc-700/40">
                  <p className="text-zinc-400 font-mono text-sm">Card deployed with template: <span style={{ color: currentTemplate.accentColor }}>{selectedTemplate}</span></p>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={() => setShareOpen(true)} className="btn-tactical"><Share2 className="w-4 h-4 mr-2" />Share & Distribute</Button>
                    <Button variant="outline" onClick={() => trackCardOpenEvent(card?.user_id || 'draft')} className="border-zinc-700/40 text-zinc-300"><Eye className="w-4 h-4 mr-2" />Simulate Open</Button>
                  </div>
                </div>
                <FeedbackModule disabled={!hasCard} onSubmit={submitFeedback} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <LivePreviewPanel
              formData={formData}
              selectedTemplate={selectedTemplate}
              headshotPreview={headshotPreview || card?.profile_photo_url || ''}
              shareUrl={shareUrl || "https://eden.app/card/preview"}
            />
            <EngagementPanel metrics={metrics} />
            <PerformanceSummary openRate={summary.openRate} engagementScore={summary.engagementScore} />
          </div>
        </div>
      )}

      {activeTab === 'engagement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EngagementPanel metrics={metrics} />
          <PerformanceSummary openRate={summary.openRate} engagementScore={summary.engagementScore} />
          <div className="lg:col-span-2">
            <ReviewsPanel />
          </div>
          <div className="lg:col-span-2">
            <FeedbackModule disabled={!hasCard} onSubmit={submitFeedback} />
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-tactical text-white uppercase">Squad Cards</h2>
            <span className="text-zinc-500 font-mono text-sm">{teamCards.length} members</span>
          </div>
          {teamCards.length === 0 ? (
            <div className="card-tactical p-6 text-center text-zinc-500 font-mono">No team cards found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamCards.map(({ card: tc, analytics: ta }) => (
                <div key={tc.user_id} className="card-tactical p-4">
                  <p className="font-tactical text-white truncate">{tc.full_name}</p>
                  <p className="text-zinc-500 text-xs font-mono truncate">{tc.title}</p>
                  <div className="flex justify-between mt-2 text-xs font-mono">
                    <span className="text-blue-400">{ta?.total_views || 0} views</span>
                    <span className="text-green-400">{ta?.shares || 0} shares</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={shareUrl}
        qrCode={qrCode}
        onCopy={handleCopy}
        onTrackSend={handleShareOption}
      />
    </div>
  );
};

export default MyCardPage;




