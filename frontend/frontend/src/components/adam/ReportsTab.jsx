/**
 * Adam Module - Reports Tab Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { FileWarning, Shield } from 'lucide-react';

export const ReportsTab = ({ breakReports }) => {
  return (
    <div className="space-y-6">
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileWarning className="w-5 h-5 text-orange-400" />
                Break Reports
              </CardTitle>
              <CardDescription className="text-gray-500">
                Issues detected by The Centurion
              </CardDescription>
            </div>
            <Badge className="bg-gray-700 text-gray-300">
              {breakReports.length} Reports
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {breakReports.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
              <p className="text-gray-600">No break reports detected</p>
              <p className="text-gray-600 text-sm">All systems are functioning properly</p>
            </div>
          ) : (
            <div className="space-y-3">
              {breakReports.map((report, idx) => (
                <div key={idx} className="p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Badge className={
                        report.severity === 'P0' ? 'bg-red-500/20 text-red-400' :
                        report.severity === 'P1' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-600'
                      }>
                        {report.severity}
                      </Badge>
                      <span className="ml-2 text-gray-600 text-sm">{report.module}</span>
                    </div>
                    <span className="text-xs text-gray-600">
                      {new Date(report.detected_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-gray-900 font-medium">{report.description}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Route: {report.route}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-600">Expected: {report.expected}</span>
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
