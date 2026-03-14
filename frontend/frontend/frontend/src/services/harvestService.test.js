/**
 * Tests for harvestService — Harvest API service layer
 * Covers: unwrap, normalizers, toFiniteNumber, tryRequests, all service methods
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module
vi.mock('../lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const { apiGet, apiPost, apiPatch, apiDelete } = await import('../lib/api');
const { harvestService } = await import('./harvestService');

beforeEach(() => {
  vi.clearAllMocks();
});

// ── unwrap (tested indirectly through service methods) ────────────────

describe('harvestService simple unwrap methods', () => {
  it('getToday returns data on success', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { visits: 5 } });
    const result = await harvestService.getToday();
    expect(result).toEqual({ visits: 5 });
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/v2/today', { cache: false });
  });

  it('getToday throws on failure', async () => {
    apiGet.mockResolvedValue({ ok: false, error: 'Server error' });
    await expect(harvestService.getToday()).rejects.toThrow('Server error');
  });

  it('getToday uses fallback message when no error string', async () => {
    apiGet.mockResolvedValue({ ok: false });
    await expect(harvestService.getToday()).rejects.toThrow('Failed to load today stats');
  });

  it('getStreak returns data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { streak: 7 } });
    const result = await harvestService.getStreak();
    expect(result).toEqual({ streak: 7 });
  });

  it('getChallenges without includeCompleted', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [{ id: 'c1' }] });
    await harvestService.getChallenges();
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/challenges', { cache: false });
  });

  it('getChallenges with includeCompleted', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [{ id: 'c1' }] });
    await harvestService.getChallenges(true);
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/challenges?include_completed=true', { cache: false });
  });

  it('claimChallenge calls correct endpoint', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { claimed: true } });
    const result = await harvestService.claimChallenge('ch-123');
    expect(result).toEqual({ claimed: true });
    expect(apiPost).toHaveBeenCalledWith('/api/harvest/challenges/ch-123/claim');
  });

  it('getCampaigns returns data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [{ id: 'camp1' }] });
    const result = await harvestService.getCampaigns();
    expect(result).toEqual([{ id: 'camp1' }]);
  });

  it('getRewardProgress returns data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { progress: 50 } });
    const result = await harvestService.getRewardProgress();
    expect(result).toEqual({ progress: 50 });
  });

  it('getCompetitionDashboard calls incentives endpoint', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { dashboard: true } });
    await harvestService.getCompetitionDashboard();
    expect(apiGet).toHaveBeenCalledWith('/api/incentives/me/dashboard', { cache: false });
  });

  it('getDispositions returns data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { dispositions: [] } });
    const result = await harvestService.getDispositions();
    expect(result).toEqual({ dispositions: [] });
  });

  it('createTerritory posts payload', async () => {
    const payload = { name: 'Zone A', coordinates: [] };
    apiPost.mockResolvedValue({ ok: true, data: { id: 't1' } });
    const result = await harvestService.createTerritory(payload);
    expect(result).toEqual({ id: 't1' });
    expect(apiPost).toHaveBeenCalledWith('/api/harvest/territories/', payload);
  });

  it('createPin posts payload', async () => {
    const payload = { latitude: 27.95, longitude: -82.45 };
    apiPost.mockResolvedValue({ ok: true, data: { id: 'p1' } });
    const result = await harvestService.createPin(payload);
    expect(result).toEqual({ id: 'p1' });
    expect(apiPost).toHaveBeenCalledWith('/api/canvassing-map/pins', payload);
  });

  it('updatePin patches pin', async () => {
    apiPatch.mockResolvedValue({ ok: true, data: { updated: true } });
    const result = await harvestService.updatePin('p1', { disposition: 'deal' });
    expect(result).toEqual({ updated: true });
  });

  it('deletePin deletes pin', async () => {
    apiDelete.mockResolvedValue({ ok: true, data: { deleted: true } });
    const result = await harvestService.deletePin('p1');
    expect(result).toEqual({ deleted: true });
  });

  it('repairInvalidPins posts to repair endpoint', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { repaired: 3 } });
    const result = await harvestService.repairInvalidPins();
    expect(result).toEqual({ repaired: 3 });
  });

  it('updateRepLocation posts location', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { updated: true } });
    const result = await harvestService.updateRepLocation({ lat: 27.95, lng: -82.45 });
    expect(result).toEqual({ updated: true });
  });

  it('getScoringLeaderboard uses default period and limit', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [] });
    await harvestService.getScoringLeaderboard();
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/scoring/leaderboard?period=day&limit=20', { cache: false });
  });

  it('getScoringLeaderboard uses custom period and limit', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [] });
    await harvestService.getScoringLeaderboard('week', 10);
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/scoring/leaderboard?period=week&limit=10', { cache: false });
  });

  it('getCompetitions returns data', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [] });
    const result = await harvestService.getCompetitions();
    expect(result).toEqual([]);
  });

  it('createCompetition posts payload', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { id: 'comp1' } });
    const result = await harvestService.createCompetition({ name: 'Sprint' });
    expect(result).toEqual({ id: 'comp1' });
  });

  it('joinCompetition posts to join endpoint', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { joined: true } });
    const result = await harvestService.joinCompetition('comp1');
    expect(result).toEqual({ joined: true });
  });

  it('startFieldSession posts with territory_id', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { session_id: 's1' } });
    const result = await harvestService.startFieldSession('t1');
    expect(result).toEqual({ session_id: 's1' });
    expect(apiPost).toHaveBeenCalledWith('/api/harvest/v2/field-session/start', { territory_id: 't1' });
  });

  it('startFieldSession defaults territory_id to null', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { session_id: 's1' } });
    await harvestService.startFieldSession();
    expect(apiPost).toHaveBeenCalledWith('/api/harvest/v2/field-session/start', { territory_id: null });
  });

  it('endFieldSession posts session_id', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { ended: true } });
    const result = await harvestService.endFieldSession('s1');
    expect(result).toEqual({ ended: true });
  });

  it('getFieldSessionHistory uses default limit', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [] });
    await harvestService.getFieldSessionHistory();
    expect(apiGet).toHaveBeenCalledWith('/api/harvest/v2/field-session/history?limit=20', { cache: false });
  });

  it('assignTerritoryUser encodes IDs and sends payload', async () => {
    apiPost.mockResolvedValue({ ok: true, data: { assigned: true } });
    await harvestService.assignTerritoryUser('t/1', 'u1', 'some notes');
    expect(apiPost).toHaveBeenCalledWith('/api/harvest/territories/t%2F1/assign', {
      user_id: 'u1',
      notes: 'some notes',
    });
  });

  it('unassignTerritoryUser calls correct endpoint', async () => {
    apiDelete.mockResolvedValue({ ok: true, data: { unassigned: true } });
    await harvestService.unassignTerritoryUser('t1', 'u1');
    expect(apiDelete).toHaveBeenCalledWith('/api/harvest/territories/t1/assign/u1');
  });
});

// ── tryRequests (tested through methods that use it) ──────────────────

describe('harvestService tryRequests methods', () => {
  it('getCanvassingStats uses first successful endpoint', async () => {
    apiGet.mockResolvedValueOnce({ ok: true, data: { today: 5, week: 20, signed: 3 } });
    const result = await harvestService.getCanvassingStats();
    expect(result.today).toBe(5);
    expect(result.week).toBe(20);
    expect(result.signed).toBe(3);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('getCanvassingStats falls back to second endpoint', async () => {
    apiGet
      .mockResolvedValueOnce({ ok: false, error: 'Not found' })
      .mockResolvedValueOnce({ ok: true, data: { today_visits: 10 } });
    const result = await harvestService.getCanvassingStats();
    expect(result.today).toBe(10);
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('getCanvassingStats throws when all endpoints fail', async () => {
    apiGet
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });
    await expect(harvestService.getCanvassingStats()).rejects.toThrow('Failed to load canvassing stats');
  });

  it('getCanvassingStats normalizes legacy field names', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: {
        doors_knocked: 15,
        this_week_visits: 30,
        signed_contracts: 2,
        appointments_set: 4,
        current_streak: 7,
      },
    });
    const result = await harvestService.getCanvassingStats();
    expect(result).toEqual({
      today: 15,
      week: 30,
      signed: 2,
      appointments: 4,
      streak: 7,
      multiplier: 1,
      total_points: 0,
    });
  });

  it('getCanvassingStats handles NaN/undefined values', async () => {
    apiGet.mockResolvedValueOnce({ ok: true, data: {} });
    const result = await harvestService.getCanvassingStats();
    expect(result.today).toBe(0);
    expect(result.multiplier).toBe(1);
  });

  it('getMapOverviewStats normalizes disposition data', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: {
        not_home: 10,
        not_interested: 5,
        callbacks: 3,
        appointments_set: 2,
        signed_contracts: 1,
      },
    });
    const result = await harvestService.getMapOverviewStats();
    expect(result.by_disposition).toEqual({
      not_home: 10,
      not_interested: 5,
      callback: 3,
      appointment: 2,
      signed: 1,
      do_not_knock: 0,
    });
  });

  it('getMapOverviewStats uses nested by_disposition', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: {
        by_disposition: { not_home: 7, not_interested: 3, callback: 2, appointment: 1, signed: 0, do_not_knock: 1 },
      },
    });
    const result = await harvestService.getMapOverviewStats();
    expect(result.by_disposition.not_home).toBe(7);
    expect(result.by_disposition.do_not_knock).toBe(1);
  });

  it('getTerritories normalizes array response', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: [
        { id: 't1', polygon: [[0, 0]], color: '#FF0000' },
        { id: 't2', coordinates: [[1, 1]] },
      ],
    });
    const result = await harvestService.getTerritories();
    expect(result).toHaveLength(2);
    expect(result[0].coordinates).toEqual([[0, 0]]);
    expect(result[0].color).toBe('#FF0000');
    expect(result[1].coordinates).toEqual([[1, 1]]);
    expect(result[1].color).toBe('#F97316'); // default color
  });

  it('getTerritories normalizes object with territories key', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: { territories: [{ id: 't1' }] },
    });
    const result = await harvestService.getTerritories();
    expect(result).toHaveLength(1);
  });

  it('getAdminUsers normalizes users with id extraction', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: [
        { _id: 'u1', name: 'Alice' },
        { user_id: 'u2', name: 'Bob' },
        { name: 'NoId' },
      ],
    });
    const result = await harvestService.getAdminUsers();
    expect(result).toHaveLength(2); // NoId user filtered out
    expect(result[0].id).toBe('u1');
    expect(result[1].id).toBe('u2');
  });

  it('getAdminUsers handles nested users object', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: { users: [{ id: 'u1' }] },
    });
    const result = await harvestService.getAdminUsers();
    expect(result).toHaveLength(1);
  });

  it('getAdminUsers falls through all three endpoints', async () => {
    apiGet
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'));
    await expect(harvestService.getAdminUsers()).rejects.toThrow();
  });

  it('getPins builds query string with territoryId and bounds', async () => {
    apiGet.mockResolvedValueOnce({ ok: true, data: [] });
    await harvestService.getPins({ territoryId: 't1', bounds: '27,-82,28,-81' });
    const url = apiGet.mock.calls[0][0];
    expect(url).toContain('territory_id=t1');
    expect(url).toContain('bounds=27%2C-82%2C28%2C-81');
  });

  it('getPins normalizes pin data', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: [
        { _id: 'p1', last_status: 'NA', visit_count: 3 },
      ],
    });
    const result = await harvestService.getPins();
    expect(result[0].id).toBe('p1');
    expect(result[0].disposition).toBe('no_answer');
    expect(result[0].visit_count).toBe(3);
  });

  it('getPins handles nested pins object', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: { pins: [{ id: 'p1', disposition: 'deal', visit_count: 1 }] },
    });
    const result = await harvestService.getPins();
    expect(result).toHaveLength(1);
    expect(result[0].disposition).toBe('deal');
  });

  it('logVisit tries canvassing-map first then harvest', async () => {
    apiPost
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, data: { logged: true } });
    const result = await harvestService.logVisit({ pin_id: 'p1', status: 'NA' });
    expect(result).toEqual({ logged: true });
    expect(apiPost).toHaveBeenCalledTimes(2);
  });

  it('getPinVisits tries two endpoints', async () => {
    apiGet
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, data: [{ visit: 1 }] });
    const result = await harvestService.getPinVisits('p1');
    expect(result).toEqual([{ visit: 1 }]);
  });
});

// ── tryRequests error propagation ─────────────────────────────────────

describe('harvestService tryRequests error handling', () => {
  it('propagates last caught error when all factories throw', async () => {
    apiGet
      .mockRejectedValueOnce(new Error('Network error 1'))
      .mockRejectedValueOnce(new Error('Network error 2'));
    await expect(harvestService.getCanvassingStats()).rejects.toThrow('Network error 2');
  });

  it('handles mix of failure responses and thrown errors', async () => {
    apiGet
      .mockResolvedValueOnce({ ok: false, error: 'Not found' })
      .mockRejectedValueOnce(new Error('Connection refused'));
    await expect(harvestService.getCanvassingStats()).rejects.toThrow('Connection refused');
  });
});
