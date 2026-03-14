import { useClaimInsights } from './hooks/useClaimpilot';

const AGENT_LABELS = {
  claim_monitor: 'Claim Monitor',
  vision_analyzer: 'Vision Analyzer',
  intake_parser: 'Intake Parser',
  evidence_scorer: 'Evidence Scorer',
  statute_matcher: 'Statute Matcher',
  negotiation_copilot: 'Negotiation Copilot',
  estimate_engine: 'Estimate Engine',
  predictive_analytics: 'Predictive Analytics',
};

const AGENT_ICONS = {
  claim_monitor: '\uD83D\uDD0D',
  vision_analyzer: '\uD83D\uDCF8',
  intake_parser: '\uD83D\uDCE5',
  evidence_scorer: '\uD83D\uDCCA',
  statute_matcher: '\u2696\uFE0F',
  negotiation_copilot: '\uD83E\uDD1D',
  estimate_engine: '\uD83D\uDCB0',
  predictive_analytics: '\uD83D\uDCC8',
};

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_ICON = '\uD83E\uDD16';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ClaimPilotInsights({ claimId }) {
  const { data, isLoading, isError, error } = useClaimInsights(claimId);

  const insights = data?.insights ?? [];

  if (!claimId) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <h2 className="mb-4 text-lg font-semibold text-zinc-100">
        ClaimPilot Insights
      </h2>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-zinc-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-orange-500" />
          <span className="text-sm">Loading insights...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400">
          Failed to load insights: {error?.message || 'Unknown error'}
        </p>
      )}

      {/* Empty */}
      {!isLoading && !isError && insights.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">
          No insights yet for this claim.
        </p>
      )}

      {/* Insight list */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-3">
          {insights.map((insight, idx) => {
            const icon = AGENT_ICONS[insight.agent_name] || DEFAULT_ICON;
            const ariaLabel = AGENT_LABELS[insight.agent_name] || insight.agent_name;
            const isLowConfidence =
              insight.confidence != null &&
              insight.confidence < LOW_CONFIDENCE_THRESHOLD;

            return (
              <div
                key={insight.id ?? idx}
                className="rounded border border-zinc-700 bg-zinc-900/50 p-4"
              >
                {/* Agent header */}
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base" role="img" aria-label={ariaLabel}>
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-zinc-200">
                      {insight.agent_name}
                    </span>
                  </div>
                  {insight.created_at && (
                    <span className="text-xs text-zinc-500">
                      {formatDate(insight.created_at)}
                    </span>
                  )}
                </div>

                {/* Summary */}
                <p className="text-sm text-zinc-300">{insight.summary}</p>

                {/* Low confidence warning */}
                {isLowConfidence && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-yellow-400">
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Low confidence ({Math.round(insight.confidence * 100)}%)
                    &mdash; review carefully
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
