import React, { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import {
  Activity, Loader2, Edit, ArrowRightLeft, UserPlus, Archive,
  RotateCcw, FileText, ChevronDown, ChevronUp,
} from 'lucide-react';

const EVENT_ICONS = {
  ClaimCreated: FileText,
  ClaimUpdated: Edit,
  ClaimArchived: Archive,
  ClaimRestored: RotateCcw,
};

const EVENT_COLORS = {
  ClaimCreated: 'text-green-400 bg-green-500/10 border-green-500/30',
  ClaimUpdated: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  ClaimArchived: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  ClaimRestored: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

const formatEventDescription = (event) => {
  const details = event.details || {};
  const changes = details.changes || {};
  const changeKeys = Object.keys(changes);

  switch (event.event) {
    case 'ClaimCreated':
      return 'Claim created';
    case 'ClaimArchived':
      return 'Claim archived';
    case 'ClaimRestored':
      return 'Claim restored';
    case 'ClaimUpdated': {
      if (changes.status && details.old_status) {
        return `Status changed: ${details.old_status} → ${changes.status}`;
      }
      if (changes.assigned_to) {
        return `Reassigned to ${changes.assigned_to}`;
      }
      if (changeKeys.length > 0) {
        return `Updated: ${changeKeys.slice(0, 3).join(', ')}${changeKeys.length > 3 ? ` +${changeKeys.length - 3} more` : ''}`;
      }
      return 'Claim updated';
    }
    default:
      return event.event || 'Activity';
  }
};

const ClaimActivityLog = ({ claimId }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/claims/${claimId}/activity?limit=50`);
      if (res.ok) setActivities(res.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [claimId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="card-tactical p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full mb-4"
      >
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Activity Log
          </h3>
          <span className="text-[10px] font-mono text-zinc-500">({activities.length})</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {expanded && (
        loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-zinc-500 text-sm font-mono text-center py-4">
            No activity recorded yet.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-700/50" />
            <div className="space-y-3">
              {activities.map((act, i) => {
                const Icon = EVENT_ICONS[act.event] || Activity;
                const colorClass = EVENT_COLORS[act.event] || 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
                return (
                  <div key={act.id || i} className="flex items-start gap-3 pl-1 relative">
                    <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 z-10 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200">{formatEventDescription(act)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-zinc-500">{act.user}</span>
                        <span className="text-[10px] text-zinc-600">·</span>
                        <span className="text-[10px] font-mono text-zinc-600">{formatTime(act.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ClaimActivityLog;
