/**
 * SessionSummary — End-of-session payoff screen
 *
 * Shown after Field Mode ends. All the gamification suppressed during
 * canvassing now pays off here: points earned, doors/hour, status breakdown,
 * and session comparison to personal bests.
 */
import React from 'react';
import { FIELD_MODE_PINS } from '../../features/harvest/components/constants';
import { motion } from 'framer-motion';
import {
  Trophy,
  Clock,
  DoorOpen,
  TrendingUp,
  Zap,
  ArrowRight,
  Check,
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color = 'text-white', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl p-4 flex flex-col items-center gap-1"
  >
    <Icon className={`w-5 h-5 ${color} mb-1`} />
    <span className={`text-2xl font-bold font-mono ${color}`}>{value}</span>
    <span className="text-zinc-500 text-[10px] font-mono uppercase tracking-wider">{label}</span>
  </motion.div>
);

const SessionSummary = ({ summary, onClose }) => {
  if (!summary) return null;

  const {
    duration_minutes = 0,
    total_pins = 0,
    total_points = 0,
    status_counts = {},
    doors_per_hour = 0,
  } = summary;

  const hours = Math.floor(duration_minutes / 60);
  const mins = duration_minutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Build status breakdown
  const statusBreakdown = FIELD_MODE_PINS.map(({ code, label, color }) => ({
    code,
    label,
    color,
    count: status_counts[code] || 0,
  })).filter((s) => s.count > 0);

  const hasDeals = (status_counts.DL || 0) > 0;
  const hasAppointments = (status_counts.AP || 0) > 0;

  return (
    <div className="h-full flex flex-col bg-zinc-900 overflow-y-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-8 pb-4 px-6"
      >
        <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/30">
          <Trophy className="w-8 h-8 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Session Complete</h1>
        <p className="text-zinc-500 text-sm font-mono">
          {timeDisplay} in the field
        </p>
      </motion.div>

      {/* Key metrics grid */}
      <div className="px-4 grid grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={DoorOpen}
          label="Doors"
          value={total_pins}
          color="text-orange-400"
          delay={0.1}
        />
        <StatCard
          icon={Zap}
          label="Points"
          value={total_points}
          color="text-yellow-400"
          delay={0.2}
        />
        <StatCard
          icon={TrendingUp}
          label="Doors/hr"
          value={doors_per_hour}
          color="text-blue-400"
          delay={0.3}
        />
      </div>

      {/* Status breakdown */}
      {statusBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="px-4 mb-6"
        >
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 px-1">
            Pin Breakdown
          </h3>
          <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {statusBreakdown.map(({ code, label, color, count }) => (
              <div key={code} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-white text-sm font-medium">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold font-mono">{count}</span>
                  <span className="text-zinc-600 text-xs font-mono">
                    {total_pins > 0 ? `${Math.round((count / total_pins) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Highlights */}
      {(hasDeals || hasAppointments) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="px-4 mb-6"
        >
          <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-3 px-1">
            Highlights
          </h3>
          <div className="space-y-2">
            {hasDeals && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-300 text-sm font-medium">
                  {status_counts.DL} Deal{status_counts.DL > 1 ? 's' : ''} Closed
                </span>
              </div>
            )}
            {hasAppointments && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <Check className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 text-sm font-medium">
                  {status_counts.AP} Appointment{status_counts.AP > 1 ? 's' : ''} Set
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* No activity fallback */}
      {total_pins === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="px-4 mb-6 text-center"
        >
          <p className="text-zinc-500 text-sm">No doors knocked this session.</p>
          <p className="text-zinc-600 text-xs mt-1">Get out there next time!</p>
        </motion.div>
      )}

      {/* Close button */}
      <div className="px-4 pb-8 mt-auto">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          onClick={onClose}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-sm"
        >
          Back to Harvest
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
};

export default SessionSummary;
