import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';

const unwrap = (result, fallbackMessage) => {
  if (!result?.ok) {
    throw new Error(result?.error || fallbackMessage);
  }
  return result.data;
};

const normalizeTerritory = (territory) => {
  const coordinates = territory.coordinates || territory.polygon || [];
  return {
    ...territory,
    coordinates,
    color: territory.color || '#F97316',
  };
};

const normalizeUser = (user = {}) => ({
  ...user,
  id: user.id || user._id || user.user_id || '',
});

const STATUS_TO_DISPOSITION = {
  NA: 'no_answer',
  NI: 'not_interested',
  RN: 'renter',
  FU: 'follow_up',
  AP: 'appointment',
  DL: 'deal',
  // Legacy
  NH: 'no_answer',
  CB: 'follow_up',
  SG: 'deal',
  DNK: 'not_interested',
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const tryRequests = async (requestFactories, fallbackMessage) => {
  let lastError = null;

  for (const factory of requestFactories) {
    try {
      const result = await factory();
      if (result?.ok) return result.data;
      lastError = new Error(result?.error || fallbackMessage);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(fallbackMessage);
};

const normalizeCanvassingStats = (raw = {}) => ({
  today: toFiniteNumber(raw.today ?? raw.today_visits ?? raw.doors_knocked),
  week: toFiniteNumber(raw.week ?? raw.week_visits ?? raw.this_week_visits),
  signed: toFiniteNumber(raw.signed ?? raw.signed_contracts),
  appointments: toFiniteNumber(raw.appointments ?? raw.appointments_set),
  streak: toFiniteNumber(raw.streak ?? raw.current_streak),
  multiplier: toFiniteNumber(raw.multiplier, 1),
  total_points: toFiniteNumber(raw.total_points),
});

const normalizeMapOverview = (raw = {}) => ({
  ...raw,
  by_disposition: {
    not_home: toFiniteNumber(raw.by_disposition?.not_home ?? raw.not_home),
    not_interested: toFiniteNumber(raw.by_disposition?.not_interested ?? raw.not_interested),
    callback: toFiniteNumber(raw.by_disposition?.callback ?? raw.callbacks),
    appointment: toFiniteNumber(raw.by_disposition?.appointment ?? raw.appointments_set),
    signed: toFiniteNumber(raw.by_disposition?.signed ?? raw.signed_contracts),
    do_not_knock: toFiniteNumber(raw.by_disposition?.do_not_knock),
  },
});

const normalizePinFromV2 = (pin) => ({
  ...pin,
  id: pin?.id || pin?._id || pin?.pin_id || pin?.idempotency_key || `${pin?.latitude ?? pin?.lat}:${pin?.longitude ?? pin?.lng}:${pin?.created_at || ''}`,
  disposition: pin.disposition || STATUS_TO_DISPOSITION[pin.last_status] || 'unmarked',
  visit_count: toFiniteNumber(pin.visit_count),
});

export const harvestService = {
  async getToday() {
    return unwrap(await apiGet('/api/harvest/v2/today', { cache: false }), 'Failed to load today stats');
  },

  async getStreak() {
    return unwrap(await apiGet('/api/harvest/streak', { cache: false }), 'Failed to load streak');
  },

  async getChallenges(includeCompleted = false) {
    const qs = includeCompleted ? '?include_completed=true' : '';
    return unwrap(await apiGet(`/api/harvest/challenges${qs}`, { cache: false }), 'Failed to load challenges');
  },

  async claimChallenge(challengeId) {
    return unwrap(await apiPost(`/api/harvest/challenges/${challengeId}/claim`), 'Failed to claim challenge');
  },

  async getCampaigns() {
    return unwrap(await apiGet('/api/harvest/campaigns', { cache: false }), 'Failed to load campaigns');
  },

  async getRewardProgress() {
    return unwrap(await apiGet('/api/harvest/progress/rewards', { cache: false }), 'Failed to load reward progress');
  },

  async getCompetitionDashboard() {
    return unwrap(await apiGet('/api/incentives/me/dashboard', { cache: false }), 'Failed to load competitions');
  },

  async getIncentivesActive() {
    return unwrap(await apiGet('/api/harvest/incentives/active', { cache: false }), 'Failed to load incentives season');
  },

  async getIncentivesProgress() {
    return unwrap(await apiGet('/api/harvest/incentives/progress', { cache: false }), 'Failed to load incentives progress');
  },

  async getBadgesByTier() {
    return unwrap(await apiGet('/api/harvest/badges/tiers', { cache: false }), 'Failed to load badges');
  },

  async getCanvassingStats() {
    const data = await tryRequests(
      [
        () => apiGet('/api/canvassing-map/stats', { cache: false }),
        () => apiGet('/api/harvest/v2/stats/me', { cache: false }),
      ],
      'Failed to load canvassing stats'
    );
    return normalizeCanvassingStats(data);
  },

  async getMapOverviewStats() {
    const data = await tryRequests(
      [
        () => apiGet('/api/canvassing-map/stats/overview', { cache: false }),
        () => apiGet('/api/harvest/v2/today', { cache: false }),
      ],
      'Failed to load map overview'
    );
    return normalizeMapOverview(data);
  },

  async getTerritories() {
    const list = await tryRequests(
      [
        () => apiGet('/api/canvassing-map/territories', { cache: false }),
        () => apiGet('/api/harvest/territories', { cache: false }),
      ],
      'Failed to load territories'
    );
    const normalizedList = Array.isArray(list) ? list : list?.territories || [];
    return normalizedList.map(normalizeTerritory);
  },

  async createTerritory(payload) {
    return unwrap(await apiPost('/api/harvest/territories/', payload), 'Failed to create territory');
  },

  async getAdminUsers() {
    const data = await tryRequests(
      [
        () => apiGet('/api/admin/users', { cache: false }),
        () => apiGet('/api/users', { cache: false }),
        () => apiGet('/api/users/', { cache: false }),
      ],
      'Failed to load users'
    );
    const users = Array.isArray(data) ? data : data?.users || [];
    return users.map(normalizeUser).filter((user) => user.id);
  },

  async assignTerritoryUser(territoryId, userId, notes = '') {
    return unwrap(
      await apiPost(`/api/harvest/territories/${encodeURIComponent(territoryId)}/assign`, {
        user_id: userId,
        notes,
      }),
      'Failed to assign user to territory'
    );
  },

  async unassignTerritoryUser(territoryId, userId) {
    return unwrap(
      await apiDelete(`/api/harvest/territories/${encodeURIComponent(territoryId)}/assign/${encodeURIComponent(userId)}`),
      'Failed to unassign user from territory'
    );
  },

  async getDispositions() {
    return unwrap(await apiGet('/api/harvest/v2/dispositions', { cache: false }), 'Failed to load dispositions');
  },

  async getPins({ territoryId, bounds } = {}) {
    const params = new URLSearchParams();
    if (territoryId) params.append('territory_id', territoryId);
    if (bounds) params.append('bounds', bounds);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await tryRequests(
      [
        () => apiGet(`/api/canvassing-map/pins${qs}`, { cache: false }),
        () => apiGet(`/api/harvest/v2/pins-with-history${qs}`, { cache: false }),
      ],
      'Failed to load pins'
    );
    const list = Array.isArray(data) ? data : data?.pins || [];
    return list.map(normalizePinFromV2);
  },

  async createPin(payload) {
    return unwrap(await apiPost('/api/canvassing-map/pins', payload), 'Failed to create pin');
  },

  async logVisit(payload) {
    return tryRequests(
      [
        () => apiPost('/api/canvassing-map/visits', payload),
        () => apiPost('/api/harvest/v2/visits', payload),
      ],
      'Failed to log visit'
    );
  },

  async updatePin(pinId, payload) {
    return unwrap(await apiPatch(`/api/canvassing-map/pins/${pinId}`, payload), 'Failed to update pin');
  },

  async getPinVisits(pinId) {
    return tryRequests(
      [
        () => apiGet(`/api/canvassing-map/pins/${pinId}/visits`, { cache: false }),
        () => apiGet(`/api/harvest/v2/visits?pin_id=${encodeURIComponent(pinId)}`, { cache: false }),
      ],
      'Failed to load pin visits'
    );
  },

  async deletePin(pinId) {
    return unwrap(await apiDelete(`/api/canvassing-map/pins/${pinId}`), 'Failed to delete pin');
  },

  async repairInvalidPins() {
    return unwrap(await apiPost('/api/canvassing-map/pins/repair-invalid', {}), 'Failed to repair invalid pins');
  },

  async updateRepLocation(payload) {
    return unwrap(await apiPost('/api/canvassing-map/location', payload), 'Failed to update rep location');
  },

  async getScoringLeaderboard(period = 'day', limit = 20) {
    return unwrap(await apiGet(`/api/harvest/scoring/leaderboard?period=${period}&limit=${limit}`, { cache: false }), 'Failed to load leaderboard');
  },

  async getCompetitions() {
    return unwrap(await apiGet('/api/harvest/competitions', { cache: false }), 'Failed to load competitions');
  },

  async createCompetition(payload) {
    return unwrap(await apiPost('/api/harvest/competitions', payload), 'Failed to create competition');
  },

  async joinCompetition(competitionId) {
    return unwrap(await apiPost(`/api/harvest/competitions/${competitionId}/join`), 'Failed to join competition');
  },

  async getMyScoringStats() {
    return unwrap(await apiGet('/api/harvest/scoring/stats/me', { cache: false }), 'Failed to load user scoring stats');
  },

  async getScoringBadges() {
    return unwrap(await apiGet('/api/harvest/scoring/badges', { cache: false }), 'Failed to load scoring badges');
  },

  // Field Mode session tracking
  async startFieldSession(territoryId = null) {
    return unwrap(
      await apiPost('/api/harvest/v2/field-session/start', { territory_id: territoryId }),
      'Failed to start field session'
    );
  },

  async endFieldSession(sessionId) {
    return unwrap(
      await apiPost('/api/harvest/v2/field-session/end', { session_id: sessionId }),
      'Failed to end field session'
    );
  },

  async getFieldSessionHistory(limit = 20) {
    return unwrap(
      await apiGet(`/api/harvest/v2/field-session/history?limit=${limit}`, { cache: false }),
      'Failed to load session history'
    );
  },
};

export default harvestService;
