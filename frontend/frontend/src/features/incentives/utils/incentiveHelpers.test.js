/**
 * Tests for incentiveHelpers — Pure utility functions for incentives
 * Covers: getStatusColor, getStatusBadge, getCategoryColor, formatCurrency,
 *         calculateProgress, createDefaultRule, constants
 */
import { describe, it, expect, vi } from 'vitest';
import {
  getStatusColor,
  getStatusBadge,
  getCategoryColor,
  getCategoryIconComponent,
  formatCurrency,
  calculateProgress,
  createDefaultRule,
  CATEGORIES,
  RULE_TYPES,
  REWARD_TYPES,
  TIER_CONFIG,
  DEFAULT_TEMPLATE,
  DEFAULT_COMP_FORM_DATA,
  DEFAULT_SEASON,
  DEFAULT_BADGE,
  DEFAULT_REWARD,
} from './incentiveHelpers';

describe('getStatusColor', () => {
  it('returns green for active', () => {
    expect(getStatusColor('active')).toBe('bg-green-500');
  });

  it('returns blue for scheduled', () => {
    expect(getStatusColor('scheduled')).toBe('bg-blue-500');
  });

  it('returns gray for completed', () => {
    expect(getStatusColor('completed')).toBe('bg-gray-500');
  });

  it('returns yellow for draft', () => {
    expect(getStatusColor('draft')).toBe('bg-yellow-500');
  });

  it('returns orange for paused', () => {
    expect(getStatusColor('paused')).toBe('bg-orange-500');
  });

  it('returns default gray for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('bg-gray-400');
  });
});

describe('getStatusBadge', () => {
  it('returns correct badge classes for known statuses', () => {
    expect(getStatusBadge('active')).toBe('bg-green-100 text-green-800');
    expect(getStatusBadge('scheduled')).toBe('bg-blue-100 text-blue-800');
    expect(getStatusBadge('completed')).toBe('bg-gray-100 text-gray-800');
    expect(getStatusBadge('draft')).toBe('bg-yellow-100 text-yellow-800');
    expect(getStatusBadge('paused')).toBe('bg-orange-100 text-orange-800');
    expect(getStatusBadge('upcoming')).toBe('bg-blue-100 text-blue-800');
  });

  it('returns default for unknown status', () => {
    expect(getStatusBadge('foo')).toBe('bg-gray-100 text-gray-800');
  });
});

describe('getCategoryColor', () => {
  it('returns correct colors for categories', () => {
    expect(getCategoryColor('sprint')).toBe('bg-green-100 text-green-800');
    expect(getCategoryColor('ladder')).toBe('bg-purple-100 text-purple-800');
    expect(getCategoryColor('threshold')).toBe('bg-orange-100 text-orange-800');
    expect(getCategoryColor('team_battle')).toBe('bg-red-100 text-red-800');
    expect(getCategoryColor('milestone')).toBe('bg-blue-100 text-blue-800');
    expect(getCategoryColor('lottery')).toBe('bg-pink-100 text-pink-800');
  });

  it('returns default for unknown category', () => {
    expect(getCategoryColor('unknown')).toBe('bg-gray-100 text-gray-800');
  });
});

describe('getCategoryIconComponent', () => {
  it('returns a component for each known category', () => {
    expect(getCategoryIconComponent('sprint')).toBeDefined();
    expect(getCategoryIconComponent('ladder')).toBeDefined();
    expect(getCategoryIconComponent('threshold')).toBeDefined();
    expect(getCategoryIconComponent('team_battle')).toBeDefined();
    expect(getCategoryIconComponent('milestone')).toBeDefined();
    expect(getCategoryIconComponent('lottery')).toBeDefined();
  });

  it('returns Trophy for unknown category', () => {
    const icon = getCategoryIconComponent('foo');
    expect(icon).toBeDefined();
  });
});

describe('formatCurrency', () => {
  it('formats cents to USD string', () => {
    expect(formatCurrency(5000)).toBe('$50.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats small amounts', () => {
    expect(formatCurrency(99)).toBe('$0.99');
  });

  it('formats large amounts', () => {
    expect(formatCurrency(100000)).toBe('$1,000.00');
  });
});

describe('calculateProgress', () => {
  it('returns 0 when before start date', () => {
    const season = {
      start_date: new Date(Date.now() + 86400000).toISOString(),
      end_date: new Date(Date.now() + 172800000).toISOString(),
    };
    expect(calculateProgress(season)).toBe(0);
  });

  it('returns 100 when past end date', () => {
    const season = {
      start_date: new Date(Date.now() - 172800000).toISOString(),
      end_date: new Date(Date.now() - 86400000).toISOString(),
    };
    expect(calculateProgress(season)).toBe(100);
  });

  it('returns progress between 0 and 100 during season', () => {
    const now = Date.now();
    const season = {
      start_date: new Date(now - 50000).toISOString(),
      end_date: new Date(now + 50000).toISOString(),
    };
    const progress = calculateProgress(season);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(100);
  });

  it('returns approximately 50 at midpoint', () => {
    const now = Date.now();
    const season = {
      start_date: new Date(now - 100000).toISOString(),
      end_date: new Date(now + 100000).toISOString(),
    };
    const progress = calculateProgress(season);
    expect(progress).toBeGreaterThanOrEqual(45);
    expect(progress).toBeLessThanOrEqual(55);
  });
});

describe('createDefaultRule', () => {
  it('creates threshold rule with default config', () => {
    const rule = createDefaultRule('threshold');
    expect(rule.type).toBe('threshold');
    expect(rule.config.threshold_value).toBe(75);
    expect(rule.reward_config.points_award).toBe(100);
  });

  it('creates top_n rule', () => {
    const rule = createDefaultRule('top_n');
    expect(rule.config.top_n).toBe(3);
  });

  it('creates milestone rule with tiers', () => {
    const rule = createDefaultRule('milestone');
    expect(rule.config.milestones).toHaveLength(3);
    expect(rule.config.milestones[0].tier).toBe('bronze');
    expect(rule.config.milestones[2].value).toBe(100);
  });

  it('creates improvement rule', () => {
    const rule = createDefaultRule('improvement');
    expect(rule.config.improvement_percent).toBe(10);
    expect(rule.config.baseline_period).toBe('last_week');
  });

  it('creates lottery rule', () => {
    const rule = createDefaultRule('lottery');
    expect(rule.config.lottery_qualifier_threshold).toBe(50);
    expect(rule.config.lottery_winner_count).toBe(3);
  });

  it('handles unknown type with empty config', () => {
    const rule = createDefaultRule('custom');
    expect(rule.type).toBe('custom');
    expect(rule.config).toEqual({});
  });
});

describe('constants', () => {
  it('CATEGORIES has 6 entries', () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(CATEGORIES.map(c => c.value)).toEqual([
      'sprint', 'ladder', 'threshold', 'team_battle', 'milestone', 'lottery',
    ]);
  });

  it('RULE_TYPES has 5 entries', () => {
    expect(RULE_TYPES).toHaveLength(5);
    expect(RULE_TYPES.every(r => r.iconComponent)).toBe(true);
  });

  it('REWARD_TYPES has 8 entries', () => {
    expect(REWARD_TYPES).toHaveLength(8);
    expect(REWARD_TYPES.map(r => r.value)).toContain('gift_card');
    expect(REWARD_TYPES.map(r => r.value)).toContain('cash');
  });

  it('TIER_CONFIG has 4 tiers', () => {
    expect(Object.keys(TIER_CONFIG)).toEqual(['legendary', 'epic', 'rare', 'common']);
    Object.values(TIER_CONFIG).forEach(tier => {
      expect(tier).toHaveProperty('color');
      expect(tier).toHaveProperty('ring');
      expect(tier).toHaveProperty('label');
    });
  });

  it('DEFAULT_TEMPLATE has required fields', () => {
    expect(DEFAULT_TEMPLATE).toHaveProperty('name');
    expect(DEFAULT_TEMPLATE).toHaveProperty('category');
    expect(DEFAULT_TEMPLATE.default_duration_days).toBe(7);
  });

  it('DEFAULT_COMP_FORM_DATA has auto_start', () => {
    expect(DEFAULT_COMP_FORM_DATA.auto_start).toBe(true);
  });

  it('DEFAULT_SEASON is_active defaults to true', () => {
    expect(DEFAULT_SEASON.is_active).toBe(true);
  });

  it('DEFAULT_BADGE tier is common', () => {
    expect(DEFAULT_BADGE.tier).toBe('common');
    expect(DEFAULT_BADGE.points_value).toBe(100);
  });

  it('DEFAULT_REWARD defaults', () => {
    expect(DEFAULT_REWARD.type).toBe('gift_card');
    expect(DEFAULT_REWARD.value_cents).toBe(5000);
    expect(DEFAULT_REWARD.is_active).toBe(true);
  });
});
