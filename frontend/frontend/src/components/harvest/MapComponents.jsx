/**
 * Harvest Map Sub-components
 */

import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

/**
 * Map event controller for location and click handling
 */
export const MapController = ({ onLocationFound, onMapClick }) => {
  useMapEvents({
    locationfound(e) {
      onLocationFound?.(e.latlng);
    },
    click(e) {
      onMapClick?.(e.latlng);
    },
  });
  return null;
};

/**
 * Animated fly-to component
 */
export const FlyTo = ({ position, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom || 19, { duration: 0.5 });
  }, [position, zoom, map]);
  return null;
};
