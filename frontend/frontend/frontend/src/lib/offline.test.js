/**
 * Tests for offline.js — IndexedDB photo storage via idb-keyval
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock idb-keyval ──────────────────────────────────────────────────

const store = new Map();

vi.mock('idb-keyval', () => ({
  set: vi.fn((key, value) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  get: vi.fn((key) => Promise.resolve(store.get(key) ?? undefined)),
  del: vi.fn((key) => {
    store.delete(key);
    return Promise.resolve();
  }),
  keys: vi.fn(() => Promise.resolve([...store.keys()])),
}));

// Import after mocking
const { OfflineService } = await import('./offline.js');

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

// ── savePhoto ────────────────────────────────────────────────────────

describe('OfflineService.savePhoto', () => {
  it('saves a photo for a claim', async () => {
    await OfflineService.savePhoto('claim-1', { id: 'photo-1', data: 'blob1' });

    const photos = await OfflineService.getPhotos('claim-1');
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe('photo-1');
  });

  it('appends multiple photos for same claim', async () => {
    await OfflineService.savePhoto('claim-1', { id: 'p1', data: 'a' });
    await OfflineService.savePhoto('claim-1', { id: 'p2', data: 'b' });

    const photos = await OfflineService.getPhotos('claim-1');
    expect(photos).toHaveLength(2);
    expect(photos[0].id).toBe('p1');
    expect(photos[1].id).toBe('p2');
  });

  it('updates existing photo if same id', async () => {
    await OfflineService.savePhoto('claim-1', { id: 'p1', data: 'original' });
    await OfflineService.savePhoto('claim-1', { id: 'p1', data: 'updated' });

    const photos = await OfflineService.getPhotos('claim-1');
    expect(photos).toHaveLength(1);
    expect(photos[0].data).toBe('updated');
  });

  it('does nothing when claimId is falsy', async () => {
    await OfflineService.savePhoto(null, { id: 'p1' });
    await OfflineService.savePhoto('', { id: 'p1' });
    await OfflineService.savePhoto(undefined, { id: 'p1' });

    expect(store.size).toBe(0);
  });

  it('does nothing when photo is falsy', async () => {
    await OfflineService.savePhoto('claim-1', null);
    await OfflineService.savePhoto('claim-1', undefined);

    expect(store.size).toBe(0);
  });

  it('stores photos under correct key prefix', async () => {
    await OfflineService.savePhoto('abc', { id: 'p1', data: 'x' });

    expect(store.has('rapid_capture_photos_abc')).toBe(true);
  });
});

// ── getPhotos ────────────────────────────────────────────────────────

describe('OfflineService.getPhotos', () => {
  it('returns empty array when no photos saved', async () => {
    const photos = await OfflineService.getPhotos('empty-claim');
    expect(photos).toEqual([]);
  });

  it('returns empty array when claimId is falsy', async () => {
    expect(await OfflineService.getPhotos(null)).toEqual([]);
    expect(await OfflineService.getPhotos('')).toEqual([]);
    expect(await OfflineService.getPhotos(undefined)).toEqual([]);
  });

  it('returns photos that were saved', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1', name: 'front.jpg' });
    await OfflineService.savePhoto('c1', { id: 'p2', name: 'back.jpg' });

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(2);
    expect(photos.map(p => p.name)).toEqual(['front.jpg', 'back.jpg']);
  });

  it('returns photos only for the specified claim', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.savePhoto('c2', { id: 'p2' });

    const photos1 = await OfflineService.getPhotos('c1');
    const photos2 = await OfflineService.getPhotos('c2');

    expect(photos1).toHaveLength(1);
    expect(photos1[0].id).toBe('p1');
    expect(photos2).toHaveLength(1);
    expect(photos2[0].id).toBe('p2');
  });
});

// ── deletePhoto ──────────────────────────────────────────────────────

describe('OfflineService.deletePhoto', () => {
  it('deletes a specific photo by id', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1', data: 'a' });
    await OfflineService.savePhoto('c1', { id: 'p2', data: 'b' });

    await OfflineService.deletePhoto('c1', 'p1');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe('p2');
  });

  it('does nothing when claimId is falsy', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.deletePhoto(null, 'p1');
    await OfflineService.deletePhoto('', 'p1');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(1);
  });

  it('does nothing when photoId is falsy', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.deletePhoto('c1', null);
    await OfflineService.deletePhoto('c1', '');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(1);
  });

  it('handles deleting non-existent photo gracefully', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.deletePhoto('c1', 'nonexistent');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(1);
  });

  it('handles deleting from non-existent claim gracefully', async () => {
    // Should not throw
    await OfflineService.deletePhoto('nonexistent', 'p1');
  });
});

// ── clearPhotos ──────────────────────────────────────────────────────

describe('OfflineService.clearPhotos', () => {
  it('clears all photos for a claim', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.savePhoto('c1', { id: 'p2' });

    await OfflineService.clearPhotos('c1');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toEqual([]);
  });

  it('does not affect other claims', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.savePhoto('c2', { id: 'p2' });

    await OfflineService.clearPhotos('c1');

    const photos2 = await OfflineService.getPhotos('c2');
    expect(photos2).toHaveLength(1);
  });

  it('does nothing when claimId is falsy', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.clearPhotos(null);
    await OfflineService.clearPhotos('');

    const photos = await OfflineService.getPhotos('c1');
    expect(photos).toHaveLength(1);
  });
});

// ── getClaimsWithOfflineData ─────────────────────────────────────────

describe('OfflineService.getClaimsWithOfflineData', () => {
  it('returns empty array when no offline data', async () => {
    const claims = await OfflineService.getClaimsWithOfflineData();
    expect(claims).toEqual([]);
  });

  it('returns claim IDs that have offline photos', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    await OfflineService.savePhoto('c2', { id: 'p2' });

    const claims = await OfflineService.getClaimsWithOfflineData();
    expect(claims).toContain('c1');
    expect(claims).toContain('c2');
    expect(claims).toHaveLength(2);
  });

  it('does not include non-photo keys', async () => {
    await OfflineService.savePhoto('c1', { id: 'p1' });
    // Manually add a non-photo key
    store.set('some_other_key', 'value');

    const claims = await OfflineService.getClaimsWithOfflineData();
    expect(claims).toEqual(['c1']);
  });

  it('strips the key prefix to return clean claim IDs', async () => {
    await OfflineService.savePhoto('my-claim-123', { id: 'p1' });

    const claims = await OfflineService.getClaimsWithOfflineData();
    expect(claims).toEqual(['my-claim-123']);
  });

  it('handles non-string keys from idb-keyval gracefully', async () => {
    // idb-keyval can store IDBValidKey types (numbers, etc.)
    store.set(123, 'numeric key');
    await OfflineService.savePhoto('c1', { id: 'p1' });

    const claims = await OfflineService.getClaimsWithOfflineData();
    expect(claims).toEqual(['c1']);
  });
});
