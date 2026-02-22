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
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  FileText, Loader2, Copy, Download, RefreshCw,
  ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle,
  Sparkles, X, History
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
    clearReport
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
      className="bg-zinc-900 rounded-xl border border-zinc-700/50 shadow-sm overflow-hidden"
      data-testid="inspection-report-panel"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-900/40 to-zinc-800/80 border-b border-zinc-700/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Eve Inspection Report</h3>
            <p className="text-xs text-zinc-400">
              {report ? `Version ${report.version}` : 'AI-generated carrier-ready report'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reportHistory.length > 0 && (
            <Badge variant="outline" className="text-purple-400 border-purple-500/40">
              {reportHistory.length} version{reportHistory.length > 1 ? 's' : ''}
            </Badge>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-zinc-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Generate Button */}
          {!report && (
            <div className="text-center py-6">
              <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-3" />
              <p className="text-zinc-400 mb-4">
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
                <p className="text-amber-500 text-sm mt-2">
                  Session must be in progress or completed to generate report
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {generating && (
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-3" />
              <p className="text-zinc-300 font-medium">Eve is writing your report...</p>
              <p className="text-zinc-500 text-sm">This may take 15-30 seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && !generating && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 font-medium">Generation Failed</p>
                  <p className="text-red-400 text-sm">{error}</p>
                  <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-2 border-zinc-600 text-zinc-300">
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
              <div className="flex items-center justify-between pb-3 border-b border-zinc-700/50">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="border-zinc-600 text-zinc-300 hover:text-white"
                    data-testid="copy-report-btn"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="border-zinc-600 text-zinc-300 hover:text-white"
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
                      className="border-zinc-600 text-zinc-300 hover:text-white"
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
                <div className="bg-zinc-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-zinc-300">Report Versions</p>
                  {reportHistory.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectVersion(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                        report.id === r.id
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'hover:bg-zinc-700 text-zinc-400'
                      }`}
                    >
                      <span>Version {r.version}</span>
                      <span className="text-xs text-zinc-500">
                        {new Date(r.generated_at).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Markdown Content — rendered as formatted HTML */}
              <div
                className="bg-zinc-800/60 rounded-lg p-4 max-h-[500px] overflow-y-auto prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-strong:text-zinc-200 prose-li:text-zinc-300 prose-a:text-purple-400"
                data-testid="report-content"
              >
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {report.report_markdown}
                </ReactMarkdown>
              </div>

              {/* Meta Info */}
              <div className="flex items-center justify-between text-xs text-zinc-500 pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Generated {new Date(report.generated_at).toLocaleString()}
                </span>
                <span>
                  By {report.generated_by || 'Eve AI'}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InspectionReportPanel;
