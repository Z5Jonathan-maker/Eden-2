/**
 * University Module - Stats Banner Component
 * Tactical Military Style Stats Cards
 */

import React from 'react';
import { BookOpen, CheckCircle, TrendingUp, Award } from 'lucide-react';

export const StatsBanner = ({ stats }) => {
  if (!stats) return null;

  const statCards = [
    {
      label: 'Courses',
      value: stats.total_courses,
      icon: BookOpen,
      color: 'blue',
      borderColor: 'border-blue-500/30',
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-400'
    },
    {
      label: 'Completed',
      value: stats.completed_courses,
      icon: CheckCircle,
      color: 'green',
      borderColor: 'border-green-500/30',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-400'
    },
    {
      label: 'In Progress',
      value: stats.in_progress,
      icon: TrendingUp,
      color: 'purple',
      borderColor: 'border-purple-500/30',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-400'
    },
    {
      label: 'Certificates',
      value: stats.certificates,
      icon: Award,
      color: 'orange',
      borderColor: 'border-orange-500/30',
      iconBg: 'bg-orange-500/10',
      iconColor: 'text-orange-400'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div 
            key={index} 
            className={`card-tactical p-3 sm:p-5 border-l-2 ${stat.borderColor}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-xs sm:text-sm font-mono uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl sm:text-3xl font-tactical font-bold text-white">{stat.value}</p>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg ${stat.iconBg}`}>
                <Icon className={`w-6 h-6 sm:w-8 sm:h-8 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsBanner;
