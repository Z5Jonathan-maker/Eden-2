/**
 * Badge Assets - High-fidelity gaming-style badges and icons
 * ALL icons processed with rembg for TRUE transparent backgrounds
 * Operation Eden Tactical Platform
 */

// Main App Logo - Golden eagle emblem with transparent background
export const APP_LOGO = "/icons/app_logo.png";

// Feature Icons - AAA Quality with TRUE Transparent Backgrounds
export const FEATURE_ICONS = {
  agent_eve: "/icons/agent_eve.png",
  scales: "/icons/scales.png",
  garden: "/icons/garden.png",
  harvest: "/icons/harvest.png",
  recon: "/icons/recon.png",
  contracts: "/icons/contracts.png",
  doctrine: "/icons/doctrine.png",
};

// NEW 3D Page Icons - Premium AAA Quality (All stored locally)
export const PAGE_ICONS = {
  command_center: "/icons/command_center.png",
  my_card: "/icons/my_card.png",
  university: "/icons/university.png",
  vision_board: "/icons/vision_board.png",
  qa_shield: "/icons/qa_shield.png",
  settings_gear: "/icons/settings_gear.png",
  eve_ai: "/icons/agent_eve.png",
  battle_pass: "/icons/battle_pass.png",
  tactical_card_header: "/icons/tactical_card_header.png",
  tactical_avatar: "/icons/tactical_avatar.png",
};

// Navigation 3D Icons - Sidebar & Page Headers (All local)
export const NAV_ICONS = {
  command: "/icons/command_center.png",
  battle_pass: "/icons/battle_pass.png",
  my_card: "/icons/my_card.png",
  garden: "/icons/garden.png",
  recon: "/icons/recon.png",
  harvest: "/icons/harvest.png",
  sales_ops: "/icons/sales_ops.png",
  intel_hub: "/icons/intel_hub.png",
  scales: "/icons/scales.png",
  eve: "/icons/agent_eve.png",
  documents: "/icons/documents.png",
  contracts: "/icons/contracts.png",
  doctrine: "/icons/doctrine.png",
  experts: "/icons/experts.png",
  laws: "/icons/laws.png",
  storage: "/icons/storage.png",
  squad: "/icons/squad.png",
  data_ops: "/icons/data_ops.png",
  vision: "/icons/vision_board.png",
  settings: "/icons/settings_gear.png",
  adam_qa: "/icons/qa_shield.png",
  voice_assistant: "/icons/voice_assistant.png",
  incentives: "/icons/incentives.png",
  new_mission: "/icons/new_mission.png",
  weather: "/icons/weather.png",
  supplement: "/icons/documents.png",
  notion: "/icons/documents.png",
  course: "/icons/university.png",
  article: "/icons/doctrine.png",
  client_portal: "/icons/my_card.png",
  claim_detail: "/icons/garden.png",
  harvest_admin: "/icons/harvest.png",
  property_intel: "/icons/intel_hub.png",
};

// Tier Badge Images - ALL with transparent backgrounds
export const TIER_BADGES = {
  recruit: "/icons/tier_recruit.png",
  agent: "/icons/tier_agent.png",
  veteran: "/icons/tier_veteran.png",
  elite: "/icons/tier_elite.png",
  commander: "/icons/tier_commander.png",
  apex: "/icons/tier_apex.png",
  legend: "/icons/tier_legend.png",
  field_marshal: "/icons/tier_field_marshal.png",
};

// UI Icons - ALL with transparent backgrounds
export const UI_ICONS = {
  xp_orb: "/icons/ui_xp_orb.png",
  leaderboard_crown: "/icons/ui_leaderboard_crown.png",
  daily_streak: "/icons/ui_daily_streak.png",
  mission_complete: "/icons/ui_mission_complete.png",
};

// Map tier numbers to badge images
export const getTierBadge = (tier) => {
  if (tier >= 50) return TIER_BADGES.field_marshal;
  if (tier >= 40) return TIER_BADGES.legend;
  if (tier >= 35) return TIER_BADGES.apex;
  if (tier >= 25) return TIER_BADGES.commander;
  if (tier >= 20) return TIER_BADGES.elite;
  if (tier >= 15) return TIER_BADGES.veteran;
  if (tier >= 6) return TIER_BADGES.agent;
  return TIER_BADGES.recruit;
};

// Map rarity to badge
export const getRarityBadge = (rarity) => {
  switch (rarity) {
    case 'mythic': return TIER_BADGES.field_marshal;
    case 'legendary': return TIER_BADGES.legend;
    case 'epic': return TIER_BADGES.apex;
    case 'rare': return TIER_BADGES.elite;
    case 'uncommon': return TIER_BADGES.agent;
    default: return TIER_BADGES.recruit;
  }
};

// Tier configuration with badges
export const BATTLE_PASS_TIERS = [
  { tier: 1, badge: TIER_BADGES.recruit, name: "Recruit", rarity: "common" },
  { tier: 5, badge: TIER_BADGES.recruit, name: "Field Agent", rarity: "common" },
  { tier: 10, badge: TIER_BADGES.agent, name: "Specialist", rarity: "uncommon" },
  { tier: 15, badge: TIER_BADGES.veteran, name: "Veteran", rarity: "rare" },
  { tier: 20, badge: TIER_BADGES.elite, name: "Elite", rarity: "rare" },
  { tier: 25, badge: TIER_BADGES.commander, name: "Commander", rarity: "epic" },
  { tier: 35, badge: TIER_BADGES.apex, name: "Apex Closer", rarity: "epic" },
  { tier: 40, badge: TIER_BADGES.legend, name: "Legend", rarity: "legendary" },
  { tier: 45, badge: TIER_BADGES.legend, name: "Legendary", rarity: "legendary" },
  { tier: 50, badge: TIER_BADGES.field_marshal, name: "Field Marshal", rarity: "mythic" },
];

export default {
  APP_LOGO,
  FEATURE_ICONS,
  PAGE_ICONS,
  NAV_ICONS,
  TIER_BADGES,
  UI_ICONS,
  getTierBadge,
  getRarityBadge,
  BATTLE_PASS_TIERS,
};
