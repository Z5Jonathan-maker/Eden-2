/**
 * University Module - Stats Overview Component
 */

import React from 'react';
import { Card, CardContent } from '../shared/ui/card';
import { GraduationCap, BookOpen, Award, TrendingUp } from 'lucide-react';

export const StatsOverview = ({ stats, certificates }) => {
  if (!stats) return null;
  
  const statItems = [
    {
      icon: <GraduationCap className="w-6 h-6 text-orange-600" />,
      label: 'Courses Completed',
      value: stats.courses_completed || 0,
      total: stats.total_courses || 0,
      bgColor: 'bg-orange-100'
    },
    {
      icon: <BookOpen className="w-6 h-6 text-blue-600" />,
      label: 'Articles Read',
      value: stats.articles_read || 0,
      total: stats.total_articles || 0,
      bgColor: 'bg-blue-100'
    },
    {
      icon: <Award className="w-6 h-6 text-green-600" />,
      label: 'Certificates',
      value: certificates?.length || 0,
      bgColor: 'bg-green-100'
    },
    {
      icon: <TrendingUp className="w-6 h-6 text-purple-600" />,
      label: 'Learning Streak',
      value: stats.streak_days || 0,
      suffix: 'days',
      bgColor: 'bg-purple-100'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {statItems.map((item, index) => (
        <Card key={index} className="dark:bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bgColor}`}>
                {item.icon}
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {item.value}
                  {item.total ? `/${item.total}` : ''}
                  {item.suffix ? ` ${item.suffix}` : ''}
                </p>
                <p className="text-sm text-gray-500">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsOverview;
