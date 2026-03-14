import React, { useState } from 'react';
import { Brain, Activity, Eye, FileText, Calculator, Shield, Scale, TrendingUp, Newspaper, AlertTriangle, Info, AlertCircle, ChevronRight, Zap } from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT = 'orange-500';

const AGENTS = [
  {
    id: 'claim-monitor',
    name: 'ClaimMonitor',
    icon: Activity,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    status: 'Active',
    description: 'Monitors claim lifecycle for stalls, anomalies, and missed milestones.',
    lastAction: 'Flagged stalled claim #1847 — no update in 14 days',
    lastActionTime: '2 min ago',
    metric: '47 claims scanned',
  },
  {
    id: 'vision-analyzer',
    name: 'VisionAnalyzer',
    icon: Eye,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    status: 'Active',
    description: 'AI photo analysis for damage assessment and severity scoring.',
    lastAction: 'Analyzed 12 roof photos for claim #2041',
    lastActionTime: '5 min ago',
    metric: '218 photos analyzed',
  },
  {
    id: 'intake-parser',
    name: 'IntakeParser',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    status: 'Active',
    description: 'Parses intake documents and auto-populates claim fields.',
    lastAction: 'Parsed new intake form for claim #2053',
    lastActionTime: '8 min ago',
    metric: '31 documents parsed',
  },
  {
    id: 'estimate-engine',
    name: 'EstimateEngine',
    icon: Calculator,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    status: 'Ready',
    description: 'Generates preliminary damage estimates from photos and field notes.',
    lastAction: 'Generated estimate for claim #1998 — $14,200',
    lastActionTime: '12 min ago',
    metric: '89 estimates generated',
  },
  {
    id: 'compliance-watch',
    name: 'ComplianceWatch',
    icon: Shield,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    status: 'Active',
    description: 'FL statute monitoring, 90-day deadlines, and compliance alerts.',
    lastAction: 'Alerted: 3 claims approaching 90-day FL deadline',
    lastActionTime: '15 min ago',
    metric: '12 alerts triggered',
  },
  {
    id: 'negotiation-advisor',
    name: 'NegotiationAdvisor',
    icon: Scale,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    status: 'Standby',
    description: 'Carrier negotiation strategy based on historical settlement data.',
    lastAction: 'Prepared strategy brief for Heritage Insurance',
    lastActionTime: '1 hr ago',
    metric: '7 strategies drafted',
  },
  {
    id: 'settlement-predictor',
    name: 'SettlementPredictor',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    status: 'Active',
    description: 'ML-based settlement range prediction with confidence scores.',
    lastAction: 'Predicted $18,500–$24,200 for claim #1903',
    lastActionTime: '20 min ago',
    metric: '156 predictions made',
  },
  {
    id: 'legal-feed',
    name: 'LegalFeed',
    icon: Newspaper,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    status: 'Ready',
    description: 'Legal and regulatory updates relevant to FL property claims.',
    lastAction: 'New FL Senate Bill 2A amendment detected',
    lastActionTime: '45 min ago',
    metric: '23 updates tracked',
  },
];

const ACTIVITY_FEED = [
  { agent: 'ClaimMonitor', icon: Activity, text: 'Flagged stalled claim #1847 — no update in 14 days', time: '2 min ago', severity: 'warning' },
  { agent: 'ComplianceWatch', icon: Shield, text: '3 claims approaching 90-day FL statute deadline', time: '15 min ago', severity: 'critical' },
  { agent: 'VisionAnalyzer', icon: Eye, text: 'Completed roof damage analysis for claim #2041 — severe hail impact', time: '5 min ago', severity: 'info' },
  { agent: 'IntakeParser', icon: FileText, text: 'Auto-populated 18 fields from intake PDF for claim #2053', time: '8 min ago', severity: 'info' },
  { agent: 'SettlementPredictor', icon: TrendingUp, text: 'High-confidence prediction: claim #1903 likely settles $18.5K–$24.2K', time: '20 min ago', severity: 'info' },
  { agent: 'EstimateEngine', icon: Calculator, text: 'Generated preliminary estimate for claim #1998: $14,200', time: '12 min ago', severity: 'info' },
  { agent: 'LegalFeed', icon: Newspaper, text: 'FL Senate Bill 2A amendment may affect assignment of benefits claims', time: '45 min ago', severity: 'warning' },
  { agent: 'ComplianceWatch', icon: Shield, text: 'Claim #1776 carrier response overdue by 5 business days', time: '1 hr ago', severity: 'critical' },
  { agent: 'ClaimMonitor', icon: Activity, text: 'Claim #2010 moved to "Inspection Scheduled" — adjuster assigned', time: '1.5 hr ago', severity: 'info' },
  { agent: 'NegotiationAdvisor', icon: Scale, text: 'Heritage Insurance historical data: avg settlement 73% of estimate', time: '2 hr ago', severity: 'info' },
];

const INSIGHTS = [
  { title: '3 claims approaching 90-day FL deadline', description: 'Claims #1776, #1802, #1819 need immediate carrier follow-up to avoid statutory violations.', urgency: 'critical' },
  { title: 'Roof damage claims up 34% this month', description: 'Storm season surge detected. Consider pre-positioning inspection resources in Broward and Palm Beach counties.', urgency: 'warning' },
  { title: 'Heritage Insurance avg response time: 18 days', description: 'Significantly slower than industry avg of 11 days. Recommend escalation protocol for Heritage claims.', urgency: 'warning' },
  { title: 'Settlement prediction accuracy at 87%', description: 'Model confidence has improved 4% since last calibration. Top-performing agent this quarter.', urgency: 'info' },
  { title: 'New FL regulation effective April 1', description: 'Updated adjuster licensing requirements. 2 team members need CE credits before deadline.', urgency: 'warning' },
];

const KPI_CARDS = [
  { label: 'Total Agents Active', value: '8', icon: Zap, pulse: true, accentColor: 'text-green-400' },
  { label: 'Claims Monitored', value: '47', icon: Activity, pulse: false, accentColor: `text-${ACCENT}` },
  { label: 'Insights Generated', value: '156', icon: Brain, pulse: false, accentColor: 'text-blue-400' },
  { label: 'Alerts Pending', value: '3', icon: AlertTriangle, pulse: false, accentColor: 'text-red-400' },
];

// ─── Sub-Components ──────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const config = {
    Active: 'bg-green-500/15 text-green-400 border-green-500/30',
    Ready: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Standby: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${config[status] || config.Standby}`}>
      {status === 'Active' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
        </span>
      )}
      {status}
    </span>
  );
};

const SeverityBadge = ({ severity }) => {
  const config = {
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider border ${config[severity] || config.info}`}>
      {severity}
    </span>
  );
};

const KpiCard = ({ label, value, icon: Icon, pulse, accentColor }) => (
  <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all duration-300 group">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accentColor === 'text-green-400' ? 'bg-green-500/10' : accentColor === 'text-blue-400' ? 'bg-blue-500/10' : accentColor === 'text-red-400' ? 'bg-red-500/10' : 'bg-orange-500/10'}`}>
        <Icon className={`w-5 h-5 ${accentColor}`} />
      </div>
      {pulse && (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-white font-mono tracking-tight">{value}</p>
    <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-mono">{label}</p>
  </div>
);

const AgentCard = ({ agent }) => {
  const Icon = agent.icon;

  return (
    <div className="bg-[#1a1a1a] border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${agent.bgColor}`}>
            <Icon className={`w-4.5 h-4.5 ${agent.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white font-mono">{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-3">{agent.description}</p>
      <div className="border-t border-white/5 pt-3 space-y-1.5">
        <p className="text-[11px] text-zinc-500 leading-snug">
          <span className="text-zinc-600">Last:</span>{' '}
          <span className="text-zinc-400">{agent.lastAction}</span>
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-600 font-mono">{agent.lastActionTime}</span>
          <span className="text-[10px] text-orange-400/80 font-mono">{agent.metric}</span>
        </div>
      </div>
    </div>
  );
};

const ActivityItem = ({ item }) => {
  const Icon = item.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors">
      <div className="w-7 h-7 rounded-md bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono font-semibold text-zinc-300">{item.agent}</span>
          <SeverityBadge severity={item.severity} />
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">{item.text}</p>
        <p className="text-[10px] text-zinc-600 font-mono mt-1">{item.time}</p>
      </div>
    </div>
  );
};

const InsightCard = ({ insight }) => {
  const urgencyConfig = {
    critical: { border: 'border-red-500/30 hover:border-red-500/50', badge: 'bg-red-500/15 text-red-400', icon: AlertCircle },
    warning: { border: 'border-yellow-500/20 hover:border-yellow-500/40', badge: 'bg-yellow-500/15 text-yellow-400', icon: AlertTriangle },
    info: { border: 'border-blue-500/20 hover:border-blue-500/40', badge: 'bg-blue-500/15 text-blue-400', icon: Info },
  };

  const config = urgencyConfig[insight.urgency] || urgencyConfig.info;
  const UrgencyIcon = config.icon;

  return (
    <div className={`bg-[#1a1a1a] border ${config.border} rounded-xl p-4 transition-all duration-300`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.badge}`}>
          <UrgencyIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-1">{insight.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed mb-3">{insight.description}</p>
          <button className="text-xs font-mono text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1 group">
            Review
            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ClaimPilotPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Brain className="w-6 h-6 text-orange-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white font-mono tracking-wider">CLAIMPILOT</h1>
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">AI Agent Mesh &mdash; Autonomous Claims Intelligence</p>
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-mono text-green-400 uppercase tracking-wider">All Systems Operational</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Main Content: Agent Grid + Activity Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Agent Grid — 2 cols */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            Agent Fleet
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AGENTS.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>

        {/* Activity Feed — 1 col */}
        <div className="space-y-4">
          <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-orange-500" />
            Live Activity Feed
          </h2>
          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1 scrollbar-hide">
            {ACTIVITY_FEED.map((item, idx) => (
              <ActivityItem key={idx} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Panel */}
      <div className="space-y-4">
        <h2 className="text-sm font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Brain className="w-4 h-4 text-orange-500" />
          Latest AI Insights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {INSIGHTS.map((insight, idx) => (
            <InsightCard key={idx} insight={insight} />
          ))}
        </div>
      </div>
    </div>
  );
}
