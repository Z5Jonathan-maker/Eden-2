import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Loader2, RefreshCw, Search, Clock3, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import EvidenceDrawer from './EvidenceDrawer';

const EVENT_TYPES = [
  '',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'ATTACHMENT_ADDED',
  'ESTIMATE_UPLOADED',
  'ESTIMATE_REVISED',
  'INSPECTION_SCHEDULED',
  'INSPECTION_COMPLETED',
  'DOC_SUBMITTED_TO_CARRIER',
  'COVERAGE_DETERMINATION',
  'PAYMENT_ISSUED',
  'REQUEST_FOR_INFO',
  'RECORDED_STATEMENT_REQUESTED',
  'MEDIATION_APPRAISAL',
  'CLAIM_CLOSED',
  'NOTE',
];

const ClaimTimelineTab = ({ claimId }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningIngest, setRunningIngest] = useState(false);
  const [eventType, setEventType] = useState('');
  const [query, setQuery] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const fetchTimeline = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (eventType) params.set('event_type', eventType);
    if (query.trim()) params.set('q', query.trim());

    const res = await apiGet(`/api/claims/${claimId}/timeline?${params.toString()}`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to load timeline');
      setLoading(false);
      return;
    }
    setEvents(res.data.events || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const runIngestion = async () => {
    setRunningIngest(true);
    const res = await apiPost(`/api/claims/${claimId}/evidence/ingest/run`, { mode: 'manual' });
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Ingestion failed');
      setRunningIngest(false);
      return;
    }
    toast.success(`Ingestion ${res.data.status || 'started'}`);
    await fetchTimeline();
    setRunningIngest(false);
  };

  const openEventEvidence = async (eventId) => {
    setLoadingEvidence(true);
    const res = await apiGet(`/api/claims/${claimId}/timeline/events/${eventId}`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to load event evidence');
      setLoadingEvidence(false);
      return;
    }
    const primaryEvidence = (res.data.evidence || [])[0];
    if (!primaryEvidence) {
      toast.error('No linked evidence found for this event');
      setLoadingEvidence(false);
      return;
    }
    setSelectedEvidence(primaryEvidence);
    setLoadingEvidence(false);
  };

  const openRawSource = async (evidenceId) => {
    const res = await apiGet(`/api/claims/${claimId}/evidence/items/${evidenceId}/raw`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Raw source unavailable');
      return;
    }
    window.open(res.data.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <select
            className="input-tactical px-3 py-2 text-xs"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            {EVENT_TYPES.map((type) => (
              <option key={type || 'all'} value={type}>
                {type || 'All event types'}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2.5 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-tactical pl-7 pr-2 py-2 text-xs"
              placeholder="Search timeline"
            />
          </div>
          <button
            onClick={fetchTimeline}
            className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
        <button
          onClick={runIngestion}
          disabled={runningIngest}
          className="px-3 py-2 rounded border border-emerald-600/40 text-emerald-300 hover:text-emerald-200 text-xs uppercase font-mono flex items-center gap-2"
        >
          {runningIngest ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock3 className="w-3 h-3" />}
          Run Email Ingest
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Loading timeline...
        </div>
      ) : events.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 font-mono text-xs uppercase">
          No timeline events found
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-3 rounded border border-zinc-800 bg-zinc-900/50 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
            >
              <div>
                <p className="text-zinc-100 text-sm">{event.summary || event.event_type}</p>
                <p className="text-[10px] text-zinc-500 font-mono mt-1">
                  {event.event_type} | {new Date(event.occurred_at || event.ingested_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => openEventEvidence(event.id)}
                disabled={loadingEvidence}
                className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
              >
                <ExternalLink className="w-3 h-3" />
                Show Evidence
              </button>
            </div>
          ))}
        </div>
      )}

      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
        onOpenRaw={openRawSource}
      />
    </div>
  );
};

export default ClaimTimelineTab;

