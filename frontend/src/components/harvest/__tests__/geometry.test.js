import { findTerritoryForPoint, normalizeTerritoryCoordinates } from '../geometry';

describe('harvest geometry safety', () => {
  test('normalizes mixed coordinate formats and drops invalid points', () => {
    const polygon = normalizeTerritoryCoordinates({
      coordinates: [
        [27.95, -82.46],
        { lat: '27.96', lng: '-82.45' },
        { latitude: 27.97, longitude: -82.44 },
        ['bad', 'data'],
      ],
    });

    expect(polygon).toHaveLength(3);
    expect(polygon[0]).toEqual({ lat: 27.95, lng: -82.46 });
  });

  test('supports [lng, lat] arrays and still finds containing territory', () => {
    const territory = {
      id: 't-1',
      coordinates: [
        [-82.47, 27.95],
        [-82.45, 27.95],
        [-82.45, 27.97],
        [-82.47, 27.97],
      ],
    };

    const found = findTerritoryForPoint(27.96, -82.46, [territory]);
    expect(found?.id).toBe('t-1');
  });

  test('returns null when no valid polygons exist', () => {
    const territory = { id: 'bad', coordinates: [{ lat: null, lng: undefined }] };
    const found = findTerritoryForPoint(27.96, -82.46, [territory]);
    expect(found).toBeNull();
  });
});
