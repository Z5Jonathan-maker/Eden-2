/**
 * HarvestAdminConsole - Admin interface for gamification management
 *
 * Based on HARVEST_GAMIFICATION_SPEC.md
 * Features:
 * - Campaign management (create, edit, end)
 * - Campaign templates library
 * - Rewards catalog (add, edit, archive)
 * - Redemption requests (approve/deny/fulfill)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Badge } from '../shared/ui/badge';
import { Button } from '../shared/ui/button';
import { Input } from '../shared/ui/input';
import { Progress } from '../shared/ui/progress';
import {
  RefreshCw,
  Trophy,
  Gift,
  Target,
  Zap,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Edit,
  Trash2,
  Users,
  TrendingUp,
  Calendar,
  Award,
  Package,
  History,
  Play,
  Pause,
  X,
  Check,
  AlertCircle,
  MapPin,
  Settings,
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL;

// Tab configuration
const ADMIN_TABS = [
  { id: 'campaigns', label: 'Campaigns', icon: Target },
  { id: 'templates', label: 'Templates', icon: Zap },
  { id: 'territories', label: 'Territories', icon: MapPin },
  { id: 'rewards', label: 'Rewards', icon: Gift },
  { id: 'redemptions', label: 'Redemptions', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
    scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Scheduled' },
    draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
    completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Completed' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    approved: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approved' },
    fulfilled: { bg: 'bg-green-100', text: 'text-green-700', label: 'Fulfilled' },
    denied: { bg: 'bg-red-100', text: 'text-red-700', label: 'Denied' },
  };

  const c = config[status] || config.draft;
  return <Badge className={`${c.bg} ${c.text} border-0`}>{c.label}</Badge>;
};

// ============================================
// CAMPAIGNS TAB
// ============================================
const CampaignsTab = ({ onRefresh }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await apiGet('/api/harvest/campaigns?include_past=true');
      if (res.ok) {
        setCampaigns(res.data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const endCampaign = async (campaignId) => {
    if (!window.confirm('Are you sure you want to end this campaign?')) return;

    try {
      const res = await apiPost(`/api/harvest/campaigns/${campaignId}/end`, {});
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to end campaign:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campaign Management</h3>
          <p className="text-sm text-gray-500">{campaigns.length} campaigns</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
                    {campaign.icon || '🎯'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{campaign.name}</h4>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(campaign.start_date).toLocaleDateString()} -{' '}
                        {new Date(campaign.end_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {campaign.participant_count || 0} participants
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {campaign.target_value} {campaign.goal_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {campaign.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => endCampaign(campaign.id)}>
                      <Pause className="w-4 h-4 mr-1" />
                      End
                    </Button>
                  )}
                  <Button size="sm" variant="ghost">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Progress */}
              {campaign.leader && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Leader: {campaign.leader.name}</span>
                    <span className="font-medium text-orange-600">
                      {campaign.leader.value} {campaign.goal_type}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {campaigns.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No Campaigns</h3>
              <p className="text-sm text-gray-500">
                Create your first campaign to motivate your team!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <CreateCampaignModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchCampaigns();
          }}
        />
      )}
    </div>
  );
};

// Create Campaign Modal
const CreateCampaignModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    goal_type: 'doors',
    target_value: 100,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    points_bonus: 100,
    icon: '🎯',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiPost('/api/harvest/campaigns', {
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Campaign</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Weekend Door Blitz"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Hit your target for bonus points!"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.goal_type}
                onChange={(e) => setFormData({ ...formData, goal_type: e.target.value })}
              >
                <option value="doors">Doors</option>
                <option value="appointments">Appointments</option>
                <option value="contracts">Contracts</option>
                <option value="points">Points</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
              <Input
                type="number"
                value={formData.target_value}
                onChange={(e) =>
                  setFormData({ ...formData, target_value: parseInt(e.target.value) })
                }
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bonus Points</label>
              <Input
                type="number"
                value={formData.points_bonus}
                onChange={(e) =>
                  setFormData({ ...formData, points_bonus: parseInt(e.target.value) })
                }
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🎯"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              disabled={loading}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// TEMPLATES TAB
// ============================================
const TemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await apiGet('/api/harvest/campaigns/templates/list');
        if (res.ok) {
          setTemplates(res.data.templates || []);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const applyTemplate = async (templateId) => {
    const name = window.prompt('Enter campaign name:');
    if (!name) return;

    try {
      const startDate = new Date().toISOString();
      const res = await apiPost(
        `/api/harvest/campaigns/from-template/${templateId}?name=${encodeURIComponent(name)}&start_date=${startDate}`,
        {}
      );
      if (res.ok) {
        alert('Campaign created successfully!');
      }
    } catch (err) {
      console.error('Failed to create from template:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Campaign Templates</h3>
        <p className="text-sm text-gray-500">Quick-start campaigns with pre-configured settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="text-center mb-3">
                <span className="text-4xl">{template.icon || '🎯'}</span>
              </div>
              <h4 className="font-semibold text-gray-900 text-center">{template.name}</h4>
              <p className="text-sm text-gray-500 text-center mt-1">{template.description}</p>

              <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
                <span>{template.duration_days} days</span>
                <span>
                  {template.default_target} {template.goal_type}
                </span>
              </div>

              <Button
                className="w-full mt-4 bg-orange-500 hover:bg-orange-600"
                onClick={() => applyTemplate(template.id)}
              >
                <Play className="w-4 h-4 mr-2" />
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ============================================
// REWARDS TAB
// ============================================
const RewardsTab = () => {
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchRewards = useCallback(async () => {
    try {
      const res = await apiGet('/api/harvest/rewards?is_active=false');
      if (res.ok) {
        setRewards(res.data.rewards || []);
      }
    } catch (err) {
      console.error('Failed to fetch rewards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const archiveReward = async (rewardId) => {
    if (!window.confirm('Archive this reward?')) return;

    try {
      const res = await apiDelete(`/api/harvest/rewards/${rewardId}`);
      if (res.ok) {
        fetchRewards();
      }
    } catch (err) {
      console.error('Failed to archive reward:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rewards Catalog</h3>
          <p className="text-sm text-gray-500">{rewards.length} rewards available</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Reward
        </Button>
      </div>

      <div className="space-y-3">
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center">
                    {reward.image_url ? (
                      <img
                        src={reward.image_url}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                      />
                    ) : (
                      <Trophy className="w-8 h-8 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{reward.name}</h4>
                      {reward.is_featured && (
                        <Badge className="bg-amber-100 text-amber-700">Featured</Badge>
                      )}
                      {!reward.is_active && (
                        <Badge className="bg-gray-100 text-gray-500">Archived</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{reward.description}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span className="font-medium text-purple-600">
                        {reward.points_required} pts
                      </span>
                      <span className="capitalize">{reward.category?.replace('_', ' ')}</span>
                      {reward.stock_quantity !== null && (
                        <span>Stock: {reward.stock_quantity}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => archiveReward(reward.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {rewards.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Gift className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No Rewards</h3>
              <p className="text-sm text-gray-500">Add rewards for your team to redeem!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Reward Modal */}
      {showCreate && (
        <CreateRewardModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchRewards();
          }}
        />
      )}
    </div>
  );
};

// Create Reward Modal
const CreateRewardModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'gift_card',
    points_required: 1000,
    stock_quantity: null,
    is_featured: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiPost('/api/harvest/rewards', formData);

      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to create reward:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add Reward</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reward Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="$50 Amazon Gift Card"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Digital gift card delivered via email"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="gift_card">Gift Card</option>
                <option value="merchandise">Merchandise</option>
                <option value="experience">Experience</option>
                <option value="cash_bonus">Cash Bonus</option>
                <option value="pto">PTO</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Points Required
              </label>
              <Input
                type="number"
                value={formData.points_required}
                onChange={(e) =>
                  setFormData({ ...formData, points_required: parseInt(e.target.value) })
                }
                min={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stock (leave empty for unlimited)
              </label>
              <Input
                type="number"
                value={formData.stock_quantity || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock_quantity: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                min={0}
                placeholder="Unlimited"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_featured}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Featured Reward</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-purple-500 hover:bg-purple-600"
              disabled={loading}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Add Reward'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================
// REDEMPTIONS TAB
// ============================================
const RedemptionsTab = () => {
  const [redemptions, setRedemptions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, fulfilled: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  const fetchRedemptions = useCallback(async () => {
    try {
      const res = await apiGet(
        `/api/harvest/redemptions${filter !== 'all' ? `?status=${filter}` : ''}`
      );
      if (res.ok) {
        setRedemptions(res.data.redemptions || []);
        setCounts(res.data.counts || {});
      }
    } catch (err) {
      console.error('Failed to fetch redemptions:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRedemptions();
  }, [fetchRedemptions]);

  const processRedemption = async (redemptionId, action, notes = null) => {
    try {
      const res = await apiPut(`/api/harvest/redemptions/${redemptionId}`, { action, notes });
      if (res.ok) {
        fetchRedemptions();
      }
    } catch (err) {
      console.error('Failed to process redemption:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Redemption Requests</h3>
          <p className="text-sm text-gray-500">
            {counts.pending} pending · {counts.approved} approved · {counts.fulfilled} fulfilled
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['pending', 'approved', 'fulfilled', 'all'].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
            className={filter === f ? 'bg-orange-500' : ''}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && ` (${counts[f] || 0})`}
          </Button>
        ))}
      </div>

      {/* Redemptions List */}
      <div className="space-y-3">
        {redemptions.map((redemption) => (
          <Card key={redemption.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{redemption.user_name}</h4>
                      <StatusBadge status={redemption.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {redemption.reward_name} · {redemption.points_spent} pts
                    </p>
                    <p className="text-xs text-gray-400">
                      Requested {new Date(redemption.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {redemption.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-green-500 hover:bg-green-600"
                      onClick={() => processRedemption(redemption.id, 'approve')}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        const reason = window.prompt('Denial reason:');
                        if (reason) processRedemption(redemption.id, 'deny', reason);
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                )}

                {redemption.status === 'approved' && (
                  <Button
                    size="sm"
                    className="bg-purple-500 hover:bg-purple-600"
                    onClick={() => processRedemption(redemption.id, 'fulfill')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Mark Fulfilled
                  </Button>
                )}

                {redemption.status === 'denied' && redemption.denial_reason && (
                  <p className="text-sm text-red-500">Reason: {redemption.denial_reason}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {redemptions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No Redemptions</h3>
              <p className="text-sm text-gray-500">No {filter} redemption requests</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============================================
// TERRITORIES TAB
// ============================================
const TerritoriesTab = () => {
  const [territories, setTerritories] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState(null);

  const fetchTerritories = useCallback(async () => {
    try {
      const res = await apiGet('/api/harvest/territories/?include_inactive=true');
      if (res.ok) {
        setTerritories(res.data.territories || []);
      }
    } catch (err) {
      console.error('Failed to fetch territories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiGet('/api/admin/users');
      if (res.ok) {
        setUsers(res.data.users || res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  useEffect(() => {
    fetchTerritories();
    fetchUsers();
  }, [fetchTerritories, fetchUsers]);

  const deleteTerritory = async (territoryId) => {
    if (!window.confirm('Are you sure you want to deactivate this territory?')) return;

    try {
      const res = await apiDelete(`/api/harvest/territories/${territoryId}`);
      if (res.ok) {
        fetchTerritories();
      }
    } catch (err) {
      console.error('Failed to delete territory:', err);
    }
  };

  const assignUser = async (territoryId, userId) => {
    try {
      const res = await apiPost(`/api/harvest/territories/${territoryId}/assign`, {
        user_id: userId,
      });
      if (res.ok) {
        fetchTerritories();
      }
    } catch (err) {
      console.error('Failed to assign user:', err);
    }
  };

  const unassignUser = async (territoryId, userId) => {
    try {
      const res = await apiDelete(
        `/api/harvest/territories/${territoryId}/assign/${userId}`
      );
      if (res.ok) {
        fetchTerritories();
      }
    } catch (err) {
      console.error('Failed to unassign user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Territory Management</h3>
          <p className="text-sm text-gray-500">{territories.length} territories defined</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="create-territory-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Territory
        </Button>
      </div>

      <div className="space-y-3">
        {territories.map((territory) => (
          <Card key={territory.id} className={!territory.is_active ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: territory.color || '#3B82F6' }}
                  />
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      {territory.name}
                      {!territory.is_active && (
                        <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">
                          Inactive
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {territory.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedTerritory(territory)}
                    data-testid={`manage-territory-${territory.id}`}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => deleteTerritory(territory.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-gray-500">Pins</span>
                  <p className="font-semibold">{territory.stats?.total_pins || 0}</p>
                </div>
                <div>
                  <span className="text-gray-500">Visited</span>
                  <p className="font-semibold">{territory.stats?.visited_pins || 0}</p>
                </div>
                <div>
                  <span className="text-gray-500">Coverage</span>
                  <p className="font-semibold text-blue-600">
                    {territory.stats?.coverage_percent || 0}%
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Contracts</span>
                  <p className="font-semibold text-green-600">{territory.stats?.contracts || 0}</p>
                </div>
              </div>

              {/* Assigned Users */}
              {territory.assigned_users && territory.assigned_users.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-500 mb-2">Assigned Reps:</p>
                  <div className="flex flex-wrap gap-2">
                    {territory.assigned_users.map((assignment) => (
                      <Badge
                        key={assignment.user_id}
                        className="bg-blue-100 text-blue-700 border-0 flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" />
                        {assignment.user_name || assignment.user_id}
                        <button
                          onClick={() => unassignUser(territory.id, assignment.user_id)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {territories.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-700">No Territories</h3>
              <p className="text-sm text-gray-500">
                Create territories to organize your canvassing areas
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Territory Modal */}
      {showCreate && (
        <CreateTerritoryModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            fetchTerritories();
          }}
        />
      )}

      {/* Assign Users Modal */}
      {selectedTerritory && (
        <AssignUsersModal
          territory={selectedTerritory}
          users={users}
          onClose={() => setSelectedTerritory(null)}
          onAssign={(userId) => assignUser(selectedTerritory.id, userId)}
          onUnassign={(userId) => unassignUser(selectedTerritory.id, userId)}
        />
      )}
    </div>
  );
};

// Create Territory Modal
const CreateTerritoryModal = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    priority: 2,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For now, create with empty polygon - can be drawn on map later
      const res = await apiPost('/api/harvest/territories/', {
        ...formData,
        polygon: [
          { lat: 27.95, lng: -82.46 },
          { lat: 27.96, lng: -82.46 },
          { lat: 27.96, lng: -82.45 },
          { lat: 27.95, lng: -82.45 },
        ],
      });

      if (res.ok) {
        onSuccess();
      } else {
        alert(res.error?.detail || 'Failed to create territory');
      }
    } catch (err) {
      console.error('Failed to create territory:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New Territory</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Zone A - Downtown"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="High-density residential area"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 rounded-md border border-gray-300 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              >
                <option value={1}>Low</option>
                <option value={2}>Medium</option>
                <option value={3}>High</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-500">
            Note: Territory boundaries can be drawn on the map after creation.
          </p>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-500 hover:bg-blue-600"
              disabled={loading}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Territory'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Assign Users Modal
const AssignUsersModal = ({ territory, users, onClose, onAssign, onUnassign }) => {
  const assignedIds = (territory.assignments || territory.assigned_users || []).map(
    (a) => a.user_id
  );
  const availableUsers = users.filter((u) => !assignedIds.includes(u.id) && u.role !== 'client');

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Assign Reps to {territory.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Currently Assigned */}
        {assignedIds.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Currently Assigned</p>
            <div className="space-y-2">
              {(territory.assignments || territory.assigned_users || []).map((assignment) => {
                const user = users.find((u) => u.id === assignment.user_id);
                return (
                  <div
                    key={assignment.user_id}
                    className="flex items-center justify-between p-2 bg-blue-50 rounded-lg"
                  >
                    <span className="text-sm font-medium">
                      {user?.full_name || assignment.user_name || 'Unknown'}
                    </span>
                    <button
                      onClick={() => onUnassign(assignment.user_id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Users */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Available Reps</p>
          {availableUsers.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div>
                    <span className="text-sm font-medium">{user.full_name}</span>
                    <span className="text-xs text-gray-500 ml-2">{user.role}</span>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onAssign(user.id)}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">All reps are already assigned</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SETTINGS TAB (Dispositions & Daily Goals)
// ============================================
const SettingsTab = () => {
  const [dispositions, setDispositions] = useState([]);
  const [dailyGoals, setDailyGoals] = useState({
    doors_knocked: 40,
    appointments_set: 3,
    signed_contracts: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const [dispRes, goalsRes] = await Promise.all([
        apiGet('/api/harvest/v2/dispositions'),
        apiGet('/api/harvest/v2/daily-goals'),
      ]);

      if (dispRes.ok) {
        setDispositions(dispRes.data.dispositions || []);
      }

      if (goalsRes.ok) {
        setDailyGoals(
          goalsRes.data.goals || { doors_knocked: 40, appointments_set: 3, signed_contracts: 1 }
        );
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveGoals = async () => {
    setSaving(true);
    try {
      const res = await apiPut('/api/harvest/v2/daily-goals', dailyGoals);

      if (res.ok) {
        alert('Daily goals updated!');
      }
    } catch (err) {
      console.error('Failed to save goals:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Daily Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-500" />
            Daily Goals Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Set daily targets that reps need to hit to maintain their streak and earn bonuses.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doors Knocked</label>
              <Input
                type="number"
                value={dailyGoals.doors_knocked}
                onChange={(e) =>
                  setDailyGoals({ ...dailyGoals, doors_knocked: parseInt(e.target.value) || 0 })
                }
                min={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointments Set
              </label>
              <Input
                type="number"
                value={dailyGoals.appointments_set}
                onChange={(e) =>
                  setDailyGoals({ ...dailyGoals, appointments_set: parseInt(e.target.value) || 0 })
                }
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contracts Signed
              </label>
              <Input
                type="number"
                value={dailyGoals.signed_contracts}
                onChange={(e) =>
                  setDailyGoals({ ...dailyGoals, signed_contracts: parseInt(e.target.value) || 0 })
                }
                min={0}
              />
            </div>
          </div>

          <Button onClick={saveGoals} disabled={saving} className="bg-blue-500 hover:bg-blue-600">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Daily Goals
          </Button>
        </CardContent>
      </Card>

      {/* Dispositions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-500" />
            Pin Dispositions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            These are the status options available when logging a door visit.
          </p>

          <div className="space-y-2">
            {dispositions.map((disp, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: disp.color }}
                >
                  {disp.icon || disp.code.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{disp.label}</p>
                  <p className="text-xs text-gray-500">
                    Code: {disp.code} • Points: {disp.points}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-sm text-gray-400 mt-4">
            Disposition configuration is managed at the system level. Contact support to modify.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const HarvestAdminConsole = () => {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [refreshKey, setRefreshKey] = useState(0);

  const token = localStorage.getItem('eden_token');

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={NAV_ICONS.harvest_admin}
                alt="Harvest Admin"
                className="w-10 h-10 object-contain icon-3d-shadow"
              />
              <div>
                <h1 className="text-xl font-tactical font-bold text-white tracking-wide text-glow-orange">
                  HARVEST ADMIN
                </h1>
                <p className="text-sm text-zinc-500 font-mono uppercase tracking-wider">
                  Manage gamification for your team
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {ADMIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    isActive ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  data-testid={`admin-${tab.id}-tab`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6" key={refreshKey}>
        {activeTab === 'campaigns' && <CampaignsTab onRefresh={handleRefresh} />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'territories' && <TerritoriesTab />}
        {activeTab === 'rewards' && <RewardsTab />}
        {activeTab === 'redemptions' && <RedemptionsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>
    </div>
  );
};

export default HarvestAdminConsole;
