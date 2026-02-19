import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPut } from '@/lib/api';
import {
  Loader2, AlertTriangle, GripVertical, Flame, User, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

const PIPELINE_COLUMNS = [
  { status: 'New', color: 'border-zinc-500', bg: 'bg-zinc-500/10', text: 'text-zinc-300', dot: 'bg-zinc-400' },
  { status: 'In Progress', color: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-300', dot: 'bg-blue-400' },
  { status: 'Under Review', color: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-300', dot: 'bg-purple-400' },
  { status: 'Approved', color: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-300', dot: 'bg-green-400' },
  { status: 'Denied', color: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-300', dot: 'bg-red-400' },
  { status: 'Completed', color: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: 'bg-emerald-400' },
];

const PRIORITY_CONFIG = {
  High:   { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', icon: Flame },
  Medium: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low:    { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' },
};

const AVATAR_COLORS = [
  'bg-orange-600','bg-blue-600','bg-emerald-600','bg-purple-600',
  'bg-rose-600','bg-cyan-600','bg-amber-600','bg-indigo-600',
];

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const getAvatarColor = (name) => {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const ClaimsPipeline = ({ claims, loading, onRefresh }) => {
  const navigate = useNavigate();
  const [draggedClaim, setDraggedClaim] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const getColumnClaims = (status) => {
    return claims.filter(c => c.status === status);
  };

  const handleDragStart = (e, claim) => {
    setDraggedClaim(claim);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedClaim || draggedClaim.status === newStatus) {
      setDraggedClaim(null);
      return;
    }

    try {
      const res = await apiPut(`/api/claims/${draggedClaim.id}`, { status: newStatus });
      if (res.ok) {
        toast.success(`${draggedClaim.claim_number} moved to ${newStatus}`);
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.error || 'Failed to update status');
      }
    } catch {
      toast.error('Failed to update claim status');
    }
    setDraggedClaim(null);
  };

  const totalValue = claims.reduce((s, c) => s + (c.estimated_value || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pipeline Summary Bar */}
      <div className="flex items-center gap-3 px-1">
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden flex">
          {PIPELINE_COLUMNS.map(col => {
            const count = getColumnClaims(col.status).length;
            const pct = claims.length ? (count / claims.length) * 100 : 0;
            return pct > 0 ? (
              <div key={col.status} className={`${col.dot} h-full transition-all duration-500`}
                style={{ width: `${pct}%` }} title={`${col.status}: ${count}`} />
            ) : null;
          })}
        </div>
        <span className="text-[11px] font-mono text-zinc-500 whitespace-nowrap">
          {claims.length} claims &middot; ${(totalValue / 1000).toFixed(0)}K
        </span>
      </div>

      {/* Columns */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-[1200px]">
          {PIPELINE_COLUMNS.map(col => {
            const columnClaims = getColumnClaims(col.status);
            const columnValue = columnClaims.reduce((sum, c) => sum + (c.estimated_value || 0), 0);
            const isDragOver = dragOverColumn === col.status;
            const maxValue = Math.max(...PIPELINE_COLUMNS.map(c =>
              getColumnClaims(c.status).reduce((s, cl) => s + (cl.estimated_value || 0), 0)
            ), 1);

            return (
              <div
                key={col.status}
                className={`flex-1 min-w-[200px] rounded-xl border transition-all duration-200 ${
                  isDragOver
                    ? `${col.bg} ${col.color} border-2 scale-[1.01]`
                    : `${col.color}/30 bg-zinc-900/60`
                }`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {/* Column Header */}
                <div className={`p-3 border-b ${col.color}/20`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className={`text-xs font-tactical font-bold uppercase ${col.text}`}>
                        {col.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {columnClaims.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div className={`h-full ${col.dot} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max((columnValue / maxValue) * 100, columnClaims.length ? 3 : 0)}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      ${(columnValue / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                  {columnClaims.length === 0 ? (
                    <div className={`text-center py-8 border border-dashed rounded-lg transition-all ${
                      isDragOver ? `${col.color} ${col.bg}` : 'border-zinc-800 text-zinc-600'
                    }`}>
                      {isDragOver ? (
                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className={`w-4 h-4 ${col.text}`} />
                          <span className={`text-xs font-medium ${col.text}`}>Drop here</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono">No claims</span>
                      )}
                    </div>
                  ) : (
                    columnClaims.map(claim => {
                      const pri = PRIORITY_CONFIG[claim.priority] || PRIORITY_CONFIG.Low;
                      const PriIcon = pri.icon;
                      const isDragging = draggedClaim?.id === claim.id;

                      return (
                        <div
                          key={claim.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, claim)}
                          onClick={() => navigate(`/claims/${claim.id}`)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 group ${
                            isDragging
                              ? 'opacity-40 scale-95 border-orange-500/40 bg-zinc-800/40'
                              : 'bg-zinc-800/70 border-zinc-700/40 hover:border-orange-500/40 hover:bg-zinc-800'
                          }`}
                        >
                          {/* Header: claim number + grip */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-xs font-tactical font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                              {claim.claim_number}
                            </span>
                            <GripVertical className="w-3 h-3 text-zinc-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Client with avatar */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-5 h-5 rounded-full ${getAvatarColor(claim.client_name)} flex items-center justify-center flex-shrink-0`}>
                              <span className="text-[8px] font-bold text-white">{getInitials(claim.client_name)}</span>
                            </div>
                            <p className="text-[10px] font-mono text-zinc-400 truncate">
                              {claim.client_name}
                            </p>
                          </div>

                          {/* Type */}
                          <p className="text-[10px] font-mono text-zinc-500 truncate mb-2">
                            {claim.claim_type}
                          </p>

                          {/* Footer: value + priority */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-tactical font-bold text-orange-400">
                              ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                            </span>
                            <div className="flex items-center gap-1.5">
                              {claim.assigned_to && (
                                <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                                  <User className="w-2.5 h-2.5" />
                                  <span className="truncate max-w-[50px]">{claim.assigned_to.split(' ')[0]}</span>
                                </div>
                              )}
                              {claim.priority && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold border ${pri.bg} ${pri.text} ${pri.border}`}>
                                  {PriIcon && <PriIcon className="w-2.5 h-2.5" />}
                                  {claim.priority}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ClaimsPipeline;
