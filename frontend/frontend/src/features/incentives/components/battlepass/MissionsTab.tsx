import React from 'react';
import MissionCategorySection from './MissionCategorySection';
import { Mission } from './types';

interface Props {
  missions: Mission[];
  completedMissionIds: string[];
  claimFxMissionId: string | null;
  onAdvanceMission: (missionId: string) => void;
  onClaimMission: (missionId: string) => void;
  getTimeRemaining: (type: 'daily' | 'weekly' | 'seasonal') => string;
}

const MissionsTab: React.FC<Props> = ({
  missions,
  completedMissionIds,
  claimFxMissionId,
  onAdvanceMission,
  onClaimMission,
  getTimeRemaining,
}) => {
  const daily = missions.filter((m) => m.type === 'daily');
  const weekly = missions.filter((m) => m.type === 'weekly');
  const seasonal = missions.filter((m) => m.type === 'seasonal');

  return (
    <div className="space-y-4">
      <MissionCategorySection
        title="Daily Ops"
        type="daily"
        missions={daily}
        completedMissionIds={completedMissionIds}
        claimFxMissionId={claimFxMissionId}
        timeRemaining={getTimeRemaining('daily')}
        onAdvance={onAdvanceMission}
        onClaim={onClaimMission}
      />
      <MissionCategorySection
        title="Weekly Ops"
        type="weekly"
        missions={weekly}
        completedMissionIds={completedMissionIds}
        claimFxMissionId={claimFxMissionId}
        timeRemaining={getTimeRemaining('weekly')}
        onAdvance={onAdvanceMission}
        onClaim={onClaimMission}
      />
      <MissionCategorySection
        title="Seasonal Ops"
        type="seasonal"
        missions={seasonal}
        completedMissionIds={completedMissionIds}
        claimFxMissionId={claimFxMissionId}
        timeRemaining={getTimeRemaining('seasonal')}
        onAdvance={onAdvanceMission}
        onClaim={onClaimMission}
      />
    </div>
  );
};

export default MissionsTab;
