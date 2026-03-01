import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent } from '../../../shared/ui/card';
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
  Plus,
  Loader2,
  RefreshCw,
  Shield,
  Edit2,
  Trash2,
  Save,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { DEFAULT_BADGE, TIER_CONFIG } from '../utils/incentiveHelpers';

export const BadgesTab = () => {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBadge, setEditingBadge] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(DEFAULT_BADGE);

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
        setFormData(DEFAULT_BADGE);
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
      icon: badge.icon || '\uD83C\uDFC6',
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
              setFormData(DEFAULT_BADGE);
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
            setFormData(DEFAULT_BADGE);
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
                className={`w-20 h-20 rounded-full ${TIER_CONFIG[formData.tier]?.color} flex items-center justify-center text-4xl shadow-lg ring-4 ${TIER_CONFIG[formData.tier]?.ring}`}
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
                    <SelectItem value="legendary">{'\uD83C\uDF1F'} Legendary</SelectItem>
                    <SelectItem value="epic">{'\uD83D\uDC8E'} Epic</SelectItem>
                    <SelectItem value="rare">{'\uD83D\uDCA0'} Rare</SelectItem>
                    <SelectItem value="common">{'\u2B50'} Common</SelectItem>
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
                  placeholder="\uD83C\uDFC6"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <Card
              key={badge.id}
              className={`hover:border-amber-200 transition-all ${!badge.is_active ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`w-16 h-16 rounded-full ${TIER_CONFIG[badge.tier]?.color || TIER_CONFIG.common.color} flex items-center justify-center text-3xl shadow-md ring-2 ${TIER_CONFIG[badge.tier]?.ring || TIER_CONFIG.common.ring} mb-3`}
                  >
                    {badge.image_url ? (
                      <img
                        src={badge.image_url}
                        alt={badge.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      badge.icon || '\uD83C\uDFC6'
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
