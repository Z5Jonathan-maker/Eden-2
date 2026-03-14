import { useState } from 'react';

const SEVERITY_COLORS = {
  low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' },
  moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  severe: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' },
};

const QUALITY_LABELS = {
  good: { text: 'Good', color: 'text-green-400' },
  fair: { text: 'Fair', color: 'text-yellow-400' },
  poor: { text: 'Poor', color: 'text-red-400' },
};

const SEVERITY_THRESHOLD_HIGH = 7;
const SEVERITY_THRESHOLD_MED = 4;
const MAX_SEVERITY = 10;

function getSeverityLevel(score) {
  if (score >= SEVERITY_THRESHOLD_HIGH) return 'severe';
  if (score >= SEVERITY_THRESHOLD_MED) return 'moderate';
  return 'low';
}

function getSeverityBarColor(score) {
  const ratio = score / MAX_SEVERITY;
  if (ratio >= 0.7) return 'bg-red-500';
  if (ratio >= 0.4) return 'bg-yellow-500';
  return 'bg-green-500';
}

function DamageInsightBadge({ insight }) {
  const details = insight.details ?? {};
  const damageType = details.damage_type ?? 'Unknown';
  const severity = details.severity_score ?? 0;
  const quality = details.photo_quality ?? 'fair';
  const fraudIndicators = details.fraud_indicators ?? [];
  const level = getSeverityLevel(severity);
  const colors = SEVERITY_COLORS[level];
  const qualityLabel = QUALITY_LABELS[quality] ?? QUALITY_LABELS.fair;

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} p-3 backdrop-blur-sm`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`text-sm font-semibold ${colors.text}`}>
          {damageType}
        </span>
        <span className={`text-xs ${qualityLabel.color}`}>
          Quality: {qualityLabel.text}
        </span>
      </div>

      {/* Severity score bar */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-zinc-400">Severity</span>
        <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
          <div
            className={`h-full rounded-full transition-all ${getSeverityBarColor(severity)}`}
            style={{ width: `${(severity / MAX_SEVERITY) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${colors.text}`}>
          {severity}/{MAX_SEVERITY}
        </span>
      </div>

      {/* Fraud indicators */}
      {fraudIndicators.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {fraudIndicators.map((indicator, idx) => (
            <span
              key={idx}
              className="rounded-full border border-red-500/50 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400"
            >
              {indicator}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VisionOverlay({ insights }) {
  const [visible, setVisible] = useState(false);

  const visionInsights = (insights ?? []).filter(
    (i) => i.insight_type === 'vision_analysis'
  );

  if (visionInsights.length === 0) return null;

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
      >
        {visible ? 'Hide AI Analysis' : 'Show AI Analysis'}
      </button>

      {/* Overlay panel */}
      {visible && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-md space-y-2">
          {visionInsights.map((insight, idx) => (
            <DamageInsightBadge key={insight.id ?? idx} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
