import { useState } from 'react';
import { useClaimInsights } from './hooks/useClaimpilot';
import { DEADLINE_COMPLIANCE_DAYS } from './config';
import SeverityBadge from './SeverityBadge';

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

function computeDaysRemaining(deadlineStr) {
  if (!deadlineStr) return null;
  const now = new Date();
  const deadline = new Date(deadlineStr);
  const diffMs = deadline - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ daysRemaining }) {
  if (daysRemaining === null) {
    return <SeverityBadge level="medium" label="Unknown" />;
  }

  if (daysRemaining <= 0) {
    return <SeverityBadge level="high" label="OVERDUE" />;
  }

  if (daysRemaining <= DEADLINE_COMPLIANCE_DAYS) {
    return <SeverityBadge level="medium" label="Approaching" />;
  }

  return <SeverityBadge level="low" label="Compliant" />;
}

function DaysRemainingText({ daysRemaining }) {
  if (daysRemaining === null) return null;

  if (daysRemaining <= 0) {
    const overdueDays = Math.abs(daysRemaining);
    return (
      <span className="text-xs font-medium text-red-400">
        {overdueDays} day{overdueDays !== 1 ? 's' : ''} OVERDUE
      </span>
    );
  }

  return (
    <span className="text-xs text-zinc-400">
      {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
    </span>
  );
}

function StatuteCard({ statute }) {
  const daysRemaining = computeDaysRemaining(statute.deadline);

  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-bold text-zinc-100">
          {statute.statute_number}
        </span>
        <div className="flex items-center gap-2">
          <DaysRemainingText daysRemaining={daysRemaining} />
          <DeadlineBadge daysRemaining={daysRemaining} />
        </div>
      </div>
      {statute.title && (
        <p className="mb-1 text-sm font-medium text-zinc-300">
          {statute.title}
        </p>
      )}
      {statute.summary && (
        <p className="text-sm text-zinc-400">{statute.summary}</p>
      )}
    </div>
  );
}

function ViolationCard({ violation }) {
  return (
    <div className="rounded border-2 border-red-700/30 bg-red-500/10 p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-sm font-semibold text-red-300">
          {violation.statute_number || 'Violation'}
        </span>
        {violation.severity && (
          <SeverityBadge
            level={violation.severity === 'high' || violation.severity === 'critical' ? 'high' : violation.severity === 'medium' ? 'medium' : 'low'}
            label={violation.severity}
          />
        )}
      </div>
      {violation.description && (
        <p className="text-sm text-red-200/80">{violation.description}</p>
      )}
    </div>
  );
}

function ComplianceActions({ actions }) {
  const [checkedItems, setCheckedItems] = useState({});

  function toggleItem(idx) {
    setCheckedItems((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-zinc-200">
        Required Compliance Actions
      </h4>
      <ul className="flex flex-col gap-1.5">
        {actions.map((action, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={!!checkedItems[idx]}
              onChange={() => toggleItem(idx)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500"
            />
            <span
              className={`text-sm ${
                checkedItems[idx]
                  ? 'text-zinc-500 line-through'
                  : 'text-zinc-300'
              }`}
            >
              {typeof action === 'string' ? action : action.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StatuteMatches({ claimId }) {
  const { data, isLoading, isError, error } = useClaimInsights(claimId);

  if (!claimId) return null;

  const insights = data?.insights ?? [];
  const statuteInsight = insights.find(
    (i) => i.insight_type === 'statute_matching'
  );

  const details = statuteInsight?.details ?? {};
  const matchedStatutes = details.matched_statutes ?? [];
  const deadlines = details.deadlines ?? [];
  const violations = details.violations ?? [];
  const complianceActions = details.compliance_actions ?? [];

  // Merge deadline info into statutes
  const statutesWithDeadlines = matchedStatutes.map((statute) => {
    const deadlineEntry = deadlines.find(
      (d) => d.statute_number === statute.statute_number
    );
    return {
      ...statute,
      deadline: deadlineEntry?.deadline ?? statute.deadline ?? null,
    };
  });

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">
          FL Statute Compliance
        </h2>
        {statuteInsight?.created_at && (
          <span className="text-xs text-zinc-500">
            Updated {formatDate(statuteInsight.created_at)}
          </span>
        )}
      </div>

      {/* Legal disclaimer */}
      <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <p className="text-xs text-amber-300">
          Automated statute matching for reference only. Not legal advice.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-zinc-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-orange-500" />
          <span className="text-sm">Loading statute analysis...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="text-sm text-red-400">
          Failed to load insights: {error?.message || 'Unknown error'}
        </p>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !statuteInsight && (
        <p className="py-6 text-center text-sm text-zinc-500">
          No statute analysis available yet
        </p>
      )}

      {/* Matched statutes list */}
      {statutesWithDeadlines.length > 0 && (
        <div className="flex flex-col gap-2">
          {statutesWithDeadlines.map((statute, idx) => (
            <StatuteCard key={statute.statute_number ?? idx} statute={statute} />
          ))}
        </div>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-red-300">
            Carrier Violations Detected
          </h4>
          <div className="flex flex-col gap-2">
            {violations.map((violation, idx) => (
              <ViolationCard key={idx} violation={violation} />
            ))}
          </div>
        </div>
      )}

      {/* Compliance actions */}
      <ComplianceActions actions={complianceActions} />
    </div>
  );
}
