/**
 * PerformanceConsole - Unified admin console for field performance
 * 
 * Combines:
 * - Harvest configuration (territories, dispositions, goals)
 * - Incentives management (competitions, templates, rewards)
 * 
 * Enzy-style ops dashboard for admins/managers.
 */
import React, { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../shared/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { 
  MapPin, Trophy, Settings, Users, Target, 
  Gift, Calendar, BarChart3, Zap, Brain, AlertTriangle, Loader2, Download
} from 'lucide-react';

// Import existing admin consoles
import HarvestAdminConsole from '../HarvestAdminConsole';
import IncentivesAdminConsole from '../IncentivesAdminConsole';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;
const SMS_AUDIT_PRESETS_KEY = 'eden_sms_audit_presets_v1';
const SMS_AUDIT_THRESHOLDS_KEY = 'eden_sms_audit_thresholds_v1';
const DEFAULT_SMS_AUDIT_PRESETS = [
  { id: 'preset_high_unack', name: 'High + Unacked', days: 7, riskLevel: 'high', ack: 'unack', intent: 'all' },
  { id: 'preset_high_all', name: 'All High Risk', days: 7, riskLevel: 'high', ack: 'all', intent: 'all' },
  { id: 'preset_docs_24h', name: 'Docs Last 24h', days: 1, riskLevel: 'all', ack: 'all', intent: 'document_collection' },
];
const DEFAULT_SMS_AUDIT_THRESHOLDS = {
  minEvents: 10,
  highRiskRatePct: 20,
  ackMissingRatePct: 15,
};

const PerformanceConsole = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50" data-testid="performance-console">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Performance Console</h1>
              <p className="text-white/70">Harvest operations & incentives management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="harvest" className="flex items-center gap-2" data-testid="tab-harvest">
              <MapPin className="w-4 h-4" />
              Harvest & Territories
            </TabsTrigger>
            <TabsTrigger value="incentives" className="flex items-center gap-2" data-testid="tab-incentives">
              <Trophy className="w-4 h-4" />
              Competitions & Rewards
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Quick Stats */}
          <TabsContent value="overview">
            <PerformanceOverview onNavigate={setActiveTab} />
          </TabsContent>

          {/* Harvest Tab */}
          <TabsContent value="harvest">
            <HarvestAdminConsole />
          </TabsContent>

          {/* Incentives Tab */}
          <TabsContent value="incentives">
            <IncentivesAdminConsole />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};


/**
 * Performance Overview - Quick stats and actions
 */
const PerformanceOverview = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    activeCompetitions: 0,
    totalReps: 0,
    todayDoors: 0,
    todayAppointments: 0,
    territories: 0,
    activeStreaks: 0
  });
  const [aiMetrics, setAiMetrics] = useState(null);
  const [loadingAiMetrics, setLoadingAiMetrics] = useState(false);
  const [aiMetricsError, setAiMetricsError] = useState('');
  const [aiMetricsDays, setAiMetricsDays] = useState(7);
  const [smsAudit, setSmsAudit] = useState(null);
  const [loadingSmsAudit, setLoadingSmsAudit] = useState(false);
  const [smsAuditError, setSmsAuditError] = useState('');
  const [smsAuditDays, setSmsAuditDays] = useState(7);
  const [smsAuditRiskLevel, setSmsAuditRiskLevel] = useState('all');
  const [smsAuditAck, setSmsAuditAck] = useState('all');
  const [smsAuditIntent, setSmsAuditIntent] = useState('all');
  const [smsAuditPresets, setSmsAuditPresets] = useState(DEFAULT_SMS_AUDIT_PRESETS);
  const [smsAuditThresholds, setSmsAuditThresholds] = useState(DEFAULT_SMS_AUDIT_THRESHOLDS);
  const [loadingSmsThresholds, setLoadingSmsThresholds] = useState(false);
  const [savingSmsThresholds, setSavingSmsThresholds] = useState(false);
  const [smsThresholdsError, setSmsThresholdsError] = useState('');
  const [smsThresholdsMeta, setSmsThresholdsMeta] = useState({ updatedAt: null, updatedBy: null });

  const exportAiMetricsCsv = () => {
    if (!aiMetrics) return;

    const rows = [];
    rows.push(['window_days', aiMetrics.days ?? aiMetricsDays]);
    rows.push(['total_calls', aiMetrics.total_calls ?? 0]);
    rows.push(['success_rate_pct', aiMetrics.success_rate ?? 0]);
    rows.push(['failure_rate_pct', aiMetrics.failure_rate ?? 0]);
    rows.push(['p50_latency_ms', aiMetrics.latency_ms?.p50 ?? 0]);
    rows.push(['p95_latency_ms', aiMetrics.latency_ms?.p95 ?? 0]);
    rows.push(['cost_total_usd', aiMetrics.cost_usd?.total ?? 0]);
    rows.push(['gateway_calls', aiMetrics.gateway?.calls ?? 0]);
    rows.push(['gateway_fallback_calls', aiMetrics.gateway?.fallback_calls ?? 0]);
    rows.push(['gateway_fallback_rate_pct', aiMetrics.gateway?.fallback_rate ?? 0]);
    rows.push(['gateway_error_calls', aiMetrics.gateway?.error_calls ?? 0]);
    rows.push(['budget_daily_limit_usd', aiMetrics.budget?.daily_limit_usd ?? 0]);
    rows.push(['budget_today_spend_usd', aiMetrics.budget?.today_spend_usd ?? 0]);
    rows.push(['budget_today_utilization_pct', aiMetrics.budget?.today_utilization_pct ?? 0]);
    rows.push([]);
    rows.push(['by_task']);
    rows.push(['task', 'calls']);
    Object.entries(aiMetrics.by_task || {}).forEach(([task, calls]) => {
      rows.push([task, calls]);
    });
    rows.push([]);
    rows.push(['by_provider']);
    rows.push(['provider', 'calls', 'cost_usd']);
    Object.entries(aiMetrics.by_provider || {}).forEach(([provider, calls]) => {
      rows.push([provider, calls, aiMetrics.cost_usd?.by_provider?.[provider] || 0]);
    });
    rows.push([]);
    rows.push(['slowest_tasks']);
    rows.push(['task', 'calls', 'avg_latency_ms', 'total_cost_usd']);
    (aiMetrics.rankings?.slowest_tasks || []).forEach((item) => {
      rows.push([item.task, item.calls, item.avg_latency_ms, item.total_cost_usd]);
    });
    rows.push([]);
    rows.push(['highest_cost_tasks']);
    rows.push(['task', 'calls', 'avg_latency_ms', 'total_cost_usd']);
    (aiMetrics.rankings?.highest_cost_tasks || []).forEach((item) => {
      rows.push([item.task, item.calls, item.avg_latency_ms, item.total_cost_usd]);
    });

    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell === undefined || cell === null ? '' : String(cell);
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-ops-metrics-${aiMetricsDays}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // TODO: Fetch real stats from API
  useEffect(() => {
    const fetchAiMetrics = async () => {
      setLoadingAiMetrics(true);
      setAiMetricsError('');
      try {
        const token = localStorage.getItem('eden_token');
        const res = await fetch(`${API_URL}/api/ai/task/metrics?days=${aiMetricsDays}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load AI metrics');
        }
        setAiMetrics(data);
      } catch (err) {
        setAiMetricsError(err.message || 'Failed to load AI metrics');
      } finally {
        setLoadingAiMetrics(false);
      }
    };

    fetchAiMetrics();
  }, [aiMetricsDays]);

  useEffect(() => {
    const fetchSmsAudit = async () => {
      setLoadingSmsAudit(true);
      setSmsAuditError('');
      try {
        const token = localStorage.getItem('eden_token');
        const params = new URLSearchParams();
        params.set('days', String(smsAuditDays));
        params.set('limit', '40');
        if (smsAuditRiskLevel !== 'all') params.set('risk_level', smsAuditRiskLevel);
        if (smsAuditAck === 'ack') params.set('risk_acknowledged', 'true');
        if (smsAuditAck === 'unack') params.set('risk_acknowledged', 'false');
        if (smsAuditIntent !== 'all') params.set('thread_intent', smsAuditIntent);
        const res = await fetch(`${API_URL}/api/sms/audit?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load SMS risk audit');
        }
        setSmsAudit(data);
      } catch (err) {
        setSmsAuditError(err.message || 'Failed to load SMS risk audit');
      } finally {
        setLoadingSmsAudit(false);
      }
    };

    fetchSmsAudit();
  }, [smsAuditAck, smsAuditDays, smsAuditIntent, smsAuditRiskLevel]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SMS_AUDIT_PRESETS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .map((preset) => ({
          id: String(preset.id || `preset_${Math.random().toString(36).slice(2)}`),
          name: String(preset.name || 'Preset'),
          days: Number(preset.days || 7),
          riskLevel: String(preset.riskLevel || 'all'),
          ack: String(preset.ack || 'all'),
          intent: String(preset.intent || 'all'),
        }))
        .filter((preset) => preset.name.trim().length > 0)
        .slice(0, 12);
      if (normalized.length > 0) {
        setSmsAuditPresets(normalized);
      }
    } catch (_err) {
      // Ignore local storage parse errors.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SMS_AUDIT_PRESETS_KEY, JSON.stringify(smsAuditPresets));
  }, [smsAuditPresets]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SMS_AUDIT_THRESHOLDS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setSmsAuditThresholds({
        minEvents: Number(parsed?.minEvents ?? DEFAULT_SMS_AUDIT_THRESHOLDS.minEvents),
        highRiskRatePct: Number(parsed?.highRiskRatePct ?? DEFAULT_SMS_AUDIT_THRESHOLDS.highRiskRatePct),
        ackMissingRatePct: Number(parsed?.ackMissingRatePct ?? DEFAULT_SMS_AUDIT_THRESHOLDS.ackMissingRatePct),
      });
    } catch (_err) {
      // Ignore local storage parse errors.
    }
  }, []);

  useEffect(() => {
    const fetchSmsThresholds = async () => {
      setLoadingSmsThresholds(true);
      setSmsThresholdsError('');
      try {
        const token = localStorage.getItem('eden_token');
        const res = await fetch(`${API_URL}/api/settings/ai-comms-risk-thresholds`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load audit thresholds');
        }
        setSmsAuditThresholds({
          minEvents: Number(data.min_events ?? DEFAULT_SMS_AUDIT_THRESHOLDS.minEvents),
          highRiskRatePct: Number(data.high_risk_rate_pct ?? DEFAULT_SMS_AUDIT_THRESHOLDS.highRiskRatePct),
          ackMissingRatePct: Number(data.ack_missing_rate_pct ?? DEFAULT_SMS_AUDIT_THRESHOLDS.ackMissingRatePct),
        });
        setSmsThresholdsMeta({
          updatedAt: data.updated_at || null,
          updatedBy: data.updated_by || null,
        });
      } catch (err) {
        setSmsThresholdsError(err.message || 'Failed to load audit thresholds');
      } finally {
        setLoadingSmsThresholds(false);
      }
    };
    fetchSmsThresholds();
  }, []);

  useEffect(() => {
    localStorage.setItem(SMS_AUDIT_THRESHOLDS_KEY, JSON.stringify(smsAuditThresholds));
  }, [smsAuditThresholds]);

  const applySmsAuditPreset = (preset) => {
    setSmsAuditDays(Number(preset.days || 7));
    setSmsAuditRiskLevel(preset.riskLevel || 'all');
    setSmsAuditAck(preset.ack || 'all');
    setSmsAuditIntent(preset.intent || 'all');
  };

  const saveCurrentSmsAuditPreset = () => {
    const name = window.prompt('Name this SMS audit preset');
    if (!name || !name.trim()) return;
    const nextPreset = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      days: smsAuditDays,
      riskLevel: smsAuditRiskLevel,
      ack: smsAuditAck,
      intent: smsAuditIntent,
    };
    setSmsAuditPresets((prev) => [nextPreset, ...prev].slice(0, 12));
  };

  const removeSmsAuditPreset = (presetId) => {
    setSmsAuditPresets((prev) => prev.filter((preset) => preset.id !== presetId));
  };

  const updateSmsThreshold = (key, value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return;
    setSmsAuditThresholds((prev) => ({
      ...prev,
      [key]: Math.max(0, numeric),
    }));
  };

  const saveSmsThresholds = async () => {
    setSavingSmsThresholds(true);
    setSmsThresholdsError('');
    try {
      const token = localStorage.getItem('eden_token');
      const res = await fetch(`${API_URL}/api/settings/ai-comms-risk-thresholds`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          min_events: Number(smsAuditThresholds.minEvents || 0),
          high_risk_rate_pct: Number(smsAuditThresholds.highRiskRatePct || 0),
          ack_missing_rate_pct: Number(smsAuditThresholds.ackMissingRatePct || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to save audit thresholds');
      }
      setSmsThresholdsMeta({
        updatedAt: data.updated_at || null,
        updatedBy: data.updated_by || null,
      });
    } catch (err) {
      setSmsThresholdsError(err.message || 'Failed to save audit thresholds');
    } finally {
      setSavingSmsThresholds(false);
    }
  };

  const exportSmsAuditCsv = () => {
    const events = Array.isArray(smsAudit?.events) ? smsAudit.events : [];
    if (!events.length) return;
    const rows = [];
    rows.push(['window_days', smsAuditDays]);
    rows.push(['filter_risk_level', smsAuditRiskLevel]);
    rows.push(['filter_ack', smsAuditAck]);
    rows.push(['filter_intent', smsAuditIntent]);
    rows.push(['summary_total', smsAudit?.summary?.total ?? 0]);
    rows.push(['summary_high_risk', smsAudit?.summary?.high_risk ?? 0]);
    rows.push(['summary_ack_missing', smsAudit?.summary?.ack_missing ?? 0]);
    rows.push([]);
    rows.push(['id', 'created_at', 'claim_id', 'to', 'status', 'risk_level', 'risk_acknowledged', 'thread_intent', 'risk_flags', 'created_by_name']);
    events.forEach((evt) => {
      rows.push([
        evt.id || '',
        evt.created_at || '',
        evt.claim_id || '',
        evt.to || '',
        evt.status || '',
        evt.risk_level || '',
        evt.risk_acknowledged === true ? 'true' : 'false',
        evt.thread_intent || '',
        Array.isArray(evt.risk_flags) ? evt.risk_flags.join(' | ') : '',
        evt.created_by_name || '',
      ]);
    });
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const value = cell === undefined || cell === null ? '' : String(cell);
            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms-risk-audit-${smsAuditDays}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const quickActions = [
    {
      title: 'Launch Competition',
      description: 'Create a new competition from template',
      icon: Trophy,
      color: 'bg-orange-500',
      onClick: () => onNavigate('incentives')
    },
    {
      title: 'Assign Territories',
      description: 'Manage territory assignments',
      icon: MapPin,
      color: 'bg-blue-500',
      onClick: () => onNavigate('harvest')
    },
    {
      title: 'Configure Goals',
      description: 'Set daily targets for reps',
      icon: Target,
      color: 'bg-green-500',
      onClick: () => onNavigate('harvest')
    },
    {
      title: 'Manage Rewards',
      description: 'Update reward catalog',
      icon: Gift,
      color: 'bg-purple-500',
      onClick: () => onNavigate('incentives')
    }
  ];

  const smsTotal = Number(smsAudit?.summary?.total ?? 0);
  const smsHighRisk = Number(smsAudit?.summary?.high_risk ?? 0);
  const smsAckMissing = Number(smsAudit?.summary?.ack_missing ?? 0);
  const highRiskRate = smsTotal > 0 ? (smsHighRisk / smsTotal) * 100 : 0;
  const ackMissingRate = smsTotal > 0 ? (smsAckMissing / smsTotal) * 100 : 0;
  const showThresholdAlerts = smsTotal >= smsAuditThresholds.minEvents;
  const smsAuditAlerts = [];
  if (showThresholdAlerts && highRiskRate >= smsAuditThresholds.highRiskRatePct) {
    smsAuditAlerts.push({
      id: 'high-risk-rate',
      level: 'warn',
      message: `High-risk SMS rate is ${highRiskRate.toFixed(1)}% (threshold ${smsAuditThresholds.highRiskRatePct}%).`,
    });
  }
  if (showThresholdAlerts && ackMissingRate >= smsAuditThresholds.ackMissingRatePct) {
    smsAuditAlerts.push({
      id: 'ack-missing-rate',
      level: 'error',
      message: `Missing acknowledgment rate is ${ackMissingRate.toFixed(1)}% (threshold ${smsAuditThresholds.ackMissingRatePct}%).`,
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          title="Active Competitions"
          value="3"
          icon={Trophy}
          color="text-orange-500"
        />
        <StatCard 
          title="Active Reps"
          value="12"
          icon={Users}
          color="text-blue-500"
        />
        <StatCard 
          title="Doors Today"
          value="247"
          icon={MapPin}
          color="text-green-500"
        />
        <StatCard 
          title="Appointments"
          value="18"
          icon={Calendar}
          color="text-purple-500"
        />
        <StatCard 
          title="Territories"
          value="8"
          icon={Target}
          color="text-cyan-500"
        />
        <StatCard 
          title="Active Streaks"
          value="9"
          icon={Zap}
          color="text-amber-500"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <Card 
              key={idx}
              className="cursor-pointer hover:border-slate-300 transition-colors"
              onClick={action.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${action.color} text-white`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI Ops */}
      <div>
        <h2 className="text-lg font-semibold mb-4">AI Ops</h2>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-500" />
                AI Task Health
              </CardTitle>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportAiMetricsCsv}
                  disabled={!aiMetrics || loadingAiMetrics}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  title="Export AI metrics CSV"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                {[1, 7, 30].map((days) => (
                  <button
                    key={`metrics-days-${days}`}
                    onClick={() => setAiMetricsDays(days)}
                    className={`px-2 py-1 rounded text-xs border ${
                      aiMetricsDays === days
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {days === 1 ? '24h' : `${days}d`}
                  </button>
                ))}
              </div>
            </div>
            <CardDescription>Gateway metrics for claim workspace AI tasks.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAiMetrics ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading AI telemetry...
              </div>
            ) : aiMetricsError ? (
              <div className="text-sm text-red-500">{aiMetricsError}</div>
            ) : aiMetrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MetricPill label="Calls" value={aiMetrics.total_calls ?? 0} />
                  <MetricPill label="Success" value={`${aiMetrics.success_rate ?? 0}%`} />
                  <MetricPill label="Failure" value={`${aiMetrics.failure_rate ?? 0}%`} />
                  <MetricPill label="P50" value={`${aiMetrics.latency_ms?.p50 ?? 0}ms`} />
                  <MetricPill label="P95" value={`${aiMetrics.latency_ms?.p95 ?? 0}ms`} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MetricPill label="Est. Cost Total" value={`$${Number(aiMetrics.cost_usd?.total || 0).toFixed(4)}`} />
                  <MetricPill
                    label="Top Provider Cost"
                    value={(() => {
                      const entries = Object.entries(aiMetrics.cost_usd?.by_provider || {});
                      if (!entries.length) return '$0.0000';
                      const [provider, cost] = entries.sort((a, b) => b[1] - a[1])[0];
                      return `${provider}: $${Number(cost || 0).toFixed(4)}`;
                    })()}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MetricPill label="Gateway Calls" value={aiMetrics.gateway?.calls ?? 0} />
                  <MetricPill label="Fallback Rate" value={`${aiMetrics.gateway?.fallback_rate ?? 0}%`} />
                  <MetricPill
                    label="Budget Today"
                    value={`$${Number(aiMetrics.budget?.today_spend_usd || 0).toFixed(4)} / $${Number(aiMetrics.budget?.daily_limit_usd || 0).toFixed(2)} (${Number(aiMetrics.budget?.today_utilization_pct || 0).toFixed(1)}%)`}
                  />
                </div>

                {Array.isArray(aiMetrics.alerts) && aiMetrics.alerts.length > 0 && (
                  <div className="space-y-2">
                    {aiMetrics.alerts.map((alert, idx) => (
                      <div key={`alert-${idx}`} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                        <div className="text-amber-900">{alert.message}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">By Task</p>
                    <div className="space-y-1">
                      {Object.entries(aiMetrics.by_task || {}).map(([task, count]) => (
                        <div key={task} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{task}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">By Provider</p>
                    <div className="space-y-1">
                      {Object.entries(aiMetrics.by_provider || {}).map(([provider, count]) => (
                        <div key={provider} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{provider}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Slowest Tasks</p>
                    <div className="space-y-1">
                      {(aiMetrics.rankings?.slowest_tasks || []).map((item) => (
                        <div key={`slow-${item.task}`} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.task}</span>
                          <span className="font-medium">{item.avg_latency_ms}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Highest Cost Tasks</p>
                    <div className="space-y-1">
                      {(aiMetrics.rankings?.highest_cost_tasks || []).map((item) => (
                        <div key={`cost-${item.task}`} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.task}</span>
                          <span className="font-medium">${Number(item.total_cost_usd || 0).toFixed(4)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No AI metrics available.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                AI Comms Risk Audit
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportSmsAuditCsv}
                  disabled={!Array.isArray(smsAudit?.events) || smsAudit.events.length === 0 || loadingSmsAudit}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  title="Export SMS risk audit CSV"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
                <button
                  onClick={saveCurrentSmsAuditPreset}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200"
                  title="Save current filters as preset"
                >
                  Save Preset
                </button>
                <select
                  value={smsAuditDays}
                  onChange={(e) => setSmsAuditDays(Number(e.target.value) || 7)}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200"
                >
                  <option value={1}>24h</option>
                  <option value={7}>7d</option>
                  <option value={30}>30d</option>
                </select>
                <select
                  value={smsAuditRiskLevel}
                  onChange={(e) => setSmsAuditRiskLevel(e.target.value)}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200"
                >
                  <option value="all">All Risks</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select
                  value={smsAuditAck}
                  onChange={(e) => setSmsAuditAck(e.target.value)}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200"
                >
                  <option value="all">All Ack</option>
                  <option value="ack">Acknowledged</option>
                  <option value="unack">Unacknowledged</option>
                </select>
                <select
                  value={smsAuditIntent}
                  onChange={(e) => setSmsAuditIntent(e.target.value)}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200"
                >
                  <option value="all">All Intents</option>
                  <option value="status_update">Status</option>
                  <option value="document_collection">Docs</option>
                  <option value="scheduling">Scheduling</option>
                  <option value="settlement_update">Settlement</option>
                </select>
              </div>
            </div>
            <CardDescription>Outbound AI SMS risk events with acknowledgment lineage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg border bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase text-muted-foreground">Alert Thresholds</p>
                <button
                  onClick={saveSmsThresholds}
                  disabled={savingSmsThresholds || loadingSmsThresholds}
                  className="px-2 py-1 rounded text-xs border bg-white text-slate-600 border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSmsThresholds ? 'Saving...' : 'Save Thresholds'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="text-xs text-slate-600 flex items-center gap-2">
                  Min events
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={smsAuditThresholds.minEvents}
                    onChange={(e) => updateSmsThreshold('minEvents', e.target.value)}
                    className="w-20 px-2 py-1 rounded border bg-white text-slate-700 border-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-600 flex items-center gap-2">
                  High risk %
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={smsAuditThresholds.highRiskRatePct}
                    onChange={(e) => updateSmsThreshold('highRiskRatePct', e.target.value)}
                    className="w-20 px-2 py-1 rounded border bg-white text-slate-700 border-slate-200"
                  />
                </label>
                <label className="text-xs text-slate-600 flex items-center gap-2">
                  Ack missing %
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={smsAuditThresholds.ackMissingRatePct}
                    onChange={(e) => updateSmsThreshold('ackMissingRatePct', e.target.value)}
                    className="w-20 px-2 py-1 rounded border bg-white text-slate-700 border-slate-200"
                  />
                </label>
              </div>
              {loadingSmsThresholds && (
                <div className="mt-2 text-xs text-muted-foreground">Loading org thresholds...</div>
              )}
              {smsThresholdsError && (
                <div className="mt-2 text-xs text-red-600">{smsThresholdsError}</div>
              )}
              {(smsThresholdsMeta.updatedAt || smsThresholdsMeta.updatedBy) && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Last saved {smsThresholdsMeta.updatedAt ? new Date(smsThresholdsMeta.updatedAt).toLocaleString() : '-'}
                  {smsThresholdsMeta.updatedBy ? ` by ${smsThresholdsMeta.updatedBy}` : ''}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {smsAuditPresets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1 rounded border bg-slate-50 px-2 py-1">
                  <button
                    onClick={() => applySmsAuditPreset(preset)}
                    className="text-xs text-slate-700 hover:text-slate-900"
                    title="Apply preset"
                  >
                    {preset.name}
                  </button>
                  {String(preset.id).startsWith('custom_') && (
                    <button
                      onClick={() => removeSmsAuditPreset(preset.id)}
                      className="text-[10px] text-slate-500 hover:text-red-600"
                      title="Remove preset"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
            {loadingSmsAudit ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading SMS audit events...
              </div>
            ) : smsAuditError ? (
              <div className="text-sm text-red-500">{smsAuditError}</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <MetricPill label="High Risk %" value={`${highRiskRate.toFixed(1)}%`} />
                  <MetricPill label="Ack Missing %" value={`${ackMissingRate.toFixed(1)}%`} />
                </div>
                {smsAuditAlerts.length > 0 && (
                  <div className="space-y-2">
                    {smsAuditAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-md border p-2 text-sm ${
                          alert.level === 'error'
                            ? 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}
                      >
                        {alert.message}
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <MetricPill label="Total Events" value={smsAudit?.summary?.total ?? 0} />
                  <MetricPill label="High Risk" value={smsAudit?.summary?.high_risk ?? 0} />
                  <MetricPill label="Ack Missing" value={smsAudit?.summary?.ack_missing ?? 0} />
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-[11px] uppercase text-muted-foreground">
                    <div className="col-span-2">When</div>
                    <div className="col-span-2">Claim</div>
                    <div className="col-span-2">Intent</div>
                    <div className="col-span-1">Risk</div>
                    <div className="col-span-2">Ack</div>
                    <div className="col-span-3">Flags</div>
                  </div>
                  {Array.isArray(smsAudit?.events) && smsAudit.events.length > 0 ? (
                    smsAudit.events.slice(0, 12).map((evt) => (
                      <div key={evt.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-t text-xs">
                        <div className="col-span-2 text-muted-foreground">{evt.created_at ? new Date(evt.created_at).toLocaleString() : '-'}</div>
                        <div className="col-span-2 font-medium">{evt.claim_id || '-'}</div>
                        <div className="col-span-2">{evt.thread_intent || '-'}</div>
                        <div className="col-span-1">
                          <Badge variant="outline">{evt.risk_level || '-'}</Badge>
                        </div>
                        <div className="col-span-2">{evt.risk_acknowledged === true ? 'Yes' : 'No'}</div>
                        <div className="col-span-3 truncate" title={Array.isArray(evt.risk_flags) ? evt.risk_flags.join(' | ') : ''}>
                          {Array.isArray(evt.risk_flags) && evt.risk_flags.length > 0 ? evt.risk_flags.join(' | ') : '-'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground border-t">No audit events found for current filters.</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              <ActivityItem 
                icon={Trophy}
                iconColor="text-orange-500"
                title="New competition started"
                description="Weekend Blitz is now active"
                time="2 hours ago"
              />
              <ActivityItem 
                icon={MapPin}
                iconColor="text-blue-500"
                title="Territory assigned"
                description="Zone 5 assigned to John Smith"
                time="4 hours ago"
              />
              <ActivityItem 
                icon={Gift}
                iconColor="text-purple-500"
                title="Reward redeemed"
                description="$50 Amazon Gift Card by Sarah Jones"
                time="Yesterday"
              />
              <ActivityItem 
                icon={Target}
                iconColor="text-green-500"
                title="Daily goals updated"
                description="Door target increased to 50"
                time="2 days ago"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

const MetricPill = ({ label, value }) => (
  <div className="rounded-lg border bg-slate-50 px-3 py-2">
    <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
  </div>
);


const ActivityItem = ({ icon: Icon, iconColor, title, description, time }) => (
  <div className="flex items-start gap-3 p-4">
    <div className={`p-2 rounded-full bg-slate-100 ${iconColor}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
  </div>
);


export default PerformanceConsole;
