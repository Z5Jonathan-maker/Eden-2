import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent } from '../../../shared/ui/card';
import { Progress } from '../../../shared/ui/progress';
import {
  Trophy,
  Calendar,
  Plus,
  Loader2,
  RefreshCw,
  Crown,
  Medal,
  Edit2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  DEFAULT_SEASON,
  getStatusBadge,
  formatCurrency,
  calculateProgress,
} from '../utils/incentiveHelpers';
import { SeasonFormDialog } from './SeasonFormDialog';

export const SeasonsTab = () => {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState(DEFAULT_SEASON);

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
        setFormData(DEFAULT_SEASON);
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
      icon: season.icon || '\uD83C\uDFC6',
      grand_prize_description: season.grand_prize_description || '',
      grand_prize_value_cents: season.grand_prize_value_cents || 0,
      is_active: season.is_active !== false,
    });
    setEditingSeason(season);
    setShowCreateDialog(true);
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
              setFormData(DEFAULT_SEASON);
              setEditingSeason(null);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Season
          </Button>
        </div>
      </div>

      <SeasonFormDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSeason(null);
            setFormData(DEFAULT_SEASON);
          }
          setShowCreateDialog(open);
        }}
        editingSeason={editingSeason}
        formData={formData}
        setFormData={setFormData}
        saving={saving}
        onSave={handleSave}
      />

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
                  <span className="text-2xl">{season.icon || '\uD83C\uDFC6'}</span>
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
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

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
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
