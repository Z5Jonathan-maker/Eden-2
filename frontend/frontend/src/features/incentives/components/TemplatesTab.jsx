import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent } from '../../../shared/ui/card';
import {
  Plus,
  Loader2,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  DEFAULT_TEMPLATE,
  DEFAULT_COMP_FORM_DATA,
  createDefaultRule,
} from '../utils/incentiveHelpers';
import { TemplateFormDialog } from './TemplateFormDialog';
import { TemplateCard } from './TemplateCard';
import { UseTemplateDialog } from './UseTemplateDialog';

export const TemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [badges, setBadges] = useState([]);
  const [saving, setSaving] = useState(false);

  const [showUseDialog, setShowUseDialog] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [creatingComp, setCreatingComp] = useState(false);

  const [compFormData, setCompFormData] = useState(DEFAULT_COMP_FORM_DATA);
  const [formData, setFormData] = useState(DEFAULT_TEMPLATE);

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
    const now = new Date();
    const startDate = new Date(now.getTime() + 60 * 60 * 1000);
    const endDate = new Date(
      startDate.getTime() + (template.default_duration_days || 7) * 24 * 60 * 60 * 1000
    );

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
        setCompFormData(DEFAULT_COMP_FORM_DATA);
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
        setFormData(DEFAULT_TEMPLATE);
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
      icon: template.icon || '\uD83C\uDFAF',
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
    setFormData({ ...formData, default_rules: [...formData.default_rules, createDefaultRule(type)] });
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
              setFormData(DEFAULT_TEMPLATE);
              setEditingTemplate(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      <TemplateFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTemplate(null);
            setFormData(DEFAULT_TEMPLATE);
          }
          setShowCreateDialog(open);
        }}
        editingTemplate={editingTemplate}
        formData={formData}
        setFormData={setFormData}
        metrics={metrics}
        rewards={rewards}
        saving={saving}
        onSave={handleSave}
        onAddRule={addRule}
        onUpdateRule={updateRule}
        onRemoveRule={removeRule}
      />

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
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              onUse={openUseTemplateDialog}
            />
          ))}
        </div>
      )}

      <UseTemplateDialog
        open={showUseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setUsingTemplate(null);
            setCompFormData(DEFAULT_COMP_FORM_DATA);
          }
          setShowUseDialog(open);
        }}
        usingTemplate={usingTemplate}
        compFormData={compFormData}
        setCompFormData={setCompFormData}
        seasons={seasons}
        creatingComp={creatingComp}
        onCreateFromTemplate={handleCreateFromTemplate}
      />
    </div>
  );
};
