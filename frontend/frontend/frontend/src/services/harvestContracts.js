// Canonical Harvest API contract map for frontend integration.
// Use this as the source of truth when wiring UI data access.

export const HARVEST_API_CONTRACT = {
  dispositions: '/api/harvest/v2/dispositions',
  dailyGoals: '/api/harvest/v2/daily-goals',
  today: '/api/harvest/v2/today',

  pins: '/api/canvassing-map/pins',
  visits: '/api/canvassing-map/visits',
  mapOverview: '/api/canvassing-map/stats/overview',
  mapStats: '/api/canvassing-map/stats',
  mapTerritories: '/api/canvassing-map/territories',
  mapLocationUpdate: '/api/canvassing-map/location',

  harvestTerritories: '/api/harvest/territories',

  scoringLeaderboard: '/api/harvest/scoring/leaderboard',
  scoringStatsMe: '/api/harvest/scoring/stats/me',
  scoringBadges: '/api/harvest/scoring/badges',

  campaigns: '/api/harvest/campaigns',
  challenges: '/api/harvest/challenges',
  rewardsProgress: '/api/harvest/progress/rewards',
  streak: '/api/harvest/streak',

  incentivesDashboard: '/api/incentives/me/dashboard',
  incentivesActive: '/api/harvest/incentives/active',
  incentivesProgress: '/api/harvest/incentives/progress',
};

export default HARVEST_API_CONTRACT;
