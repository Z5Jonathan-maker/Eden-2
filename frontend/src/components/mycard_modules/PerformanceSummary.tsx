import React from "react";

interface Props {
  openRate: number;
  engagementScore: number;
}

const PerformanceSummary: React.FC<Props> = ({ openRate, engagementScore }) => {
  const safeOpenRate = Number.isFinite(Number(openRate)) ? Number(openRate) : 0;
  const safeEngagementScore = Number.isFinite(Number(engagementScore)) ? Number(engagementScore) : 0;
  return (
    <div className="card-tactical p-4">
      <h3 className="font-tactical font-bold text-white uppercase tracking-wide mb-3">Performance Summary</h3>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
            <span>Open Rate</span>
            <span>{safeOpenRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(safeOpenRate, 100)}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs font-mono text-zinc-400 mb-1">
            <span>Engagement Score</span>
            <span>{safeEngagementScore}/100</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500" style={{ width: `${Math.min(safeEngagementScore, 100)}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceSummary;
