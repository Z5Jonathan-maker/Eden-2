import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Textarea } from '../../../shared/ui/textarea';
import { Switch } from '../../../shared/ui/switch';
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
  Star,
  DollarSign,
  Hash,
} from 'lucide-react';
import { REWARD_TYPES, formatCurrency } from '../utils/incentiveHelpers';

export const RewardFormDialog = ({
  open,
  onOpenChange,
  editingReward,
  formData,
  setFormData,
  saving,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {REWARD_TYPES.map((t) => (
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
                placeholder="\uD83C\uDF81"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
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
  );
};
