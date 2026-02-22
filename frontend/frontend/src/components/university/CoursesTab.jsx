/**
 * University Module - Courses Tab Component
 * Supports track-based filtering (Foundation / Operator / Advanced-Elite)
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Progress } from '../../shared/ui/progress';
import { Clock, CheckCircle, PlayCircle, ChevronRight, Shield, Crosshair, Star } from 'lucide-react';

const TRACK_FILTERS = [
  { id: 'all', label: 'All Courses' },
  { id: 'foundation', label: 'Foundation' },
  { id: 'operator', label: 'Operator' },
  { id: 'advanced-elite', label: 'Advanced-Elite' }
];

const TRACK_STYLE = {
  foundation: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Foundation', icon: Shield },
  operator: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', label: 'Operator', icon: Crosshair },
  'advanced-elite': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', label: 'Advanced-Elite', icon: Star },
  // Fallbacks for legacy category values
  training: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Training', icon: Shield },
  industry: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30', label: 'Industry', icon: Shield },
  advanced: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', label: 'Advanced', icon: Star },
};

const CategoryFilter = ({ categoryFilter, setCategoryFilter }) => {
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {TRACK_FILTERS.map((cat) => (
        <button
          key={cat.id}
          className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border ${
            categoryFilter === cat.id
              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
              : 'text-zinc-400 border-zinc-700/40 hover:text-zinc-200 hover:border-zinc-500'
          }`}
          onClick={() => setCategoryFilter(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
};

const CourseCardInner = ({ course, onClick }) => {
  const getProgressPercentage = () => {
    if (!course.user_progress || !course.lessons) return 0;
    const completed = course.user_progress.completed_lessons?.length || 0;
    const total = course.lessons.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getTotalDuration = () => {
    if (course.est_minutes) return course.est_minutes;
    if (!course.lessons) return 0;
    return course.lessons.reduce((total, lesson) => total + (lesson.duration_minutes || 10), 0);
  };

  const progress = getProgressPercentage();
  const isCompleted = course.user_progress?.quiz_passed;
  const lessonCount = course.lessons?.length || 0;
  const trackKey = course.track || course.category;
  const trackStyle = TRACK_STYLE[trackKey] || TRACK_STYLE.training;
  const TrackIcon = trackStyle.icon;

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border-zinc-800/50 hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(249,115,22,0.08)]"
      onClick={onClick}
    >
      {course.thumbnail && (
        <div className="h-40 bg-zinc-900 overflow-hidden">
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover opacity-80" />
        </div>
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2 gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase ${trackStyle.bg} ${trackStyle.text} border ${trackStyle.border}`}>
            <TrackIcon className="w-3 h-3" />
            {trackStyle.label}
          </span>
          {isCompleted && (
            <Badge className="bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Done
            </Badge>
          )}
        </div>

        {course.category && course.track && (
          <p className="text-[10px] text-zinc-500 font-mono uppercase mb-1">{course.category}</p>
        )}

        <h3 className="font-semibold text-lg text-zinc-100 mb-2">{course.title}</h3>
        <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{course.description}</p>

        <div className="flex items-center text-sm text-zinc-500 mb-3">
          <PlayCircle className="w-4 h-4 mr-1" />
          <span>{lessonCount} lessons</span>
          <span className="mx-2">·</span>
          <Clock className="w-4 h-4 mr-1" />
          <span>{getTotalDuration()} min</span>
          {course.difficulty && (
            <>
              <span className="mx-2">·</span>
              <span className="text-orange-400/70">{'★'.repeat(course.difficulty)}</span>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-zinc-500">{progress}% complete</p>
        </div>

        <div className="mt-4 flex items-center text-orange-400 text-sm font-medium font-mono uppercase">
          {isCompleted ? 'Review' : progress > 0 ? 'Continue' : 'Start'} Course
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
};

export const CoursesTab = ({ courses, categoryFilter, setCategoryFilter }) => {
  const navigate = useNavigate();

  const filteredCourses = categoryFilter === 'all'
    ? courses
    : courses.filter((c) => (c.track || c.category) === categoryFilter);

  return (
    <div>
      <CategoryFilter
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCourses.map((course) => (
          <CourseCardInner
            key={course.id}
            course={course}
            onClick={() => navigate(`/university/course/${course.id}`)}
          />
        ))}
      </div>
      {filteredCourses.length === 0 && (
        <div className="text-center py-12 text-zinc-500 font-mono">
          No courses found in this track.
        </div>
      )}
    </div>
  );
};

export default CoursesTab;
