/**
 * Adam Module - CQIL Metrics Cards Component
 * Tactical Military Style
 */

import React from 'react';
import { AlertCircle, AlertTriangle, FileWarning, CheckCircle2 } from 'lucide-react';

export const CqilMetricsCards = ({ cqilMetrics }) => {
  const metrics = [
    {
      label: 'P0 Issues',
      value: cqilMetrics?.open_issues?.P0 || 0,
      subtext: 'Must stop release',
      icon: AlertCircle,
      color: 'red',
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-400',
      borderColor: 'border-red-500/30'
    },
    {
      label: 'P1 Issues',
      value: cqilMetrics?.open_issues?.P1 || 0,
      subtext: 'Fix within sprint',
      icon: AlertTriangle,
      color: 'yellow',
      bgColor: 'bg-yellow-500/10',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30'
    },
    {
      label: 'P2 Issues',
      value: cqilMetrics?.open_issues?.P2 || 0,
      subtext: 'Scheduled fix',
      icon: FileWarning,
      color: 'zinc',
      bgColor: 'bg-zinc-500/10',
      textColor: 'text-zinc-400',
      borderColor: 'border-zinc-500/30'
    },
    {
      label: 'Resolved (7d)',
      value: cqilMetrics?.resolved_this_week || 0,
      subtext: 'This week',
      icon: CheckCircle2,
      color: 'green',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      borderColor: 'border-green-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <div 
            key={idx} 
            className={`card-tactical p-4 ${metric.borderColor} border-l-2`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider">{metric.label}</p>
                <p className={`text-3xl font-tactical font-bold ${metric.textColor}`}>
                  {metric.value}
                </p>
              </div>
              <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                <Icon className={`w-8 h-8 ${metric.textColor} opacity-70`} />
              </div>
            </div>
            <p className="text-xs text-zinc-600 mt-2 font-mono">{metric.subtext}</p>
          </div>
        );
      })}
    </div>
  );
};

export default CqilMetricsCards;
