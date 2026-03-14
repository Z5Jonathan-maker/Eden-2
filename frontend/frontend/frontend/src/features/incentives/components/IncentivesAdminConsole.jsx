import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/ui/tabs';
import {
  Trophy,
  Calendar,
  BarChart3,
  Gift,
  Shield,
  Copy,
} from 'lucide-react';
import { NAV_ICONS } from '../../../assets/badges';
import { CompetitionsTab } from './CompetitionsTab';
import { TemplatesTab } from './TemplatesTab';
import { SeasonsTab } from './SeasonsTab';
import { MetricsTab } from './MetricsTab';
import { BadgesTab } from './BadgesTab';
import { RewardsTab } from './RewardsTab';

const IncentivesAdminConsole = () => {
  const [activeTab, setActiveTab] = useState('competitions');

  return (
    <div className="min-h-screen page-enter" data-testid="incentives-admin-console">
      {/* Header */}
      <div className="bg-zinc-900/80 border-b border-zinc-800/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3 animate-fade-in-up">
            <img
              src={NAV_ICONS.incentives}
              alt="Incentives"
              className="w-12 h-12 object-contain icon-3d-shadow"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-tactical font-bold text-white tracking-wide text-glow-orange">
                INCENTIVES ENGINE
              </h1>
              <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">
                Competitions, rewards, badges & seasons
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger
              value="competitions"
              className="flex items-center gap-2"
              data-testid="tab-competitions"
            >
              <Trophy className="w-4 h-4" />
              Competitions
            </TabsTrigger>
            <TabsTrigger
              value="templates"
              className="flex items-center gap-2"
              data-testid="tab-templates"
            >
              <Copy className="w-4 h-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger
              value="seasons"
              className="flex items-center gap-2"
              data-testid="tab-seasons"
            >
              <Calendar className="w-4 h-4" />
              Seasons
            </TabsTrigger>
            <TabsTrigger
              value="badges"
              className="flex items-center gap-2"
              data-testid="tab-badges"
            >
              <Shield className="w-4 h-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger
              value="rewards"
              className="flex items-center gap-2"
              data-testid="tab-rewards"
            >
              <Gift className="w-4 h-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger
              value="metrics"
              className="flex items-center gap-2"
              data-testid="tab-metrics"
            >
              <BarChart3 className="w-4 h-4" />
              Metrics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="competitions">
            <CompetitionsTab />
          </TabsContent>
          <TabsContent value="templates">
            <TemplatesTab />
          </TabsContent>
          <TabsContent value="seasons">
            <SeasonsTab />
          </TabsContent>
          <TabsContent value="badges">
            <BadgesTab />
          </TabsContent>
          <TabsContent value="rewards">
            <RewardsTab />
          </TabsContent>
          <TabsContent value="metrics">
            <MetricsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IncentivesAdminConsole;
