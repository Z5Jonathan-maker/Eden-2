import { useClaimInsights } from './hooks/useClaimpilot';

const RISK_LOW_THRESHOLD = 20;
const RISK_HIGH_THRESHOLD = 50;

const RISK_LEVELS = {
  low: { label: 'Low Risk', bg: 'bg-green-500/20', text: 'text-green-400', ring: 'ring-green-500/40' },
  moderate: { label: 'Moderate', bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/40' },
  high: { label: 'High Risk', bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/40' },
};

const CARRIER_TAG_STYLES = {
  'Fast Settler': 'bg-green-500/20 text-green-400',
  Normal: 'bg-zinc-600/30 text-zinc-300',
  'Aggressive Denier': 'bg-red-500/20 text-red-400',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function getRiskLevel(percentage) {
  if (percentage < RISK_LOW_THRESHOLD) return RISK_LEVELS.low;
  if (percentage <= RISK_HIGH_THRESHOLD) return RISK_LEVELS.moderate;
  return RISK_LEVELS.high;
}

function SettlementRangeBar({ p10, p50, p90 }) {
  const range = p90 - p10;
  const p50Position = range > 0 ? ((p50 - p10) / range) * 100 : 50;

  return (
    <div className="mb-4">
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
        Settlement Range
      </h4>
      <div className="relative h-3 w-full rounded-full bg-gradient-to-r from-green-600 via-amber-500 to-amber-600">
        {/* p50 marker */}
        <div
          className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 bg-white shadow-sm"
          style={{ left: `${p50Position}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span className="text-green-400">{formatCurrency(p10)}</span>
        <span className="font-semibold text-zinc-100">{formatCurrency(p50)}</span>
        <span className="text-amber-400">{formatCurrency(p90)}</span>
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
        <span>Low (p10)</span>
        <span>Expected (p50)</span>
        <span>High (p90)</span>
      </div>
    </div>
  );
}

function LitigationRiskPill({ percentage }) {
  const risk = getRiskLevel(percentage);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        Litigation Risk
      </span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${risk.bg} ${risk.text} ${risk.ring}`}
      >
        {Math.round(percentage)}% &mdash; {risk.label}
      </span>
    </div>
  );
}

export default function PredictionCard({ claimId }) {
  const { data, isLoading, isError } = useClaimInsights(claimId);

  const insights = data?.insights ?? [];
  const prediction = insights.find((i) => i.insight_type === 'prediction');

  if (!claimId) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <span className="text-sm">Loading prediction...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="text-sm text-red-400">Failed to load prediction data.</p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="py-4 text-center text-sm text-zinc-500">
          Prediction available after claim data accumulates.
        </p>
      </div>
    );
  }

  const details = prediction.details ?? {};
  const settlement = details.settlement_range ?? {};
  const litigationRisk = details.litigation_risk_pct ?? 0;
  const timelineMonths = details.timeline_months ?? null;
  const carrierBehavior = details.carrier_behavior ?? 'Normal';
  const carrierStyle =
    CARRIER_TAG_STYLES[carrierBehavior] ?? CARRIER_TAG_STYLES.Normal;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        Settlement Prediction
      </h3>

      {/* Settlement range */}
      {settlement.p10 != null && (
        <SettlementRangeBar
          p10={settlement.p10}
          p50={settlement.p50}
          p90={settlement.p90}
        />
      )}

      {/* Litigation risk */}
      <div className="mb-3">
        <LitigationRiskPill percentage={litigationRisk} />
      </div>

      {/* Timeline + Carrier row */}
      <div className="flex items-center justify-between">
        {timelineMonths != null && (
          <span className="text-xs text-zinc-400">
            ~{timelineMonths} months to resolution
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${carrierStyle}`}
        >
          {carrierBehavior}
        </span>
      </div>
    </div>
  );
}
