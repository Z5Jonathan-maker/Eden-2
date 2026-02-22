import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Loader2, FileDown, Share2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const REPORT_TYPES = [
  { id: 'client_report', label: 'Client Report' },
  { id: 'carrier_packet', label: 'Carrier Packet' },
];

const ClaimReportsTab = ({ claimId }) => {
  const [reportType, setReportType] = useState('client_report');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const pollingRef = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const fetchTemplates = async () => {
    const res = await apiGet(`/api/claims/${claimId}/reports/templates?report_type=${reportType}`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to load templates');
      return;
    }
    const templateList = res.data.templates || [];
    setTemplates(templateList);
    if (!templateList.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templateList[0]?.id || '');
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    const [jobRes, reportRes] = await Promise.all([
      apiGet(`/api/claims/${claimId}/reports/jobs?limit=20`),
      apiGet(`/api/claims/${claimId}/reports?report_type=${reportType}&limit=20`),
    ]);

    if (jobRes.ok) {
      setJobs(jobRes.data.jobs || []);
    }
    if (reportRes.ok) {
      setReports(reportRes.data.reports || []);
    } else {
      toast.error(reportRes.error?.detail || reportRes.error || 'Failed to load reports');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
    fetchReports();
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimId, reportType]);

  const pollJob = (jobId) => {
    if (pollingRef.current) window.clearInterval(pollingRef.current);
    pollingRef.current = window.setInterval(async () => {
      const res = await apiGet(`/api/claims/${claimId}/reports/jobs/${jobId}`);
      if (!res.ok) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
        setGenerating(false);
        toast.error(res.error?.detail || res.error || 'Failed to poll report job');
        return;
      }

      const job = res.data.job;
      if (job) {
        setJobs((prev) => {
          const next = [job, ...prev.filter((item) => item.id !== job.id)];
          return next.slice(0, 10);
        });
      }

      if (res.data.status === 'completed') {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
        setGenerating(false);
        toast.success('Report generated');
        fetchReports();
      }
      if (res.data.status === 'failed') {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
        setGenerating(false);
        toast.error(res.data.error || 'Report generation failed');
      }
    }, 2500);
  };

  const generateReport = async () => {
    if (!selectedTemplate) {
      toast.error('Select a report template first');
      return;
    }
    setGenerating(true);
    const res = await apiPost(`/api/claims/${claimId}/reports/generate`, {
      report_type: reportType,
      template_id: selectedTemplate.id,
      template_version: selectedTemplate.version,
      options: {},
    });
    if (!res.ok) {
      setGenerating(false);
      toast.error(res.error?.detail || res.error || 'Failed to start report generation');
      return;
    }
    const jobId = res.data.job_id;
    setJobs((prev) => [{ id: jobId, status: res.data.status, progress: 0 }, ...prev].slice(0, 10));
    pollJob(jobId);
  };

  const downloadReport = async (reportId) => {
    const res = await apiGet(`/api/claims/${claimId}/reports/${reportId}/download`);
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to download report');
      return;
    }
    window.open(res.data.url, '_blank', 'noopener,noreferrer');
  };

  const shareReport = async (reportId) => {
    const res = await apiPost(`/api/claims/${claimId}/reports/${reportId}/share-link`, {
      expires_hours: 72,
    });
    if (!res.ok) {
      toast.error(res.error?.detail || res.error || 'Failed to create share link');
      return;
    }
    try {
      await navigator.clipboard.writeText(res.data.url);
      toast.success('Share link copied (72h expiry)');
    } catch {
      toast.success('Share link created');
      window.open(res.data.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <select
          className="input-tactical px-3 py-2 text-xs"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
        >
          {REPORT_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
        <select
          className="input-tactical px-3 py-2 text-xs md:col-span-2"
          value={selectedTemplateId}
          onChange={(e) => setSelectedTemplateId(e.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} (v{template.version})
            </option>
          ))}
        </select>
        <button
          onClick={generateReport}
          disabled={generating}
          className="px-3 py-2 rounded border border-emerald-600/40 text-emerald-300 hover:text-emerald-200 text-xs uppercase font-mono flex items-center justify-center gap-2"
        >
          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Generate
        </button>
      </div>

      <div className="p-3 rounded border border-zinc-800 bg-zinc-900/40">
        <p className="text-xs text-zinc-500 font-mono uppercase mb-2">Template Outline Preview</p>
        {selectedTemplate ? (
          <div className="text-xs text-zinc-300 space-y-1">
            <p>Template: {selectedTemplate.name}</p>
            <p>Tone: {selectedTemplate.config?.tone || 'default'}</p>
            <p>Depth: {selectedTemplate.config?.depth || 'standard'}</p>
            <p>
              Sections:{' '}
              {Object.entries(selectedTemplate.config?.sections || {})
                .filter(([, enabled]) => Boolean(enabled))
                .map(([name]) => name)
                .join(', ') || 'none'}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No template selected</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 font-mono uppercase">Report Jobs</p>
        <button
          onClick={fetchReports}
          className="px-3 py-2 rounded border border-zinc-700 text-zinc-300 hover:text-white text-xs uppercase font-mono flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <p className="text-xs text-zinc-500">No active jobs</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="p-2 rounded border border-zinc-800 bg-zinc-900/50 text-xs">
              <p className="text-zinc-200 font-mono">{job.id}</p>
              <p className="text-zinc-500 mt-1 uppercase">{job.status} ({job.progress || 0}%)</p>
            </div>
          ))
        )}
      </div>

      <div className="pt-2">
        <p className="text-xs text-zinc-500 font-mono uppercase mb-2">Generated Reports</p>
        {loading ? (
          <div className="py-6 text-zinc-500 text-center text-sm">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <p className="text-xs text-zinc-500">No reports generated yet</p>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="p-3 rounded border border-zinc-800 bg-zinc-900/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-sm text-zinc-200">{report.title || report.id}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">
                      {report.report_type} | template v{report.template_version} | {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadReport(report.id)}
                      className="px-3 py-2 rounded border border-emerald-600/40 text-emerald-300 hover:text-emerald-200 text-xs uppercase font-mono flex items-center gap-2"
                    >
                      <FileDown className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() => shareReport(report.id)}
                      className="px-3 py-2 rounded border border-blue-600/40 text-blue-300 hover:text-blue-200 text-xs uppercase font-mono flex items-center gap-2"
                    >
                      <Share2 className="w-3 h-3" />
                      Share 72h
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimReportsTab;
