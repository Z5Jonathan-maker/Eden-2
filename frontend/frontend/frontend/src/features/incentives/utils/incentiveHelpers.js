import {
  Target,
  Crown,
  TrendingUp,
  Percent,
  Gift,
  Zap,
  Users,
  Star,
  Trophy,
} from 'lucide-react';

export const CATEGORIES = [
  {
    value: 'sprint',
    label: 'Sprint',
    icon: '\u26A1',
    description: 'Short-term competition for quick results',
  },
  {
    value: 'ladder',
    label: 'Ladder',
    icon: '\uD83D\uDCC8',
    description: 'Ranking-based competition over time',
  },
  { value: 'threshold', label: 'Threshold', icon: '\uD83C\uDFAF', description: 'Hit a target to win' },
  {
    value: 'team_battle',
    label: 'Team Battle',
    icon: '\u2694\uFE0F',
    description: 'Teams compete against each other',
  },
  {
    value: 'milestone',
    label: 'Milestone',
    icon: '\uD83C\uDFC5',
    description: 'Progress through multiple tiers',
  },
  { value: 'lottery', label: 'Lottery', icon: '\uD83C\uDFB0', description: 'Random draw among qualifiers' },
];

export const RULE_TYPES = [
  {
    value: 'threshold',
    label: 'Threshold',
    description: 'Hit X to qualify',
    iconComponent: Target,
  },
  {
    value: 'top_n',
    label: 'Top N',
    description: 'Top performers win',
    iconComponent: Crown,
  },
  {
    value: 'milestone',
    label: 'Milestone',
    description: 'Multiple achievement tiers',
    iconComponent: TrendingUp,
  },
  {
    value: 'improvement',
    label: 'Improvement',
    description: 'Beat your baseline',
    iconComponent: Percent,
  },
  {
    value: 'lottery',
    label: 'Lottery',
    description: 'Random draw from qualifiers',
    iconComponent: Gift,
  },
];

export const REWARD_TYPES = [
  { value: 'gift_card', label: 'Gift Card', icon: '\uD83C\uDF81' },
  { value: 'merchandise', label: 'Merchandise', icon: '\uD83D\uDC55' },
  { value: 'experience', label: 'Experience', icon: '\uD83C\uDFA2' },
  { value: 'cash', label: 'Cash Bonus', icon: '\uD83D\uDCB5' },
  { value: 'pto', label: 'PTO Hours', icon: '\uD83C\uDFD6\uFE0F' },
  { value: 'points', label: 'Bonus Points', icon: '\u2B50' },
  { value: 'badge', label: 'Badge', icon: '\uD83D\uDEE1\uFE0F' },
  { value: 'custom', label: 'Custom', icon: '\uD83C\uDFAF' },
];

export const TIER_CONFIG = {
  legendary: {
    color: 'bg-gradient-to-r from-yellow-400 to-amber-500',
    ring: 'ring-amber-400',
    label: 'Legendary',
  },
  epic: {
    color: 'bg-gradient-to-r from-purple-500 to-indigo-500',
    ring: 'ring-purple-400',
    label: 'Epic',
  },
  rare: {
    color: 'bg-gradient-to-r from-blue-400 to-cyan-500',
    ring: 'ring-blue-400',
    label: 'Rare',
  },
  common: {
    color: 'bg-gradient-to-r from-slate-400 to-slate-500',
    ring: 'ring-zinc-700',
    label: 'Common',
  },
};

export const DEFAULT_TEMPLATE = {
  name: '',
  description: '',
  tagline: '',
  icon: '\uD83C\uDFAF',
  banner_color: '#F97316',
  category: 'threshold',
  default_metric_id: '',
  default_duration_type: 'week',
  default_duration_days: 7,
  default_scope: 'individual',
  default_rules: [],
};

export const DEFAULT_COMP_FORM_DATA = {
  name: '',
  start_date: '',
  end_date: '',
  season_id: null,
  auto_start: true,
};

export const DEFAULT_SEASON = {
  name: '',
  description: '',
  start_date: '',
  end_date: '',
  theme_name: '',
  theme_color: '#6366F1',
  banner_image_url: '',
  icon: '\uD83C\uDFC6',
  grand_prize_description: '',
  grand_prize_value_cents: 0,
  is_active: true,
};

export const DEFAULT_BADGE = {
  name: '',
  description: '',
  criteria: '',
  tier: 'common',
  icon: '\uD83C\uDFC6',
  image_url: '',
  points_value: 100,
  is_active: true,
};

export const DEFAULT_REWARD = {
  name: '',
  description: '',
  type: 'gift_card',
  value_cents: 5000,
  points_required: 0,
  icon: '\uD83C\uDF81',
  image_url: '',
  stock_quantity: null,
  is_featured: false,
  is_active: true,
  categories: [],
};

export const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'scheduled':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-zinc-9000';
    case 'draft':
      return 'bg-yellow-500';
    case 'paused':
      return 'bg-orange-500';
    default:
      return 'bg-zinc-600';
  }
};

export const getStatusBadge = (status) => {
  const colors = {
    active: 'bg-green-500/20 text-green-400',
    scheduled: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-zinc-900 text-zinc-200',
    draft: 'bg-yellow-500/20 text-yellow-400',
    paused: 'bg-orange-100 text-orange-800',
    upcoming: 'bg-blue-500/20 text-blue-400',
  };
  return colors[status] || 'bg-zinc-900 text-zinc-200';
};

export const getCategoryColor = (category) => {
  const colors = {
    sprint: 'bg-green-500/20 text-green-400',
    ladder: 'bg-purple-500/20 text-purple-400',
    threshold: 'bg-orange-100 text-orange-800',
    team_battle: 'bg-red-500/20 text-red-400',
    milestone: 'bg-blue-500/20 text-blue-400',
    lottery: 'bg-pink-500/20 text-pink-400',
  };
  return colors[category] || 'bg-zinc-900 text-zinc-200';
};

export const getCategoryIconComponent = (category) => {
  const icons = {
    sprint: Zap,
    ladder: TrendingUp,
    threshold: Target,
    team_battle: Users,
    milestone: Star,
    lottery: Gift,
  };
  return icons[category] || Trophy;
};

export const formatCurrency = (cents) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
};

export const calculateProgress = (season) => {
  const now = new Date();
  const start = new Date(season.start_date);
  const end = new Date(season.end_date);

  if (now < start) return 0;
  if (now > end) return 100;

  const total = end - start;
  const elapsed = now - start;
  return Math.round((elapsed / total) * 100);
};

export const createDefaultRule = (type) => {
  const configMap = {
    threshold: { threshold_value: 75 },
    top_n: { top_n: 3 },
    milestone: {
      milestones: [
        { tier: 'bronze', value: 25 },
        { tier: 'silver', value: 50 },
        { tier: 'gold', value: 100 },
      ],
    },
    improvement: { improvement_percent: 10, baseline_period: 'last_week' },
    lottery: { lottery_qualifier_threshold: 50, lottery_winner_count: 3 },
  };

  return {
    type,
    config: configMap[type] || {},
    reward_config: { points_award: 100 },
  };
};
