/**
 * Adam Module - Dashboard Tab Component
 */

import React from 'react';
import { SystemHealthGrid } from './SystemHealthGrid';
import { CqilMetricsCards } from './CqilMetricsCards';
import { QuickActions } from './QuickActions';

export const DashboardTab = ({
  systemHealth,
  cqilMetrics,
  onRunTests,
  onRefreshHealth,
  onViewReports,
  onRunScan,
  isRunning,
  isScanRunning
}) => {
  return (
    <div className="space-y-6">
      <SystemHealthGrid systemHealth={systemHealth} />
      <CqilMetricsCards cqilMetrics={cqilMetrics} />
      <QuickActions
        onRunTests={onRunTests}
        onRefreshHealth={onRefreshHealth}
        onViewReports={onViewReports}
        onRunScan={onRunScan}
        isRunning={isRunning}
        isScanRunning={isScanRunning}
      />
    </div>
  );
};

export default DashboardTab;
