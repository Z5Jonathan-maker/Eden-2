import React, { useState, useMemo } from 'react';
import {
  PlusCircle,
  ArrowRightLeft,
  Search as SearchIcon,
  FileText,
  MessageSquare,
  StickyNote,
  Layers,
  Banknote,
  ChevronDown,
  Loader2,
  Activity,
  Eye,
} from 'lucide-react';
import { useClaimActivity } from '../../features/claims/hooks/useClaimDetails';

// ── Event type configuration ─────────────────────────────────────────

const EVENT_CONFIG = {
  created: {
    label: 'Created',
    dotColor: 'bg-green-500',
    ringColor: 'ring-green-500/30',
    textColor: 'text-green-400',
    Icon: PlusCircle,
  },
  status_change: {
    label: 'Status Change',
    dotColor: 'bg-blue-500',
    ringColor: 'ring-blue-500/30',
    textColor: 'text-blue-400',
    Icon: ArrowRightLeft,
  },
  inspection: {
    label: 'Inspection',
    dotColor: 'bg-purple-500',
    ringColor: 'ring-purple-500/30',
    textColor: 'text-purple-400',
    Icon: SearchIcon,
  },
  document: {
    label: 'Document',
    dotColor: 'bg-amber-500',
    ringColor: 'ring-amber-500/30',
    textColor: 'text-amber-400',
    Icon: FileText,
  },
  communication: {
    label: 'Communication',
    dotColor: 'bg-cyan-500',
    ringColor: 'ring-cyan-500/30',
    textColor: 'text-cyan-400',
    Icon: MessageSquare,
  },
  note: {
    label: 'Note',
    dotColor: 'bg-zinc-500',
    ringColor: 'ring-zinc-500/30',
    textColor: 'text-zinc-400',
    Icon: StickyNote,
  },
  supplement: {
    label: 'Supplement',
    dotColor: 'bg-orange-500',
    ringColor: 'ring-orange-500/30',
    textColor: 'text-orange-400',
    Icon: Layers,
  },
  settlement: {
    label: 'Settlement',
    dotColor: 'bg-emerald-500',
    ringColor: 'ring-emerald-500/30',
    textColor: 'text-emerald-400',
    Icon: Banknote,
  },
};

const DEFAULT_CONFIG = {
  label: 'Activity',
  dotColor: 'bg-zinc-500',
  ringColor: 'ring-zinc-500/30',
  textColor: 'text-zinc-400',
  Icon: Activity,
};

// ── Mock data for fallback ───────────────────────────────────────────

const MOCK_EVENTS = [
  {
    id: 'mock-1',
    type: 'created',
    description: 'Claim created by Jonathan',
    user: 'Jonathan',
    timestamp: '2025-12-01T09:00:00Z',
  },
  {
    id: 'mock-2',
    type: 'document',
    description: 'Document uploaded: Policy Declaration Page',
    user: 'Jonathan',
    timestamp: '2025-12-01T10:30:00Z',
  },
  {
    id: 'mock-3',
    type: 'status_change',
    description: 'Status changed from New to In Progress',
    user: 'System',
    timestamp: '2025-12-02T08:15:00Z',
  },
  {
    id: 'mock-4',
    type: 'communication',
    description: 'Email sent to carrier: Initial notice of claim',
    user: 'Jonathan',
    timestamp: '2025-12-02T11:00:00Z',
  },
  {
    id: 'mock-5',
    type: 'inspection',
    description: 'Inspection completed at property',
    user: 'Jonathan',
    timestamp: '2025-12-05T14:00:00Z',
  },
  {
    id: 'mock-6',
    type: 'document',
    description: 'Document uploaded: Inspection Report',
    user: 'Jonathan',
    timestamp: '2025-12-05T16:45:00Z',
  },
  {
    id: 'mock-7',
    type: 'note',
    description: 'Note added: Roof damage more extensive than initially reported',
    user: 'Jonathan',
    timestamp: '2025-12-06T09:20:00Z',
  },
  {
    id: 'mock-8',
    type: 'supplement',
    description: 'Supplement #1 filed for additional water damage',
    user: 'Jonathan',
    timestamp: '2025-12-10T13:30:00Z',
  },
  {
    id: 'mock-9',
    type: 'status_change',
    description: 'Status changed from In Progress to Under Review',
    user: 'System',
    timestamp: '2025-12-15T10:00:00Z',
  },
  {
    id: 'mock-10',
    type: 'settlement',
    description: 'Settlement reached: $47,500',
    user: 'Jonathan',
    timestamp: '2025-12-20T15:00:00Z',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

const COLLAPSED_COUNT = 5;

/**
 * Classify a raw activity event from the API into a known event type.
 */
const classifyEvent = (raw) => {
  const eventName = String(raw.event || '').toLowerCase();
  const details = raw.details || {};
  const changes = details.changes || {};

  if (eventName.includes('created') || eventName === 'claimcreated') {
    return 'created';
  }
  if (eventName.includes('archived') || eventName.includes('restored')) {
    return 'status_change';
  }
  if (eventName.includes('updated') || eventName === 'claimupdated') {
    if (changes.status) return 'status_change';
    if (changes.assigned_to) return 'status_change';
    return 'note';
  }
  return 'note';
};

/**
 * Build a human-readable description from a raw activity event.
 */
const describeEvent = (raw) => {
  const details = raw.details || {};
  const changes = details.changes || {};
  const eventName = String(raw.event || '');

  if (eventName === 'ClaimCreated') {
    return `Claim created by ${raw.user || 'System'}`;
  }
  if (eventName === 'ClaimArchived') {
    return 'Claim archived';
  }
  if (eventName === 'ClaimRestored') {
    return 'Claim restored from archive';
  }
  if (eventName === 'ClaimUpdated') {
    if (changes.status && details.old_status) {
      return `Status changed from ${details.old_status} to ${changes.status}`;
    }
    if (changes.assigned_to) {
      return `Reassigned to ${changes.assigned_to}`;
    }
    const changeKeys = Object.keys(changes);
    if (changeKeys.length > 0) {
      return `Updated: ${changeKeys.slice(0, 3).join(', ')}${changeKeys.length > 3 ? ` +${changeKeys.length - 3} more` : ''}`;
    }
    return 'Claim details updated';
  }
  return eventName || 'Activity recorded';
};

/**
 * Map raw API activity data into normalised timeline events.
 */
const normaliseActivities = (activities) =>
  activities.map((act, idx) => ({
    id: act.id || `act-${idx}`,
    type: classifyEvent(act),
    description: describeEvent(act),
    user: act.user || 'System',
    timestamp: act.timestamp || act.created_at || new Date().toISOString(),
  }));

/**
 * Format a timestamp into a human-friendly relative or absolute string.
 */
const formatTimestamp = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;

  if (diffMs < 60_000) return 'just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  if (diffMs < 604_800_000) return `${Math.floor(diffMs / 86_400_000)}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const formatFullTimestamp = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// ── Component ────────────────────────────────────────────────────────

const ClaimTimeline = ({ claimId }) => {
  const { data: rawActivities = [], isLoading } = useClaimActivity(claimId);
  const [expanded, setExpanded] = useState(false);

  // Normalise API data or fall back to mock events
  const events = useMemo(() => {
    if (rawActivities.length > 0) {
      return normaliseActivities(rawActivities);
    }
    return MOCK_EVENTS;
  }, [rawActivities]);

  const isMockData = rawActivities.length === 0 && !isLoading;
  const visibleEvents = expanded ? events : events.slice(0, COLLAPSED_COUNT);
  const hiddenCount = events.length - COLLAPSED_COUNT;

  return (
    <div className="bg-[#1a1a1a] border border-zinc-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-orange-500" />
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            Claim Timeline
          </h3>
          <span className="text-[10px] font-mono text-zinc-500">
            ({events.length} event{events.length !== 1 ? 's' : ''})
          </span>
        </div>
        {isMockData && (
          <span className="text-[9px] font-mono text-zinc-600 uppercase px-2 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/50">
            Sample Data
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-zinc-500 text-sm font-mono text-center py-8">
          No timeline events yet.
        </p>
      ) : (
        <>
          {/* Timeline */}
          <div className="relative ml-1.5">
            {/* Vertical line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-700" />

            <div className="space-y-0">
              {visibleEvents.map((event, idx) => {
                const config = EVENT_CONFIG[event.type] || DEFAULT_CONFIG;
                const { Icon, dotColor, ringColor, textColor } = config;

                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-4 group"
                    style={{
                      animation: `timeline-fade-in 0.35s ease-out ${idx * 60}ms both`,
                    }}
                  >
                    {/* Dot */}
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div
                        className={`w-[15px] h-[15px] rounded-full ${dotColor} ring-4 ${ringColor} transition-transform group-hover:scale-125`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-6">
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${textColor}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 leading-snug">
                            {event.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-zinc-500">
                              {event.user}
                            </span>
                            <span className="text-[10px] text-zinc-600 select-none">
                              &middot;
                            </span>
                            <span
                              className="text-[10px] font-mono text-zinc-600 cursor-help"
                              title={formatFullTimestamp(event.timestamp)}
                            >
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expand / Collapse toggle */}
          {events.length > COLLAPSED_COUNT && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-700/40 bg-zinc-800/30 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 transition-all text-xs font-mono uppercase tracking-wide"
            >
              {expanded ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Show all {events.length} events ({hiddenCount} more)
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes timeline-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ClaimTimeline;
