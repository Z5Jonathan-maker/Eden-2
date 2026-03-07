/**
 * Adam Module - Reports Tab Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { FileWarning, Shield } from 'lucide-react';

export const ReportsTab = ({ breakReports }) => {
  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900 border-zinc-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <FileWarning className="w-5 h-5 text-orange-400" />
                Break Reports
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Issues detected by The Centurion
              </CardDescription>
            </div>
            <Badge className="bg-zinc-700 text-zinc-300">{breakReports.length} Reports</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {breakReports.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
              <p className="text-zinc-400">No break reports detected</p>
              <p className="text-zinc-400 text-sm">All systems are functioning properly</p>
            </div>
          ) : (
            <div className="space-y-3">
              {breakReports.map((report, idx) => (
                <div key={idx} className="p-4 bg-zinc-800 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge
                        className={
                          report.severity === 'P0'
                            ? 'bg-red-500/20 text-red-400'
                            : report.severity === 'P1'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-zinc-500/20 text-zinc-400'
                        }
                      >
                        {report.severity}
                      </Badge>
                      <span className="ml-2 text-zinc-400 text-sm">{report.module}</span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(report.detected_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-zinc-100 font-medium">{report.description}</p>
                  <p className="text-sm text-zinc-500 mt-1">Route: {report.route}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-zinc-400">Expected: {report.expected}</span>
                    <span className="text-red-400">Actual: {report.actual}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsTab;
