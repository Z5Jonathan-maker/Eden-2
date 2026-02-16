import { describe, it, expect } from 'vitest';
import {
  haversineFt,
  haversineMeters,
  toLocalFt,
  polygonAreaSqFt,
  polygonAreaSqM,
  perimeterFt,
  polylineLengthFt,
  segmentLengthsFt,
  formatDistance,
  formatArea,
  sqftToSquares,
  ftToM,
  mToFt,
  sqftToSqm,
  sqmToSqft,
  isNearby,
  nearestVertexIndex,
  centroid,
  boundingBox,
  serializeArtifact,
  deserializeArtifact,
} from './geoUtils';

// ── Known reference points ──────────────────────────────────────────
// Tampa, FL area — typical property imagery coords
const TAMPA_A = [27.9506, -82.4572]; // Downtown Tampa
const TAMPA_B = [27.9510, -82.4572]; // ~146 ft north

// A simple 100ft x 100ft square (approx) at building scale
// At lat 27.95: 1 degree lat ≈ 364,320 ft, 1 degree lng ≈ 322,127 ft
const SQUARE_100FT = [
  [27.950000, -82.457200],
  [27.950000, -82.456889], // ~100ft east
  [27.950274, -82.456889], // ~100ft north
  [27.950274, -82.457200], // back west
];

// ── Haversine distance ──────────────────────────────────────────────

describe('haversineFt', () => {
  it('returns 0 for identical points', () => {
    expect(haversineFt(TAMPA_A, TAMPA_A)).toBe(0);
  });

  it('computes distance within 5% of known value', () => {
    // 0.0004 degrees lat ≈ 145.7 ft
    const dist = haversineFt(TAMPA_A, TAMPA_B);
    expect(dist).toBeGreaterThan(130);
    expect(dist).toBeLessThan(160);
  });

  it('is symmetric', () => {
    const ab = haversineFt(TAMPA_A, TAMPA_B);
    const ba = haversineFt(TAMPA_B, TAMPA_A);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('handles longitude-only offset', () => {
    const a = [27.95, -82.46];
    const b = [27.95, -82.459]; // ~0.001 deg lng ≈ 322 ft at this lat
    const dist = haversineFt(a, b);
    expect(dist).toBeGreaterThan(280);
    expect(dist).toBeLessThan(360);
  });
});

describe('haversineMeters', () => {
  it('returns meters = feet / 3.28084', () => {
    const ft = haversineFt(TAMPA_A, TAMPA_B);
    const m = haversineMeters(TAMPA_A, TAMPA_B);
    expect(m).toBeCloseTo(ft / 3.28084, 2);
  });
});

// ── Local projection ────────────────────────────────────────────────

describe('toLocalFt', () => {
  it('returns [0,0] for reference point', () => {
    const result = toLocalFt([TAMPA_A], TAMPA_A);
    expect(result[0][0]).toBe(0);
    expect(result[0][1]).toBe(0);
  });

  it('returns empty array for empty input', () => {
    expect(toLocalFt([])).toEqual([]);
  });

  it('projects north offset to positive Y', () => {
    const result = toLocalFt([TAMPA_A, TAMPA_B], TAMPA_A);
    expect(result[1][1]).toBeGreaterThan(0); // north = positive Y
    expect(Math.abs(result[1][0])).toBeLessThan(1); // same longitude = near-zero X
  });
});

// ── Polygon area ────────────────────────────────────────────────────

describe('polygonAreaSqFt', () => {
  it('returns 0 for fewer than 3 points', () => {
    expect(polygonAreaSqFt([])).toBe(0);
    expect(polygonAreaSqFt([[0, 0]])).toBe(0);
    expect(polygonAreaSqFt([[0, 0], [1, 1]])).toBe(0);
  });

  it('computes ~10,000 sqft for 100x100 ft square', () => {
    const area = polygonAreaSqFt(SQUARE_100FT);
    // Should be approximately 10,000 sqft (100 x 100)
    expect(area).toBeGreaterThan(8000);
    expect(area).toBeLessThan(12000);
  });

  it('is independent of winding direction', () => {
    const cw = polygonAreaSqFt(SQUARE_100FT);
    const ccw = polygonAreaSqFt([...SQUARE_100FT].reverse());
    expect(cw).toBeCloseTo(ccw, 0);
  });

  it('triangle area is half of enclosing rectangle', () => {
    const triangle = [
      SQUARE_100FT[0],
      SQUARE_100FT[1],
      SQUARE_100FT[2],
    ];
    const triArea = polygonAreaSqFt(triangle);
    const rectArea = polygonAreaSqFt(SQUARE_100FT);
    // Triangle should be ~half the rectangle
    expect(triArea / rectArea).toBeCloseTo(0.5, 1);
  });
});

describe('polygonAreaSqM', () => {
  it('converts sqft to sqm', () => {
    const sqft = polygonAreaSqFt(SQUARE_100FT);
    const sqm = polygonAreaSqM(SQUARE_100FT);
    expect(sqm).toBeCloseTo(sqft / 10.7639, 0);
  });
});

// ── Perimeter / polyline length ─────────────────────────────────────

describe('perimeterFt', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(perimeterFt([])).toBe(0);
    expect(perimeterFt([[0, 0]])).toBe(0);
  });

  it('computes ~400 ft perimeter for 100x100 ft square', () => {
    const p = perimeterFt(SQUARE_100FT);
    expect(p).toBeGreaterThan(350);
    expect(p).toBeLessThan(450);
  });

  it('closes the polygon (includes last→first segment)', () => {
    const line = polylineLengthFt(SQUARE_100FT);
    const closed = perimeterFt(SQUARE_100FT);
    // Perimeter should be longer than open polyline (adds closing segment)
    expect(closed).toBeGreaterThan(line);
  });
});

describe('polylineLengthFt', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(polylineLengthFt([])).toBe(0);
    expect(polylineLengthFt([[0, 0]])).toBe(0);
  });

  it('equals haversine for 2 points', () => {
    const length = polylineLengthFt([TAMPA_A, TAMPA_B]);
    const direct = haversineFt(TAMPA_A, TAMPA_B);
    expect(length).toBeCloseTo(direct, 6);
  });

  it('does NOT close the shape', () => {
    // For a triangle, polyline should be 3 segments, not 3 + closing
    const tri = [SQUARE_100FT[0], SQUARE_100FT[1], SQUARE_100FT[2]];
    const length = polylineLengthFt(tri);
    const seg1 = haversineFt(tri[0], tri[1]);
    const seg2 = haversineFt(tri[1], tri[2]);
    expect(length).toBeCloseTo(seg1 + seg2, 2);
  });
});

describe('segmentLengthsFt', () => {
  it('returns individual segment lengths', () => {
    const segs = segmentLengthsFt([TAMPA_A, TAMPA_B, SQUARE_100FT[1]]);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toBeCloseTo(haversineFt(TAMPA_A, TAMPA_B), 2);
  });

  it('sums to polyline length', () => {
    const pts = SQUARE_100FT;
    const segs = segmentLengthsFt(pts);
    const total = segs.reduce((a, b) => a + b, 0);
    const polyline = polylineLengthFt(pts);
    expect(total).toBeCloseTo(polyline, 2);
  });
});

// ── Unit conversions ────────────────────────────────────────────────

describe('unit conversions', () => {
  it('ftToM and mToFt are inverses', () => {
    expect(mToFt(ftToM(100))).toBeCloseTo(100, 4);
  });

  it('sqftToSqm and sqmToSqft are inverses', () => {
    expect(sqmToSqft(sqftToSqm(1000))).toBeCloseTo(1000, 2);
  });

  it('sqftToSquares: 100 sqft = 1 square', () => {
    expect(sqftToSquares(100)).toBe(1);
    expect(sqftToSquares(2500)).toBe(25);
  });
});

// ── Formatting ──────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('formats small distances in ft', () => {
    expect(formatDistance(42)).toBe('42 ft');
  });

  it('formats large distances with k suffix', () => {
    expect(formatDistance(1500)).toBe('1.50k ft');
  });

  it('formats in meters', () => {
    expect(formatDistance(100, 'm')).toMatch(/\d+\.\d+ m/);
  });
});

describe('formatArea', () => {
  it('formats small areas in sqft', () => {
    expect(formatArea(1234)).toBe('1234 sq ft');
  });

  it('formats large areas with k suffix', () => {
    expect(formatArea(15000)).toBe('15.0k sq ft');
  });

  it('formats in squares', () => {
    expect(formatArea(2500, 'squares')).toBe('25.0 squares');
  });

  it('formats in sqm', () => {
    expect(formatArea(1000, 'sqm')).toMatch(/\d+\.\d+ m²/);
  });
});

// ── Geometry helpers ────────────────────────────────────────────────

describe('isNearby', () => {
  it('returns true for identical points', () => {
    expect(isNearby(TAMPA_A, TAMPA_A)).toBe(true);
  });

  it('returns false for distant points', () => {
    expect(isNearby(TAMPA_A, TAMPA_B, 3)).toBe(false);
  });

  it('respects custom radius', () => {
    const dist = haversineFt(TAMPA_A, TAMPA_B);
    expect(isNearby(TAMPA_A, TAMPA_B, dist + 1)).toBe(true);
    expect(isNearby(TAMPA_A, TAMPA_B, dist - 1)).toBe(false);
  });
});

describe('nearestVertexIndex', () => {
  it('finds exact match', () => {
    const idx = nearestVertexIndex(SQUARE_100FT[2], SQUARE_100FT, 50);
    expect(idx).toBe(2);
  });

  it('returns -1 when no vertex within range', () => {
    const farPoint = [28.0, -82.0];
    expect(nearestVertexIndex(farPoint, SQUARE_100FT, 10)).toBe(-1);
  });
});

describe('centroid', () => {
  it('returns center of square', () => {
    const c = centroid(SQUARE_100FT);
    const expectedLat = SQUARE_100FT.reduce((s, p) => s + p[0], 0) / 4;
    const expectedLng = SQUARE_100FT.reduce((s, p) => s + p[1], 0) / 4;
    expect(c[0]).toBeCloseTo(expectedLat, 6);
    expect(c[1]).toBeCloseTo(expectedLng, 6);
  });

  it('returns [0,0] for empty input', () => {
    expect(centroid([])).toEqual([0, 0]);
  });
});

describe('boundingBox', () => {
  it('computes correct bounds', () => {
    const bb = boundingBox(SQUARE_100FT);
    expect(bb.south).toBe(27.950000);
    expect(bb.north).toBe(27.950274);
    expect(bb.west).toBe(-82.457200);
    expect(bb.east).toBe(-82.456889);
  });

  it('handles empty input', () => {
    const bb = boundingBox([]);
    expect(bb.south).toBe(0);
  });
});

// ── Artifact serialization ──────────────────────────────────────────

describe('serializeArtifact', () => {
  it('serializes a distance artifact', () => {
    const artifact = {
      type: 'distance',
      label: 'Test distance',
      points: [TAMPA_A, TAMPA_B],
      provider: 'esri_wayback',
      imageryDate: '2023-06-15',
      zoom: 19,
    };
    const s = serializeArtifact(artifact);
    expect(s.type).toBe('distance');
    expect(s.computed.totalFt).toBeGreaterThan(0);
    expect(s.computed.segments).toHaveLength(1);
    expect(s.meta.provider).toBe('esri_wayback');
    expect(s.meta.projectionMethod).toBe('equirectangular_local_ft');
    expect(s.points).toHaveLength(2);
    expect(s.points[0]).toHaveProperty('lat');
    expect(s.points[0]).toHaveProperty('lng');
  });

  it('serializes an area artifact with computed values', () => {
    const artifact = {
      type: 'area',
      label: 'Test area',
      points: SQUARE_100FT,
    };
    const s = serializeArtifact(artifact);
    expect(s.computed.areaSqFt).toBeGreaterThan(8000);
    expect(s.computed.perimeterFt).toBeGreaterThan(350);
    expect(s.computed.squares).toBeGreaterThan(80);
  });

  it('serializes a roofFacet like area', () => {
    const artifact = {
      type: 'roofFacet',
      label: 'Main Roof',
      points: SQUARE_100FT,
    };
    const s = serializeArtifact(artifact);
    expect(s.computed.areaSqFt).toBeGreaterThan(0);
    expect(s.meta.bbox).toBeDefined();
  });
});

describe('deserializeArtifact', () => {
  it('converts {lat, lng} objects back to [lat, lng] arrays', () => {
    const stored = {
      id: 'test-id',
      type: 'area',
      label: 'Test',
      points: [{ lat: 27.95, lng: -82.46 }, { lat: 27.96, lng: -82.45 }],
      computed: { areaSqFt: 10000 },
      meta: {},
    };
    const d = deserializeArtifact(stored);
    expect(d.id).toBe('test-id');
    expect(d.points[0]).toEqual([27.95, -82.46]);
    expect(d.points[1]).toEqual([27.96, -82.45]);
  });

  it('passes through [lat, lng] arrays unchanged', () => {
    const stored = {
      _id: 'mongo-id',
      type: 'distance',
      points: [[27.95, -82.46]],
      computed: {},
    };
    const d = deserializeArtifact(stored);
    expect(d.id).toBe('mongo-id');
    expect(d.points[0]).toEqual([27.95, -82.46]);
  });

  it('handles missing fields gracefully', () => {
    const d = deserializeArtifact({ type: 'annotation' });
    expect(d.points).toEqual([]);
    expect(d.label).toBe('');
    expect(d.computed).toEqual({});
  });
});
