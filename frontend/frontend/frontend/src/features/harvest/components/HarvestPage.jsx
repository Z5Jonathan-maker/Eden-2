/**
 * HarvestPage - Operation Eden Tactical Canvassing Experience
 *
 * Two modes:
 * - BASE MODE: 5-tab gamification dashboard (Map, Today, Leaderboard, Challenges, Profile)
 * - FIELD MODE: Map-only canvassing with 6-button quick-tap (DoorMamba-class UX)
 *
 * Field Mode entry: Prominent "GO FIELD" button on the map tab.
 * Field Mode exit: END button -> Session Summary -> back to base.
 *
 * This is the slim orchestrator (~100 lines). All logic is delegated to:
 * - useHarvestData (data fetching + field mode state)
 * - HarvestMapTab (map + filters + stats)
 * - HarvestLeaderboard (podium + ranked list)
 * - HarvestBottomNav (tab bar)
 */
import React, { useState } from 'react';
import FieldMode from '../../../components/harvest/FieldMode';
import SessionSummary from '../../../components/harvest/SessionSummary';
import HarvestTodayTab from '../../../components/HarvestTodayTab';
import HarvestProfileTab from '../../../components/HarvestProfileTab';
import HarvestChallengesTab from '../../../components/HarvestChallengesTab';
import HarvestMapTab from './HarvestMapTab';
import HarvestLeaderboard from './HarvestLeaderboard';
import HarvestBottomNav from './HarvestBottomNav';
import useHarvestData from '../hooks/useHarvestData';

const HarvestPage = () => {
  const [activeTab, setActiveTab] = useState('map');

  const {
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
  } = useHarvestData(activeTab);

  // ---- FIELD MODE: Full takeover ----
  if (fieldModeActive) {
    return <FieldMode onEndSession={handleEndFieldMode} />;
  }

  // ---- SESSION SUMMARY: Payoff screen ----
  if (sessionSummary) {
    return <SessionSummary summary={sessionSummary} onClose={handleCloseSummary} />;
  }

  // ---- BASE MODE: Normal 5-tab dashboard ----
  return (
    <div className="h-[calc(100dvh-64px)] flex flex-col bg-zinc-900" data-testid="harvest-page">
      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'map' && (
          <HarvestMapTab
            myStats={myStats}
            onPinStatusChange={fetchMyStats}
            onEnterFieldMode={handleEnterFieldMode}
          />
        )}

        {activeTab === 'today' && <HarvestTodayTab dailyGoal={75} />}

        {activeTab === 'leaderboard' && (
          <HarvestLeaderboard
            leaderboard={leaderboard}
            period={leaderboardPeriod}
            setPeriod={setLeaderboardPeriod}
            loading={loadingLeaderboard}
            fetchLeaderboard={fetchLeaderboard}
          />
        )}

        {activeTab === 'challenges' && <HarvestChallengesTab />}

        {activeTab === 'profile' && <HarvestProfileTab />}
      </div>

      {/* Bottom Navigation */}
      <HarvestBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default HarvestPage;
