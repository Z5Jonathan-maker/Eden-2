import React from 'react';
import {
  FolderOpen,
  Activity,
  CheckCircle2,
  Camera,
  DollarSign,
} from 'lucide-react';

const KPI_DEFINITIONS = [
  {
    id: 'total-claims',
    label: 'Claims Tracked',
    tag: 'Total',
    icon: FolderOpen,
    colorClass: 'blue',
    valueKey: 'totalClaims',
    navigateTo: '/claims',
    format: (v) => String(v),
    valueStyle: { color: '#60a5fa' },
  },
  {
    id: 'active-claims',
    label: 'In Progress',
    tag: 'Active',
    icon: Activity,
    colorClass: 'orange',
    valueKey: 'activeClaims',
    navigateTo: '/claims',
    format: (v) => String(v),
    valueStyle: {},
  },
  {
    id: 'completed',
    label: 'This Month',
    tag: 'Done',
    icon: CheckCircle2,
    colorClass: 'green',
    valueKey: 'completedThisMonth',
    navigateTo: null,
    format: (v) => String(v),
    valueStyle: {},
  },
  {
    id: 'inspections',
    label: 'Pending',
    tag: 'Recon',
    icon: Camera,
    colorClass: 'purple',
    valueKey: 'pendingInspections',
    navigateTo: '/inspections',
    format: (v) => String(v),
    valueStyle: {},
  },
  {
    id: 'pipeline-value',
    label: 'Pipeline Value',
    tag: 'Revenue',
    icon: DollarSign,
    colorClass: 'orange',
    valueKey: 'pipelineValue',
    navigateTo: '/claims',
    format: (v) => `$${(v / 1000).toFixed(0)}K`,
    valueStyle: {},
  },
];

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    hoverBorder: 'group-hover:border-blue-500/40',
    text: 'text-blue-400',
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    hoverBorder: 'group-hover:border-orange-500/40',
    text: 'text-orange-400',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    hoverBorder: 'group-hover:border-green-500/40',
    text: 'text-green-400',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    hoverBorder: 'group-hover:border-purple-500/40',
    text: 'text-purple-400',
  },
};

const KpiCards = ({ stats, onNavigate }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8 stagger-children">
      {KPI_DEFINITIONS.map((kpi) => {
        const Icon = kpi.icon;
        const colors = COLOR_MAP[kpi.colorClass];
        const rawValue = stats?.[kpi.valueKey] ?? 0;
        const displayValue = kpi.format(rawValue);
        const isClickable = kpi.navigateTo !== null;

        return (
          <div
            key={kpi.id}
            className={`card-tactical card-tactical-hover p-3 sm:p-5 group shadow-tactical hover-lift-sm focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${isClickable ? 'cursor-pointer' : ''}`}
            onClick={isClickable ? () => onNavigate(kpi.navigateTo) : undefined}
            tabIndex={isClickable ? 0 : undefined}
            data-testid={`stat-${kpi.id}`}
          >
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className={`p-1.5 sm:p-2.5 rounded-lg ${colors.bg} border ${colors.border} ${colors.hoverBorder} transition-colors`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${colors.text} group-hover:animate-bounce-gentle`} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase">
                {kpi.tag}
              </span>
            </div>
            <p
              className={`text-2xl sm:text-4xl font-tactical font-bold ${colors.text} mb-1`}
              style={kpi.valueStyle}
            >
              {displayValue}
            </p>
            <p className="text-[10px] sm:text-xs font-mono text-zinc-400 uppercase tracking-wider">
              {kpi.label}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default KpiCards;
