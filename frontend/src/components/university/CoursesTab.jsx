/**
 * University Module - Courses Tab Component
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../shared/ui/card';
import { Badge } from '../shared/ui/badge';
import { Progress } from '../shared/ui/progress';
import { Clock, CheckCircle, PlayCircle, ChevronRight } from 'lucide-react';

const CategoryFilter = ({ categoryFilter, setCategoryFilter }) => {
  const categories = [
    { id: 'all', label: 'All' },
    { id: 'training', label: 'Training' },
    { id: 'industry', label: 'Industry' },
    { id: 'advanced', label: 'Advanced' }
  ];

  return (
    <div className="flex space-x-2 mb-4">
      {categories.map((cat) => (
        <Badge 
          key={cat.id}
          className={`cursor-pointer ${
            categoryFilter === cat.id 
              ? 'bg-orange-600' 
              : 'bg-gray-200 text-gray-700'
          }`}
          onClick={() => setCategoryFilter(cat.id)}
        >
          {cat.label}
        </Badge>
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
    if (!course.lessons) return 0;
    return course.lessons.reduce((total, lesson) => total + (lesson.duration_minutes || 10), 0);
  };

  const progress = getProgressPercentage();
  const isCompleted = course.user_progress?.quiz_passed;
  const lessonCount = course.lessons?.length || 0;

  return (
    <Card 
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {course.thumbnail && (
        <div className="h-40 bg-gray-200 overflow-hidden">
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2">
          <Badge variant="outline" className="text-xs">
            {course.category === 'training' ? 'Training' : 'Industry'}
          </Badge>
          {isCompleted && (
            <Badge className="bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Done
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">{course.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
        
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <PlayCircle className="w-4 h-4 mr-1" />
          <span>{lessonCount} lessons</span>
          <span className="mx-2">•</span>
          <Clock className="w-4 h-4 mr-1" />
          <span>{getTotalDuration()} min</span>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-gray-500">{progress}% complete</p>
        </div>

        <div className="mt-4 flex items-center text-orange-600 text-sm font-medium">
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
    : courses.filter((c) => c.category === categoryFilter);

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
        <div className="text-center py-12 text-gray-500">
          No courses found in this category.
        </div>
      )}
    </div>
  );
};

export default CoursesTab;
