// Centralized thresholds — single source of truth
export const CONFIDENCE_TIERS = { HIGH: 0.85, MEDIUM: 0.60 };
export const SEVERITY_TIERS = { HIGH: 7, MEDIUM: 4 };
export const DEADLINE_COMPLIANCE_DAYS = 14;
export const EVIDENCE_READINESS = { READY: 80, NEEDS_WORK: 50 };

// Semantic severity colors (consistent across all components)
export const SEVERITY_STYLES = {
  high: { bg: 'bg-red-500/20', text: 'text-red-400', ring: 'ring-red-500/30', label: 'High' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', ring: 'ring-amber-500/30', label: 'Medium' },
  low: { bg: 'bg-green-500/20', text: 'text-green-400', ring: 'ring-green-500/30', label: 'Low' },
};

export function getSeverityLevel(value, highThreshold, medThreshold) {
  if (value >= highThreshold) return 'high';
  if (value >= medThreshold) return 'medium';
  return 'low';
}
