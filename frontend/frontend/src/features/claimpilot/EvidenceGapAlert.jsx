import { useState } from 'react';
import { useClaimInsights } from './hooks/useClaimpilot';

const SCORE_GOOD_THRESHOLD = 80;
const SCORE_AMBER_THRESHOLD = 50;

const PRIORITY_COLORS = {
  high: 'text-red-400',
  medium: 'text-amber-400',
  low: 'text-zinc-400',
};

const READINESS_LEVELS = {
  ready: { label: 'Ready for Negotiation', bg: 'bg-green-500/20', text: 'text-green-400', ring: 'ring-green-500/40' },
  needs_work: { label: 'Needs Work', bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/40' },
  insufficient: { label: 'Insufficient', bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/40' },
};

function getScoreColor(score) {
  if (score >= SCORE_GOOD_THRESHOLD) return 'text-green-400';
  if (score >= SCORE_AMBER_THRESHOLD) return 'text-amber-400';
  return 'text-red-400';
}

function getBarColor(score) {
  if (score >= SCORE_GOOD_THRESHOLD) return 'bg-green-500';
  if (score >= SCORE_AMBER_THRESHOLD) return 'bg-amber-500';
  return 'bg-red-500';
}

function getReadiness(score) {
  if (score >= SCORE_GOOD_THRESHOLD) return READINESS_LEVELS.ready;
  if (score >= SCORE_AMBER_THRESHOLD) return READINESS_LEVELS.needs_work;
  return READINESS_LEVELS.insufficient;
}

function CategoryBar({ name, score, gaps }) {
  const [expanded, setExpanded] = useState(false);
  const hasGaps = gaps && gaps.length > 0;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => hasGaps && setExpanded((prev) => !prev)}
        className={`w-full text-left ${hasGaps ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-300">{name}</span>
          <span className={`text-xs font-semibold ${getScoreColor(score)}`}>
            {score}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-700">
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
            const priorityColor = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium;
            return (
              <p key={idx} className="text-xs text-zinc-400">
                <span className={`font-medium ${priorityColor}`}>Missing:</span>{' '}
                {gap.item ?? gap}{' '}
                <span className={`${priorityColor}`}>({priority} priority)</span>
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
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
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
  const readiness = getReadiness(overallScore);

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
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${readiness.bg} ${readiness.text} ${readiness.ring}`}
        >
          {readiness.label}
        </span>
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
