import React from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  Camera,
  Shield,
  ChevronRight,
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  warning: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  info: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  success: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

const INSIGHT_ICON_MAP = {
  deadline: Clock,
  stalled: AlertTriangle,
  prediction: TrendingUp,
  photos: Camera,
  compliance: Shield,
};

const MOCK_INSIGHTS = [
  {
    id: 'deadline-alert',
    icon: 'deadline',
    severity: 'critical',
    message: '3 claims approaching 90-day FL deadline',
    action: '/claims?filter=deadline',
  },
  {
    id: 'stalled-claim',
    icon: 'stalled',
    severity: 'warning',
    message: 'Claim #1847 stalled \u2014 no carrier response in 12 days',
    action: '/claims/1847',
  },
  {
    id: 'settlement-prediction',
    icon: 'prediction',
    severity: 'success',
    message: 'Settlement prediction ready for Claim #2156: $42K\u2013$48K',
    action: '/claims/2156',
  },
  {
    id: 'photo-review',
    icon: 'photos',
    severity: 'info',
    message: '2 new inspection photos need review',
    action: '/inspections',
  },
  {
    id: 'compliance-update',
    icon: 'compliance',
    severity: 'warning',
    message: 'ComplianceWatch: SB 2A update affects 5 active claims',
    action: '/claims?filter=compliance',
  },
];

const ClaimPilotWidget = ({ onNavigate }) => {
  const handleNavigation = (path) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  return (
    <div className="card-tactical p-4 sm:p-5 shadow-tactical">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-scale-pulse" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500/50 animate-ping" />
          </div>
          <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
            ClaimPilot Insights
          </h3>
        </div>
        <span className="text-[9px] font-mono text-green-400/80 uppercase tracking-wider">
          Live
        </span>
      </div>

      <div className="space-y-2.5">
        {MOCK_INSIGHTS.map((insight) => {
          const IconComponent = INSIGHT_ICON_MAP[insight.icon] || AlertTriangle;
          const severity = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.info;

          return (
            <button
              key={insight.id}
              onClick={() => handleNavigation(insight.action)}
              className={`w-full text-left p-3 rounded-lg ${severity.bg} border ${severity.border} hover:border-orange-500/40 transition-all duration-200 group hover-lift-sm focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900`}
            >
              <div className="flex items-start gap-3">
                <IconComponent className={`w-4 h-4 ${severity.color} flex-shrink-0 mt-0.5`} />
                <p className="text-xs font-mono text-zinc-300 flex-1 leading-relaxed">
                  {insight.message}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="text-[9px] font-mono text-orange-400 uppercase">Review</span>
                  <ChevronRight className="w-3 h-3 text-orange-400" />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ClaimPilotWidget;
