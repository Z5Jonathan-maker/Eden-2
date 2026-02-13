/**
 * Battle pass tier definitions adapted from the Eden full-drop spec.
 * Kept as plain JS for compatibility with the existing CRA stack.
 */
export const battlePassTiers = [
  {
    id: 'tier-1',
    level: 1,
    xpRequired: 0,
    reward: {
      id: 'badge-bronze',
      name: 'Bronze Operator Badge',
      description: 'Entry-level recognition for new operators.',
      iconUrl: '/icons/tier_recruit.png',
      rarity: 'common',
    },
  },
  {
    id: 'tier-2',
    level: 2,
    xpRequired: 100,
    reward: {
      id: 'badge-silver',
      name: 'Silver Recon Emblem',
      description: 'Awarded for consistent mission performance.',
      iconUrl: '/icons/tier_agent.png',
      rarity: 'uncommon',
    },
  },
  {
    id: 'tier-3',
    level: 3,
    xpRequired: 250,
    reward: {
      id: 'badge-gold',
      name: 'Gold Field Commander Crest',
      description: 'Reserved for elite field leaders.',
      iconUrl: '/icons/tier_veteran.png',
      rarity: 'rare',
    },
  },
  {
    id: 'tier-4',
    level: 4,
    xpRequired: 500,
    reward: {
      id: 'badge-elite',
      name: 'Elite Tactical Insignia',
      description: 'Marks operators with exceptional tactical performance.',
      iconUrl: '/icons/tier_elite.png',
      rarity: 'epic',
    },
  },
  {
    id: 'tier-5',
    level: 5,
    xpRequired: 900,
    reward: {
      id: 'badge-legendary',
      name: 'Legendary Eden Crest',
      description: 'Awarded to top 1% performers across Eden.',
      iconUrl: '/icons/tier_legend.png',
      rarity: 'legendary',
    },
  },
  {
    id: 'tier-6',
    level: 6,
    xpRequired: 1400,
    reward: {
      id: 'badge-mythic',
      name: 'Mythic Vanguard Seal',
      description: 'Reserved for unmatched mythic-tier operators.',
      iconUrl: '/icons/tier_field_marshal.png',
      rarity: 'mythic',
    },
  },
];
