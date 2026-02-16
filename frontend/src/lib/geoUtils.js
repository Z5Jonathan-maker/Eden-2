/**
 * geoUtils.js — Geodesic calculation utilities for Eden Claims OS
 *
 * All distance/area calculations use proper geodesic or local-projected math.
 * DO NOT compute area or length in raw lat/lng degrees.
 *
 * Coordinate convention: [lat, lng] arrays (WGS84).
 */

// ── Constants ──────────────────────────────────────────────────────
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_FT = 20_902_231;   // mean radius in feet
const EARTH_RADIUS_M  = 6_371_000;    // mean radius in meters
const FT_PER_M        = 3.28084;
const SQFT_PER_SQM    = 10.7639;

// ── Haversine distance ─────────────────────────────────────────────

/**
 * Haversine distance between two [lat, lng] points.
 * @param {number[]} a - [lat, lng]
 * @param {number[]} b - [lat, lng]
 * @returns {number} distance in feet
 */
export function haversineFt(a, b) {
  const dLat = (b[0] - a[0]) * DEG_TO_RAD;
  const dLng = (b[1] - a[1]) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat +
    Math.cos(a[0] * DEG_TO_RAD) * Math.cos(b[0] * DEG_TO_RAD) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_FT * Math.asin(Math.sqrt(h));
}

/**
 * Haversine distance in meters.
 */
export function haversineMeters(a, b) {
  return haversineFt(a, b) / FT_PER_M;
}

// ── Local projected coordinates ────────────────────────────────────

/**
 * Convert [lat, lng] points to local XY (feet) relative to a reference point.
 * Uses equirectangular projection — accurate at building scale (<1km).
 * @param {number[][]} points - Array of [lat, lng]
 * @param {number[]} [ref] - Reference point (default: first point)
 * @returns {number[][]} Array of [x, y] in feet
 */
export function toLocalFt(points, ref) {
  if (!points.length) return [];
  const refPt = ref || points[0];
  const ftPerDegLat = 364_320; // ~111km in feet
  const ftPerDegLng = ftPerDegLat * Math.cos(refPt[0] * DEG_TO_RAD);
  return points.map(([lat, lng]) => [
    (lng - refPt[1]) * ftPerDegLng,
    (lat - refPt[0]) * ftPerDegLat,
  ]);
}

// ── Polygon area ───────────────────────────────────────────────────

/**
 * Polygon area in sqft using local flat-Earth projection.
 * Accurate for building-scale polygons (<1km diameter).
 * @param {number[][]} points - Array of [lat, lng] (minimum 3)
 * @returns {number} area in square feet
 */
export function polygonAreaSqFt(points) {
  if (points.length < 3) return 0;
  const xy = toLocalFt(points);
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    area += xy[i][0] * xy[j][1];
    area -= xy[j][0] * xy[i][1];
  }
  return Math.abs(area / 2);
}

/**
 * Polygon area in square meters.
 */
export function polygonAreaSqM(points) {
  return polygonAreaSqFt(points) / SQFT_PER_SQM;
}

// ── Perimeter / polyline length ────────────────────────────────────

/**
 * Perimeter of a closed polygon in feet.
 * @param {number[][]} points - Array of [lat, lng]
 * @returns {number} perimeter in feet
 */
export function perimeterFt(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    total += haversineFt(points[i], points[(i + 1) % points.length]);
  }
  return total;
}

/**
 * Length of an open polyline in feet (does NOT close the shape).
 * @param {number[][]} points - Array of [lat, lng]
 * @returns {number} total length in feet
 */
export function polylineLengthFt(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineFt(points[i], points[i + 1]);
  }
  return total;
}

/**
 * Segment lengths of a polyline in feet.
 * @param {number[][]} points
 * @returns {number[]} array of segment lengths
 */
export function segmentLengthsFt(points) {
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push(haversineFt(points[i], points[i + 1]));
  }
  return segments;
}

// ── Unit conversions ───────────────────────────────────────────────

export function ftToM(ft) { return ft / FT_PER_M; }
export function mToFt(m) { return m * FT_PER_M; }
export function sqftToSqm(sqft) { return sqft / SQFT_PER_SQM; }
export function sqmToSqft(sqm) { return sqm * SQFT_PER_SQM; }
export function sqftToSquares(sqft) { return sqft / 100; } // 1 roofing square = 100 sqft

// ── Formatting ─────────────────────────────────────────────────────

/**
 * Format a distance value with appropriate unit.
 * @param {number} ft - value in feet
 * @param {'ft'|'m'} unit
 * @returns {string}
 */
export function formatDistance(ft, unit = 'ft') {
  if (unit === 'm') return `${ftToM(ft).toFixed(1)} m`;
  if (ft >= 1000) return `${(ft / 1000).toFixed(2)}k ft`;
  return `${Math.round(ft)} ft`;
}

/**
 * Format an area value with appropriate unit.
 * @param {number} sqft - value in square feet
 * @param {'sqft'|'sqm'|'squares'} unit
 * @returns {string}
 */
export function formatArea(sqft, unit = 'sqft') {
  if (unit === 'sqm') return `${sqftToSqm(sqft).toFixed(1)} m²`;
  if (unit === 'squares') return `${sqftToSquares(sqft).toFixed(1)} squares`;
  if (sqft >= 10000) return `${(sqft / 1000).toFixed(1)}k sq ft`;
  return `${Math.round(sqft)} sq ft`;
}

// ── Geometry helpers ───────────────────────────────────────────────

/**
 * Check if a point is near another point (within radius in feet).
 */
export function isNearby(a, b, radiusFt = 3) {
  return haversineFt(a, b) <= radiusFt;
}

/**
 * Find the nearest vertex index to a point.
 * @param {number[]} point - [lat, lng]
 * @param {number[][]} vertices - Array of [lat, lng]
 * @param {number} [maxDistFt=10] - max distance to consider
 * @returns {number} index or -1
 */
export function nearestVertexIndex(point, vertices, maxDistFt = 10) {
  let best = -1;
  let bestDist = maxDistFt;
  for (let i = 0; i < vertices.length; i++) {
    const d = haversineFt(point, vertices[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * Compute the centroid of a polygon.
 * @param {number[][]} points - Array of [lat, lng]
 * @returns {number[]} [lat, lng]
 */
export function centroid(points) {
  if (!points.length) return [0, 0];
  const lat = points.reduce((s, p) => s + p[0], 0) / points.length;
  const lng = points.reduce((s, p) => s + p[1], 0) / points.length;
  return [lat, lng];
}

/**
 * Compute bounding box of a set of points.
 * @param {number[][]} points
 * @returns {{ south: number, north: number, west: number, east: number }}
 */
export function boundingBox(points) {
  if (!points.length) return { south: 0, north: 0, west: 0, east: 0 };
  let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
  for (const [lat, lng] of points) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, north, west, east };
}

// ── Artifact serialization ─────────────────────────────────────────

/**
 * Serialize a measurement artifact for storage/transport.
 * @param {Object} artifact
 * @returns {Object} serialized artifact (JSON-safe)
 */
export function serializeArtifact(artifact) {
  return {
    type: artifact.type, // 'distance' | 'area' | 'perimeter' | 'polygon' | 'roofFacet' | 'annotation'
    label: artifact.label || '',
    points: artifact.points.map(([lat, lng]) => ({ lat, lng })),
    computed: {
      ...(artifact.type === 'distance' && {
        totalFt: polylineLengthFt(artifact.points),
        segments: segmentLengthsFt(artifact.points),
      }),
      ...((['area', 'polygon', 'roofFacet'].includes(artifact.type)) && {
        areaSqFt: polygonAreaSqFt(artifact.points),
        perimeterFt: perimeterFt(artifact.points),
        squares: sqftToSquares(polygonAreaSqFt(artifact.points)),
      }),
      ...(artifact.type === 'perimeter' && {
        perimeterFt: perimeterFt(artifact.points),
      }),
    },
    meta: {
      provider: artifact.provider || 'esri_wayback',
      imageryDate: artifact.imageryDate || null,
      zoom: artifact.zoom || null,
      bbox: artifact.points.length ? boundingBox(artifact.points) : null,
      projectionMethod: 'equirectangular_local_ft',
      createdAt: artifact.createdAt || new Date().toISOString(),
      createdBy: artifact.createdBy || null,
    },
  };
}

/**
 * Deserialize a stored artifact back to working format.
 * @param {Object} stored
 * @returns {Object}
 */
export function deserializeArtifact(stored) {
  const points = (stored.points || []).map(p =>
    Array.isArray(p) ? p : [p.lat, p.lng]
  );
  return {
    id: stored.id || stored._id,
    type: stored.type,
    label: stored.label || '',
    points,
    computed: stored.computed || {},
    meta: stored.meta || {},
    claimId: stored.claimId || stored.claim_id || null,
    sessionId: stored.sessionId || stored.session_id || null,
  };
}

// Export constants for tests
export { DEG_TO_RAD, EARTH_RADIUS_FT, FT_PER_M, SQFT_PER_SQM };
