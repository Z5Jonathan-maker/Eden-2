import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent } from '../../../shared/ui/card';
import {
  Plus,
  Loader2,
  RefreshCw,
  Gift,
  Edit2,
  Trash2,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { DEFAULT_REWARD, formatCurrency } from '../utils/incentiveHelpers';
import { RewardFormDialog } from './RewardFormDialog';

export const RewardsTab = () => {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(DEFAULT_REWARD);

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
        setFormData(DEFAULT_REWARD);
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
      icon: reward.icon || '\uD83C\uDF81',
      image_url: reward.image_url || '',
      stock_quantity: reward.stock_quantity,
      is_featured: reward.is_featured || false,
      is_active: reward.is_active !== false,
      categories: reward.categories || [],
    });
    setEditingReward(reward);
    setShowCreateDialog(true);
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
              setFormData(DEFAULT_REWARD);
              setEditingReward(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reward
          </Button>
        </div>
      </div>

      <RewardFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingReward(null);
            setFormData(DEFAULT_REWARD);
          }
          setShowCreateDialog(open);
        }}
        editingReward={editingReward}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        onSave={handleSave}
      />

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
                      reward.icon || '\uD83C\uDF81'
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
