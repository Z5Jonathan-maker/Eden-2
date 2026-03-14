/**
 * useInspectionReport - Hook for generating and managing inspection reports
 * 
 * Handles:
 * - Report generation via Eve AI
 * - Report versioning/history
 * - Markdown rendering
 */

import { useState, useCallback } from 'react';
import { api, apiPost, API_URL } from '../lib/api';

export function useInspectionReport() {
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [error, setError] = useState(null);

  /**
   * Generate a new inspection report for a session
   */
  const generateReport = useCallback(async (sessionId) => {
    if (!sessionId) {
      setError('No session ID provided');
      return null;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await apiPost(`/api/inspections/sessions/${sessionId}/report`, {});

      if (!res.ok) {
        throw new Error(res.error || 'Failed to generate report');
      }

      setReport(res.data);
      return res.data;
    } catch (err) {
      console.error('[useInspectionReport] Generation error:', err);
      setError(err.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  /**
   * Fetch report history for a session
   */
  const fetchReportHistory = useCallback(async (sessionId) => {
    if (!sessionId) return [];

    try {
      const res = await api(`/api/inspections/sessions/${sessionId}/reports`);
      if (res.ok) {
        setReportHistory(res.data.reports || []);
        return res.data.reports || [];
      }
    } catch (err) {
      console.error('[useInspectionReport] Fetch history error:', err);
    }
    return [];
  }, []);

  /**
   * Fetch a specific report by ID
   */
  const fetchReport = useCallback(async (reportId) => {
    if (!reportId) return null;

    try {
      const res = await api(`/api/inspections/reports/${reportId}`);
      if (res.ok) {
        setReport(res.data);
        return res.data;
      }
    } catch (err) {
      console.error('[useInspectionReport] Fetch report error:', err);
    }
    return null;
  }, []);

  /**
   * Copy report markdown to clipboard
   */
  const copyReportToClipboard = useCallback(async () => {
    if (!report?.report_markdown) return false;

    try {
      await navigator.clipboard.writeText(report.report_markdown);
      return true;
    } catch (err) {
      console.error('[useInspectionReport] Copy error:', err);
      return false;
    }
  }, [report]);

  /**
   * Download report as markdown file
   */
  const downloadReport = useCallback(() => {
    if (!report?.report_markdown) return;

    const blob = new Blob([report.report_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection-report-${report.session_id}-v${report.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report]);

  /**
   * Clear current report
   */
  const clearReport = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return {
    // State
    generating,
    report,
    reportHistory,
    error,
    
    // Actions
    generateReport,
    fetchReportHistory,
    fetchReport,
    copyReportToClipboard,
    downloadReport,
    clearReport
  };
}

export default useInspectionReport;
