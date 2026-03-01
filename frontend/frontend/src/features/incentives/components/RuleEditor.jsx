import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Card, CardContent } from '../../../shared/ui/card';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import { Star, Trash2 } from 'lucide-react';
import { RULE_TYPES } from '../utils/incentiveHelpers';

export const RuleEditor = ({ rule, index, rewards, onUpdate, onRemove }) => {
  const ruleType = RULE_TYPES.find((r) => r.value === rule.type);
  const IconComponent = ruleType?.iconComponent;

  return (
    <Card className="border-dashed bg-slate-50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {IconComponent && <IconComponent className="w-4 h-4" />}
            <span className="font-medium capitalize">{rule.type.replace('_', ' ')} Rule</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500"
            onClick={() => onRemove(index)}
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
                  onUpdate(index, {
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
                  onUpdate(index, {
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {['bronze', 'silver', 'gold'].map((tier) => {
                const milestone = rule.config.milestones?.find((m) => m.tier === tier) || {
                  tier,
                  value: 0,
                };
                return (
                  <div key={tier} className="flex items-center gap-1">
                    <span
                      className={`text-sm capitalize ${tier === 'gold' ? 'text-yellow-600' : tier === 'silver' ? 'text-gray-500' : 'text-orange-700'}`}
                    >
                      {tier === 'gold' ? '\uD83E\uDD47' : tier === 'silver' ? '\uD83E\uDD48' : '\uD83E\uDD49'}
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
                        onUpdate(index, {
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
                  onUpdate(index, {
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
                  onUpdate(index, { config: { ...rule.config, baseline_period: v } })
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
                  onUpdate(index, {
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
                  onUpdate(index, {
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
                  onUpdate(index, {
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
                onUpdate(index, {
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
