import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '@/lib/api';
import {
  Loader2, DollarSign, ChevronRight, AlertTriangle, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

const PIPELINE_COLUMNS = [
  { status: 'New', color: 'border-zinc-500', bg: 'bg-zinc-500/10', text: 'text-zinc-300' },
  { status: 'In Progress', color: 'border-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-300' },
  { status: 'Under Review', color: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-300' },
  { status: 'Approved', color: 'border-green-500', bg: 'bg-green-500/10', text: 'text-green-300' },
  { status: 'Denied', color: 'border-red-500', bg: 'bg-red-500/10', text: 'text-red-300' },
  { status: 'Completed', color: 'border-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[1200px]">
        {PIPELINE_COLUMNS.map(col => {
          const columnClaims = getColumnClaims(col.status);
          const columnValue = columnClaims.reduce((sum, c) => sum + (c.estimated_value || 0), 0);
          const isDragOver = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              className={`flex-1 min-w-[200px] rounded-lg border ${col.color}/30 ${isDragOver ? `${col.bg} border-2` : 'bg-zinc-900/50'} transition-all`}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column Header */}
              <div className={`p-3 border-b ${col.color}/20`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-tactical font-bold uppercase ${col.text}`}>
                    {col.status}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {columnClaims.length}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-zinc-500">
                  ${(columnValue / 1000).toFixed(0)}K
                </p>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 max-h-[60vh] overflow-y-auto">
                {columnClaims.length === 0 ? (
                  <div className="text-center py-6 text-zinc-600 text-xs font-mono">
                    No claims
                  </div>
                ) : (
                  columnClaims.map(claim => (
                    <div
                      key={claim.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, claim)}
                      onClick={() => navigate(`/claims/${claim.id}`)}
                      className="p-3 bg-zinc-800/60 rounded border border-zinc-700/40 hover:border-orange-500/40 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-tactical font-bold text-white group-hover:text-orange-400 transition-colors truncate">
                          {claim.claim_number}
                        </span>
                        <GripVertical className="w-3 h-3 text-zinc-600 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                      </div>
                      <p className="text-[10px] font-mono text-zinc-400 truncate mb-1">
                        {claim.client_name}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500 truncate mb-2">
                        {claim.claim_type}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-tactical font-bold text-orange-400">
                          ${((claim.estimated_value || 0) / 1000).toFixed(0)}K
                        </span>
                        {claim.priority === 'High' && (
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClaimsPipeline;
