/**
 * useHarvestData - Data fetching hook for Harvest page
 *
 * Encapsulates leaderboard + stats fetching, field mode state,
 * and session summary lifecycle.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api';
import { toast } from 'sonner';

const useHarvestData = (activeTab) => {
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('day');
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // My stats
  const [myStats, setMyStats] = useState({
    today: 0,
    week: 0,
    signed: 0,
    appointments: 0,
    streak: 0,
    multiplier: 1.0,
  });

  // Field Mode
  const [fieldModeActive, setFieldModeActive] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await apiGet(`/api/canvassing-map/leaderboard?period=${leaderboardPeriod}`);
      if (res.ok) {
        setLeaderboard(res.data.leaderboard || res.data || []);
      } else if (res.status !== 401) {
        toast.error('Failed to load leaderboard');
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  }, [leaderboardPeriod]);

  const fetchMyStats = useCallback(async () => {
    try {
      const res = await apiGet('/api/canvassing-map/stats');
      if (res.ok) {
        setMyStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchMyStats();
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab, fetchLeaderboard, fetchMyStats]);

  useEffect(() => {
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [leaderboardPeriod, fetchLeaderboard, activeTab]);

  // Field Mode handlers
  const handleEnterFieldMode = useCallback(() => {
    setFieldModeActive(true);
    setSessionSummary(null);
  }, []);

  const handleEndFieldMode = useCallback(
    (summary) => {
      setFieldModeActive(false);
      if (summary) {
        setSessionSummary(summary);
      }
      fetchMyStats();
    },
    [fetchMyStats]
  );

  const handleCloseSummary = useCallback(() => {
    setSessionSummary(null);
  }, []);

  return {
    leaderboard,
    leaderboardPeriod,
    setLeaderboardPeriod,
    loadingLeaderboard,
    fetchLeaderboard,
    myStats,
    fetchMyStats,
    fieldModeActive,
    sessionSummary,
    handleEnterFieldMode,
    handleEndFieldMode,
    handleCloseSummary,
  };
};

export default useHarvestData;
