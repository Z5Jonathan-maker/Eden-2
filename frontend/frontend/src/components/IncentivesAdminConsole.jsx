/**
 * IncentivesAdminConsole - Admin UI for Managing the Enzy-Style Incentives Engine
 *
 * Features:
 * - Competitions management (create, view, start, end)
 * - Templates library (view, use templates, edit rules)
 * - Seasons management
 * - Metrics overview
 * - Badges management (CRUD with artwork)
 * - Rewards catalog (CRUD with artwork)
 * - Fully configurable - NO HARD-CODED values
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../shared/ui/card';
import { Progress } from '../shared/ui/progress';
import { Input } from '../shared/ui/input';
import { Label } from '../shared/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shared/ui/tabs';
import { Textarea } from '../shared/ui/textarea';
import { Switch } from '../shared/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/select';
import {
  Trophy,
  Target,
  Calendar,
  Users,
  Play,
  Pause,
  StopCircle,
  Plus,
  Loader2,
  RefreshCw,
  ChevronRight,
  Clock,
  Award,
  Zap,
  Crown,
  Star,
  Medal,
  TrendingUp,
  BarChart3,
  Gift,
  Settings,
  Copy,
  Eye,
  Edit2,
  Shield,
  Image,
  Trash2,
  Save,
  Upload,
  DollarSign,
  Hash,
  Percent,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { NAV_ICONS } from '../assets/badges';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

// ============================================
// COMPETITIONS TAB
// ============================================

const CompetitionsTab = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [newCompName, setNewCompName] = useState('');
  const [newCompStartDate, setNewCompStartDate] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/competitions?include_past=true');
      if (!res.ok) {
        console.error('Failed to fetch competitions: Status', res.ok);
        setLoading(false);
        return;
      }
      setCompetitions(res.data.competitions || []);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
    }
    setLoading(false);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/templates');
      if (!res.ok) {
        console.error('Failed to fetch templates: Status', res.ok);
        return;
      }
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newCompName || !newCompStartDate) return;

    setCreating(true);
    try {
      const res = await apiPost('/api/incentives/competitions/from-template', {
        template_id: selectedTemplate,
        name: newCompName,
        start_date: new Date(newCompStartDate).toISOString(),
      });

      if (res.ok) {
        setShowCreateDialog(false);
        setSelectedTemplate(null);
        setNewCompName('');
        setNewCompStartDate('');
        fetchCompetitions();
      }
    } catch (err) {
      console.error('Failed to create competition:', err);
    }
    setCreating(false);
  };

  const handleStartCompetition = async (compId) => {
    try {
      await apiPost(`/api/incentives/competitions/${compId}/start`, {});
      fetchCompetitions();
    } catch (err) {
      console.error('Failed to start competition:', err);
    }
  };

  const handleEndCompetition = async (compId) => {
    if (
      !window.confirm('Are you sure you want to end this competition? Results will be calculated.')
    )
      return;

    try {
      await apiPost(`/api/incentives/competitions/${compId}/end`, {});
      fetchCompetitions();
    } catch (err) {
      console.error('Failed to end competition:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'scheduled':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-gray-500';
      case 'draft':
        return 'bg-yellow-500';
      case 'paused':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      draft: 'bg-yellow-100 text-yellow-800',
      paused: 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Competitions</h2>
          <p className="text-sm text-muted-foreground">
            {competitions.filter((c) => c.status === 'active').length} active, {competitions.length}{' '}
            total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCompetitions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                New Competition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Competition</DialogTitle>
                <DialogDescription>
                  Select a template and customize your competition
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="mr-2">{t.icon}</span>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      {templates.find((t) => t.id === selectedTemplate)?.tagline}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Competition Name</Label>
                  <Input
                    placeholder="e.g., February Weekend Blitz"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={newCompStartDate}
                    onChange={(e) => setNewCompStartDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFromTemplate}
                  disabled={!selectedTemplate || !newCompName || !newCompStartDate || creating}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Competition Cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : competitions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Trophy className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No competitions yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Competition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id} className="hover:border-orange-200 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${comp.banner_color}20` }}
                    >
                      {comp.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{comp.name}</h3>
                        <Badge className={getStatusBadge(comp.status)}>{comp.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {comp.tagline || comp.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {comp.participant_count} participants
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {comp.time_remaining}
                        </span>
                        {comp.leader && comp.leader.value > 0 && (
                          <span className="flex items-center gap-1">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            {comp.leader.name}: {comp.leader.value}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {comp.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartCompetition(comp.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </Button>
                    )}
                    {comp.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndCompetition(comp.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <StopCircle className="w-4 h-4 mr-1" />
                        End
                      </Button>
                    )}
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// TEMPLATES TAB - With Rules Builder
// ============================================

const TemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [badges, setBadges] = useState([]);
  const [saving, setSaving] = useState(false);

  // Use Template state
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [creatingComp, setCreatingComp] = useState(false);

  const defaultCompFormData = {
    name: '',
    start_date: '',
    end_date: '',
    season_id: null,
    auto_start: true,
  };
  const [compFormData, setCompFormData] = useState(defaultCompFormData);

  const defaultTemplate = {
    name: '',
    description: '',
    tagline: '',
    icon: '🎯',
    banner_color: '#F97316',
    category: 'threshold',
    default_metric_id: '',
    default_duration_type: 'week',
    default_duration_days: 7,
    default_scope: 'individual',
    default_rules: [],
  };

  const [formData, setFormData] = useState(defaultTemplate);

  const categories = [
    {
      value: 'sprint',
      label: 'Sprint',
      icon: '⚡',
      description: 'Short-term competition for quick results',
    },
    {
      value: 'ladder',
      label: 'Ladder',
      icon: '📈',
      description: 'Ranking-based competition over time',
    },
    { value: 'threshold', label: 'Threshold', icon: '🎯', description: 'Hit a target to win' },
    {
      value: 'team_battle',
      label: 'Team Battle',
      icon: '⚔️',
      description: 'Teams compete against each other',
    },
    {
      value: 'milestone',
      label: 'Milestone',
      icon: '🏅',
      description: 'Progress through multiple tiers',
    },
    { value: 'lottery', label: 'Lottery', icon: '🎰', description: 'Random draw among qualifiers' },
  ];

  const ruleTypes = [
    {
      value: 'threshold',
      label: 'Threshold',
      description: 'Hit X to qualify',
      icon: <Target className="w-4 h-4" />,
    },
    {
      value: 'top_n',
      label: 'Top N',
      description: 'Top performers win',
      icon: <Crown className="w-4 h-4" />,
    },
    {
      value: 'milestone',
      label: 'Milestone',
      description: 'Multiple achievement tiers',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      value: 'improvement',
      label: 'Improvement',
      description: 'Beat your baseline',
      icon: <Percent className="w-4 h-4" />,
    },
    {
      value: 'lottery',
      label: 'Lottery',
      description: 'Random draw from qualifiers',
      icon: <Gift className="w-4 h-4" />,
    },
  ];

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/templates');
      if (res.ok) {
        setTemplates(res.data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
    setLoading(false);
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/metrics');
      if (res.ok) {
        setMetrics(res.data.metrics || []);
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  }, []);

  const fetchRewards = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/rewards?active_only=true');
      if (res.ok) {
        setRewards(res.data.rewards || []);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    }
  }, []);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/badges/definitions');
      if (res.ok) {
        setBadges(res.data.badges || []);
      }
    } catch (err) {
      console.error('Failed to fetch badges:', err);
    }
  }, []);

  const fetchSeasons = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/seasons');
      if (res.ok) {
        setSeasons(res.data.seasons || []);
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchMetrics();
    fetchRewards();
    fetchBadges();
    fetchSeasons();
  }, [fetchTemplates, fetchMetrics, fetchRewards, fetchBadges, fetchSeasons]);

  const openUseTemplateDialog = (template) => {
    // Calculate default dates based on template duration
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const endDate = new Date(
      startDate.getTime() + (template.default_duration_days || 7) * 24 * 60 * 60 * 1000
    );

    // Format for datetime-local input
    const formatDate = (d) => {
      return d.toISOString().slice(0, 16);
    };

    setUsingTemplate(template);
    setCompFormData({
      name: `${new Date().toLocaleDateString('en-US', { month: 'long' })} ${template.name}`,
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      season_id: null,
      auto_start: true,
    });
    setShowUseDialog(true);
  };

  const handleCreateFromTemplate = async () => {
    if (
      !usingTemplate ||
      !compFormData.name ||
      !compFormData.start_date ||
      !compFormData.end_date
    ) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCreatingComp(true);
    try {
      const payload = {
        template_id: usingTemplate.id,
        name: compFormData.name,
        start_date: new Date(compFormData.start_date).toISOString(),
        end_date: new Date(compFormData.end_date).toISOString(),
        season_id: compFormData.season_id,
        auto_start: compFormData.auto_start,
      };

      const res = await apiPost('/api/incentives/competitions/from-template', payload);

      if (res.ok) {
        toast.success(`Competition "${compFormData.name}" created successfully!`);
        setShowUseDialog(false);
        setUsingTemplate(null);
        setCompFormData(defaultCompFormData);

        // Increment template usage count
        fetchTemplates();
      } else {
        toast.error(res.error || 'Failed to create competition');
      }
    } catch (err) {
      toast.error('Error creating competition');
    }
    setCreatingComp(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.default_metric_id) {
      toast.error('Name and metric are required');
      return;
    }

    setSaving(true);
    try {
      const res = editingTemplate
        ? await apiPut(`/api/incentives/templates/${editingTemplate.id}`, formData)
        : await apiPost('/api/incentives/templates', formData);

      if (res.ok) {
        toast.success(editingTemplate ? 'Template updated' : 'Template created');
        setShowCreateDialog(false);
        setEditingTemplate(null);
        setFormData(defaultTemplate);
        fetchTemplates();
      } else {
        toast.error('Failed to save template');
      }
    } catch (err) {
      toast.error('Error saving template');
    }
    setSaving(false);
  };

  const handleDelete = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await apiDelete(`/api/incentives/templates/${templateId}`);

      if (res.ok) {
        toast.success('Template deleted');
        fetchTemplates();
      }
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const openEditDialog = (template) => {
    setFormData({
      name: template.name || '',
      description: template.description || '',
      tagline: template.tagline || '',
      icon: template.icon || '🎯',
      banner_color: template.banner_color || '#F97316',
      category: template.category || 'threshold',
      default_metric_id: template.default_metric_id || '',
      default_duration_type: template.default_duration_type || 'week',
      default_duration_days: template.default_duration_days || 7,
      default_scope: template.default_scope || 'individual',
      default_rules: template.default_rules || [],
    });
    setEditingTemplate(template);
    setShowCreateDialog(true);
  };

  const addRule = (type) => {
    const newRule = {
      type,
      config:
        type === 'threshold'
          ? { threshold_value: 75 }
          : type === 'top_n'
            ? { top_n: 3 }
            : type === 'milestone'
              ? {
                  milestones: [
                    { tier: 'bronze', value: 25 },
                    { tier: 'silver', value: 50 },
                    { tier: 'gold', value: 100 },
                  ],
                }
              : type === 'improvement'
                ? { improvement_percent: 10, baseline_period: 'last_week' }
                : type === 'lottery'
                  ? { lottery_qualifier_threshold: 50, lottery_winner_count: 3 }
                  : {},
      reward_config: { points_award: 100 },
    };
    setFormData({ ...formData, default_rules: [...formData.default_rules, newRule] });
  };

  const updateRule = (index, updates) => {
    const newRules = [...formData.default_rules];
    newRules[index] = { ...newRules[index], ...updates };
    setFormData({ ...formData, default_rules: newRules });
  };

  const removeRule = (index) => {
    setFormData({
      ...formData,
      default_rules: formData.default_rules.filter((_, i) => i !== index),
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      sprint: 'bg-green-100 text-green-800',
      ladder: 'bg-purple-100 text-purple-800',
      threshold: 'bg-orange-100 text-orange-800',
      team_battle: 'bg-red-100 text-red-800',
      milestone: 'bg-blue-100 text-blue-800',
      lottery: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      sprint: <Zap className="w-4 h-4" />,
      ladder: <TrendingUp className="w-4 h-4" />,
      threshold: <Target className="w-4 h-4" />,
      team_battle: <Users className="w-4 h-4" />,
      milestone: <Star className="w-4 h-4" />,
      lottery: <Gift className="w-4 h-4" />,
    };
    return icons[category] || <Trophy className="w-4 h-4" />;
  };

  // Rule Editor Component
  const RuleEditor = ({ rule, index }) => {
    const ruleType = ruleTypes.find((r) => r.value === rule.type);

    return (
      <Card className="border-dashed bg-slate-50">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              {ruleType?.icon}
              <span className="font-medium capitalize">{rule.type.replace('_', ' ')} Rule</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500"
              onClick={() => removeRule(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Rule-specific configuration */}
          {rule.type === 'threshold' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="w-32">Target Value:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={rule.config.threshold_value || 0}
                  onChange={(e) =>
                    updateRule(index, {
                      config: { ...rule.config, threshold_value: parseInt(e.target.value) || 0 },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">to qualify</span>
              </div>
            </div>
          )}

          {rule.type === 'top_n' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="w-32">Top Positions:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={rule.config.top_n || 3}
                  onChange={(e) =>
                    updateRule(index, {
                      config: { ...rule.config, top_n: parseInt(e.target.value) || 1 },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">winners</span>
              </div>
            </div>
          )}

          {rule.type === 'milestone' && (
            <div className="space-y-3">
              <Label>Milestone Tiers:</Label>
              <div className="grid grid-cols-3 gap-2">
                {['bronze', 'silver', 'gold'].map((tier, tierIdx) => {
                  const milestone = rule.config.milestones?.find((m) => m.tier === tier) || {
                    tier,
                    value: 0,
                  };
                  return (
                    <div key={tier} className="flex items-center gap-1">
                      <span
                        className={`text-sm capitalize ${tier === 'gold' ? 'text-yellow-600' : tier === 'silver' ? 'text-gray-500' : 'text-orange-700'}`}
                      >
                        {tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉'}
                      </span>
                      <Input
                        type="number"
                        className="w-16 h-8 text-sm"
                        value={milestone.value}
                        onChange={(e) => {
                          const newMilestones = [...(rule.config.milestones || [])];
                          const existingIdx = newMilestones.findIndex((m) => m.tier === tier);
                          if (existingIdx >= 0) {
                            newMilestones[existingIdx].value = parseInt(e.target.value) || 0;
                          } else {
                            newMilestones.push({ tier, value: parseInt(e.target.value) || 0 });
                          }
                          updateRule(index, {
                            config: { ...rule.config, milestones: newMilestones },
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rule.type === 'improvement' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="w-32">Improvement %:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={rule.config.improvement_percent || 10}
                  onChange={(e) =>
                    updateRule(index, {
                      config: {
                        ...rule.config,
                        improvement_percent: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">vs baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-32">Baseline:</Label>
                <Select
                  value={rule.config.baseline_period || 'last_week'}
                  onValueChange={(v) =>
                    updateRule(index, { config: { ...rule.config, baseline_period: v } })
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_week">Last Week</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="last_quarter">Last Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {rule.type === 'lottery' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="w-32">Qualify at:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={rule.config.lottery_qualifier_threshold || 0}
                  onChange={(e) =>
                    updateRule(index, {
                      config: {
                        ...rule.config,
                        lottery_qualifier_threshold: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">to enter lottery</span>
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-32">Winners:</Label>
                <Input
                  type="number"
                  className="w-24"
                  value={rule.config.lottery_winner_count || 1}
                  onChange={(e) =>
                    updateRule(index, {
                      config: {
                        ...rule.config,
                        lottery_winner_count: parseInt(e.target.value) || 1,
                      },
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">drawn randomly</span>
              </div>
            </div>
          )}

          {/* Reward configuration */}
          <div className="border-t mt-3 pt-3">
            <Label className="text-xs text-muted-foreground uppercase mb-2 block">Reward</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500" />
                <Input
                  type="number"
                  className="w-20 h-8 text-sm"
                  placeholder="Points"
                  value={rule.reward_config?.points_award || 0}
                  onChange={(e) =>
                    updateRule(index, {
                      reward_config: {
                        ...rule.reward_config,
                        points_award: parseInt(e.target.value) || 0,
                      },
                    })
                  }
                />
                <span className="text-xs">pts</span>
              </div>
              <Select
                value={rule.reward_config?.reward_id || 'none'}
                onValueChange={(v) =>
                  updateRule(index, {
                    reward_config: { ...rule.reward_config, reward_id: v === 'none' ? null : v },
                  })
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="+ Reward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No physical reward</SelectItem>
                  {rewards.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.icon} {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Competition Templates</h2>
          <p className="text-sm text-muted-foreground">
            Pre-configured blueprints with customizable rules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTemplates}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              setFormData(defaultTemplate);
              setEditingTemplate(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplate(null);
            setFormData(defaultTemplate);
          }
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              Configure competition blueprint with rules and rewards
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name *</Label>
                  <Input
                    placeholder="e.g., Weekend Blitz"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="template-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input
                    placeholder="e.g., 75 doors = $50 guaranteed"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    data-testid="template-tagline-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe what this competition is about..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  data-testid="template-description-input"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Input
                    placeholder="🎯"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    data-testid="template-icon-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Banner Color</Label>
                  <Input
                    type="color"
                    value={formData.banner_color}
                    onChange={(e) => setFormData({ ...formData, banner_color: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="template-category-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.icon} {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Competition Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">
                Competition Settings
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Metric *</Label>
                  <Select
                    value={formData.default_metric_id}
                    onValueChange={(v) => setFormData({ ...formData, default_metric_id: v })}
                  >
                    <SelectTrigger data-testid="template-metric-select">
                      <SelectValue placeholder="Select metric..." />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.icon} {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    value={formData.default_duration_days}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_duration_days: parseInt(e.target.value) || 7,
                      })
                    }
                    data-testid="template-duration-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select
                    value={formData.default_scope}
                    onValueChange={(v) => setFormData({ ...formData, default_scope: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">👤 Individual</SelectItem>
                      <SelectItem value="team">👥 Team</SelectItem>
                      <SelectItem value="company">🏢 Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Rules Builder */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">Rules</h3>
                <div className="flex gap-1">
                  {ruleTypes.map((rt) => (
                    <Button
                      key={rt.value}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => addRule(rt.value)}
                      title={rt.description}
                    >
                      {rt.icon}
                      <span className="ml-1 hidden sm:inline">{rt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {formData.default_rules.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-6">
                    <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-muted-foreground">No rules configured</p>
                    <p className="text-xs text-muted-foreground">Click a rule type above to add</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {formData.default_rules.map((rule, idx) => (
                    <RuleEditor key={idx} rule={rule} index={idx} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="template-save-button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingTemplate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Copy className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No templates configured yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="hover:border-orange-200 hover:shadow-md transition-all"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${template.banner_color}20` }}
                  >
                    {template.icon}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={getCategoryColor(template.category)}>
                      {getCategoryIcon(template.category)}
                      <span className="ml-1 capitalize">
                        {template.category?.replace('_', ' ')}
                      </span>
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
                <CardDescription>{template.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {template.description}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {template.default_duration_days} days
                  </span>
                  <span className="flex items-center gap-1">
                    <BarChart3 className="w-4 h-4" />
                    {template.default_scope}
                  </span>
                </div>
                {template.default_rules?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.default_rules.map((rule, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs capitalize">
                        {rule.type?.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Used {template.times_used || 0} times
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(template)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {!template.is_system && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => openUseTemplateDialog(template)}
                      data-testid={`use-template-${template.id}`}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Launch
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Use Template Dialog - Create Competition from Template */}
      <Dialog
        open={showUseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setUsingTemplate(null);
            setCompFormData(defaultCompFormData);
          }
          setShowUseDialog(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-orange-500" />
              Launch Competition
            </DialogTitle>
            <DialogDescription>
              Create a new competition from "{usingTemplate?.name}" template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Template Preview */}
            {usingTemplate && (
              <div
                className="p-4 rounded-lg flex items-center gap-3"
                style={{ backgroundColor: `${usingTemplate.banner_color}15` }}
              >
                <span className="text-3xl">{usingTemplate.icon}</span>
                <div>
                  <p className="font-semibold">{usingTemplate.name}</p>
                  <p className="text-sm text-muted-foreground">{usingTemplate.tagline}</p>
                  <div className="flex gap-1 mt-1">
                    {usingTemplate.default_rules?.map((rule, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs capitalize">
                        {rule.type?.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Competition Name *</Label>
              <Input
                placeholder={`e.g., ${new Date().toLocaleDateString('en-US', { month: 'long' })} ${usingTemplate?.name || 'Competition'}`}
                value={compFormData.name}
                onChange={(e) => setCompFormData({ ...compFormData, name: e.target.value })}
                data-testid="comp-name-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="datetime-local"
                  value={compFormData.start_date}
                  onChange={(e) => setCompFormData({ ...compFormData, start_date: e.target.value })}
                  data-testid="comp-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="datetime-local"
                  value={compFormData.end_date}
                  onChange={(e) => setCompFormData({ ...compFormData, end_date: e.target.value })}
                  data-testid="comp-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Season (optional)</Label>
              <Select
                value={compFormData.season_id || 'none'}
                onValueChange={(v) =>
                  setCompFormData({ ...compFormData, season_id: v === 'none' ? null : v })
                }
              >
                <SelectTrigger data-testid="comp-season-select">
                  <SelectValue placeholder="No season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No season</SelectItem>
                  {seasons
                    .filter((s) => s.status === 'active' || s.status === 'upcoming')
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.icon} {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <Label>Auto-start when date arrives</Label>
                <p className="text-xs text-muted-foreground">
                  Competition will activate automatically
                </p>
              </div>
              <Switch
                checked={compFormData.auto_start}
                onCheckedChange={(v) => setCompFormData({ ...compFormData, auto_start: v })}
                data-testid="comp-auto-start"
              />
            </div>

            {/* Rules Preview */}
            {usingTemplate?.default_rules?.length > 0 && (
              <div className="border-t pt-4">
                <Label className="text-xs text-muted-foreground uppercase mb-2 block">
                  Rules from Template
                </Label>
                <div className="space-y-2">
                  {usingTemplate.default_rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded"
                    >
                      <span className="capitalize font-medium">{rule.type?.replace('_', ' ')}</span>
                      <span className="text-muted-foreground">
                        {rule.type === 'threshold' &&
                          `${rule.config?.threshold_value || 0} to qualify`}
                        {rule.type === 'top_n' && `Top ${rule.config?.top_n || 3} win`}
                        {rule.type === 'milestone' &&
                          `${rule.config?.milestones?.length || 0} tiers`}
                        {rule.type === 'improvement' &&
                          `${rule.config?.improvement_percent || 0}% improvement`}
                        {rule.type === 'lottery' &&
                          `${rule.config?.lottery_winner_count || 1} winner(s)`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        <Star className="w-3 h-3 mr-1" />
                        {rule.reward_config?.points_award || 0} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUseDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={
                creatingComp ||
                !compFormData.name ||
                !compFormData.start_date ||
                !compFormData.end_date
              }
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="comp-create-button"
            >
              {creatingComp ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Launch Competition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================
// SEASONS TAB
// ============================================

const SeasonsTab = () => {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [saving, setSaving] = useState(false);

  const defaultSeason = {
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    theme_name: '',
    theme_color: '#6366F1',
    banner_image_url: '',
    icon: '🏆',
    grand_prize_description: '',
    grand_prize_value_cents: 0,
    is_active: true,
  };

  const [formData, setFormData] = useState(defaultSeason);

  const fetchSeasons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/seasons');
      if (res.ok) {
        setSeasons(res.data.seasons || []);
      }
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  const handleSave = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Name and dates are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      };

      const res = editingSeason
        ? await apiPut(`/api/incentives/seasons/${editingSeason.id}`, payload)
        : await apiPost('/api/incentives/seasons', payload);

      if (res.ok) {
        toast.success(editingSeason ? 'Season updated' : 'Season created');
        setShowCreateDialog(false);
        setEditingSeason(null);
        setFormData(defaultSeason);
        fetchSeasons();
      } else {
        toast.error('Failed to save season');
      }
    } catch (err) {
      toast.error('Error saving season');
    }
    setSaving(false);
  };

  const handleDelete = async (seasonId) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this season? All associated data will be preserved but unlinked.'
      )
    )
      return;

    try {
      const res = await apiDelete(`/api/incentives/seasons/${seasonId}`);

      if (res.ok) {
        toast.success('Season deleted');
        fetchSeasons();
      } else {
        toast.error('Failed to delete season');
      }
    } catch (err) {
      toast.error('Error deleting season');
    }
  };

  const openEditDialog = (season) => {
    setFormData({
      name: season.name || '',
      description: season.description || '',
      start_date: season.start_date ? season.start_date.split('T')[0] : '',
      end_date: season.end_date ? season.end_date.split('T')[0] : '',
      theme_name: season.theme_name || '',
      theme_color: season.theme_color || '#6366F1',
      banner_image_url: season.banner_image_url || '',
      icon: season.icon || '🏆',
      grand_prize_description: season.grand_prize_description || '',
      grand_prize_value_cents: season.grand_prize_value_cents || 0,
      is_active: season.is_active !== false,
    });
    setEditingSeason(season);
    setShowCreateDialog(true);
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      upcoming: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const calculateProgress = (season) => {
    const now = new Date();
    const start = new Date(season.start_date);
    const end = new Date(season.end_date);

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end - start;
    const elapsed = now - start;
    return Math.round((elapsed / total) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Seasons</h2>
          <p className="text-sm text-muted-foreground">
            Group competitions into quarterly campaigns with grand prizes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSeasons}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-purple-500 hover:bg-purple-600"
            onClick={() => {
              setFormData(defaultSeason);
              setEditingSeason(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Season
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSeason(null);
            setFormData(defaultSeason);
          }
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeason ? 'Edit Season' : 'Create Season'}</DialogTitle>
            <DialogDescription>Configure season details, theme, and grand prize</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Preview Banner */}
            <div
              className="h-24 rounded-lg flex items-center justify-center text-white relative overflow-hidden"
              style={{ backgroundColor: formData.theme_color }}
            >
              {formData.banner_image_url && (
                <img
                  src={formData.banner_image_url}
                  alt="Banner"
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10 text-center">
                <span className="text-3xl">{formData.icon}</span>
                <p className="font-bold">{formData.name || 'Season Name'}</p>
                <p className="text-sm text-white/80">{formData.theme_name || 'Theme'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Season Name *</Label>
                <Input
                  placeholder="e.g., Q1 2026 Winter Warriors"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="season-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Theme Name</Label>
                <Input
                  placeholder="e.g., Thunder & Lightning"
                  value={formData.theme_name}
                  onChange={(e) => setFormData({ ...formData, theme_name: e.target.value })}
                  data-testid="season-theme-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="e.g., Start the year strong with aggressive targets..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="season-description-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  data-testid="season-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  data-testid="season-end-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input
                  placeholder="🏆"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  data-testid="season-icon-input"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Theme Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={formData.theme_color}
                    onChange={(e) => setFormData({ ...formData, theme_color: e.target.value })}
                    className="h-10 w-16"
                  />
                  <div className="flex gap-1 flex-1">
                    {['#6366F1', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map(
                      (color) => (
                        <button
                          key={color}
                          className={`w-8 h-8 rounded-full border-2 ${formData.theme_color === color ? 'border-gray-800' : 'border-transparent'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData({ ...formData, theme_color: color })}
                          type="button"
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Banner Image URL (optional)</Label>
              <Input
                placeholder="https://example.com/banner.jpg"
                value={formData.banner_image_url}
                onChange={(e) => setFormData({ ...formData, banner_image_url: e.target.value })}
                data-testid="season-banner-input"
              />
              <p className="text-xs text-muted-foreground">
                Recommended: 1200x400px landscape image
              </p>
            </div>

            {/* Grand Prize Section */}
            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                Grand Prize (Season Winner)
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prize Description</Label>
                  <Input
                    placeholder="e.g., $1,000 bonus + trip"
                    value={formData.grand_prize_description}
                    onChange={(e) =>
                      setFormData({ ...formData, grand_prize_description: e.target.value })
                    }
                    data-testid="season-prize-description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Prize Value (cents)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      className="pl-8"
                      placeholder="100000"
                      value={formData.grand_prize_value_cents}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          grand_prize_value_cents: parseInt(e.target.value) || 0,
                        })
                      }
                      data-testid="season-prize-value"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(formData.grand_prize_value_cents)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                data-testid="season-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.start_date || !formData.end_date}
              className="bg-purple-500 hover:bg-purple-600"
              data-testid="season-save-button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingSeason ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : seasons.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No seasons yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-purple-500 hover:bg-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Season
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {seasons.map((season) => (
            <Card
              key={season.id}
              className="hover:border-purple-200 transition-all overflow-hidden"
            >
              {/* Season Banner */}
              <div
                className="h-16 relative flex items-center px-4"
                style={{ backgroundColor: season.theme_color }}
              >
                {season.banner_image_url && (
                  <img
                    src={season.banner_image_url}
                    alt="Banner"
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                )}
                <div className="relative z-10 flex items-center gap-3 text-white">
                  <span className="text-2xl">{season.icon || '🏆'}</span>
                  <div>
                    <h3 className="font-bold">{season.name}</h3>
                    <p className="text-sm text-white/80">{season.theme_name}</p>
                  </div>
                </div>
                <Badge className={`absolute top-2 right-2 ${getStatusBadge(season.status)}`}>
                  {season.status}
                </Badge>
              </div>

              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{season.description}</p>

                    {/* Progress Bar */}
                    {season.status === 'active' && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{new Date(season.start_date).toLocaleDateString()}</span>
                          <span>{calculateProgress(season)}% complete</span>
                          <span>{new Date(season.end_date).toLocaleDateString()}</span>
                        </div>
                        <Progress value={calculateProgress(season)} className="h-2" />
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(season.start_date).toLocaleDateString()} -{' '}
                        {new Date(season.end_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4" />
                        {season.competition_count || 0} competitions
                      </span>
                      {season.grand_prize_value_cents > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <Crown className="w-4 h-4" />
                          Grand Prize: {formatCurrency(season.grand_prize_value_cents)}
                        </span>
                      )}
                    </div>

                    {/* Top Standings */}
                    {season.top_standings && season.top_standings.length > 0 && (
                      <div className="flex items-center gap-3 mt-3">
                        {season.top_standings.slice(0, 3).map((standing, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-sm">
                            <Medal
                              className={`w-4 h-4 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-orange-500'}`}
                            />
                            <span className="text-muted-foreground truncate max-w-[100px]">
                              {standing.user_name}
                            </span>
                            <span className="font-medium">{standing.total_points} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(season)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(season.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// METRICS TAB
// ============================================

const MetricsTab = () => {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/metrics');
      if (!res.ok) {
        console.error('Failed to fetch metrics: Status', res.ok);
        setLoading(false);
        return;
      }
      setMetrics(res.data.metrics || []);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Available Metrics</h2>
          <p className="text-sm text-muted-foreground">KPIs that can power competitions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <Card key={metric.id} className="hover:border-blue-200 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-xl">
                    {metric.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{metric.name}</h3>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {metric.aggregation}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {metric.unit}
                      </Badge>
                      {metric.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// BADGES TAB - Full CRUD with Artwork
// ============================================

const BadgesTab = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [saving, setSaving] = useState(false);

  const defaultBadge = {
    name: '',
    description: '',
    criteria: '',
    tier: 'common',
    icon: '🏆',
    image_url: '',
    points_value: 100,
    is_active: true,
  };

  const [formData, setFormData] = useState(defaultBadge);

  const tierConfig = {
    legendary: {
      color: 'bg-gradient-to-r from-yellow-400 to-amber-500',
      ring: 'ring-amber-400',
      label: 'Legendary',
    },
    epic: {
      color: 'bg-gradient-to-r from-purple-500 to-indigo-500',
      ring: 'ring-purple-400',
      label: 'Epic',
    },
    rare: {
      color: 'bg-gradient-to-r from-blue-400 to-cyan-500',
      ring: 'ring-blue-400',
      label: 'Rare',
    },
    common: {
      color: 'bg-gradient-to-r from-slate-400 to-slate-500',
      ring: 'ring-slate-300',
      label: 'Common',
    },
  };

  const fetchBadges = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/badges/definitions');
      if (res.ok) {
        setBadges(res.data.badges || []);
      }
    } catch (err) {
      console.error('Failed to fetch badges:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const handleSave = async () => {
    if (!formData.name || !formData.criteria) {
      toast.error('Name and criteria are required');
      return;
    }

    setSaving(true);
    try {
      const res = editingBadge
        ? await apiPut(`/api/incentives/badges/${editingBadge.id}`, formData)
        : await apiPost('/api/incentives/badges', formData);

      if (res.ok) {
        toast.success(editingBadge ? 'Badge updated' : 'Badge created');
        setShowCreateDialog(false);
        setEditingBadge(null);
        setFormData(defaultBadge);
        fetchBadges();
      } else {
        toast.error('Failed to save badge');
      }
    } catch (err) {
      toast.error('Error saving badge');
    }
    setSaving(false);
  };

  const handleDelete = async (badgeId) => {
    if (!window.confirm('Are you sure you want to delete this badge?')) return;

    try {
      const res = await apiDelete(`/api/incentives/badges/${badgeId}`);

      if (res.ok) {
        toast.success('Badge deleted');
        fetchBadges();
      }
    } catch (err) {
      toast.error('Failed to delete badge');
    }
  };

  const openEditDialog = (badge) => {
    setFormData({
      name: badge.name || '',
      description: badge.description || '',
      criteria: badge.criteria || '',
      tier: badge.tier || 'common',
      icon: badge.icon || '🏆',
      image_url: badge.image_url || '',
      points_value: badge.points_value || 100,
      is_active: badge.is_active !== false,
    });
    setEditingBadge(badge);
    setShowCreateDialog(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Badge Definitions</h2>
          <p className="text-sm text-muted-foreground">
            Configure achievement badges with custom artwork
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchBadges}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600"
            onClick={() => {
              setFormData(defaultBadge);
              setEditingBadge(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Badge
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingBadge(null);
            setFormData(defaultBadge);
          }
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBadge ? 'Edit Badge' : 'Create Badge'}</DialogTitle>
            <DialogDescription>Configure badge details and artwork</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Preview */}
            <div className="flex justify-center">
              <div
                className={`w-20 h-20 rounded-full ${tierConfig[formData.tier]?.color} flex items-center justify-center text-4xl shadow-lg ring-4 ${tierConfig[formData.tier]?.ring}`}
              >
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="Badge"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  formData.icon
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Badge Name *</Label>
                <Input
                  placeholder="e.g., First Harvest"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="badge-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(v) => setFormData({ ...formData, tier: v })}
                >
                  <SelectTrigger data-testid="badge-tier-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legendary">🌟 Legendary</SelectItem>
                    <SelectItem value="epic">💎 Epic</SelectItem>
                    <SelectItem value="rare">💠 Rare</SelectItem>
                    <SelectItem value="common">⭐ Common</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="e.g., Awarded for your first signed contract"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="badge-description-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Unlock Criteria *</Label>
              <Input
                placeholder="e.g., Sign your first contract"
                value={formData.criteria}
                onChange={(e) => setFormData({ ...formData, criteria: e.target.value })}
                data-testid="badge-criteria-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon (Emoji)</Label>
                <Input
                  placeholder="🏆"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  data-testid="badge-icon-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Points Value</Label>
                <Input
                  type="number"
                  placeholder="100"
                  value={formData.points_value}
                  onChange={(e) =>
                    setFormData({ ...formData, points_value: parseInt(e.target.value) || 0 })
                  }
                  data-testid="badge-points-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                placeholder="https://example.com/badge-image.png"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                data-testid="badge-image-input"
              />
              <p className="text-xs text-muted-foreground">Override emoji with custom artwork</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                data-testid="badge-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-500 hover:bg-amber-600"
              data-testid="badge-save-button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingBadge ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : badges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Shield className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No badges configured yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Badge
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={`hover:border-amber-200 transition-all ${!badge.is_active ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-full ${tierConfig[badge.tier]?.color || tierConfig.common.color} flex items-center justify-center text-3xl shadow-md ring-2 ${tierConfig[badge.tier]?.ring || tierConfig.common.ring} mb-3`}
                  >
                    {badge.image_url ? (
                      <img
                        src={badge.image_url}
                        alt={badge.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      badge.icon || '🏆'
                    )}
                  </div>
                  <h3 className="font-semibold">{badge.name}</h3>
                  <Badge variant="outline" className="mt-1 text-xs capitalize">
                    {badge.tier || 'common'}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {badge.criteria}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-sm">
                    <Star className="w-3 h-3 text-amber-500" />
                    <span className="font-medium">{badge.points_value || 0} pts</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="ghost" onClick={() => openEditDialog(badge)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(badge.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// REWARDS TAB - Full CRUD with Artwork
// ============================================

const RewardsTab = () => {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [saving, setSaving] = useState(false);

  const defaultReward = {
    name: '',
    description: '',
    type: 'gift_card',
    value_cents: 5000,
    points_required: 0,
    icon: '🎁',
    image_url: '',
    stock_quantity: null,
    is_featured: false,
    is_active: true,
    categories: [],
  };

  const [formData, setFormData] = useState(defaultReward);

  const rewardTypes = [
    { value: 'gift_card', label: 'Gift Card', icon: '🎁' },
    { value: 'merchandise', label: 'Merchandise', icon: '👕' },
    { value: 'experience', label: 'Experience', icon: '🎢' },
    { value: 'cash', label: 'Cash Bonus', icon: '💵' },
    { value: 'pto', label: 'PTO Hours', icon: '🏖️' },
    { value: 'points', label: 'Bonus Points', icon: '⭐' },
    { value: 'badge', label: 'Badge', icon: '🛡️' },
    { value: 'custom', label: 'Custom', icon: '🎯' },
  ];

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/rewards');
      if (res.ok) {
        setRewards(res.data.rewards || []);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const res = editingReward
        ? await apiPut(`/api/incentives/rewards/${editingReward.id}`, formData)
        : await apiPost('/api/incentives/rewards', formData);

      if (res.ok) {
        toast.success(editingReward ? 'Reward updated' : 'Reward created');
        setShowCreateDialog(false);
        setEditingReward(null);
        setFormData(defaultReward);
        fetchRewards();
      } else {
        toast.error('Failed to save reward');
      }
    } catch (err) {
      toast.error('Error saving reward');
    }
    setSaving(false);
  };

  const handleDelete = async (rewardId) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) return;

    try {
      const res = await apiDelete(`/api/incentives/rewards/${rewardId}`);

      if (res.ok) {
        toast.success('Reward deleted');
        fetchRewards();
      }
    } catch (err) {
      toast.error('Failed to delete reward');
    }
  };

  const openEditDialog = (reward) => {
    setFormData({
      name: reward.name || '',
      description: reward.description || '',
      type: reward.type || 'gift_card',
      value_cents: reward.value_cents || 0,
      points_required: reward.points_required || 0,
      icon: reward.icon || '🎁',
      image_url: reward.image_url || '',
      stock_quantity: reward.stock_quantity,
      is_featured: reward.is_featured || false,
      is_active: reward.is_active !== false,
      categories: reward.categories || [],
    });
    setEditingReward(reward);
    setShowCreateDialog(true);
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Rewards Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Configure prizes and rewards with custom artwork
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRewards}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            className="bg-green-500 hover:bg-green-600"
            onClick={() => {
              setFormData(defaultReward);
              setEditingReward(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reward
          </Button>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingReward(null);
            setFormData(defaultReward);
          }
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingReward ? 'Edit Reward' : 'Create Reward'}</DialogTitle>
            <DialogDescription>Configure reward details and value</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* Preview */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-4xl shadow-lg">
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="Reward"
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  formData.icon
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reward Name *</Label>
              <Input
                placeholder="e.g., $50 Amazon Gift Card"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="reward-name-input"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="e.g., Redeemable at Amazon.com"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="reward-description-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v })}
                >
                  <SelectTrigger data-testid="reward-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rewardTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Icon (Emoji)</Label>
                <Input
                  placeholder="🎁"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  data-testid="reward-icon-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Value (cents)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-8"
                    placeholder="5000"
                    value={formData.value_cents}
                    onChange={(e) =>
                      setFormData({ ...formData, value_cents: parseInt(e.target.value) || 0 })
                    }
                    data-testid="reward-value-input"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(formData.value_cents)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Points Required</Label>
                <div className="relative">
                  <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-8"
                    placeholder="0"
                    value={formData.points_required}
                    onChange={(e) =>
                      setFormData({ ...formData, points_required: parseInt(e.target.value) || 0 })
                    }
                    data-testid="reward-points-input"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stock Quantity (leave empty for unlimited)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-8"
                  placeholder="Unlimited"
                  value={formData.stock_quantity ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_quantity: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                  data-testid="reward-stock-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                placeholder="https://example.com/reward-image.png"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                data-testid="reward-image-input"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Featured</Label>
              <Switch
                checked={formData.is_featured}
                onCheckedChange={(v) => setFormData({ ...formData, is_featured: v })}
                data-testid="reward-featured-switch"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                data-testid="reward-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-500 hover:bg-green-600"
              data-testid="reward-save-button"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editingReward ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rewards Grid */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-green-500" />
        </div>
      ) : rewards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Gift className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No rewards configured yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-green-500 hover:bg-green-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Reward
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rewards.map((reward) => (
            <Card
              key={reward.id}
              className={`hover:border-green-200 transition-all ${!reward.is_active ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-2xl shadow-md flex-shrink-0">
                    {reward.image_url ? (
                      <img
                        src={reward.image_url}
                        alt={reward.name}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      reward.icon || '🎁'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold truncate">{reward.name}</h3>
                        {reward.is_featured && (
                          <Badge className="bg-amber-100 text-amber-800 text-xs mt-1">
                            <Star className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(reward)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleDelete(reward.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {reward.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(reward.value_cents || 0)}
                      </span>
                      {reward.stock_quantity !== null && (
                        <span className="text-xs text-muted-foreground">
                          {reward.stock_quantity} in stock
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs capitalize">
                      {reward.type?.replace('_', ' ') || 'gift_card'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const IncentivesAdminConsole = () => {
  const [activeTab, setActiveTab] = useState('competitions');

  return (
    <div className="min-h-screen page-enter" data-testid="incentives-admin-console">
      {/* Header */}
      <div className="bg-zinc-900/80 border-b border-zinc-800/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <img
              src={NAV_ICONS.incentives}
              alt="Incentives"
              className="w-12 h-12 object-contain icon-3d-shadow"
            />
            <div>
              <h1 className="text-2xl font-tactical font-bold text-white tracking-wide text-glow-orange">
                INCENTIVES ENGINE
              </h1>
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
                Competitions, rewards, badges & seasons
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger
              value="competitions"
              className="flex items-center gap-2"
              data-testid="tab-competitions"
            >
              <Trophy className="w-4 h-4" />
              Competitions
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="flex items-center gap-2"
              data-testid="tab-templates"
            >
              <Copy className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="seasons"
              className="flex items-center gap-2"
              data-testid="tab-seasons"
            >
              <Calendar className="w-4 h-4" />
              Seasons
            </TabsTrigger>
            <TabsTrigger
              value="badges"
              className="flex items-center gap-2"
              data-testid="tab-badges"
            >
              <Shield className="w-4 h-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger
              value="rewards"
              className="flex items-center gap-2"
              data-testid="tab-rewards"
            >
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger
              value="metrics"
              className="flex items-center gap-2"
              data-testid="tab-metrics"
            >
              <BarChart3 className="w-4 h-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="competitions">
            <CompetitionsTab />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="seasons">
            <SeasonsTab />
          </TabsContent>
          <TabsContent value="badges">
            <BadgesTab />
          </TabsContent>
          <TabsContent value="rewards">
            <RewardsTab />
          </TabsContent>
          <TabsContent value="metrics">
            <MetricsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IncentivesAdminConsole;
