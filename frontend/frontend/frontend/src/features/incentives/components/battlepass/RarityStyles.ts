import { Rarity } from './types';

export const rarityBorderClass: Record<Rarity, string> = {
  common: 'bp-rarity-common',
  uncommon: 'bp-rarity-uncommon',
  rare: 'bp-rarity-rare',
  epic: 'bp-rarity-epic',
  legendary: 'bp-rarity-legendary',
  mythic: 'bp-rarity-mythic',
};

export const rarityTextClass: Record<Rarity, string> = {
  common: 'text-zinc-300',
  uncommon: 'text-emerald-300',
  rare: 'text-cyan-300',
  epic: 'text-violet-300',
  legendary: 'text-amber-300',
  mythic: 'text-rose-300',
};

export const rarityGlowColor: Record<Rarity, string> = {
  common: 'rgba(161,161,170,0.8)',
  uncommon: 'rgba(52,211,153,0.9)',
  rare: 'rgba(56,189,248,0.9)',
  epic: 'rgba(167,139,250,0.95)',
  legendary: 'rgba(251,191,36,0.95)',
  mythic: 'rgba(251,113,133,1)',
};
