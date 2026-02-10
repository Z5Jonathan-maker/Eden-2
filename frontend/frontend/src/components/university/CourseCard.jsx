/**
 * University Module - Course Card Component
 * Tactical Military Style
 */

import React from 'react';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Clock, CheckCircle, ChevronRight, PlayCircle, BookOpen, Target } from 'lucide-react';

export const CourseCard = ({ course, onClick }) => {
  const progress = course.progress || 0;
  const isComplete = progress >= 100;
  
  const getCategoryStyle = (category) => {
    switch(category) {
      case 'xactimate':
        return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400' };
      case 'sales':
        return { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'text-green-400' };
      case 'operations':
        return { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400' };
      default:
        return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'text-orange-400' };
    }
  };
  
  const style = getCategoryStyle(course.category);
  
  return (
    <div 
      className="card-tactical p-5 cursor-pointer hover:border-orange-500/50 transition-all group"
      onClick={() => onClick?.(course)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${style.bg} border ${style.border}`}>
          {course.category === 'xactimate' ? <BookOpen className={`w-6 h-6 ${style.icon}`} /> :
           course.category === 'sales' ? <PlayCircle className={`w-6 h-6 ${style.icon}`} /> :
           <Target className={`w-6 h-6 ${style.icon}`} />}
        </div>
        {isComplete && (
          <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" /> Complete
          </Badge>
        )}
      </div>
      
      <h3 className="font-tactical font-bold text-lg text-white mb-2 line-clamp-2 uppercase">{course.title}</h3>
      <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{course.description}</p>
      
      <div className="flex items-center justify-between text-sm text-zinc-500 mb-3 font-mono">
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          {course.duration || course.estimated_time || '30 min'}
        </span>
        <span>{course.lessons?.length || course.lesson_count || 0} lessons</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Progress</span>
          <span className="font-medium text-white">{progress}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      <div className="mt-4 flex items-center text-orange-500 text-sm font-medium group-hover:text-orange-400 transition-colors">
        {isComplete ? 'Review Course' : progress > 0 ? 'Continue Learning' : 'Start Course'}
        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};

export default CourseCard;
