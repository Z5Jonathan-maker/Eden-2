/**
 * RepLayout - Mobile-first layout for sales reps
 *
 * Enzy-inspired player UI with:
 * - Top nav showing rank and points
 * - Bottom navigation for quick actions
 * - Gamification-focused design
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  Home, Map, Trophy, User, ChevronRight,
  Flame, Star, Target, Zap
} from 'lucide-react';
import { apiGet } from '@/lib/api';

const RepLayout = () => {
  const location = useLocation();
  const [stats, setStats] = useState({
    points: 0,
    rank: null,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch today's stats
        const res = await apiGet('/api/harvest/v2/today');

        if (res.ok) {
          setStats({
            points: res.data.total_points || 0,
            rank: null, // Would come from leaderboard
            streak: res.data.streak_days || 0
          });
        }
      } catch (err) {
        console.error('Failed to fetch rep stats:', err);
      }
      setLoading(false);
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/rep', icon: Home, label: 'Home' },
    { path: '/canvassing', icon: Map, label: 'Harvest' },
    { path: '/rep/competitions', icon: Trophy, label: 'Compete' },
    { path: '/rep/profile', icon: User, label: 'Profile' }
  ];

  const isActive = (path) => {
    if (path === '/rep') {
      return location.pathname === '/rep' || location.pathname === '/rep/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">EDEN</span>
          </div>
          
          {/* Stats Pill */}
          <div className="flex items-center gap-3">
            {/* Streak */}
            {stats.streak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">{stats.streak}</span>
              </div>
            )}
            
            {/* Points */}
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-300">
                {loading ? '...' : stats.points.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-sm border-t border-slate-800">
        <div className="flex justify-around items-center py-2 px-4 max-w-lg mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                isActive(path)
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default RepLayout;
