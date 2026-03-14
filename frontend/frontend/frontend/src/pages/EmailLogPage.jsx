import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Mail, Search, Filter, Paperclip, Download, ExternalLink,
  Clock, Tag, Plus, Link2, Brain, ChevronRight, Inbox,
  MailOpen, X, ArrowLeft, FileText, AlertCircle, RefreshCw,
} from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Input } from '../shared/ui/input';
import { Textarea } from '../shared/ui/textarea';
import { ScrollArea } from '../shared/ui/scroll-area';
import { Skeleton } from '../shared/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../shared/ui/dialog';

// ── Constants ────────────────────────────────────────────────────────────────

const TAG_CONFIG = {
  settlement: { label: 'Settlement', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  estimate:   { label: 'Estimate',   color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  denial:     { label: 'Denial',     color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  carrier:    { label: 'Carrier',    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  client:     { label: 'Client',     color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  supplement: { label: 'Supplement', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

const FILTER_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'settlement', label: 'Settlement' },
  { key: 'estimate',   label: 'Estimate' },
  { key: 'denial',     label: 'Denial' },
  { key: 'carrier',    label: 'Carrier' },
  { key: 'client',     label: 'Client' },
  { key: 'unmatched',  label: 'Unmatched' },
];

const EMPTY_FORM = {
  from_address: '',
  to_address: '',
  subject: '',
  body: '',
  claim_id: '',
  tags: [],
  received_at: new Date().toISOString().slice(0, 16),
};

// ── Sub-components ───────────────────────────────────────────────────────────

function EmailTagBadge({ tag }) {
  const config = TAG_CONFIG[tag];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.color}`}>
      {config.label}
    </span>
  );
}

function ClaimBadge({ claimNumber, onClick }) {
  if (!claimNumber) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400 hover:bg-orange-500/25 transition-colors"
    >
      <FileText className="w-3 h-3" />
      #{claimNumber}
    </button>
  );
}

function EmailListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmailDetailSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-white/5 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-zinc-500" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm">{description}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-300 mb-1">Failed to load emails</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button variant="tacticalOutline" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      )}
    </div>
  );
}

// ── Email List Item ──────────────────────────────────────────────────────────

function EmailListItem({ email, isSelected, onSelect }) {
  const navigate = useNavigate();
  const dateStr = email.received_at
    ? new Date(email.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <button
      onClick={() => onSelect(email)}
      className={`w-full text-left px-3 py-3 rounded-lg transition-all duration-150 group ${
        isSelected
          ? 'bg-orange-500/10 border border-orange-500/30'
          : 'hover:bg-zinc-800/60 border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className={`text-sm font-medium truncate ${isSelected ? 'text-orange-300' : 'text-zinc-200'}`}>
          {email.from_name || email.from_address || 'Unknown'}
        </span>
        <span className="text-[11px] text-zinc-500 whitespace-nowrap flex-shrink-0">{dateStr}</span>
      </div>

      <p className="text-sm text-zinc-300 truncate mb-1.5">{email.subject || '(No Subject)'}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {email.claim_number && (
          <ClaimBadge
            claimNumber={email.claim_number}
            onClick={() => navigate(`/claims/${email.claim_id}`)}
          />
        )}
        {(email.tags || []).map((tag) => (
          <EmailTagBadge key={tag} tag={tag} />
        ))}
        {email.has_attachments && (
          <Paperclip className="w-3 h-3 text-zinc-500" />
        )}
      </div>
    </button>
  );
}

// ── Email Detail Panel ───────────────────────────────────────────────────────

function EmailDetailPanel({ email, onBack }) {
  const navigate = useNavigate();
  if (!email) {
    return (
      <EmptyState
        icon={MailOpen}
        title="Select an email"
        description="Choose an email from the list to view its details, attachments, and AI analysis."
      />
    );
  }

  const receivedDate = email.received_at
    ? new Date(email.received_at).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : 'Unknown date';

  return (
    <div className="flex flex-col h-full">
      {/* Mobile back button */}
      <button
        onClick={onBack}
        className="lg:hidden flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 px-4 pt-4 pb-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to list
      </button>

      <ScrollArea className="flex-1">
        <div className="p-4 lg:p-6 space-y-5">
          {/* Subject */}
          <h2 className="text-xl font-bold text-zinc-100 leading-tight">
            {email.subject || '(No Subject)'}
          </h2>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-400">
                  {(email.from_name || email.from_address || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-zinc-200">{email.from_name || email.from_address}</p>
                {email.from_name && (
                  <p className="text-xs text-zinc-500">{email.from_address}</p>
                )}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">{receivedDate}</span>
            </div>
          </div>

          {/* To */}
          {email.to_address && (
            <p className="text-xs text-zinc-500">
              To: <span className="text-zinc-400">{email.to_address}</span>
            </p>
          )}

          {/* Tags & Claim */}
          <div className="flex flex-wrap items-center gap-2">
            {email.claim_number && (
              <ClaimBadge
                claimNumber={email.claim_number}
                onClick={() => navigate(`/claims/${email.claim_id}`)}
              />
            )}
            {(email.tags || []).map((tag) => (
              <EmailTagBadge key={tag} tag={tag} />
            ))}
          </div>

          <div className="border-t border-white/5" />

          {/* AI Summary */}
          {email.ai_summary && (
            <Card tactical className="border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    AI Summary
                  </span>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{email.ai_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Extracted Data */}
          {email.extracted_data && Object.keys(email.extracted_data).length > 0 && (
            <Card tactical className="border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                    Extracted Data
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(email.extracted_data).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-zinc-500 capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                      <span className="text-zinc-200 font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Body */}
          <div className="bg-zinc-900/60 rounded-xl border border-white/5 p-4">
            <div
              className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: email.body_html || email.body || '<em class="text-zinc-500">No content</em>',
              }}
            />
          </div>

          {/* Attachments */}
          {email.attachments?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                Attachments ({email.attachments.length})
              </h4>
              <div className="space-y-2">
                {email.attachments.map((att, i) => (
                  <a
                    key={att.id || i}
                    href={att.download_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/60 border border-white/5 hover:border-orange-500/30 hover:bg-zinc-800/60 transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-zinc-400 group-hover:text-orange-400 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{att.filename || 'Attachment'}</p>
                      <p className="text-xs text-zinc-500">{att.size ? `${(att.size / 1024).toFixed(1)} KB` : ''} {att.content_type || ''}</p>
                    </div>
                    <Download className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Log Email Modal ──────────────────────────────────────────────────────────

function LogEmailModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [tagInput, setTagInput] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => apiPost('/api/email-log/', data),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success('Email logged successfully');
        queryClient.invalidateQueries({ queryKey: ['email-log'] });
        onOpenChange(false);
        setForm({ ...EMPTY_FORM });
      } else {
        toast.error(res.error || 'Failed to log email');
      }
    },
    onError: () => toast.error('Network error logging email'),
  });

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.from_address || !form.subject) {
      toast.error('From and Subject are required');
      return;
    }
    mutation.mutate({
      ...form,
      claim_id: form.claim_id || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Plus className="w-5 h-5 text-orange-400" /> Log Email
          </DialogTitle>
          <DialogDescription>
            Manually log an email and link it to a claim.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">From *</label>
              <Input
                value={form.from_address}
                onChange={(e) => updateField('from_address', e.target.value)}
                placeholder="sender@example.com"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">To</label>
              <Input
                value={form.to_address}
                onChange={(e) => updateField('to_address', e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">Subject *</label>
            <Input
              value={form.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="Re: Claim #1234 Settlement"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">Claim ID</label>
              <Input
                value={form.claim_id}
                onChange={(e) => updateField('claim_id', e.target.value)}
                placeholder="Optional claim ID"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">Received</label>
              <Input
                type="datetime-local"
                value={form.received_at}
                onChange={(e) => updateField('received_at', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">Tags</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-white/10 px-2.5 py-0.5 text-xs text-zinc-300"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="text-zinc-500 hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="settlement, carrier..."
                className="flex-1"
              />
              <Button type="button" variant="tacticalOutline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">Body</label>
            <Textarea
              value={form.body}
              onChange={(e) => updateField('body', e.target.value)}
              placeholder="Email body content..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="tacticalGhost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="tactical" disabled={mutation.isPending}>
              {mutation.isPending ? 'Logging...' : 'Log Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Match to Claim Modal ─────────────────────────────────────────────────────

function MatchClaimModal({ email, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [claimId, setClaimId] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => apiPost(`/api/email-log/${email?.id}/match`, data),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success('Email matched to claim');
        queryClient.invalidateQueries({ queryKey: ['email-log'] });
        onOpenChange(false);
        setClaimId('');
      } else {
        toast.error(res.error || 'Failed to match email');
      }
    },
    onError: () => toast.error('Network error'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Link2 className="w-5 h-5 text-orange-400" /> Match to Claim
          </DialogTitle>
          <DialogDescription>
            Link "{email?.subject}" to a claim.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="Enter Claim ID or Claim #"
          />
        </div>
        <DialogFooter>
          <Button variant="tacticalGhost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="tactical"
            disabled={!claimId.trim() || mutation.isPending}
            onClick={() => mutation.mutate({ claim_id: claimId.trim() })}
          >
            {mutation.isPending ? 'Matching...' : 'Match'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function EmailLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchEmail, setMatchEmail] = useState(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const claimIdParam = searchParams.get('claim');

  // ── Queries ──────────────────────────────────────────────────────────────

  const emailsQuery = useQuery({
    queryKey: ['email-log', 'all'],
    queryFn: () => apiGet('/api/email-log/search?q='),
    staleTime: 30_000,
  });

  const claimEmailsQuery = useQuery({
    queryKey: ['email-log', 'claim', claimIdParam],
    queryFn: () => apiGet(`/api/email-log/claim/${claimIdParam}`),
    enabled: Boolean(claimIdParam),
    staleTime: 30_000,
  });

  const unmatchedQuery = useQuery({
    queryKey: ['email-log', 'unmatched'],
    queryFn: () => apiGet('/api/email-log/unmatched'),
    staleTime: 30_000,
  });

  const searchResultsQuery = useQuery({
    queryKey: ['email-log', 'search', searchQuery],
    queryFn: () => apiGet(`/api/email-log/search?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
    staleTime: 15_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const allEmails = useMemo(() => {
    if (claimIdParam && claimEmailsQuery.data?.ok) {
      return claimEmailsQuery.data.data || [];
    }
    if (searchQuery.length >= 2 && searchResultsQuery.data?.ok) {
      return searchResultsQuery.data.data || [];
    }
    if (emailsQuery.data?.ok) {
      return emailsQuery.data.data || [];
    }
    return [];
  }, [claimIdParam, claimEmailsQuery.data, searchQuery, searchResultsQuery.data, emailsQuery.data]);

  const unmatchedEmails = useMemo(() => {
    if (unmatchedQuery.data?.ok) return unmatchedQuery.data.data || [];
    return [];
  }, [unmatchedQuery.data]);

  const filteredEmails = useMemo(() => {
    if (activeFilter === 'unmatched') return unmatchedEmails;
    if (activeFilter === 'all') return allEmails;
    return allEmails.filter((e) => (e.tags || []).includes(activeFilter));
  }, [allEmails, unmatchedEmails, activeFilter]);

  const isLoading = emailsQuery.isLoading || (claimIdParam && claimEmailsQuery.isLoading);
  const isError = emailsQuery.isError || (claimIdParam && claimEmailsQuery.isError);
  const errorMsg = emailsQuery.error?.message || claimEmailsQuery.error?.message || 'Unknown error';

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectEmail = useCallback((email) => {
    setSelectedEmail(email);
    setMobileShowDetail(true);
  }, []);

  const handleMatchClick = useCallback((email) => {
    setMatchEmail(email);
    setMatchModalOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    emailsQuery.refetch();
    unmatchedQuery.refetch();
    if (claimIdParam) claimEmailsQuery.refetch();
  }, [emailsQuery, unmatchedQuery, claimEmailsQuery, claimIdParam]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 py-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Mail className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Email Log</h1>
              <p className="text-xs text-zinc-500">
                {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''}
                {claimIdParam ? ` for claim ${claimIdParam}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="tacticalOutline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <Button variant="tactical" size="sm" onClick={() => setLogModalOpen(true)}>
              <Plus className="w-4 h-4" /> Log Email
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeFilter === tab.key
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
              }`}
            >
              {tab.label}
              {tab.key === 'unmatched' && unmatchedEmails.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                  {unmatchedEmails.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, sender, or body text..."
            className="pl-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Email List */}
        <div
          className={`w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-white/5 flex flex-col ${
            mobileShowDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <ScrollArea className="flex-1">
            {isLoading && <EmailListSkeleton />}
            {isError && <ErrorState message={errorMsg} onRetry={handleRefresh} />}
            {!isLoading && !isError && filteredEmails.length === 0 && (
              <EmptyState
                icon={Inbox}
                title={activeFilter === 'unmatched' ? 'No unmatched emails' : 'No emails found'}
                description={
                  activeFilter === 'unmatched'
                    ? 'All emails are linked to claims.'
                    : searchQuery
                      ? 'Try a different search term.'
                      : 'No emails have been logged yet.'
                }
              />
            )}
            {!isLoading && !isError && filteredEmails.length > 0 && (
              <div className="p-2 space-y-0.5">
                {filteredEmails.map((email) => (
                  <div key={email.id || email._id} className="relative">
                    <EmailListItem
                      email={email}
                      isSelected={selectedEmail?.id === email.id || selectedEmail?._id === email._id}
                      onSelect={handleSelectEmail}
                    />
                    {activeFilter === 'unmatched' && !email.claim_id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMatchClick(email); }}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20 text-[10px] font-semibold text-orange-400 hover:bg-orange-500/20 transition-colors"
                      >
                        <Link2 className="w-3 h-3" /> Match
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Email Detail */}
        <div
          className={`flex-1 min-w-0 bg-zinc-950/50 ${
            mobileShowDetail ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'
          }`}
        >
          {isLoading && mobileShowDetail ? (
            <EmailDetailSkeleton />
          ) : (
            <EmailDetailPanel
              email={selectedEmail}
              onBack={() => {
                setMobileShowDetail(false);
                setSelectedEmail(null);
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <LogEmailModal open={logModalOpen} onOpenChange={setLogModalOpen} />
      <MatchClaimModal
        email={matchEmail}
        open={matchModalOpen}
        onOpenChange={setMatchModalOpen}
      />
    </div>
  );
}
