/**
 * ComplianceDeadlineTracker — Florida statutory deadline tracker for claims.
 *
 * Displays color-coded deadline cards with days remaining,
 * overdue warnings, and statute references.
 */
import React from 'react';
import { Shield, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const getDeadlineColor = (status) => {
  switch (status) {
    case 'overdue':
      return 'bg-red-500/10 border-red-500/30 text-red-300';
    case 'due_soon':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-300';
    case 'met':
    case 'completed':
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    default:
      return 'bg-zinc-800/50 border-zinc-700/30 text-zinc-300';
  }
};

const getDeadlineIcon = (status) => {
  switch (status) {
    case 'overdue':
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    case 'due_soon':
      return <Clock className="w-4 h-4 text-amber-400" />;
    case 'met':
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    default:
      return <Clock className="w-4 h-4 text-zinc-500" />;
  }
};

const ComplianceDeadlineTracker = ({ floridaReadiness }) => {
  if (!floridaReadiness?.deadlines?.length) return null;

  const deadlines = floridaReadiness.deadlines;
  const overdue = deadlines.filter((d) => d.status === 'overdue');

  return (
    <div className="card-tactical p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-tactical font-bold text-white uppercase tracking-wide">
          Florida Compliance
        </h3>
        {overdue.length > 0 && (
          <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-300 rounded-full border border-red-500/30 font-mono">
            {overdue.length} OVERDUE
          </span>
        )}
      </div>

      <div className="space-y-2">
        {deadlines.map((deadline, idx) => (
          <div
            key={deadline.id || idx}
            className={`flex items-center justify-between p-3 rounded-lg border ${getDeadlineColor(deadline.status)}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {getDeadlineIcon(deadline.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{deadline.label}</p>
                {deadline.statute && (
                  <p className="text-[10px] opacity-60 font-mono">{deadline.statute}</p>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              {typeof deadline.days_remaining === 'number' ? (
                <p className="text-lg font-mono font-bold">
                  {deadline.days_remaining < 0
                    ? `${Math.abs(deadline.days_remaining)}d overdue`
                    : `${deadline.days_remaining}d`}
                </p>
              ) : (
                <p className="text-sm font-mono text-zinc-500">N/A</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {floridaReadiness.disclaimer && (
        <p className="text-[10px] text-zinc-500 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {floridaReadiness.disclaimer}
        </p>
      )}
    </div>
  );
};

export default ComplianceDeadlineTracker;
