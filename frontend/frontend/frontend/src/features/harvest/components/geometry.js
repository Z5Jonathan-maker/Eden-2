const coerceNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
};

export const normalizeTerritoryCoordinates = (territory) => {
  const raw = territory?.coordinates || territory?.polygon || [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const first = coerceNumber(point[0]);
        const second = coerceNumber(point[1]);
        let lat = first;
        let lng = second;
        // Accept both [lat,lng] and [lng,lat] ordering.
        if (
          Number.isFinite(lat) &&
          Number.isFinite(lng) &&
          Math.abs(lat) > 90 &&
          Math.abs(lng) <= 90
        ) {
          const tmp = lat;
          lat = lng;
          lng = tmp;
        } else if (
          Number.isFinite(first) &&
          Number.isFinite(second) &&
          // Florida heuristic: imported polygon arrays are commonly [lng, lat]
          first < 0 &&
          second > 0 &&
          Math.abs(first) <= 180 &&
          Math.abs(second) <= 90
        ) {
          lat = second;
          lng = first;
        }
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      const lat = coerceNumber(point?.lat ?? point?.latitude);
      const lng = coerceNumber(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })
    .filter(Boolean);
};

export const pointInPolygon = (lat, lng, polygonPoints) => {
  if (!Array.isArray(polygonPoints) || polygonPoints.length < 3) return false;
  let inside = false;

  for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
    const xi = polygonPoints[i].lng;
    const yi = polygonPoints[i].lat;
    const xj = polygonPoints[j].lng;
    const yj = polygonPoints[j].lat;
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
};

export const findTerritoryForPoint = (lat, lng, territories = []) => {
  for (const territory of territories) {
    const polygon = normalizeTerritoryCoordinates(territory);
    if (pointInPolygon(lat, lng, polygon)) return territory;
  }
  return null;
};
