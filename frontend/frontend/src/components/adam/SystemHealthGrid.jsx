/**
 * Adam Module - System Health Grid Component
 * Tactical Military Style
 */

import React from 'react';
import { Badge } from '../../shared/ui/badge';
import { Database, Wifi, Zap, FileCheck, Lock, Activity } from 'lucide-react';

const COMPONENT_ICONS = {
  database: Database,
  api_routes: Wifi,
  integrations: Zap,
  data_integrity: FileCheck,
  permissions: Lock,
};

export const SystemHealthGrid = ({ systemHealth }) => {
  if (!systemHealth?.components) return null;
  const formatLatency = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return `${num.toFixed(0)}ms`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {systemHealth.components.map((comp, idx) => {
        const isOperational = comp.status === 'operational';
        const isDegraded = comp.status === 'degraded';
        const statusColor = isOperational ? 'green' : isDegraded ? 'yellow' : 'red';
        const Icon = COMPONENT_ICONS[comp.component] || Activity;

        return (
          <div
            key={idx}
            className={`card-tactical p-4 border-l-2 ${
              isOperational
                ? 'border-l-green-500'
                : isDegraded
                  ? 'border-l-yellow-500'
                  : 'border-l-red-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon
                className={`w-5 h-5 ${
                  isOperational ? 'text-green-400' : isDegraded ? 'text-yellow-400' : 'text-red-400'
                }`}
              />
              <span className="text-sm font-tactical font-medium text-white uppercase">
                {comp.component.replace('_', ' ')}
              </span>
            </div>
            <Badge
              className={`${
                isOperational
                  ? 'bg-green-500/20 text-green-400'
                  : isDegraded
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              } font-mono text-xs uppercase`}
            >
              {comp.status}
            </Badge>
            {formatLatency(comp.latency_ms) && (
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                {formatLatency(comp.latency_ms)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SystemHealthGrid;
