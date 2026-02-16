import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  FileText,
  AlertCircle,
  Target,
  Shield,
  Crosshair,
  Zap,
} from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import { apiGet, apiPost } from '@/lib/api';

const TRACK_LABELS = {
  foundation: 'Foundation',
  operator: 'Operator',
  'advanced-elite': 'Advanced-Elite',
  training: 'Training',
  industry: 'Industry',
  advanced: 'Advanced',
};

function CourseDetail() {
  var params = useParams();
  var courseId = params.courseId;
  var navigate = useNavigate();
  var [course, setCourse] = useState(null);
  var [activeLesson, setActiveLesson] = useState(null);
  var [showQuiz, setShowQuiz] = useState(false);
  var [quizAnswers, setQuizAnswers] = useState([]);
  var [quizResult, setQuizResult] = useState(null);
  var [loading, setLoading] = useState(true);

  const fetchCourse = useCallback(
    async function fetchCourse() {
      setLoading(true);
      try {
        const res = await apiGet('/api/university/courses/' + courseId);
        if (res.ok) {
          const data = res.data;
          setCourse(data);
          if (data.lessons && data.lessons.length > 0) {
            setActiveLesson(data.lessons[0]);
          }
          if (data.quiz) {
            setQuizAnswers(new Array(data.quiz.length).fill(-1));
          }
        }
      } catch (error) {
        console.error('Failed to fetch course:', error);
      } finally {
        setLoading(false);
      }
    },
    [courseId]
  );

  useEffect(
    function () {
      fetchCourse();
    },
    [fetchCourse]
  );

  async function markLessonComplete(lessonId) {
    try {
      await apiPost('/api/university/progress/lesson', {
        course_id: courseId,
        lesson_id: lessonId,
      });
      fetchCourse();
    } catch (error) {
      console.error('Failed to mark lesson complete:', error);
    }
  }

  async function submitQuiz() {
    try {
      const res = await apiPost('/api/university/quiz/submit', {
        course_id: courseId,
        answers: quizAnswers,
      });
      if (res.ok) {
        setQuizResult(res.data);
        fetchCourse();
      }
    } catch (error) {
      console.error('Failed to submit quiz:', error);
    }
  }

  function isLessonComplete(lessonId) {
    if (!course || !course.user_progress || !course.user_progress.completed_lessons) return false;
    return course.user_progress.completed_lessons.indexOf(lessonId) !== -1;
  }

  function getProgress() {
    if (!course || !course.lessons || !course.user_progress) return 0;
    var completed = course.user_progress.completed_lessons
      ? course.user_progress.completed_lessons.length
      : 0;
    return Math.round((completed / course.lessons.length) * 100);
  }

  function allLessonsComplete() {
    if (
      !course ||
      !course.lessons ||
      !course.user_progress ||
      !course.user_progress.completed_lessons
    )
      return false;
    return course.user_progress.completed_lessons.length >= course.lessons.length;
  }

  function getQuizClassName() {
    var base = 'p-4 cursor-pointer';
    if (showQuiz) {
      base = base + ' bg-orange-50 border-l-4 border-orange-600';
    } else {
      base = base + ' hover:bg-gray-50';
    }
    if (!allLessonsComplete()) {
      base = base + ' opacity-50';
    }
    return base;
  }

  function getLessonClassName(isActive) {
    if (isActive) {
      return 'p-4 cursor-pointer bg-orange-50 border-l-4 border-orange-600';
    }
    return 'p-4 cursor-pointer hover:bg-gray-50';
  }

  function getIconClassName(isComplete) {
    if (isComplete) {
      return 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-green-100 text-green-600';
    }
    return 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-gray-100 text-gray-600';
  }

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold">Course not found</h3>
            <Button
              className="mt-4"
              onClick={function () {
                navigate('/university');
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  var trackLabel = TRACK_LABELS[course.track] || TRACK_LABELS[course.category] || course.category;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={function () {
            navigate('/university');
          }}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to University
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{trackLabel}</Badge>
              {course.category && course.track && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  {course.category}
                </Badge>
              )}
              {course.difficulty && (
                <span className="text-orange-500 text-sm">{'★'.repeat(course.difficulty)}</span>
              )}
            </div>
            <h1 className="text-3xl font-tactical font-bold text-white tracking-wide">
              {course.title}
            </h1>
            <p className="text-gray-600 mt-2">{course.description}</p>
          </div>
          {course.user_progress && course.user_progress.quiz_passed && (
            <Badge className="bg-green-600 text-lg px-4 py-2">
              <Award className="w-5 h-5 mr-2" />
              Completed
            </Badge>
          )}
        </div>

        {/* Why This Matters + Outcomes */}
        {(course.why_this_matters || (course.outcomes && course.outcomes.length > 0)) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {course.why_this_matters && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-800 flex items-center mb-2">
                  <Target className="w-4 h-4 mr-1.5" />
                  Why This Matters
                </h4>
                <p className="text-sm text-orange-900/80">{course.why_this_matters}</p>
              </div>
            )}
            {course.outcomes && course.outcomes.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-800 flex items-center mb-2">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  What You'll Learn
                </h4>
                <ul className="space-y-1">
                  {course.outcomes.map(function (outcome, i) {
                    return (
                      <li key={i} className="text-sm text-blue-900/80 flex items-start">
                        <span className="text-blue-500 mr-2 mt-0.5">→</span>
                        {outcome}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{getProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-orange-600 h-3 rounded-full"
              style={{ width: getProgress() + '%' }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {course.lessons &&
                  course.lessons.map(function (lesson, index) {
                    var isComplete = isLessonComplete(lesson.id);
                    var isActive = activeLesson && activeLesson.id === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={getLessonClassName(isActive)}
                        onClick={function () {
                          setActiveLesson(lesson);
                          setShowQuiz(false);
                        }}
                      >
                        <div className="flex items-center">
                          <div className={getIconClassName(isComplete)}>
                            {isComplete ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <p className={isActive ? 'font-medium text-orange-600' : 'font-medium'}>
                              {lesson.title}
                            </p>
                            <p className="text-xs text-gray-500">{lesson.duration_minutes} min</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {course.quiz && course.quiz.length > 0 && (
                  <div
                    className={getQuizClassName()}
                    onClick={function () {
                      if (allLessonsComplete()) {
                        setShowQuiz(true);
                        setActiveLesson(null);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-purple-100 text-purple-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={showQuiz ? 'font-medium text-orange-600' : 'font-medium'}>
                          Final Quiz
                        </p>
                        <p className="text-xs text-gray-500">{course.quiz.length} questions</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {activeLesson && !showQuiz && (
            <Card>
              <CardHeader>
                <CardTitle>{activeLesson.title}</CardTitle>
                <p className="text-gray-600 text-sm">{activeLesson.description}</p>
              </CardHeader>
              <CardContent>
                {/* Teaching Beats */}
                {activeLesson.teaching_beats && activeLesson.teaching_beats.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Key Takeaways
                    </h4>
                    <ul className="space-y-1.5">
                      {activeLesson.teaching_beats.map(function (beat, i) {
                        return (
                          <li key={i} className="text-sm text-gray-700 flex items-start">
                            <Zap className="w-3.5 h-3.5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                            {beat}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="prose max-w-none whitespace-pre-wrap">{activeLesson.content}</div>

                {/* Carrier Move / Our Move */}
                {(activeLesson.carrier_move || activeLesson.our_move) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {activeLesson.carrier_move && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center mb-2">
                          <Shield className="w-3.5 h-3.5 mr-1.5" />
                          Carrier Move
                        </h4>
                        <p className="text-sm text-red-900/80">{activeLesson.carrier_move}</p>
                      </div>
                    )}
                    {activeLesson.our_move && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider flex items-center mb-2">
                          <Crosshair className="w-3.5 h-3.5 mr-1.5" />
                          Our Move
                        </h4>
                        <p className="text-sm text-green-900/80">{activeLesson.our_move}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Completion Criteria */}
                {activeLesson.completion_criteria && (
                  <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-purple-700">
                      <span className="font-semibold uppercase tracking-wider">To complete:</span>{' '}
                      {activeLesson.completion_criteria}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  {!isLessonComplete(activeLesson.id) ? (
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={function () {
                        markLessonComplete(activeLesson.id);
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark Complete
                    </Button>
                  ) : (
                    <Badge className="bg-green-100 text-green-700 px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Completed
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {showQuiz && (
            <Card>
              <CardHeader>
                <CardTitle>Final Quiz</CardTitle>
                <p className="text-gray-600">70% required to pass</p>
              </CardHeader>
              <CardContent>
                {quizResult ? (
                  <div className="text-center py-8">
                    {quizResult.passed ? (
                      <div>
                        <Award className="w-20 h-20 text-green-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-green-600 mb-2">Congratulations!</h3>
                        <p className="text-gray-600 mb-4">You scored {quizResult.score}%</p>
                        <Button
                          className="bg-orange-600 hover:bg-orange-700"
                          onClick={function () {
                            navigate('/university');
                          }}
                        >
                          View Certificates
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <AlertCircle className="w-20 h-20 text-red-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-red-600 mb-2">Try Again</h3>
                        <p className="text-gray-600 mb-4">You scored {quizResult.score}%</p>
                        <Button
                          variant="outline"
                          onClick={function () {
                            setQuizResult(null);
                            setQuizAnswers(new Array(course.quiz.length).fill(-1));
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {course.quiz &&
                      course.quiz.map(function (question, qIndex) {
                        return (
                          <div key={question.id} className="p-4 bg-gray-50 rounded-lg">
                            <p className="font-medium text-gray-900 mb-3">
                              {qIndex + 1}. {question.question}
                            </p>
                            <div className="space-y-2">
                              {question.options.map(function (option, oIndex) {
                                var optClass =
                                  quizAnswers[qIndex] === oIndex
                                    ? 'flex items-center p-3 rounded-lg cursor-pointer bg-orange-100 border-2 border-orange-500'
                                    : 'flex items-center p-3 rounded-lg cursor-pointer bg-white border-2 border-gray-200';
                                return (
                                  <label key={oIndex} className={optClass}>
                                    <input
                                      type="radio"
                                      name={'q' + qIndex}
                                      checked={quizAnswers[qIndex] === oIndex}
                                      onChange={function () {
                                        var newAnswers = quizAnswers.slice();
                                        newAnswers[qIndex] = oIndex;
                                        setQuizAnswers(newAnswers);
                                      }}
                                      className="sr-only"
                                    />
                                    <span>{option}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={submitQuiz}
                      disabled={quizAnswers.indexOf(-1) !== -1}
                    >
                      Submit Quiz
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseDetail;
