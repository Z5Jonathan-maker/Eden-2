/**
 * Harvest Module Utilities
 */

import L from 'leaflet';
import { STATUSES } from './constants';

/**
 * Calculate distance between two coordinates (in miles)
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (![nLat1, nLon1, nLat2, nLon2].every(Number.isFinite)) {
    return '--';
  }

  const R = 3959; // Earth's radius in miles
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number.isFinite(R * c) ? (R * c).toFixed(2) : '--';
};

/**
 * Create an Enzy-style map pin icon
 */
export const createEnzyPin = (status, pinId, isSelected = false) => {
  const config = STATUSES[status] || STATUSES.unmarked;
  const size = isSelected ? 48 : 40;
  const borderColor = isSelected ? '#F97316' : '#FFFFFF';
  const borderWidth = isSelected ? 4 : 3;

  const iconSvg = {
    unmarked:
      '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    not_home:
      '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    not_interested: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    do_not_knock: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    callback:
      '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/>',
    appointment:
      '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    signed: '<polyline points="20 6 9 17 4 12"/>',
    renter: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  };

  return L.divIcon({
    className: 'enzy-pin',
    html: `
      <div 
        data-pin-id="${pinId}"
        class="enzy-pin-inner"
        style="
          width: ${size}px;
          height: ${size}px;
          background: ${config.color};
          border-radius: 50%;
          border: ${borderWidth}px solid ${borderColor};
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          ${isSelected ? 'animation: selectedPulse 1.5s ease-in-out infinite;' : ''}
        ">
        <svg width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${iconSvg[status] || iconSvg.unmarked}
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

/**
 * Create user location beacon icon
 */
export const userBeacon = L.divIcon({
  className: 'user-beacon',
  html: `
    <div style="
      width: 20px; height: 20px;
      background: linear-gradient(135deg, #3B82F6, #1D4ED8);
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 0 0 rgba(59,130,246,0.5);
      animation: userPulse 2s ease-in-out infinite;
    "></div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/**
 * Copy text to clipboard with toast notification
 */
export const copyToClipboard = async (text, toast) => {
  try {
    await navigator.clipboard.writeText(text);
    toast?.success('Copied!', { duration: 1000 });
  } catch {
    toast?.error('Failed to copy');
  }
};
