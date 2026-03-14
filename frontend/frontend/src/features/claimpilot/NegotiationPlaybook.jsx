import { useState } from 'react';
import { useClaimInsights } from './hooks/useClaimpilot';

function formatCurrency(value) {
  if (value == null) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const RISK_STYLES = {
  low: 'bg-green-900/60 text-green-300',
  medium: 'bg-amber-900/60 text-amber-300',
  high: 'bg-orange-900/60 text-orange-300',
  critical: 'bg-red-900/60 text-red-300',
};

function RiskBadge({ level }) {
  if (!level) return null;
  const normalized = level.toLowerCase();
  const styles = RISK_STYLES[normalized] ?? 'bg-zinc-700 text-zinc-300';

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </span>
  );
}

function SettlementBar({ low, mid, high }) {
  if (low == null || high == null) return null;

  const range = high - low;
  if (range <= 0) return null;

  const midPercent = mid != null ? ((mid - low) / range) * 100 : 50;

  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{formatCurrency(low)}</span>
        {mid != null && <span>{formatCurrency(mid)}</span>}
        <span>{formatCurrency(high)}</span>
      </div>
      <div className="relative mt-1 h-3 w-full overflow-hidden rounded-full bg-zinc-700">
        {/* Low-to-mid gradient */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 to-green-600"
          style={{ width: '100%' }}
        />
        {/* Mid marker */}
        {mid != null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white"
            style={{ left: `${midPercent}%` }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>Low</span>
        <span>Mid</span>
        <span>High</span>
      </div>
    </div>
  );
}

function CarrierPositionSection({ position }) {
  if (!position) return null;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-zinc-200">
        Carrier Position Analysis
      </h4>
      {position.summary && (
        <p className="mb-2 text-sm text-zinc-300">{position.summary}</p>
      )}
      {position.concessions?.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-green-400">
            Conceding:
          </span>
          <ul className="ml-4 mt-1 list-disc text-sm text-zinc-400">
            {position.concessions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {position.firm_positions?.length > 0 && (
        <div>
          <span className="text-xs font-medium text-red-400">
            Firm on:
          </span>
          <ul className="ml-4 mt-1 list-disc text-sm text-zinc-400">
            {position.firm_positions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LeveragePointsSection({ points }) {
  if (!points || points.length === 0) return null;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-zinc-200">
        Leverage Points
      </h4>
      <ul className="ml-4 list-disc text-sm text-zinc-300">
        {points.map((point, idx) => (
          <li key={idx} className="mb-1">
            {typeof point === 'string' ? point : point.description}
            {point.statute_citation && (
              <span className="ml-1 text-xs text-blue-400">
                ({point.statute_citation})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CounterArgumentsSection({ args }) {
  if (!args || args.length === 0) return null;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
      <h4 className="mb-2 text-sm font-semibold text-zinc-200">
        Counter-Arguments
      </h4>
      <ol className="ml-4 list-decimal text-sm text-zinc-300">
        {args.map((arg, idx) => (
          <li key={idx} className="mb-1">
            {typeof arg === 'string' ? arg : arg.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DraftResponseSection({ draftText }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(draftText || '');

  if (!draftText && !text) return null;

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-200">
          Draft Response
        </h4>
        <button
          type="button"
          onClick={() => setIsEditing((prev) => !prev)}
          className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-600"
        >
          {isEditing ? 'Lock' : 'Edit'}
        </button>
      </div>
      <textarea
        readOnly={!isEditing}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        className={`w-full resize-y rounded border bg-zinc-950 p-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
          isEditing
            ? 'border-blue-600'
            : 'cursor-default border-zinc-700'
        }`}
      />
    </div>
  );
}

export default function NegotiationPlaybook({ claimId }) {
  const { data, isLoading, isError, error } = useClaimInsights(claimId);

  if (!claimId) return null;

  const insights = data?.insights ?? [];
  const negotiationInsight = insights.find(
    (i) => i.insight_type === 'negotiation_analysis'
  );

  const details = negotiationInsight?.details ?? {};
  const carrierPosition = details.carrier_position ?? null;
  const leveragePoints = details.leverage_points ?? [];
  const settlementRange = details.settlement_range ?? {};
  const riskAssessment = details.risk_assessment ?? null;
  const counterArguments = details.counter_arguments ?? [];
  const recommendedStrategy = details.recommended_strategy ?? '';
  const draftResponse = details.draft_response ?? '';

  const riskLevel =
    typeof riskAssessment === 'string'
      ? riskAssessment
      : riskAssessment?.level ?? null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          Negotiation Playbook
        </h2>
        {riskLevel && <RiskBadge level={riskLevel} />}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-zinc-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <span className="text-sm">Loading negotiation analysis...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400">
          Failed to load insights: {error?.message || 'Unknown error'}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !negotiationInsight && (
        <p className="py-6 text-center text-sm text-zinc-500">
          No carrier communications analyzed yet
        </p>
      )}

      {/* Content sections */}
      {negotiationInsight && (
        <div className="flex flex-col gap-3">
          <CarrierPositionSection position={carrierPosition} />
          <LeveragePointsSection points={leveragePoints} />

          {/* Settlement Range */}
          {(settlementRange.low != null || settlementRange.high != null) && (
            <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-sm font-semibold text-zinc-200">
                Settlement Range
              </h4>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-xs text-zinc-500">Low</span>
                  <p className="font-medium text-zinc-300">
                    {formatCurrency(settlementRange.low)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Mid</span>
                  <p className="font-medium text-zinc-300">
                    {formatCurrency(settlementRange.mid)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">High</span>
                  <p className="font-medium text-zinc-300">
                    {formatCurrency(settlementRange.high)}
                  </p>
                </div>
              </div>
              <SettlementBar
                low={settlementRange.low}
                mid={settlementRange.mid}
                high={settlementRange.high}
              />
            </div>
          )}

          <CounterArgumentsSection args={counterArguments} />

          {/* Recommended Strategy */}
          {recommendedStrategy && (
            <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
              <h4 className="mb-1 text-sm font-semibold text-zinc-200">
                Recommended Strategy
              </h4>
              <p className="text-sm text-zinc-300">{recommendedStrategy}</p>
            </div>
          )}

          <DraftResponseSection draftText={draftResponse} />
        </div>
      )}
    </div>
  );
}
