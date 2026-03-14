import { useClaimpilotAnalytics } from './hooks/useClaimpilot';

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

const DEFAULT_ICON = '\uD83E\uDD16';

function formatAgentName(snakeName) {
  return snakeName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDuration(ms) {
  if (ms == null) return '--';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function successRateColor(rate) {
  if (rate >= 90) return 'text-green-400';
  if (rate >= 75) return 'text-amber-400';
  return 'text-red-400';
}

function StatCard({ label, count, colorClass }) {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{count ?? 0}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2 py-12 justify-center text-zinc-400">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
      <span className="text-sm">Loading analytics...</span>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
      <p className="text-sm text-red-400">
        Failed to load analytics: {message || 'Unknown error'}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="py-12 text-center text-sm text-zinc-500">
      No analytics data available yet.
    </p>
  );
}

export default function ClaimPilotDashboard() {
  const { data, isLoading, isError, error } = useClaimpilotAnalytics();

  const agentStats = data?.agent_stats ?? [];
  const queue = data?.approval_queue ?? { pending: 0, approved: 0, rejected: 0 };

  const hasData = agentStats.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">
          ClaimPilot AI Dashboard
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Agent Performance Monitoring
        </p>
      </div>

      {isLoading && <LoadingSpinner />}

      {isError && <ErrorState message={error?.message} />}

      {!isLoading && !isError && (
        <>
          {/* Approval Queue Summary */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Pending"
              count={queue.pending}
              colorClass="text-amber-400"
            />
            <StatCard
              label="Approved"
              count={queue.approved}
              colorClass="text-green-400"
            />
            <StatCard
              label="Rejected"
              count={queue.rejected}
              colorClass="text-red-400"
            />
          </div>

          {/* Agent Performance Table */}
          {!hasData && <EmptyState />}

          {hasData && (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-700 bg-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-medium text-zinc-300">
                      Agent
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-300 text-right">
                      Runs
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-300 text-right">
                      Success Rate
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-300 text-right">
                      Avg Confidence
                    </th>
                    <th className="px-4 py-3 font-medium text-zinc-300 text-right">
                      Avg Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-700/50">
                  {agentStats.map((agent) => {
                    const icon =
                      AGENT_ICONS[agent.agent_name] || DEFAULT_ICON;
                    const successRate =
                      agent.success_rate != null
                        ? Math.round(agent.success_rate * 100)
                        : null;

                    return (
                      <tr
                        key={agent.agent_name}
                        className="bg-zinc-900/30 hover:bg-zinc-800/60 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-base"
                              role="img"
                              aria-label={agent.agent_name}
                            >
                              {icon}
                            </span>
                            <span className="font-medium text-zinc-100">
                              {formatAgentName(agent.agent_name)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {agent.total_runs?.toLocaleString() ?? '--'}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            successRate != null
                              ? successRateColor(successRate)
                              : 'text-zinc-500'
                          }`}
                        >
                          {successRate != null ? `${successRate}%` : '--'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {agent.avg_confidence != null
                            ? agent.avg_confidence.toFixed(2)
                            : '--'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatDuration(agent.avg_duration_ms)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
