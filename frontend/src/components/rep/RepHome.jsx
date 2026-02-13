/**
 * RepHome - Rep's daily game dashboard
 * 
 * Enzy-style performance view with:
 * - Daily progress bars
 * - Streak tracker
 * - Quick actions
 * - Active competitions
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Progress } from '../shared/ui/progress';
import { Badge } from '../shared/ui/badge';
import {
  Play, Trophy, Target, Flame, Star, ChevronRight,
  MapPin, Calendar, TrendingUp, Award, Zap
} from 'lucide-react';

const API_URL = import.meta.env.REACT_APP_BACKEND_URL || '';

const RepHome = () => {
  const navigate = useNavigate();
  const [todayStats, setTodayStats] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('eden_token');
    if (!token) return;

    const fetchData = async () => {
      try {
        // Fetch today's stats
        const [statsRes, compRes, terrRes] = await Promise.all([
          fetch(`${API_URL}/api/harvest/v2/today`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/incentives/competitions?status=active`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/harvest/territories/my`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (statsRes.ok) {
          const data = await statsRes.json();
          setTodayStats(data);
        }

        if (compRes.ok) {
          const data = await compRes.json();
          setCompetitions(data.competitions?.slice(0, 3) || []);
        }

        if (terrRes.ok) {
          const data = await terrRes.json();
          setTerritories(data.territories?.slice(0, 3) || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getMotivationalMessage = () => {
    if (!todayStats) return "Let's make today count!";
    
    const progress = todayStats.progress?.doors_knocked || 0;
    if (progress >= 100) return "You crushed it today! 🔥";
    if (progress >= 75) return "Almost there! Keep pushing!";
    if (progress >= 50) return "Halfway there. Don't stop now!";
    if (progress >= 25) return "Good start. Let's build momentum!";
    return "Time to get out there and knock! 💪";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{getGreeting()}</h1>
        <p className="text-slate-400">{getMotivationalMessage()}</p>
      </div>

      {/* Streak Banner */}
      {todayStats?.streak_days > 0 && (
        <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500/30 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-orange-300">{todayStats.streak_days}-Day Streak!</p>
              <p className="text-sm text-orange-400/70">Don't break it!</p>
            </div>
          </div>
          <Zap className="w-8 h-8 text-orange-400" />
        </div>
      )}

      {/* Quick Start */}
      <Button 
        className="w-full h-16 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-lg font-bold shadow-lg shadow-emerald-500/25"
        onClick={() => navigate('/canvassing')}
        data-testid="start-canvassing-btn"
      >
        <Play className="w-6 h-6 mr-2" />
        Start Canvassing
      </Button>

      {/* Today's Game */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            Today's Game
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Doors Knocked */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Doors Knocked</span>
              <span className="font-bold">
                {todayStats?.doors_knocked || 0} / {todayStats?.goals?.doors_knocked || 40}
              </span>
            </div>
            <Progress 
              value={todayStats?.progress?.doors_knocked || 0} 
              className="h-3 bg-slate-800"
            />
          </div>

          {/* Appointments */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Appointments Set</span>
              <span className="font-bold">
                {todayStats?.appointments_set || 0} / {todayStats?.goals?.appointments_set || 3}
              </span>
            </div>
            <Progress 
              value={todayStats?.progress?.appointments_set || 0} 
              className="h-3 bg-slate-800"
            />
          </div>

          {/* Contracts */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Contracts Signed</span>
              <span className="font-bold">
                {todayStats?.signed_contracts || 0} / {todayStats?.goals?.signed_contracts || 1}
              </span>
            </div>
            <Progress 
              value={todayStats?.progress?.signed_contracts || 0} 
              className="h-3 bg-slate-800"
            />
          </div>

          {/* Points earned today */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-slate-400">Points Today</span>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-lg font-bold text-amber-300">
                {todayStats?.total_points || 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Competitions */}
      {competitions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Active Competitions
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/rep/competitions')}
              className="text-slate-400"
            >
              See All <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-2">
            {competitions.map(comp => (
              <Card 
                key={comp.id} 
                className="bg-slate-900/50 border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                onClick={() => navigate(`/rep/competitions/${comp.id}`)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${comp.banner_color}30` }}
                  >
                    {comp.icon || '🏆'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{comp.name}</p>
                    <p className="text-sm text-slate-400 truncate">{comp.tagline}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* My Territories */}
      {territories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" />
              My Territories
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {territories.map(terr => (
              <Card 
                key={terr.id} 
                className="bg-slate-900/50 border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                onClick={() => navigate(`/canvassing?territory=${terr.id}`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: terr.color }}
                    />
                    <p className="font-medium truncate">{terr.name}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>{terr.stats?.coverage_percent || 0}% covered</span>
                    <span>{terr.stats?.total_pins || 0} pins</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold">{todayStats?.doors_knocked || 0}</p>
            <p className="text-sm text-slate-400">Doors Today</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-4 text-center">
            <Award className="w-6 h-6 mx-auto mb-2 text-purple-400" />
            <p className="text-2xl font-bold">{todayStats?.appointments_set || 0}</p>
            <p className="text-sm text-slate-400">Appointments</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RepHome;
