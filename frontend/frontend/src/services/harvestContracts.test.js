/**
 * Tests for harvestContracts — API contract constants
 */
import { describe, it, expect } from 'vitest';
import { HARVEST_API_CONTRACT } from './harvestContracts';

describe('HARVEST_API_CONTRACT', () => {
  it('exports all expected endpoints', () => {
    const expectedKeys = [
      'dispositions',
      'dailyGoals',
      'today',
      'pins',
      'visits',
      'mapOverview',
      'mapStats',
      'mapTerritories',
      'mapLocationUpdate',
      'harvestTerritories',
      'scoringLeaderboard',
      'scoringStatsMe',
      'scoringBadges',
      'campaigns',
      'challenges',
      'rewardsProgress',
      'streak',
      'incentivesDashboard',
      'incentivesActive',
      'incentivesProgress',
    ];

    expectedKeys.forEach(key => {
      expect(HARVEST_API_CONTRACT).toHaveProperty(key);
    });
  });

  it('all values are string paths starting with /api/', () => {
    Object.values(HARVEST_API_CONTRACT).forEach(path => {
      expect(typeof path).toBe('string');
      expect(path.startsWith('/api/')).toBe(true);
    });
  });

  it('has correct canonical paths', () => {
    expect(HARVEST_API_CONTRACT.dispositions).toBe('/api/harvest/v2/dispositions');
    expect(HARVEST_API_CONTRACT.pins).toBe('/api/canvassing-map/pins');
    expect(HARVEST_API_CONTRACT.scoringLeaderboard).toBe('/api/harvest/scoring/leaderboard');
    expect(HARVEST_API_CONTRACT.incentivesDashboard).toBe('/api/incentives/me/dashboard');
  });
});
