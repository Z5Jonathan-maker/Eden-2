import React from 'react';
import { CalendarClock, Clock3, Flag } from 'lucide-react';
import MissionCard from './MissionCard';
import { Mission } from './types';

interface Props {
  title: string;
  type: 'daily' | 'weekly' | 'seasonal';
  missions: Mission[];
  completedMissionIds: string[];
  claimFxMissionId: string | null;
  timeRemaining: string;
  onAdvance: (missionId: string) => void;
  onClaim: (missionId: string) => void;
}

const iconByType = {
  daily: Clock3,
  weekly: CalendarClock,
  seasonal: Flag,
};

const MissionCategorySection: React.FC<Props> = ({
  title,
  type,
  missions,
  completedMissionIds,
  claimFxMissionId,
  timeRemaining,
  onAdvance,
  onClaim,
}) => {
  const Icon = iconByType[type];
  const active = missions.filter((m) => !completedMissionIds.includes(m.id));
  const completed = missions.filter((m) => completedMissionIds.includes(m.id));

  return (
    <section className="rounded-xl border border-zinc-700/60 bg-zinc-900/65 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-cyan-300" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-100">{title}</h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Resets {timeRemaining}
        </span>
      </div>

      <div className="space-y-3">
        {active.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            completed={false}
            claimFx={claimFxMissionId === mission.id}
            justCompleted={false}
            timeRemaining={timeRemaining}
            onAdvance={onAdvance}
            onClaim={onClaim}
          />
        ))}
        {!active.length && (
          <p className="text-xs text-zinc-500">All {title.toLowerCase()} complete.</p>
        )}
      </div>

      {!!completed.length && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Completed Missions
          </p>
          <div className="space-y-2">
            {completed.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                completed={true}
                claimFx={false}
                justCompleted={claimFxMissionId === mission.id}
                timeRemaining={timeRemaining}
                onAdvance={onAdvance}
                onClaim={onClaim}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default MissionCategorySection;
