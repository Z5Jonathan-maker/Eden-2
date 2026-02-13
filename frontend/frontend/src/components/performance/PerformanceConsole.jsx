/**
 * PerformanceConsole - Unified admin console for field performance
 * 
 * Combines:
 * - Harvest configuration (territories, dispositions, goals)
 * - Incentives management (competitions, templates, rewards)
 * 
 * Enzy-style ops dashboard for admins/managers.
 */
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  MapPin, Trophy, Settings, Users, Target, 
  Gift, Calendar, BarChart3, Zap
} from 'lucide-react';

// Import existing admin consoles
import HarvestAdminConsole from '../HarvestAdminConsole';
import IncentivesAdminConsole from '../IncentivesAdminConsole';

const PerformanceConsole = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50" data-testid="performance-console">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Zap className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Performance Console</h1>
              <p className="text-white/70">Harvest operations & incentives management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="harvest" className="flex items-center gap-2" data-testid="tab-harvest">
              <MapPin className="w-4 h-4" />
              Harvest & Territories
            </TabsTrigger>
            <TabsTrigger value="incentives" className="flex items-center gap-2" data-testid="tab-incentives">
              <Trophy className="w-4 h-4" />
              Competitions & Rewards
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Quick Stats */}
          <TabsContent value="overview">
            <PerformanceOverview onNavigate={setActiveTab} />
          </TabsContent>

          {/* Harvest Tab */}
          <TabsContent value="harvest">
            <HarvestAdminConsole />
          </TabsContent>

          {/* Incentives Tab */}
          <TabsContent value="incentives">
            <IncentivesAdminConsole />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};


/**
 * Performance Overview - Quick stats and actions
 */
const PerformanceOverview = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    activeCompetitions: 0,
    totalReps: 0,
    todayDoors: 0,
    todayAppointments: 0,
    territories: 0,
    activeStreaks: 0
  });

  // TODO: Fetch real stats from API

  const quickActions = [
    {
      title: 'Launch Competition',
      description: 'Create a new competition from template',
      icon: Trophy,
      color: 'bg-orange-500',
      onClick: () => onNavigate('incentives')
    },
    {
      title: 'Assign Territories',
      description: 'Manage territory assignments',
      icon: MapPin,
      color: 'bg-blue-500',
      onClick: () => onNavigate('harvest')
    },
    {
      title: 'Configure Goals',
      description: 'Set daily targets for reps',
      icon: Target,
      color: 'bg-green-500',
      onClick: () => onNavigate('harvest')
    },
    {
      title: 'Manage Rewards',
      description: 'Update reward catalog',
      icon: Gift,
      color: 'bg-purple-500',
      onClick: () => onNavigate('incentives')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          title="Active Competitions"
          value="3"
          icon={Trophy}
          color="text-orange-500"
        />
        <StatCard 
          title="Active Reps"
          value="12"
          icon={Users}
          color="text-blue-500"
        />
        <StatCard 
          title="Doors Today"
          value="247"
          icon={MapPin}
          color="text-green-500"
        />
        <StatCard 
          title="Appointments"
          value="18"
          icon={Calendar}
          color="text-purple-500"
        />
        <StatCard 
          title="Territories"
          value="8"
          icon={Target}
          color="text-cyan-500"
        />
        <StatCard 
          title="Active Streaks"
          value="9"
          icon={Zap}
          color="text-amber-500"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <Card 
              key={idx}
              className="cursor-pointer hover:border-slate-300 transition-colors"
              onClick={action.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${action.color} text-white`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              <ActivityItem 
                icon={Trophy}
                iconColor="text-orange-500"
                title="New competition started"
                description="Weekend Blitz is now active"
                time="2 hours ago"
              />
              <ActivityItem 
                icon={MapPin}
                iconColor="text-blue-500"
                title="Territory assigned"
                description="Zone 5 assigned to John Smith"
                time="4 hours ago"
              />
              <ActivityItem 
                icon={Gift}
                iconColor="text-purple-500"
                title="Reward redeemed"
                description="$50 Amazon Gift Card by Sarah Jones"
                time="Yesterday"
              />
              <ActivityItem 
                icon={Target}
                iconColor="text-green-500"
                title="Daily goals updated"
                description="Door target increased to 50"
                time="2 days ago"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);


const ActivityItem = ({ icon: Icon, iconColor, title, description, time }) => (
  <div className="flex items-start gap-3 p-4">
    <div className={`p-2 rounded-full bg-slate-100 ${iconColor}`}>
      <Icon className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
  </div>
);


export default PerformanceConsole;
