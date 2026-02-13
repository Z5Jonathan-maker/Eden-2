/**
 * Adam Module - Quick Actions Component
 * Tactical Military Style
 */

import React from 'react';
import { Button } from '../ui/button';
import { Play, RefreshCw, Eye, Radar, Target, Crosshair } from 'lucide-react';

export const QuickActions = ({
  onRunTests,
  onRefreshHealth,
  onViewReports,
  onRunScan,
  isRunning,
  isScanRunning,
}) => {
  return (
    <div className="card-tactical p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-orange-500" />
        <h3 className="font-tactical font-bold text-white uppercase tracking-wide">
          Quick Actions
        </h3>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={onRunTests} disabled={isRunning} className="btn-tactical">
          <Play className="w-4 h-4 mr-2" />
          Run Full Test Suite
        </Button>
        <Button
          onClick={onRefreshHealth}
          variant="outline"
          className="border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Health Data
        </Button>
        <Button
          variant="outline"
          className="border-zinc-700/30 text-zinc-300 hover:bg-zinc-800/50 hover:text-white"
          onClick={onViewReports}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Break Reports
        </Button>
        <Button
          onClick={onRunScan}
          disabled={isScanRunning}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Radar className="w-4 h-4 mr-2" />
          Run Centurion Scan
        </Button>
      </div>
    </div>
  );
};

export default QuickActions;
