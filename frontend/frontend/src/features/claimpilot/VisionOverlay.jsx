import { useState } from 'react';
import { SEVERITY_TIERS, getSeverityLevel, SEVERITY_STYLES } from './config';
import SeverityBadge from './SeverityBadge';

const QUALITY_LABELS = {
  good: { text: 'Good', color: 'text-green-400' },
  fair: { text: 'Fair', color: 'text-amber-400' },
  poor: { text: 'Poor', color: 'text-red-400' },
};

const MAX_SEVERITY = 10;

function getSeverityBarColor(score) {
  const ratio = score / MAX_SEVERITY;
  if (ratio >= 0.7) return 'bg-red-500';
  if (ratio >= 0.4) return 'bg-amber-500';
  return 'bg-green-500';
}

function DamageInsightBadge({ insight }) {
  const details = insight.details ?? {};
  const damageType = details.damage_type ?? 'Unknown';
  const severity = details.severity_score ?? 0;
  const quality = details.photo_quality ?? 'fair';
  const fraudIndicators = details.fraud_indicators ?? [];
  const level = getSeverityLevel(severity, SEVERITY_TIERS.HIGH, SEVERITY_TIERS.MEDIUM);
  const colors = SEVERITY_STYLES[level];
  const qualityLabel = QUALITY_LABELS[quality] ?? QUALITY_LABELS.fair;

  return (
    <div
      className={`rounded-lg border ${colors.ring.replace('ring-', 'border-')} ${colors.bg} p-4 backdrop-blur-sm`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`text-sm font-semibold ${colors.text}`}>
          {damageType}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${qualityLabel.color}`}>
            Quality: {qualityLabel.text}
          </span>
          <SeverityBadge level={level} label={`Severity: ${SEVERITY_STYLES[level].label}`} />
        </div>
      </div>

      {/* Severity score bar */}
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs text-zinc-400">Severity</span>
        <div
          className="h-1.5 flex-1 rounded-full bg-zinc-700"
          role="progressbar"
          aria-valuenow={severity}
          aria-valuemin={0}
          aria-valuemax={MAX_SEVERITY}
          aria-label={`Damage severity: ${severity} out of ${MAX_SEVERITY}`}
        >
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
              className="rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400"
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
        className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none"
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
