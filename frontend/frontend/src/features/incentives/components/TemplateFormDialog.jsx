import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent } from '../../../shared/ui/card';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Textarea } from '../../../shared/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import {
  Loader2,
  Save,
  AlertCircle,
} from 'lucide-react';
import {
  CATEGORIES,
  RULE_TYPES,
} from '../utils/incentiveHelpers';
import { RuleEditor } from './RuleEditor';

export const TemplateFormDialog = ({
  open,
  onOpenChange,
  editingTemplate,
  formData,
  setFormData,
  metrics,
  rewards,
  saving,
  onSave,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  placeholder="\uD83C\uDFAF"
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
                    {CATEGORIES.map((c) => (
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
                    <SelectItem value="individual">{'\uD83D\uDC64'} Individual</SelectItem>
                    <SelectItem value="team">{'\uD83D\uDC65'} Team</SelectItem>
                    <SelectItem value="company">{'\uD83C\uDFE2'} Company</SelectItem>
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
                {RULE_TYPES.map((rt) => {
                  const IconComp = rt.iconComponent;
                  return (
                    <Button
                      key={rt.value}
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => onAddRule(rt.value)}
                      title={rt.description}
                    >
                      <IconComp className="w-4 h-4" />
                      <span className="ml-1 hidden sm:inline">{rt.label}</span>
                    </Button>
                  );
                })}
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
                  <RuleEditor
                    key={idx}
                    rule={rule}
                    index={idx}
                    rewards={rewards}
                    onUpdate={onUpdateRule}
                    onRemove={onRemoveRule}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
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
  );
};
