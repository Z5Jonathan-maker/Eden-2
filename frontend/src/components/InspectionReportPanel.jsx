/**
 * InspectionReportPanel - Display and manage inspection reports
 *
 * Features:
 * - Generate report button
 * - Report display (markdown)
 * - Copy to clipboard
 * - Download as file
 * - Version history
 */

import React, { useState, useEffect } from 'react';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { toast } from 'sonner';
import {
  FileText,
  Loader2,
  Copy,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  X,
  History,
} from 'lucide-react';
import { useInspectionReport } from '../hooks/useInspectionReport';

const InspectionReportPanel = ({ sessionId, sessionStatus, onClose }) => {
  const {
    generating,
    report,
    reportHistory,
    error,
    generateReport,
    fetchReportHistory,
    fetchReport,
    copyReportToClipboard,
    downloadReport,
    clearReport,
  } = useInspectionReport();

  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Fetch report history on mount
  useEffect(() => {
    if (sessionId) {
      fetchReportHistory(sessionId);
    }
  }, [sessionId, fetchReportHistory]);

  // Load most recent report if available
  useEffect(() => {
    if (reportHistory.length > 0 && !report) {
      fetchReport(reportHistory[0].id);
    }
  }, [reportHistory, report, fetchReport]);

  const handleGenerate = async () => {
    const result = await generateReport(sessionId);
    if (result) {
      toast.success('Report generated successfully!');
      fetchReportHistory(sessionId);
    } else {
      toast.error(error || 'Failed to generate report');
    }
  };

  const handleCopy = async () => {
    const success = await copyReportToClipboard();
    if (success) {
      toast.success('Report copied to clipboard!');
    } else {
      toast.error('Failed to copy report');
    }
  };

  const handleDownload = () => {
    downloadReport();
    toast.success('Report downloaded!');
  };

  const handleSelectVersion = async (reportId) => {
    await fetchReport(reportId);
    setShowHistory(false);
  };

  const canGenerate = sessionStatus === 'completed' || sessionStatus === 'in_progress';

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      data-testid="inspection-report-panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Eve Inspection Report</h3>
            <p className="text-xs text-gray-500">
              {report ? `Version ${report.version}` : 'AI-generated carrier-ready report'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reportHistory.length > 0 && (
            <Badge variant="outline" className="text-purple-600 border-purple-300">
              {reportHistory.length} version{reportHistory.length > 1 ? 's' : ''}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Generate Button */}
          {!report && (
            <div className="text-center py-6">
              <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">
                Generate a professional inspection report using Eve AI
              </p>
              <Button
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="generate-report-btn"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Report (Eve AI)
                  </>
                )}
              </Button>
              {!canGenerate && (
                <p className="text-amber-600 text-sm mt-2">
                  Session must be in progress or completed to generate report
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {generating && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Eve is writing your report...</p>
              <p className="text-gray-400 text-sm">This may take 15-30 seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && !generating && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 font-medium">Generation Failed</p>
                  <p className="text-red-600 text-sm">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-2">
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Report Display */}
          {report && !generating && (
            <>
              {/* Actions Bar */}
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    data-testid="copy-report-btn"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    data-testid="download-report-btn"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                  {reportHistory.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                    >
                      <History className="w-4 h-4 mr-1" />
                      History
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Regenerate
                </Button>
              </div>

              {/* Version History */}
              {showHistory && reportHistory.length > 1 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-700">Report Versions</p>
                  {reportHistory.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectVersion(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                        report.id === r.id
                          ? 'bg-purple-100 text-purple-700'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      <span>Version {r.version}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(r.generated_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Markdown Content */}
              <div
                className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto prose prose-sm max-w-none"
                data-testid="report-content"
              >
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 leading-relaxed">
                  {report.report_markdown}
                </pre>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Generated {new Date(report.generated_at).toLocaleString()}
                </span>
                <span>By {report.generated_by || 'Eve AI'}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectionReportPanel;
