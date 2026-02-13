/**
 * Harvest Module - Competitions Tab Component
 * Displays active competitions with progress, leaderboards, and join functionality
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import { Progress } from '../shared/ui/progress';
import { Input } from '../shared/ui/input';
import {
  Flame,
  Trophy,
  Clock,
  Users,
  Target,
  Plus,
  Medal,
  TrendingUp,
  Calendar,
  Gift,
  ChevronRight,
  Crown,
  Star,
} from 'lucide-react';

// Create Competition Modal
const CreateCompetitionModal = ({ show, onClose, onCreate }) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    prize: '',
    metric: 'doors',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    target_value: '',
  });

  if (!show) return null;

  const handleSubmit = () => {
    if (!form.title || !form.end_date) return;
    onCreate(form);
    setForm({
      title: '',
      description: '',
      prize: '',
      metric: 'doors',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      target_value: '',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <Card className="bg-zinc-900 border-zinc-700/50 w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Trophy className="w-5 h-5 text-orange-400" />
            Create Competition
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Title *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Weekly Door Blitz"
              className="bg-zinc-800 border-zinc-600 text-white"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Knock the most doors to win!"
              className="bg-zinc-800 border-zinc-600 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Prize</label>
              <Input
                value={form.prize}
                onChange={(e) => setForm({ ...form, prize: e.target.value })}
                placeholder="$500"
                className="bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Metric</label>
              <select
                value={form.metric}
                onChange={(e) => setForm({ ...form, metric: e.target.value })}
                className="w-full h-9 px-3 bg-gray-800 border border-zinc-600 rounded-md text-white"
              >
                <option value="doors">Doors Knocked</option>
                <option value="appointments">Appointments</option>
                <option value="signed">Contracts Signed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">Start Date</label>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1 block">End Date *</label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-1 block">Target (optional)</label>
            <Input
              type="number"
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              placeholder="e.g., 1000 doors"
              className="bg-zinc-800 border-zinc-600 text-white"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-zinc-600 text-zinc-400"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              onClick={handleSubmit}
              disabled={!form.title || !form.end_date}
            >
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Competition Card
const CompetitionCard = ({ competition, onJoin, isJoined }) => {
  const progressPercent = competition.target_value
    ? Math.min(100, (competition.my_progress / competition.target_value) * 100)
    : competition.leader_progress > 0
      ? Math.min(100, (competition.my_progress / competition.leader_progress) * 100)
      : 0;

  const getMetricIcon = (metric) => {
    switch (metric) {
      case 'doors':
        return '🚪';
      case 'appointments':
        return '📅';
      case 'signed':
        return '✍️';
      default:
        return '🎯';
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-700/50 overflow-hidden hover:border-orange-500/30 transition-colors">
      {/* Header Gradient */}
      <div className="h-24 bg-gradient-to-br from-orange-600 via-red-500 to-pink-600 relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-1">{getMetricIcon(competition.metric)}</div>
            <h3 className="text-white font-bold text-lg drop-shadow-lg">
              {competition.title || competition.name}
            </h3>
          </div>
        </div>
        {/* Time Badge */}
        <div className="absolute top-2 right-2">
          <Badge className="bg-black/30 text-white border-0">
            <Clock className="w-3 h-3 mr-1" />
            {competition.ends_in || 'Active'}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Stats Row */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-400 text-sm">
              {competition.participants || 0} competitors
            </span>
          </div>
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            {competition.metric === 'doors'
              ? 'Doors'
              : competition.metric === 'appointments'
                ? 'Appointments'
                : 'Contracts'}
          </Badge>
        </div>

        {/* Description */}
        <p className="text-zinc-400 text-sm line-clamp-2">
          {competition.description || 'Compete to win amazing prizes!'}
        </p>

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Your Progress</span>
            <span className="text-white font-medium">
              {competition.my_progress || 0}
              {competition.target_value && ` / ${competition.target_value}`}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Leader Info */}
        {competition.leader_name && competition.leader_name !== 'No entries' && (
          <div className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span className="text-zinc-400 text-sm">Leader:</span>
              <span className="text-white text-sm font-medium">{competition.leader_name}</span>
            </div>
            <span className="text-orange-400 font-bold">{competition.leader_progress || 0}</span>
          </div>
        )}

        {/* Prize & Action */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-xs text-zinc-500">Prize</p>
              <p className="text-green-400 font-bold">{competition.prize || 'TBD'}</p>
            </div>
          </div>

          {isJoined ? (
            <Button variant="outline" className="border-green-500 text-green-400" disabled>
              <Star className="w-4 h-4 mr-2" />
              Joined
            </Button>
          ) : (
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => onJoin(competition.id)}
            >
              Join Competition
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Empty State
const EmptyState = ({ canCreate, onCreateClick }) => (
  <div className="text-center py-16">
    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center">
      <Flame className="w-10 h-10 text-orange-500" />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">No Active Competitions</h3>
    <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
      Competitions bring out the best in teams. Check back soon for new challenges!
    </p>
    {canCreate && (
      <Button className="bg-orange-500 hover:bg-orange-600" onClick={onCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        Create First Competition
      </Button>
    )}
  </div>
);

// Main Competitions Tab Component
export const CompetitionsTab = ({
  competitions = [],
  canCreate = false,
  onCreateCompetition,
  onJoinCompetition,
  currentUserId,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreate = async (form) => {
    if (onCreateCompetition) {
      await onCreateCompetition(form);
    }
    setShowCreateModal(false);
  };

  const handleJoin = async (competitionId) => {
    if (onJoinCompetition) {
      await onJoinCompetition(competitionId);
    }
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white px-5 py-2 rounded-full font-bold shadow-lg">
          <Flame className="w-5 h-5" />
          COMPETITIONS
        </div>

        {canCreate && competitions.length > 0 && (
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Competition
          </Button>
        )}
      </div>

      {/* Competitions Grid */}
      {competitions.length === 0 ? (
        <EmptyState canCreate={canCreate} onCreateClick={() => setShowCreateModal(true)} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitions.map((comp) => (
            <CompetitionCard
              key={comp.id}
              competition={comp}
              onJoin={handleJoin}
              isJoined={comp.participants_list?.includes(currentUserId)}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateCompetitionModal
        show={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default CompetitionsTab;
