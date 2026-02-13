/**
 * Harvest Module Constants
 * Centralized configuration for the canvassing/harvest system
 */

import { Home, Phone, Calendar, Check, X, User } from 'lucide-react';

// Pin status configuration (Enzy-style)
export const STATUSES = {
  unmarked: { label: 'Unmarked', color: '#9CA3AF', bgClass: 'bg-gray-400', icon: Home },
  not_home: {
    label: 'Not Home',
    color: '#FBBF24',
    bgClass: 'bg-yellow-400',
    icon: Home,
    key: 'NH',
  },
  not_interested: {
    label: 'Not Interested',
    color: '#EF4444',
    bgClass: 'bg-red-500',
    icon: X,
    key: 'NI',
  },
  callback: {
    label: 'Callback',
    color: '#8B5CF6',
    bgClass: 'bg-purple-500',
    icon: Phone,
    key: 'CB',
  },
  appointment: {
    label: 'Appointment',
    color: '#3B82F6',
    bgClass: 'bg-blue-500',
    icon: Calendar,
    key: 'AP',
  },
  signed: { label: 'Signed', color: '#10B981', bgClass: 'bg-green-500', icon: Check, key: 'SG' },
  do_not_knock: { label: 'DNK', color: '#1F2937', bgClass: 'bg-gray-800', icon: X, key: 'DNK' },
  renter: { label: 'Renter', color: '#F97316', bgClass: 'bg-orange-500', icon: User, key: 'RN' },
};

// Map tile layer configurations
export const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    name: 'Satellite',
  },
  hybrid: {
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    name: 'Hybrid',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: ['a', 'b', 'c'],
    name: 'Street',
  },
};

// Default map center (Tampa, FL)
export const DEFAULT_CENTER = [27.9506, -82.4572];

// Badge rarity colors
export const RARITY_COLORS = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-500',
};
