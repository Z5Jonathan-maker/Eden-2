import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
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
import { Play, Loader2, Star } from 'lucide-react';

export const UseTemplateDialog = ({
  open,
  onOpenChange,
  usingTemplate,
  compFormData,
  setCompFormData,
  seasons,
  creatingComp,
  onCreateFromTemplate,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <div className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-700/50 rounded-lg">
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
            <div className="border-t border-zinc-700/50 pt-4">
              <Label className="text-xs text-zinc-500 uppercase mb-2 block">
                Rules from Template
              </Label>
              <div className="space-y-2">
                {usingTemplate.default_rules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm p-2 bg-zinc-900 border border-zinc-700/50 rounded"
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onCreateFromTemplate}
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
  );
};
