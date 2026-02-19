import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import EvidenceDrawer from './EvidenceDrawer';

const ClaimEvidenceReviewTab = ({ claimId }) => {
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  const fetchQueue = async () => {
    setLoading(true);
    const res = await apiGet(`/api/claims/${claimId}/evidence/review-queue?status=pending`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to load review queue');
      setLoading(false);
      return;
    }
    setQueueItems(res.data.items || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId]);

  const approveItem = async (queueId) => {
    setWorkingId(queueId);
    const res = await apiPost(`/api/claims/${claimId}/evidence/review-queue/${queueId}/approve`, {
      tags: [],
      note: '',
    });
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to approve item');
      setWorkingId(null);
      return;
    }
    toast.success('Evidence approved');
    await fetchQueue();
    setWorkingId(null);
  };

  const rejectItem = async (queueId) => {
    const reason = window.prompt('Reject reason');
    if (!reason) return;
    setWorkingId(queueId);
    const res = await apiPost(`/api/claims/${claimId}/evidence/review-queue/${queueId}/reject`, { reason });
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to reject item');
      setWorkingId(null);
      return;
    }
    toast.success('Evidence rejected');
    await fetchQueue();
    setWorkingId(null);
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
      <div className="flex justify-between items-center">
        <p className="text-xs text-zinc-500 font-mono uppercase">
          Pending relevance review ({queueItems.length})
        </p>
        <button
          onClick={fetchQueue}
          className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
          Loading review queue...
        </div>
      ) : queueItems.length === 0 ? (
        <div className="py-10 text-center text-zinc-500 font-mono text-xs uppercase">
          Review queue is empty
        </div>
      ) : (
        <div className="space-y-2">
          {queueItems.map((item) => {
            const evidence = item.evidence_item;
            return (
              <div
                key={item.id}
                className="p-3 rounded border border-zinc-800 bg-zinc-900/50"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-zinc-100 text-sm">{evidence?.title || 'Evidence item'}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">
                      Score: {Math.round(item.score || 0)} | {evidence?.kind || 'unknown'} | {evidence?.source_id || ''}
                    </p>
                    {Array.isArray(item.reasons) && item.reasons.length > 0 && (
                      <p className="text-[11px] text-zinc-400 mt-2">
                        {item.reasons.slice(0, 3).join(' | ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedEvidence(evidence)}
                      className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Inspect
                    </button>
                    <button
                      onClick={() => approveItem(item.id)}
                      disabled={workingId === item.id}
                      className="px-3 py-2 rounded border border-emerald-600/40 text-emerald-300 hover:text-emerald-200 text-xs uppercase font-mono flex items-center gap-2"
                    >
                      {workingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => rejectItem(item.id)}
                      disabled={workingId === item.id}
                      className="px-3 py-2 rounded border border-red-600/40 text-red-300 hover:text-red-200 text-xs uppercase font-mono flex items-center gap-2"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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

export default ClaimEvidenceReviewTab;

