import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Textarea } from '../shared/ui/textarea';
import { apiGet, apiPost, apiPut, apiDelete, API_URL } from '../lib/api';
import { PAGE_ICONS } from '../assets/badges';
import {
  Compass,
  Heart,
  Target,
  Feather,
  Plus,
  Star,
  Users,
  DollarSign,
  Activity,
  Briefcase,
  Calendar,
  Check,
  Edit2,
  Trash2,
  Image,
  Send,
  ThumbsUp,
  Sparkles,
  TrendingUp,
  Award,
  BookOpen,
  X,
  Flame,
  Zap,
  Quote,
  Trophy,
  Eye,
  ChevronRight
} from 'lucide-react';

// ============ CONSTANTS ============

const CATEGORIES = [
  { id: 'faith', name: 'Faith & Spirituality', icon: Heart, color: '#a855f7', gradient: 'from-purple-500/20 to-violet-500/10' },
  { id: 'family', name: 'Family & Relationships', icon: Users, color: '#ec4899', gradient: 'from-pink-500/20 to-rose-500/10' },
  { id: 'finances', name: 'Finances & Wealth', icon: DollarSign, color: '#10b981', gradient: 'from-emerald-500/20 to-green-500/10' },
  { id: 'fitness', name: 'Health & Fitness', icon: Activity, color: '#f59e0b', gradient: 'from-amber-500/20 to-yellow-500/10' },
  { id: 'career', name: 'Career & Business', icon: Briefcase, color: '#3b82f6', gradient: 'from-blue-500/20 to-indigo-500/10' },
  { id: 'personal', name: 'Personal Growth', icon: Target, color: '#6366f1', gradient: 'from-indigo-500/20 to-purple-500/10' },
  { id: 'other', name: 'Other Dreams', icon: Star, color: '#6b7280', gradient: 'from-zinc-500/20 to-slate-500/10' },
];

const MOOD_CONFIG = {
  order: ['tough', 'challenging', 'okay', 'good', 'great'],
  byValue: { 1: 'tough', 2: 'challenging', 3: 'okay', 4: 'good', 5: 'great' },
  colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#38bdf8'],
  labels: ['Tough', 'Challenging', 'Okay', 'Good', 'Great'],
  icons: [Zap, TrendingUp, Target, Sparkles, Flame],
};

const POST_TYPE_CONFIG = {
  encouragement: { label: 'Encouragement', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  gratitude: { label: 'Gratitude', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  win: { label: 'Win', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  quote: { label: 'Quote', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  milestone: { label: 'Milestone', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

// ============ SUB-COMPONENTS ============

const GlassCard = ({ children, className = '', glow = '', ...props }) => (
  <div
    className={`relative rounded-xl border border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm overflow-hidden ${className}`}
    style={glow ? { boxShadow: glow } : undefined}
    {...props}
  >
    {children}
  </div>
);

const StatBlock = ({ icon: Icon, label, value, color = 'text-orange-400' }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-zinc-400 flex items-center gap-2 text-sm">
      <Icon className="w-4 h-4" style={{ color }} />
      {label}
    </span>
    <span className="font-mono font-bold text-white">{value}</span>
  </div>
);

const EmptyState = ({ icon: Icon, title, description, action, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-20 h-20 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center mb-6">
      <Icon className="w-10 h-10 text-zinc-600" />
    </div>
    <h3 className="text-lg font-mono font-bold text-zinc-300 uppercase tracking-wider mb-2">{title}</h3>
    <p className="text-zinc-500 text-sm text-center max-w-sm mb-6">{description}</p>
    {action && (
      <Button onClick={onAction} className="bg-orange-500 hover:bg-orange-600 text-white border-0 gap-2">
        <Plus className="w-4 h-4" />
        {action}
      </Button>
    )}
  </div>
);

const ModalOverlay = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
    <div className="relative z-10 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

const InputField = ({ label, children, hint }) => (
  <div>
    <label className="block text-xs font-mono text-zinc-400 mb-1.5 uppercase tracking-wider">{label}</label>
    {children}
    {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
  </div>
);

const DarkInput = ({ className = '', ...props }) => (
  <input
    className={`w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors text-sm ${className}`}
    {...props}
  />
);

const DarkSelect = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors text-sm ${className}`}
    {...props}
  >
    {children}
  </select>
);

const DarkTextarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full px-3 py-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors text-sm resize-none ${className}`}
    {...props}
  />
);

// ============ VISION CARD (Masonry-ready) ============

const VisionCard = ({ item, categories, onToggleAchieved, onDelete }) => {
  const categoryMeta = categories?.find((cat) => cat.id === item.category);
  const catConfig = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[6];
  const CatIcon = catConfig.icon;

  return (
    <div className={`group relative rounded-xl border bg-zinc-800/60 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:translate-y-[-3px] hover:shadow-[0_8px_32px_rgba(249,115,22,0.12)] ${item.is_achieved ? 'border-emerald-500/40' : 'border-zinc-700/50 hover:border-orange-500/30'}`}>
      {/* Category accent bar */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${catConfig.color}, transparent)` }} />

      {/* Image area */}
      {item.image_url ? (
        <div className="relative">
          <img
            src={`${API_URL}${item.image_url}`}
            alt={item.title}
            className="w-full h-44 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/90 via-transparent to-transparent" />
        </div>
      ) : (
        <div className={`h-32 w-full bg-gradient-to-br ${catConfig.gradient} flex items-center justify-center`}>
          <CatIcon className="w-10 h-10 opacity-30" style={{ color: catConfig.color }} />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${catConfig.color}20` }}>
              <CatIcon className="w-3.5 h-3.5" style={{ color: catConfig.color }} />
            </div>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
              {categoryMeta?.name || item.category}
            </span>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleAchieved(item.id, item.is_achieved)}
              className={`p-1.5 rounded-md transition-colors ${item.is_achieved ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h4 className="text-white font-semibold text-sm leading-snug mb-1">{item.title}</h4>

        {item.description && (
          <p className="text-zinc-400 text-xs leading-relaxed mb-2 line-clamp-2">{item.description}</p>
        )}

        {item.affirmation && (
          <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-zinc-900/50 border border-zinc-700/30">
            <Quote className="w-3 h-3 text-orange-400 mt-0.5 flex-shrink-0" />
            <p className="text-orange-300/80 text-xs italic leading-relaxed">{item.affirmation}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          {item.target_date && (
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.target_date}
            </span>
          )}
          {item.is_achieved && (
            <Badge className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] px-2 py-0.5">
              <Trophy className="w-3 h-3 mr-1" />
              Achieved
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ MAIN COMPONENT ============

const InteractiveVisionBoard = () => {
  const [activeTab, setActiveTab] = useState('journal');
  const [loading, setLoading] = useState(true);
  const [todayEntry, setTodayEntry] = useState(null);
  const [journalHistory, setJournalHistory] = useState(null);
  const [visionItems, setVisionItems] = useState(null);
  const [teamFeed, setTeamFeed] = useState(null);
  const [stats, setStats] = useState(null);
  const [showAddVision, setShowAddVision] = useState(false);
  const [showTeamPost, setShowTeamPost] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [savePulse, setSavePulse] = useState(false);
  const [journalReady, setJournalReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const initialJournalSync = useRef(false);
  const autoSaveTimerRef = useRef(null);

  // Journal form
  const [journalForm, setJournalForm] = useState({
    thoughts: '',
    gratitude: ['', '', ''],
    beliefs: [''],
    wins: [''],
    goals_today: [''],
    mood: '',
    energy_level: 5,
    is_shared: false
  });

  // Vision item form
  const [visionForm, setVisionForm] = useState({
    category: 'personal',
    title: '',
    description: '',
    affirmation: '',
    target_date: '',
    color: '#6366F1'
  });

  // Team post form
  const [teamPostForm, setTeamPostForm] = useState({
    content: '',
    post_type: 'encouragement'
  });

  const moodValue = MOOD_CONFIG.order.indexOf(journalForm.mood) + 1 || 3;
  const energyGlow = Math.min(0.95, 0.2 + (journalForm.energy_level / 10) * 0.75);
  const monthProgress = useMemo(() => {
    const current = journalHistory?.stats?.days_this_month || 0;
    const max = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    return Math.min(100, Math.round((current / max) * 100));
  }, [journalHistory?.stats?.days_this_month]);

  const gratitudeEntries = journalForm.gratitude.filter((item) => item.trim());
  const beliefEntries = journalForm.beliefs.filter((item) => item.trim());
  const winEntries = journalForm.wins.filter((item) => item.trim());
  const isStreakHot = (journalHistory?.stats?.current_streak || 0) > 7;

  // Filter vision items by active category
  const filteredVisionItems = useMemo(() => {
    if (!visionItems?.items) return [];
    if (activeCategory === 'all') return visionItems.items;
    return visionItems.items.filter((item) => item.category === activeCategory);
  }, [visionItems, activeCategory]);

  // Count items by category
  const categoryCounts = useMemo(() => {
    const counts = { all: visionItems?.items?.length || 0 };
    visionItems?.items?.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [visionItems]);

  const fetchData = useCallback(async () => {
    try {
      const [journalRes, historyRes, visionRes, feedRes, statsRes] = await Promise.all([
        apiGet('/api/vision-board/journal/today', { cache: false }),
        apiGet('/api/vision-board/journal/history?days=30', { cache: false }),
        apiGet('/api/vision-board/items', { cache: false }),
        apiGet('/api/vision-board/team/feed?days=7', { cache: false }),
        apiGet('/api/vision-board/stats', { cache: false }),
      ]);

      if (journalRes.ok && journalRes.data.entry) {
        setTodayEntry(journalRes.data.entry);
        setJournalForm({
          thoughts: journalRes.data.entry.thoughts || '',
          gratitude: journalRes.data.entry.gratitude?.length > 0 ? journalRes.data.entry.gratitude : ['', '', ''],
          beliefs: journalRes.data.entry.beliefs?.length > 0 ? journalRes.data.entry.beliefs : [''],
          wins: journalRes.data.entry.wins?.length > 0 ? journalRes.data.entry.wins : [''],
          goals_today: journalRes.data.entry.goals_today?.length > 0 ? journalRes.data.entry.goals_today : [''],
          mood: journalRes.data.entry.mood || '',
          energy_level: journalRes.data.entry.energy_level || 5,
          is_shared: journalRes.data.entry.is_shared || false
        });
      }

      if (historyRes.ok) setJournalHistory(historyRes.data);
      if (visionRes.ok) setVisionItems(visionRes.data);
      if (feedRes.ok) setTeamFeed(feedRes.data);
      if (statsRes.ok) setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setJournalReady(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveJournal = useCallback(async ({ silent = false } = {}) => {
    try {
      setSaveState('saving');
      const cleanGratitude = journalForm.gratitude.filter(g => g.trim());
      const cleanBeliefs = journalForm.beliefs.filter(b => b.trim());
      const cleanWins = journalForm.wins.filter(w => w.trim());
      const cleanGoals = journalForm.goals_today.filter(g => g.trim());

      const params = new URLSearchParams();
      if (journalForm.thoughts) params.append('thoughts', journalForm.thoughts);
      if (journalForm.mood) params.append('mood', journalForm.mood);
      if (journalForm.energy_level) params.append('energy_level', journalForm.energy_level);
      params.append('is_shared', journalForm.is_shared);

      const res = await apiPost(`/api/vision-board/journal?${params.toString()}`, {
        gratitude: cleanGratitude,
        beliefs: cleanBeliefs,
        wins: cleanWins,
        goals_today: cleanGoals
      });

      if (res.ok) {
        setSaveState('saved');
        setSavePulse(true);
        if (!silent) {
          fetchData();
        }
        setTimeout(() => setSavePulse(false), 450);
        setTimeout(() => setSaveState('idle'), 1400);
      }
    } catch (error) {
      setSaveState('idle');
      console.error('Error saving journal:', error);
    }
  }, [journalForm, fetchData]);

  useEffect(() => {
    if (!journalReady) return undefined;
    if (!initialJournalSync.current) {
      initialJournalSync.current = true;
      return undefined;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveJournal({ silent: true });
    }, 850);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [journalForm, journalReady, handleSaveJournal]);

  const handleAddVisionItem = async () => {
    try {
      const params = new URLSearchParams();
      params.append('category', visionForm.category);
      params.append('title', visionForm.title);
      if (visionForm.description) params.append('description', visionForm.description);
      if (visionForm.affirmation) params.append('affirmation', visionForm.affirmation);
      if (visionForm.target_date) params.append('target_date', visionForm.target_date);
      if (visionForm.color) params.append('color', visionForm.color);

      const res = await apiPost(`/api/vision-board/items?${params.toString()}`, {});

      if (res.ok) {
        setShowAddVision(false);
        setVisionForm({
          category: 'personal',
          title: '',
          description: '',
          affirmation: '',
          target_date: '',
          color: '#6366F1'
        });
        fetchData();
      }
    } catch (error) {
      console.error('Error adding vision item:', error);
    }
  };

  const handleToggleAchieved = async (itemId, currentStatus) => {
    try {
      const params = new URLSearchParams();
      params.append('is_achieved', !currentStatus);

      await apiPut(`/api/vision-board/items/${itemId}?${params.toString()}`, {});
      fetchData();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteVisionItem = async (itemId) => {
    if (!window.confirm('Delete this vision item?')) return;

    try {
      await apiDelete(`/api/vision-board/items/${itemId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleShareTeamPost = async () => {
    try {
      const params = new URLSearchParams();
      params.append('content', teamPostForm.content);
      params.append('post_type', teamPostForm.post_type);

      const res = await apiPost(`/api/vision-board/team/post?${params.toString()}`, {});

      if (res.ok) {
        setShowTeamPost(false);
        setTeamPostForm({ content: '', post_type: 'encouragement' });
        fetchData();
      }
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleLikePost = async (postId) => {
    try {
      await apiPost(`/api/vision-board/team/post/${postId}/like`, {});
      fetchData();
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  // ============ LOADING STATE ============

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px] bg-tactical-animated">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading Vision Board...</p>
        </div>
      </div>
    );
  }

  // ============ RENDER ============

  return (
    <div className="min-h-screen bg-tactical-animated page-enter" data-testid="interactive-vision-board">
      {/* ========== HEADER ========== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={PAGE_ICONS.vision_board}
                alt="Vision Board"
                width={56}
                height={56}
                className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
                style={{ filter: 'drop-shadow(0 0 18px rgba(249, 115, 22, 0.5))' }}
              />
              <div className="absolute -inset-1 rounded-full bg-orange-500/10 blur-lg -z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-white uppercase tracking-wider">
                Vision Board
              </h1>
              <p className="text-zinc-500 font-mono text-sm">Dream it. Believe it. Achieve it.</p>
            </div>
          </div>

          {stats && (
            <div className="flex gap-3">
              <GlassCard className="p-3 text-center min-w-[80px]" glow={isStreakHot ? '0 0 20px rgba(249, 115, 22, 0.2)' : ''}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  {isStreakHot && <Flame className="w-4 h-4 text-orange-400" />}
                  <p className="text-2xl font-mono font-bold text-orange-400">{stats.journal?.current_streak || 0}</p>
                </div>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Day Streak</p>
              </GlassCard>
              <GlassCard className="p-3 text-center min-w-[80px]">
                <p className="text-2xl font-mono font-bold text-emerald-400 mb-1">{stats.vision_items?.achieved || 0}</p>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Achieved</p>
              </GlassCard>
              <GlassCard className="p-3 text-center min-w-[80px]">
                <p className="text-2xl font-mono font-bold text-amber-400 mb-1">{stats.vision_items?.total || 0}</p>
                <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">Visions</p>
              </GlassCard>
            </div>
          )}
        </div>

        {/* ========== TABS ========== */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-thin">
          {[
            { id: 'journal', label: 'Daily Journal', icon: BookOpen },
            { id: 'vision', label: 'My Vision', icon: Eye },
            { id: 'team', label: 'Team Feed', icon: Users },
            { id: 'anchors', label: 'Vision Anchors', icon: Compass }
          ].map(tab => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">

        {/* ========== DAILY JOURNAL TAB ========== */}
        {activeTab === 'journal' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Journal Form */}
            <div className="lg:col-span-2 space-y-6">
              <GlassCard className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2 mb-5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Feather className="w-4 h-4 text-orange-400" />
                    </div>
                    <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm">Today&apos;s Journal</h3>
                  </div>
                  <div className={`text-xs font-mono uppercase tracking-wider transition-all ${saveState === 'saved' ? 'text-emerald-400' : saveState === 'saving' ? 'text-amber-400' : 'text-transparent'}`}>
                    {saveState === 'saving' && 'Saving...'}
                    {saveState === 'saved' && (
                      <span className={`inline-flex items-center gap-1 ${savePulse ? 'animate-pulse' : ''}`}>
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Gratitude */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Heart className="w-4 h-4 text-amber-400" />
                      <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                        What I&apos;m Grateful For
                      </label>
                      {journalForm.is_shared && (
                        <span className="ml-auto rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-0.5 text-[10px] font-mono uppercase">Shared</span>
                      )}
                    </div>
                    {journalForm.gratitude.map((item, i) => (
                      <DarkInput
                        key={i}
                        value={item}
                        onChange={(e) => {
                          const newGratitude = [...journalForm.gratitude];
                          newGratitude[i] = e.target.value;
                          setJournalForm({...journalForm, gratitude: newGratitude});
                        }}
                        className="mb-2"
                        placeholder={`Gratitude ${i + 1}...`}
                      />
                    ))}
                  </div>

                  {/* Beliefs */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                        What I&apos;m Believing For
                      </label>
                    </div>
                    {journalForm.beliefs.map((item, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <DarkInput
                          value={item}
                          onChange={(e) => {
                            const newBeliefs = [...journalForm.beliefs];
                            newBeliefs[i] = e.target.value;
                            setJournalForm({...journalForm, beliefs: newBeliefs});
                          }}
                          placeholder="I believe..."
                        />
                        {i === journalForm.beliefs.length - 1 && (
                          <button
                            onClick={() => setJournalForm({...journalForm, beliefs: [...journalForm.beliefs, '']})}
                            className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-zinc-500 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Wins */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                        Today&apos;s Wins
                      </label>
                      {journalForm.is_shared && (
                        <span className="ml-auto rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 px-2 py-0.5 text-[10px] font-mono uppercase">Shared</span>
                      )}
                    </div>
                    {journalForm.wins.map((item, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <DarkInput
                          value={item}
                          onChange={(e) => {
                            const newWins = [...journalForm.wins];
                            newWins[i] = e.target.value;
                            setJournalForm({...journalForm, wins: newWins});
                          }}
                          placeholder="A win today..."
                        />
                        {i === journalForm.wins.length - 1 && (
                          <button
                            onClick={() => setJournalForm({...journalForm, wins: [...journalForm.wins, '']})}
                            className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-700/50 text-zinc-500 hover:text-orange-400 hover:border-orange-500/30 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Thoughts */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Feather className="w-4 h-4 text-zinc-400" />
                      <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                        My Thoughts
                      </label>
                      <span className="text-[10px] font-mono text-zinc-600 uppercase">(Private)</span>
                    </div>
                    <DarkTextarea
                      value={journalForm.thoughts}
                      onChange={(e) => setJournalForm({...journalForm, thoughts: e.target.value})}
                      placeholder="What's on your mind today..."
                      rows={4}
                    />
                  </div>

                  {/* Mood & Energy */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">Mood</label>
                      </div>
                      <GlassCard className="p-3">
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={moodValue}
                          onChange={(e) => setJournalForm({...journalForm, mood: MOOD_CONFIG.byValue[parseInt(e.target.value, 10)]})}
                          className="w-full accent-orange-500"
                        />
                        <div className="flex items-center justify-center gap-2 mt-2">
                          {(() => {
                            const MoodIcon = MOOD_CONFIG.icons[moodValue - 1];
                            return <MoodIcon className="w-4 h-4" style={{ color: MOOD_CONFIG.colors[moodValue - 1] }} />;
                          })()}
                          <span className="text-sm font-mono text-white capitalize">{journalForm.mood || 'okay'}</span>
                        </div>
                      </GlassCard>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <label className="text-xs font-mono text-zinc-300 uppercase tracking-wider">Energy</label>
                        <span className="text-xs font-mono text-zinc-600">{journalForm.energy_level}/10</span>
                      </div>
                      <GlassCard
                        className="p-3"
                        glow={journalForm.energy_level >= 8 ? `0 0 18px rgba(34, 211, 238, ${energyGlow * 0.4})` : ''}
                      >
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={journalForm.energy_level}
                          onChange={(e) => setJournalForm({...journalForm, energy_level: parseInt(e.target.value, 10)})}
                          className="w-full accent-cyan-500"
                        />
                        <div className="flex justify-between mt-1">
                          {[...Array(10)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${i < journalForm.energy_level ? 'bg-cyan-400' : 'bg-zinc-700'}`}
                            />
                          ))}
                        </div>
                      </GlassCard>
                    </div>
                  </div>

                  {/* Share Toggle */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/30">
                    <button
                      onClick={() => setJournalForm({...journalForm, is_shared: !journalForm.is_shared})}
                      className={`relative w-10 h-5 rounded-full transition-colors ${journalForm.is_shared ? 'bg-orange-500' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${journalForm.is_shared ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <label className="text-sm text-zinc-400 cursor-pointer" onClick={() => setJournalForm({...journalForm, is_shared: !journalForm.is_shared})}>
                      Share gratitude & wins with team
                      <span className="text-zinc-600 text-xs ml-1">(thoughts stay private)</span>
                    </label>
                  </div>

                  {/* Team Preview */}
                  {journalForm.is_shared && (gratitudeEntries.length > 0 || winEntries.length > 0) && (
                    <GlassCard className="p-4 border-orange-500/20">
                      <p className="text-[10px] uppercase tracking-wider text-orange-400 font-mono mb-3">Team Preview</p>
                      <div className="text-sm space-y-3">
                        {gratitudeEntries.length > 0 && (
                          <div>
                            <p className="text-zinc-400 text-xs font-mono uppercase mb-1">Gratitude</p>
                            <ul className="space-y-1">
                              {gratitudeEntries.slice(0, 3).map((item, index) => (
                                <li key={`g-${index}`} className="text-zinc-300 text-sm flex items-start gap-2">
                                  <ChevronRight className="w-3 h-3 text-amber-400 mt-1 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {winEntries.length > 0 && (
                          <div>
                            <p className="text-zinc-400 text-xs font-mono uppercase mb-1">Wins</p>
                            <ul className="space-y-1">
                              {winEntries.slice(0, 3).map((item, index) => (
                                <li key={`w-${index}`} className="text-zinc-300 text-sm flex items-start gap-2">
                                  <ChevronRight className="w-3 h-3 text-emerald-400 mt-1 flex-shrink-0" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  )}

                  <Button
                    onClick={handleSaveJournal}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0 font-mono uppercase tracking-wider py-3"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Save Journal Entry
                  </Button>
                </div>
              </GlassCard>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <GlassCard className="p-5" glow={isStreakHot ? '0 0 24px rgba(249, 115, 22, 0.15)' : ''}>
                <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm mb-4">Your Journey</h3>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${isStreakHot ? 'border-orange-500/40 bg-orange-500/5' : 'border-zinc-700/40'}`}>
                    <span className="text-zinc-300 flex items-center gap-2 text-sm">
                      {isStreakHot ? <Flame className="w-4 h-4 text-orange-400" /> : <Award className="w-4 h-4 text-orange-400" />}
                      Streak
                    </span>
                    <span className="text-2xl font-mono font-bold text-orange-400">
                      {journalHistory?.stats?.current_streak || 0}
                      <span className="text-xs text-zinc-500 ml-1">days</span>
                    </span>
                  </div>
                  <StatBlock icon={BookOpen} label="Total Entries" value={journalHistory?.stats?.total_entries || 0} color="#f59e0b" />
                  <StatBlock icon={Calendar} label="This Month" value={`${journalHistory?.stats?.days_this_month || 0} days`} color="#22d3ee" />
                  <div className="pt-1">
                    <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-700/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${monthProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">{monthProgress}% of month logged</p>
                  </div>
                </div>
              </GlassCard>

              {/* Recent Entries */}
              {journalHistory?.entries?.length > 0 && (
                <GlassCard className="p-5">
                  <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm mb-4">Recent Days</h3>
                  <div className="space-y-2">
                    {journalHistory.entries.slice(0, 7).map((entry) => {
                      const entryMoodIdx = MOOD_CONFIG.order.indexOf(entry.mood);
                      return (
                        <div key={entry.id} className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors">
                          <span className="text-sm text-zinc-400 font-mono">{entry.date}</span>
                          <div className="flex items-center gap-2">
                            {entry.mood && (
                              <span
                                className="text-xs font-mono uppercase px-2 py-0.5 rounded-full"
                                style={{
                                  color: MOOD_CONFIG.colors[entryMoodIdx] || '#71717a',
                                  background: `${MOOD_CONFIG.colors[entryMoodIdx] || '#71717a'}15`,
                                }}
                              >
                                {entry.mood}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              )}
            </div>
          </div>
        )}

        {/* ========== VISION BOARD TAB ========== */}
        {activeTab === 'vision' && (
          <div>
            {/* Header bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-mono font-bold text-white uppercase tracking-wider">My Vision Board</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  {visionItems?.items?.length || 0} visions &middot; {visionItems?.items?.filter(i => i.is_achieved).length || 0} achieved
                </p>
              </div>
              <Button onClick={() => setShowAddVision(true)} className="bg-orange-500 hover:bg-orange-600 text-white border-0 gap-2">
                <Plus className="w-4 h-4" /> Add Vision
              </Button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-thin">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                    : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300'
                }`}
              >
                All
                <span className="text-[10px] opacity-60">{categoryCounts.all || 0}</span>
              </button>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const count = categoryCounts[cat.id] || 0;
                if (count === 0 && activeCategory !== cat.id) return null;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                      activeCategory === cat.id
                        ? 'text-white border'
                        : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:text-zinc-300'
                    }`}
                    style={activeCategory === cat.id ? {
                      background: `${cat.color}15`,
                      borderColor: `${cat.color}40`,
                      color: cat.color,
                    } : undefined}
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    {cat.name.split(' ')[0]}
                    <span className="text-[10px] opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Masonry Grid */}
            {filteredVisionItems.length > 0 ? (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {filteredVisionItems.map((item) => (
                  <div key={item.id} className="break-inside-avoid">
                    <VisionCard
                      item={item}
                      categories={visionItems?.categories}
                      onToggleAchieved={handleToggleAchieved}
                      onDelete={handleDeleteVisionItem}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="Start Your Vision Board"
                description="Pin your dreams, goals, affirmations, and milestones. Build a visual map of where you're headed."
                action="Add Your First Vision"
                onAction={() => setShowAddVision(true)}
              />
            )}
          </div>
        )}

        {/* ========== TEAM FEED TAB ========== */}
        {activeTab === 'team' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-mono font-bold text-white uppercase tracking-wider">Team Inspiration</h2>
                <p className="text-zinc-500 text-sm mt-1">Share wins, gratitude, and encouragement with the team</p>
              </div>
              <Button onClick={() => setShowTeamPost(true)} className="bg-orange-500 hover:bg-orange-600 text-white border-0 gap-2">
                <Send className="w-4 h-4" /> Share with Team
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Feed */}
              <div className="lg:col-span-2 space-y-4">
                {teamFeed?.posts?.map((post) => {
                  const typeConfig = POST_TYPE_CONFIG[post.post_type] || POST_TYPE_CONFIG.encouragement;
                  return (
                    <GlassCard key={post.id} className="p-5 hover:border-zinc-600/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-mono font-bold text-sm flex-shrink-0">
                          {post.user_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono font-semibold text-white text-sm">{post.user_name}</span>
                            <Badge className={`text-[10px] px-2 py-0.5 border ${typeConfig.color}`}>
                              {typeConfig.label}
                            </Badge>
                          </div>
                          <p className="text-zinc-300 text-sm leading-relaxed">{post.content}</p>
                          <div className="flex items-center gap-4 mt-3">
                            <button
                              onClick={() => handleLikePost(post.id)}
                              className="flex items-center gap-1.5 text-zinc-500 hover:text-orange-400 transition-colors text-sm"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span className="font-mono">{post.likes?.length || 0}</span>
                            </button>
                            <span className="text-xs text-zinc-600 font-mono">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}

                {/* Shared Gratitude */}
                {teamFeed?.shared_gratitude?.map((entry) => (
                  <GlassCard key={entry.id} className="p-5 border-amber-500/20">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-mono font-semibold text-amber-300 text-sm mb-2">{entry.user_name}&apos;s Gratitude</p>
                        <ul className="space-y-1">
                          {entry.gratitude?.map((g, i) => (
                            <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                              <ChevronRight className="w-3 h-3 text-amber-400 mt-1 flex-shrink-0" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </GlassCard>
                ))}

                {(!teamFeed?.posts?.length && !teamFeed?.shared_gratitude?.length) && (
                  <EmptyState
                    icon={Users}
                    title="No Team Posts Yet"
                    description="Be the first to share something inspiring with the team. A word of encouragement goes a long way."
                    action="Share Something"
                    onAction={() => setShowTeamPost(true)}
                  />
                )}
              </div>

              {/* Milestones Sidebar */}
              <div>
                <GlassCard className="p-5">
                  <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Team Milestones
                  </h3>
                  {teamFeed?.milestones?.length > 0 ? (
                    <div className="space-y-3">
                      {teamFeed.milestones.map((m) => (
                        <div key={m.id} className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/30">
                          <p className="text-white text-sm font-semibold">{m.title}</p>
                          {m.description && <p className="text-zinc-400 text-xs mt-1">{m.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-zinc-500 font-mono">{m.user_name}</span>
                            <span className="text-zinc-700">&middot;</span>
                            <span className="text-xs text-zinc-600 font-mono">{m.achieved_date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-600 text-sm text-center py-4">No milestones shared yet</p>
                  )}
                </GlassCard>
              </div>
            </div>
          </div>
        )}

        {/* ========== VISION ANCHORS TAB ========== */}
        {activeTab === 'anchors' && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Compass className="w-8 h-8 text-orange-400" />
              </div>
              <h2 className="text-2xl font-mono font-bold text-white uppercase tracking-wider mb-2">Our Vision Anchors</h2>
              <p className="text-zinc-500 text-sm">The principles that guide everything we build</p>
            </div>

            <div className="space-y-4">
              {[
                { principle: "Excellence over convenience", meaning: "We choose the harder right over the easier wrong.", icon: Award },
                { principle: "Stewardship over scale", meaning: "We serve the people in front of us before chasing growth.", icon: Heart },
                { principle: "Clarity creates leverage", meaning: "Simple, clear systems outperform complex ones.", icon: Target },
                { principle: "Tools should serve people", meaning: "Technology exists to reduce chaos, not create it.", icon: Users }
              ].map((anchor, i) => {
                const AnchorIcon = anchor.icon;
                return (
                  <GlassCard key={i} className="p-5 hover:border-orange-500/30 transition-colors group">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                        <AnchorIcon className="w-5 h-5 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-white font-mono font-bold uppercase tracking-wider text-sm mb-1">{anchor.principle}</p>
                        <p className="text-zinc-400 text-sm leading-relaxed">{anchor.meaning}</p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>

            <GlassCard className="mt-10 p-6 sm:p-8 border-orange-500/10">
              <div className="flex items-center gap-2 mb-4">
                <Feather className="w-5 h-5 text-orange-400" />
                <h3 className="font-mono font-bold text-zinc-300 uppercase tracking-wider text-sm">Founder&apos;s Note</h3>
              </div>
              <p className="text-zinc-400 leading-relaxed text-sm">
                Eden was born from frustration &mdash; piecing together a dozen apps that were each &ldquo;good enough&rdquo; but none truly excellent.
                But more than frustration, Eden was born from conviction: that the people we serve deserve better.
                They deserve advocates who aren&apos;t drowning in administrative chaos. They deserve systems built with
                the same excellence we&apos;d want for our own families.
              </p>
              <p className="text-zinc-400 leading-relaxed text-sm mt-4">
                This is why we build. This is why we refine. This is why &ldquo;good enough&rdquo; will never be good enough.
              </p>
            </GlassCard>
          </div>
        )}
      </div>

      {/* ========== ADD VISION MODAL ========== */}
      {showAddVision && (
        <ModalOverlay onClose={() => setShowAddVision(false)}>
          <GlassCard className="p-6 border-zinc-600/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm">Add to Vision Board</h3>
              <button onClick={() => setShowAddVision(false)} className="p-1 text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <InputField label="Category">
                <DarkSelect
                  value={visionForm.category}
                  onChange={(e) => setVisionForm({...visionForm, category: e.target.value})}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </DarkSelect>
              </InputField>

              <InputField label="Title *">
                <DarkInput
                  value={visionForm.title}
                  onChange={(e) => setVisionForm({...visionForm, title: e.target.value})}
                  placeholder="My dream..."
                />
              </InputField>

              <InputField label="Description">
                <DarkTextarea
                  value={visionForm.description}
                  onChange={(e) => setVisionForm({...visionForm, description: e.target.value})}
                  rows={2}
                  placeholder="Describe your vision..."
                />
              </InputField>

              <InputField label="Affirmation" hint="A declaration in present tense">
                <DarkInput
                  value={visionForm.affirmation}
                  onChange={(e) => setVisionForm({...visionForm, affirmation: e.target.value})}
                  placeholder="I am..."
                />
              </InputField>

              <InputField label="Target Date">
                <DarkInput
                  type="date"
                  value={visionForm.target_date}
                  onChange={(e) => setVisionForm({...visionForm, target_date: e.target.value})}
                />
              </InputField>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddVision(false)}
                className="flex-1 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddVisionItem}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0"
                disabled={!visionForm.title}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Vision
              </Button>
            </div>
          </GlassCard>
        </ModalOverlay>
      )}

      {/* ========== TEAM POST MODAL ========== */}
      {showTeamPost && (
        <ModalOverlay onClose={() => setShowTeamPost(false)}>
          <GlassCard className="p-6 border-zinc-600/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-mono font-bold text-white uppercase tracking-wider text-sm">Share with Team</h3>
              <button onClick={() => setShowTeamPost(false)} className="p-1 text-zinc-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <InputField label="Type">
                <DarkSelect
                  value={teamPostForm.post_type}
                  onChange={(e) => setTeamPostForm({...teamPostForm, post_type: e.target.value})}
                >
                  <option value="encouragement">Encouragement</option>
                  <option value="gratitude">Gratitude</option>
                  <option value="win">Win / Celebration</option>
                  <option value="quote">Quote / Inspiration</option>
                  <option value="milestone">Milestone</option>
                </DarkSelect>
              </InputField>

              <InputField label="Message">
                <DarkTextarea
                  value={teamPostForm.content}
                  onChange={(e) => setTeamPostForm({...teamPostForm, content: e.target.value})}
                  rows={4}
                  placeholder="Share something inspiring with the team..."
                />
              </InputField>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowTeamPost(false)}
                className="flex-1 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleShareTeamPost}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0"
                disabled={!teamPostForm.content}
              >
                <Send className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </GlassCard>
        </ModalOverlay>
      )}
    </div>
  );
};

export default InteractiveVisionBoard;
