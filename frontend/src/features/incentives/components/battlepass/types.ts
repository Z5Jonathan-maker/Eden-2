export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Reward {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  rarity: Rarity;
}

export interface BattlePassTier {
  id: string;
  level: number;
  xpRequired: number;
  reward: Reward;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  type: 'daily' | 'weekly' | 'seasonal';
  progress: number;
  target: number;
  xp: number;
}

export interface BattlePassState {
  currentXp: number;
  currentLevel: number;
  claimedRewardIds: string[];
  completedMissionIds: string[];
}

export interface LeaderboardEntry {
  id: string;
  rank?: number;
  name: string;
  title: string;
  avatarUrl: string;
  totalXp: number;
  tierLevel: number;
  missionsCompleted: number;
  rewardsClaimed: number;
  streakDaily: number;
  streakWeekly: number;
  change: number;
}
