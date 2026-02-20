/**
 * Harvest Module Constants — DoorMamba-class 6-pin system
 * Centralized configuration for the canvassing/harvest system
 */

import { Home, Phone, Calendar, Check, X, User, DoorOpen, FileText, Handshake } from 'lucide-react';

// DoorMamba-class 6-pin status system
export const STATUSES = {
  no_answer: {
    label: 'No Answer',
    color: '#FBBF24',
    bgClass: 'bg-amber-400',
    icon: DoorOpen,
    key: 'NA',
  },
  not_interested: {
    label: 'Not Interested',
    color: '#EF4444',
    bgClass: 'bg-red-500',
    icon: X,
    key: 'NI',
  },
  renter: {
    label: 'Renter',
    color: '#F97316',
    bgClass: 'bg-orange-500',
    icon: Home,
    key: 'RN',
  },
  follow_up: {
    label: 'Follow Up',
    color: '#8B5CF6',
    bgClass: 'bg-purple-500',
    icon: FileText,
    key: 'FU',
  },
  appointment: {
    label: 'Appointment',
    color: '#3B82F6',
    bgClass: 'bg-blue-500',
    icon: Calendar,
    key: 'AP',
  },
  deal: {
    label: 'Deal',
    color: '#10B981',
    bgClass: 'bg-green-500',
    icon: Handshake,
    key: 'DL',
  },
};

// Quick lookup by status code
export const STATUS_BY_CODE = Object.fromEntries(
  Object.entries(STATUSES).map(([disposition, info]) => [info.key, { ...info, disposition }])
);

// Field Mode pin configuration — the 6-button quick-tap order
export const FIELD_MODE_PINS = [
  { code: 'NA', label: 'No Answer', color: '#FBBF24', shortLabel: 'NA', tier: 'cold' },
  { code: 'NI', label: 'Not Interested', color: '#EF4444', shortLabel: 'NI', tier: 'cold' },
  { code: 'RN', label: 'Renter', color: '#F97316', shortLabel: 'RN', tier: 'cold' },
  { code: 'FU', label: 'Follow Up', color: '#8B5CF6', shortLabel: 'FU', tier: 'warm' },
  { code: 'AP', label: 'Appointment', color: '#3B82F6', shortLabel: 'AP', tier: 'warm' },
  { code: 'DL', label: 'Deal', color: '#10B981', shortLabel: 'DL', tier: 'hot' },
];

// Pin state machine — forward-only progression for warm/hot pins
export const PIN_STATE_MACHINE = {
  NA: ['NI', 'RN', 'FU', 'AP'],
  NI: ['FU', 'AP'],
  RN: ['FU'],
  FU: ['AP', 'DL'],
  AP: ['DL'],
  DL: [],
};

// Map defaults
export const DEFAULT_CENTER = { lat: 27.9506, lng: -82.4572 }; // Tampa, FL
export const DEFAULT_ZOOM = 17;
export const FIELD_MODE_ZOOM = 19;

// Badge rarity colors
export const RARITY_COLORS = {
  common: 'bg-gray-500',
  uncommon: 'bg-green-500',
  rare: 'bg-blue-500',
  epic: 'bg-purple-500',
  legendary: 'bg-yellow-500',
};
