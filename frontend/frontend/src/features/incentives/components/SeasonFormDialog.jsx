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
import {
  Loader2,
  Crown,
  Save,
  DollarSign,
} from 'lucide-react';
import { formatCurrency } from '../utils/incentiveHelpers';

export const SeasonFormDialog = ({
  open,
  onOpenChange,
  editingSeason,
  formData,
  setFormData,
  saving,
  onSave,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                placeholder="\uD83C\uDFC6"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
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
  );
};
