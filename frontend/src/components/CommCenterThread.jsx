import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Phone, MessageSquare, ArrowLeft, Info, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { apiGet } from '../lib/api';
import ClaimCommsPanel from './ClaimCommsPanel';
import CommCenterDialer from './CommCenterDialer';

const CommCenterThread = () => {
  const { claimId } = useParams();
  const [claim, setClaim] = useState(null);
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [claimRes, callsRes] = await Promise.all([
      apiGet(`/api/claims/${claimId}`),
      apiGet(`/api/voice-assistant/calls?claim_id=${claimId}&limit=25`),
    ]);

    if (claimRes.ok) {
      setClaim(claimRes.data);
    } else {
      toast.error(claimRes.error || 'Failed to load claim');
    }

    if (callsRes.ok) {
      setCalls(callsRes.data.calls || []);
    }

    setLoading(false);
  }, [claimId]);

  useEffect(() => {
    if (claimId) fetchData();
  }, [claimId, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="spinner-tactical w-8 h-8" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="card-tactical p-6 text-zinc-400">
        Claim not found.{' '}
        <Link to="/comms/chat" className="text-orange-400 underline">
          Return to Comms
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/comms/chat" className="text-xs text-orange-400 flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" /> Back to Comms
          </Link>
          <h1 className="text-xl font-tactical text-white tracking-wide mt-2">
            Client Thread: {claim.client_name || claim.insured_name || 'Unknown'}
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            {claim.claim_number ? `Claim #${claim.claim_number}` : 'No claim number'} -{' '}
            {claim.property_address || claim.loss_location || 'No address'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <Phone className="w-4 h-4" />
          {claim.client_phone || 'No phone'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="card-tactical p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
                How This Thread Works
              </h3>
            </div>
            <p className="text-xs text-zinc-400">
              Use this claim thread for direct client communications: voice calls on the left and
              SMS on the right. Team GIF/file collaboration stays in the main Comms inbox channels.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-300 inline-flex items-center gap-1">
                <PhoneCall className="w-3 h-3" /> Voice
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 text-cyan-300 inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> SMS
              </span>
            </div>
          </div>

          <CommCenterDialer claimId={claimId} defaultNumber={claim.client_phone} />

          <div className="card-tactical p-4">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
                Recent Calls
              </h3>
            </div>
            {calls.length === 0 ? (
              <p className="text-xs text-zinc-500">No calls logged yet.</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {calls.map((call) => (
                  <div
                    key={call.id}
                    className="p-2 rounded-lg border border-zinc-700/40 bg-zinc-900/40"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-300">{call.from_number || 'Unknown'}</span>
                      <span className="text-zinc-500">
                        {new Date(call.start_time).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1">
                      Status: {call.call_status || call.intent || 'unknown'}
                    </div>
                    {call.ai_summary && (
                      <p className="text-[11px] text-zinc-300 mt-1 line-clamp-2">
                        {call.ai_summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card-tactical p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">
                SMS Thread
              </h3>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Send and review client text messages tied to this claim. Calls and summaries are
              tracked in Recent Calls.
            </p>
            <ClaimCommsPanel
              claimId={claimId}
              clientPhone={claim.client_phone}
              clientName={claim.client_name}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommCenterThread;
