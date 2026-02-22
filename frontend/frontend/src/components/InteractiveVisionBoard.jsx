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
  BookOpen
} from 'lucide-react';

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

  const moodOrder = ['tough', 'challenging', 'okay', 'good', 'great'];
  const moodByValue = { 1: 'tough', 2: 'challenging', 3: 'okay', 4: 'good', 5: 'great' };
  const moodValue = moodOrder.indexOf(journalForm.mood) + 1 || 3;
  const moodColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#38bdf8'];
  const moodEmojis = ['[LOW]', '[CHALLENGE]', '[OK]', '[GOOD]', '[GREAT]'];
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

  const fetchData = useCallback(async () => {
    try {
      // Get today's journal
      const journalRes = await apiGet('/api/vision-board/journal/today', { cache: false });
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

      // Get journal history
      const historyRes = await apiGet('/api/vision-board/journal/history?days=30', { cache: false });
      if (historyRes.ok) setJournalHistory(historyRes.data);

      // Get vision items
      const visionRes = await apiGet('/api/vision-board/items', { cache: false });
      if (visionRes.ok) setVisionItems(visionRes.data);

      // Get team feed
      const feedRes = await apiGet('/api/vision-board/team/feed?days=7', { cache: false });
      if (feedRes.ok) setTeamFeed(feedRes.data);

      // Get stats
      const statsRes = await apiGet('/api/vision-board/stats', { cache: false });
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

  const getCategoryIcon = (category) => {
    const icons = {
      faith: <Heart className="w-5 h-5" />,
      family: <Users className="w-5 h-5" />,
      finances: <DollarSign className="w-5 h-5" />,
      fitness: <Activity className="w-5 h-5" />,
      career: <Briefcase className="w-5 h-5" />,
      personal: <Target className="w-5 h-5" />,
      other: <Star className="w-5 h-5" />
    };
    return icons[category] || icons.other;
  };

  const getMoodEmoji = (mood) => {
    const moods = {
      great: '[GREAT]',
      good: '[GOOD]',
      okay: '[OK]',
      challenging: '[CHALLENGE]',
      tough: '[LOW]'
    };
    return moods[mood] || '';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px] bg-tactical-animated">
        <div className="text-center">
          <div className="spinner-tactical w-12 h-12 mx-auto mb-4"></div>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Loading Vision Board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-tactical-animated page-enter" data-testid="interactive-vision-board">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img 
              src={PAGE_ICONS.vision_board} 
              alt="Vision Board" 
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain animate-glow-breathe"
              style={{ filter: 'drop-shadow(0 0 15px rgba(147, 51, 234, 0.5))' }}
            />
            <div>
              <h1 className="text-2xl font-tactical font-bold text-white uppercase tracking-wide text-glow-purple">Vision Board</h1>
              <p className="text-zinc-500 font-mono">Dream it. Believe it. Achieve it.</p>
            </div>
          </div>
          
          {stats && (
            <div className="flex gap-4 text-sm">
              <div className="card-tactical p-3 text-center">
                <p className="text-2xl font-tactical font-bold text-purple-400">{stats.journal?.current_streak || 0}</p>
                <p className="text-zinc-500 text-xs font-mono uppercase">Day Streak</p>
              </div>
              <div className="card-tactical p-3 text-center">
                <p className="text-2xl font-tactical font-bold text-blue-400">{stats.vision_items?.achieved || 0}</p>
                <p className="text-zinc-500 text-xs font-mono uppercase">Achieved</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-2">
          {[
            { id: 'journal', label: 'Daily Journal', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'vision', label: 'My Vision', icon: <Target className="w-4 h-4" /> },
            { id: 'team', label: 'Team Feed', icon: <Users className="w-4 h-4" /> },
            { id: 'anchors', label: 'Vision Anchors', icon: <Compass className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                  ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' 
                  : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/30 hover:border-zinc-600'
              }`}
            >
              {tab.icon}
              <span className="ml-1">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        {/* Daily Journal Tab */}
        {activeTab === 'journal' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Journal Form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card-tactical p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Feather className="w-5 h-5 text-purple-400" />
                    <h3 className="font-tactical font-bold text-white uppercase">Today&apos;s Journal</h3>
                  </div>
                  <div className={`vision-fade-in text-xs font-mono uppercase tracking-wider ${saveState === 'saved' ? 'text-emerald-400' : 'text-cyan-300'}`}>
                    {saveState === 'saving' && 'Saving...'}
                    {saveState === 'saved' && (
                      <span className={`inline-flex items-center gap-1 ${savePulse ? 'vision-save-checkmark' : ''}`}>
                        <Check className="w-3 h-3" /> Saved
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                                    {/* Gratitude */}
                  <div>
                    <label className="block text-sm font-mono text-zinc-300 mb-2 uppercase tracking-wider">
                      What I&apos;m Grateful For
                      {journalForm.is_shared && <span className="ml-2 rounded-full bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-[10px]">Shared with team</span>}
                    </label>
                    {journalForm.gratitude.map((item, i) => (
                      <input
                        key={i}
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const newGratitude = [...journalForm.gratitude];
                          newGratitude[i] = e.target.value;
                          setJournalForm({...journalForm, gratitude: newGratitude});
                        }}
                        className="input-tactical w-full mb-2 vision-fade-in"
                        placeholder={`Gratitude ${i + 1}...`}
                      />
                    ))}
                    {gratitudeEntries.length === 0 && (
                      <div className="text-slate-500 text-sm italic">
                        Nothing here yet - start writing to build your journey.
                      </div>
                    )}
                  </div>

                  {/* Beliefs */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      What I&apos;m Believing For
                    </label>
                    {journalForm.beliefs.map((item, i) => (
                      <div key={i} className="flex gap-2 mb-2 vision-slide-up">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newBeliefs = [...journalForm.beliefs];
                            newBeliefs[i] = e.target.value;
                            setJournalForm({...journalForm, beliefs: newBeliefs});
                          }}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="I believe..."
                        />
                        {i === journalForm.beliefs.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setJournalForm({...journalForm, beliefs: [...journalForm.beliefs, '']})}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {beliefEntries.length === 0 && (
                      <div className="text-slate-500 text-sm italic">
                        Nothing here yet - start writing to build your journey.
                      </div>
                    )}
                  </div>

                  {/* Wins */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Today&apos;s Wins
                      {journalForm.is_shared && <span className="ml-2 rounded-full bg-cyan-500/20 text-cyan-300 px-2 py-0.5 text-[10px]">Shared with team</span>}
                    </label>
                    {journalForm.wins.map((item, i) => (
                      <div key={i} className="flex gap-2 mb-2 vision-slide-up">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newWins = [...journalForm.wins];
                            newWins[i] = e.target.value;
                            setJournalForm({...journalForm, wins: newWins});
                          }}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="A win today..."
                        />
                        {i === journalForm.wins.length - 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setJournalForm({...journalForm, wins: [...journalForm.wins, '']})}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {winEntries.length === 0 && (
                      <div className="text-slate-500 text-sm italic">
                        Nothing here yet - start writing to build your journey.
                      </div>
                    )}
                  </div>

                  {/* Thoughts */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      My Thoughts (Private)
                    </label>
                    <Textarea
                      value={journalForm.thoughts}
                      onChange={(e) => setJournalForm({...journalForm, thoughts: e.target.value})}
                      placeholder="What's on your mind today..."
                      rows={4}
                      className="focus:ring-2 focus:ring-purple-500 vision-fade-in"
                    />
                    {!journalForm.thoughts.trim() && (
                      <div className="text-slate-500 text-sm italic mt-2">
                        Nothing here yet - start writing to build your journey.
                      </div>
                    )}
                  </div>

                                    {/* Mood & Energy */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Mood</label>
                      <div
                        className="rounded-lg border border-slate-700 p-3 vision-mood-shift"
                        style={{ background: `linear-gradient(90deg, ${moodColors[0]}, ${moodColors[moodValue - 1]})` }}
                      >
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={moodValue}
                          onChange={(e) => setJournalForm({...journalForm, mood: moodByValue[parseInt(e.target.value, 10)]})}
                          className="w-full"
                        />
                        <p className="text-center text-sm text-white mt-1">
                          {moodEmojis[moodValue - 1]} {journalForm.mood || 'okay'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">Energy (1-10)</label>
                      <div
                        className={`rounded-lg border border-cyan-500/30 p-3 ${journalForm.energy_level >= 8 ? 'vision-pulse-glow' : ''}`}
                        style={{ boxShadow: `0 0 18px rgba(34, 211, 238, ${energyGlow})` }}
                      >
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={journalForm.energy_level}
                          onChange={(e) => setJournalForm({...journalForm, energy_level: parseInt(e.target.value, 10)})}
                          className="w-full"
                        />
                        <p className="text-center text-sm text-gray-200">{journalForm.energy_level}/10</p>
                      </div>
                    </div>
                  </div>

                  {/* Share Toggle */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="share-journal"
                      checked={journalForm.is_shared}
                      onChange={(e) => setJournalForm({...journalForm, is_shared: e.target.checked})}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="share-journal" className="text-sm text-gray-600">
                      Share gratitude & wins with team (thoughts stay private)
                    </label>
                  </div>

                  {journalForm.is_shared && (
                    <div className="rounded-xl border border-cyan-500/30 bg-slate-900/50 p-3 vision-fade-in">
                      <p className="text-xs uppercase tracking-wider text-cyan-300 mb-2">Team Preview</p>
                      <div className="text-sm text-slate-300">
                        <p className="mb-1 font-medium">Gratitude:</p>
                        {gratitudeEntries.length > 0 ? (
                          <ul className="list-disc list-inside text-slate-400">
                            {gratitudeEntries.slice(0, 3).map((item, index) => (
                              <li key={`g-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="italic text-slate-500">Add gratitude entries to share.</p>
                        )}
                        <p className="mt-3 mb-1 font-medium">Wins:</p>
                        {winEntries.length > 0 ? (
                          <ul className="list-disc list-inside text-slate-400">
                            {winEntries.slice(0, 3).map((item, index) => (
                              <li key={`w-${index}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="italic text-slate-500">Add wins to share.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSaveJournal} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Save Journal Entry
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar Stats */}
            <div className="space-y-6">
              <div className="card-tactical p-5">
                <h3 className="font-tactical font-bold text-white uppercase mb-4">Your Journey</h3>
                <div className="space-y-4">
                  <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${isStreakHot ? 'border-purple-500/40 vision-pulse-glow' : 'border-zinc-700/40'}`}>
                    <span className="text-zinc-300 flex items-center gap-2"><Award className="w-4 h-4 text-purple-400" />Current Streak</span>
                    <span className="text-2xl font-bold text-purple-400">
                      {journalHistory?.stats?.current_streak || 0} days
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-2"><BookOpen className="w-4 h-4 text-cyan-400" />Total Entries</span>
                    <span className="font-medium text-white">{journalHistory?.stats?.total_entries || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-400" />This Month</span>
                    <span className="font-medium text-white">{journalHistory?.stats?.days_this_month || 0} days</span>
                  </div>
                  <div className="pt-1">
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 vision-fade-in" style={{ width: `${monthProgress}%` }} />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">{monthProgress}% of month logged</p>
                  </div>
                </div>
              </div>

              {/* Recent Entries */}
              {journalHistory?.entries?.length > 0 && (
                <div className="card-tactical p-5">
                  <h3 className="font-tactical font-bold text-white uppercase mb-4">Recent Days</h3>
                  <div className="space-y-2">
                    {journalHistory.entries.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded border border-zinc-700/30">
                        <span className="text-sm text-zinc-300">{entry.date}</span>
                        <span>{getMoodEmoji(entry.mood)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vision Board Tab */}
        {activeTab === 'vision' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">My Vision Board</h2>
              <Button onClick={() => setShowAddVision(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" /> Add Vision Item
              </Button>
            </div>

                        {/* Categories */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visionItems?.items?.map((item) => {
                const itemType = item.affirmation ? 'Quote' : item.target_date ? 'Milestone' : item.image_url ? 'Image Goal' : 'Goal';
                const categoryMeta = visionItems?.categories?.find((cat) => cat.id === item.category);
                return (
                  <div
                    key={item.id}
                    className={`bg-slate-900/60 border border-slate-700 rounded-xl p-4 transition-all duration-300 vision-card-hover relative overflow-hidden ${item.is_achieved ? 'border-emerald-400/40' : ''}`}
                  >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,rgba(15,23,42,0.35)_1px,transparent_1px),linear-gradient(180deg,rgba(15,23,42,0.35)_1px,transparent_1px)] bg-[size:24px_24px] opacity-30" />
                    {item.image_url ? (
                      <img src={`${API_URL}${item.image_url}`} alt={item.title} className="rounded-lg mb-3 h-36 w-full object-cover" />
                    ) : (
                      <div className="rounded-lg mb-3 h-36 w-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
                        <Image className="w-6 h-6" />
                      </div>
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-slate-800 border border-slate-600 text-slate-300">{itemType}</Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleAchieved(item.id, item.is_achieved)}>
                            <Check className={`w-4 h-4 ${item.is_achieved ? 'text-emerald-400' : 'text-slate-400'}`} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteVisionItem(item.id)}>
                            <Trash2 className="w-4 h-4 text-slate-500" />
                          </Button>
                        </div>
                      </div>
                      <div className="text-slate-200 font-semibold">{item.title}</div>
                      <div className="text-slate-400 text-sm mt-1">{item.description || item.affirmation || 'Define this vision in one line.'}</div>
                      <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                        {categoryMeta ? <span>{categoryMeta.name}</span> : <span>{item.category}</span>}
                        {item.target_date && (
                          <>
                            <span>•</span>
                            <span>{item.target_date}</span>
                          </>
                        )}
                      </div>
                      {item.is_achieved && (
                        <Badge className="mt-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">Achieved</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {(!visionItems?.items || visionItems.items.length === 0) && (
              <div className="text-center py-12">
                <Target className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-200 mb-2">Start Your Vision Board</h3>
                <p className="text-slate-400 mb-4">Build your board with goals, quotes, milestones, and image anchors.</p>
                <Button onClick={() => setShowAddVision(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Vision Item
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Team Feed Tab */}
        {activeTab === 'team' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Team Inspiration Feed</h2>
              <Button onClick={() => setShowTeamPost(true)} className="bg-purple-600 hover:bg-purple-700">
                <Send className="w-4 h-4 mr-2" /> Share with Team
              </Button>
            </div>

            <div className="space-y-4 max-w-2xl">
              {teamFeed?.posts?.map((post) => (
                <div key={post.id}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-medium">
                        {post.user_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{post.user_name}</span>
                          <Badge variant="outline" className="text-xs">{post.post_type}</Badge>
                        </div>
                        <p className="text-gray-700">{post.content}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikePost(post.id)}
                            className="text-gray-500 hover:text-purple-600"
                          >
                            <ThumbsUp className="w-4 h-4 mr-1" />
                            {post.likes?.length || 0}
                          </Button>
                          <span className="text-xs text-gray-600">
                            {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Shared Gratitude */}
              {teamFeed?.shared_gratitude?.map((entry) => (
                <div key={entry.id} className="bg-yellow-50 border-yellow-200">
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        GR
                      </div>
                      <div>
                        <p className="font-medium text-yellow-800">{entry.user_name}&apos;s Gratitude</p>
                        <ul className="text-sm text-yellow-700 mt-1">
                          {entry.gratitude?.map((g, i) => (
                            <li key={i}>- {g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(!teamFeed?.posts?.length && !teamFeed?.shared_gratitude?.length) && (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No Team Posts Yet</h3>
                  <p className="text-gray-500">Be the first to share something inspiring!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vision Anchors Tab */}
        {activeTab === 'anchors' && (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-light text-gray-800 mb-2">Our Vision Anchors</h2>
              <p className="text-gray-500">The principles that guide everything we build</p>
            </div>

            <div className="space-y-6">
              {[
                { principle: "Excellence over convenience", meaning: "We choose the harder right over the easier wrong." },
                { principle: "Stewardship over scale", meaning: "We serve the people in front of us before chasing growth." },
                { principle: "Clarity creates leverage", meaning: "Simple, clear systems outperform complex ones." },
                { principle: "Tools should serve people", meaning: "Technology exists to reduce chaos, not create it." }
              ].map((anchor, i) => (
                <div key={i} className="border-l-4 border-purple-400 pl-6 py-3">
                  <p className="text-xl text-gray-800 font-medium mb-1">{anchor.principle}</p>
                  <p className="text-gray-500">{anchor.meaning}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 bg-stone-50 border-stone-200">
              <div className="p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Feather className="w-5 h-5 text-stone-400" />
                  <h3 className="font-medium text-stone-600">Founder&apos;s Note</h3>
                </div>
                <p className="text-stone-600 leading-relaxed">
                  Eden was born from frustration - piecing together a dozen apps that were each &ldquo;good enough&rdquo; but none truly excellent. 
                  But more than frustration, Eden was born from conviction: that the people we serve deserve better. 
                  They deserve advocates who aren&apos;t drowning in administrative chaos. They deserve systems built with 
                  the same excellence we&apos;d want for our own families.
                </p>
                <p className="text-stone-600 leading-relaxed mt-4">
                  This is why we build. This is why we refine. This is why &ldquo;good enough&rdquo; will never be good enough.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes visionFadeIn {
          from { opacity: 0.25; }
          to { opacity: 1; }
        }
        @keyframes visionSlideUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes visionPulseGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(147, 51, 234, 0.25); }
          50% { box-shadow: 0 0 18px rgba(147, 51, 234, 0.55); }
        }
        @keyframes visionMoodShift {
          from { filter: saturate(0.9); }
          to { filter: saturate(1.1); }
        }
        @keyframes visionSaveCheck {
          0% { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .vision-fade-in { animation: visionFadeIn 240ms ease-in-out; }
        .vision-slide-up { animation: visionSlideUp 280ms ease-out; }
        .vision-pulse-glow { animation: visionPulseGlow 1.8s ease-in-out infinite; }
        .vision-mood-shift { animation: visionMoodShift 260ms ease-in-out; }
        .vision-save-checkmark { animation: visionSaveCheck 220ms ease-out; }
        .vision-card-hover:hover {
          border-color: rgba(56, 189, 248, 0.45);
          box-shadow: 0 0 22px rgba(56, 189, 248, 0.18);
          transform: translateY(-2px);
        }
      `}</style>

      {/* Add Vision Modal */}
      {showAddVision && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Add to Vision Board</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={visionForm.category}
                  onChange={(e) => setVisionForm({...visionForm, category: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="faith">Faith & Spirituality</option>
                  <option value="family">Family & Relationships</option>
                  <option value="finances">Finances & Wealth</option>
                  <option value="fitness">Health & Fitness</option>
                  <option value="career">Career & Business</option>
                  <option value="personal">Personal Growth</option>
                  <option value="other">Other Dreams</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={visionForm.title}
                  onChange={(e) => setVisionForm({...visionForm, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="My dream..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={visionForm.description}
                  onChange={(e) => setVisionForm({...visionForm, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Describe your vision..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Affirmation</label>
                <input
                  type="text"
                  value={visionForm.affirmation}
                  onChange={(e) => setVisionForm({...visionForm, affirmation: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="I am..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Target Date</label>
                <input
                  type="date"
                  value={visionForm.target_date}
                  onChange={(e) => setVisionForm({...visionForm, target_date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowAddVision(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleAddVisionItem} className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!visionForm.title}>
                Add Vision
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Team Post Modal */}
      {showTeamPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Share with Team</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={teamPostForm.post_type}
                  onChange={(e) => setTeamPostForm({...teamPostForm, post_type: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="encouragement">Encouragement</option>
                  <option value="gratitude">Gratitude</option>
                  <option value="win">Win/Celebration</option>
                  <option value="quote">Quote/Inspiration</option>
                  <option value="milestone">Milestone</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={teamPostForm.content}
                  onChange={(e) => setTeamPostForm({...teamPostForm, content: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={4}
                  placeholder="Share something inspiring with the team..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowTeamPost(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleShareTeamPost} className="flex-1 bg-purple-600 hover:bg-purple-700" disabled={!teamPostForm.content}>
                Share
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveVisionBoard;





