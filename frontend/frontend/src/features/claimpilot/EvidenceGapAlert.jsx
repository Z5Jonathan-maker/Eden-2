import { useState } from 'react';
import { useClaimInsights } from './hooks/useClaimpilot';
import { EVIDENCE_READINESS, getSeverityLevel, SEVERITY_STYLES } from './config';
import SeverityBadge from './SeverityBadge';

const PRIORITY_LABELS = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

const READINESS_LEVELS = {
  ready: { label: 'Ready for Negotiation' },
  needs_work: { label: 'Needs Work' },
  insufficient: { label: 'Insufficient' },
};

function getScoreColor(score) {
  if (score >= EVIDENCE_READINESS.READY) return 'text-green-400';
  if (score >= EVIDENCE_READINESS.NEEDS_WORK) return 'text-amber-400';
  return 'text-red-400';
}

function getBarColor(score) {
  if (score >= EVIDENCE_READINESS.READY) return 'bg-green-500';
  if (score >= EVIDENCE_READINESS.NEEDS_WORK) return 'bg-amber-500';
  return 'bg-red-500';
}

function getReadinessKey(score) {
  if (score >= EVIDENCE_READINESS.READY) return 'ready';
  if (score >= EVIDENCE_READINESS.NEEDS_WORK) return 'needs_work';
  return 'insufficient';
}

function getReadinessSeverity(key) {
  if (key === 'ready') return 'low';
  if (key === 'needs_work') return 'medium';
  return 'high';
}

function CategoryBar({ name, score, gaps }) {
  const [expanded, setExpanded] = useState(false);
  const hasGaps = gaps && gaps.length > 0;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => hasGaps && setExpanded((prev) => !prev)}
        className={`w-full text-left ${hasGaps ? 'cursor-pointer' : 'cursor-default'} focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none rounded`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">{name}</span>
          <span className={`text-xs font-semibold ${getScoreColor(score)}`}>
            {score}% Complete
          </span>
        </div>
        <div
          className="h-2 w-full rounded-full bg-zinc-700"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name}: ${score}% complete`}
        >
          <div
            className={`h-full rounded-full transition-all ${getBarColor(score)}`}
            style={{ width: `${Math.min(score, 100)}%` }}
          />
        </div>
        {hasGaps && (
          <span className="mt-0.5 block text-[10px] text-zinc-500">
            {expanded ? 'Hide gaps' : `${gaps.length} gap${gaps.length > 1 ? 's' : ''} found`}
          </span>
        )}
      </button>

      {/* Expanded gap list */}
      {expanded && hasGaps && (
        <div className="mt-1.5 space-y-1 pl-2">
          {gaps.map((gap, idx) => {
            const priority = gap.priority ?? 'medium';
            const severityLevel = getSeverityLevel(
              priority === 'high' ? 1 : priority === 'medium' ? 0.7 : 0.3,
              0.9,
              0.6
            );
            const style = SEVERITY_STYLES[severityLevel === 'low' ? 'low' : severityLevel === 'medium' ? 'medium' : 'high'];
            return (
              <p key={idx} className="text-xs text-zinc-400">
                <span className={`font-medium ${style.text}`}>Missing:</span>{' '}
                {gap.item ?? gap}{' '}
                <span className={`${style.text}`}>({PRIORITY_LABELS[priority] || 'Medium Priority'})</span>
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EvidenceGapAlert({ claimId }) {
  const { data, isLoading, isError } = useClaimInsights(claimId);

  const insights = data?.insights ?? [];
  const scoring = insights.find((i) => i.insight_type === 'evidence_scoring');

  if (!claimId) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-orange-500" />
          <span className="text-sm">Loading evidence analysis...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="text-sm text-red-400">Failed to load evidence data.</p>
      </div>
    );
  }

  if (!scoring) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
        <p className="py-4 text-center text-sm text-zinc-500">
          Evidence scoring available after documents are uploaded.
        </p>
      </div>
    );
  }

  const details = scoring.details ?? {};
  const overallScore = details.overall_score ?? 0;
  const categories = details.categories ?? {};
  const readinessKey = getReadinessKey(overallScore);
  const readinessLabel = READINESS_LEVELS[readinessKey].label;
  const readinessSeverity = getReadinessSeverity(readinessKey);

  const categoryEntries = [
    { name: 'Property Documentation', key: 'property_documentation' },
    { name: 'Damage Documentation', key: 'damage_documentation' },
    { name: 'Communication Records', key: 'communication_records' },
    { name: 'Financial Records', key: 'financial_records' },
  ];

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      {/* Header with overall score and readiness badge */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">Evidence Completeness</h3>
          <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}%
          </span>
        </div>
        <SeverityBadge level={readinessSeverity} label={readinessLabel} />
      </div>

      {/* Category bars */}
      <div className="space-y-1">
        {categoryEntries.map(({ name, key }) => {
          const cat = categories[key] ?? {};
          const score = cat.score ?? 0;
          const gaps = cat.gaps ?? [];
          return (
            <CategoryBar key={key} name={name} score={score} gaps={gaps} />
          );
        })}
      </div>
    </div>
  );
}
