import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../shared/ui/card';
import { Button } from '../shared/ui/button';
import { Badge } from '../shared/ui/badge';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  BookOpen,
  Award,
  ChevronRight,
  FileText,
  AlertCircle,
  Info,
  Target,
  Shield,
  Crosshair,
  Zap,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
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

  function completedLessonCount() {
    if (!course || !course.user_progress || !course.user_progress.completed_lessons) return 0;
    return course.user_progress.completed_lessons.length;
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-8 min-h-screen">
        <Card className="border-zinc-700">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-zinc-200">Course not found</h3>
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
  var lessonsReady = allLessonsComplete();

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={function () {
            navigate('/university');
          }}
          className="mb-4 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to University
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-orange-500/40 text-orange-400">{trackLabel}</Badge>
              {course.category && course.track && (
                <Badge variant="outline" className="text-xs text-zinc-500 border-zinc-700">
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
            <p className="text-zinc-400 mt-2">{course.description}</p>
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
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-300 flex items-center mb-2">
                  <Target className="w-4 h-4 mr-1.5" />
                  Why This Matters
                </h4>
                <p className="text-sm text-orange-200/80">{course.why_this_matters}</p>
              </div>
            )}
            {course.outcomes && course.outcomes.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 flex items-center mb-2">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  What You'll Learn
                </h4>
                <ul className="space-y-1">
                  {course.outcomes.map(function (outcome, i) {
                    return (
                      <li key={i} className="text-sm text-blue-200/80 flex items-start">
                        <span className="text-blue-400 mr-2 mt-0.5">→</span>
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
          <div className="flex justify-between text-sm text-zinc-400 mb-1">
            <span>Progress</span>
            <span>{getProgress()}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-3">
            <div
              className="bg-orange-500 h-3 rounded-full transition-all"
              style={{ width: getProgress() + '%' }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-zinc-200">
                <BookOpen className="w-5 h-5 mr-2 text-orange-400" />
                Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800">
                {course.lessons &&
                  course.lessons.map(function (lesson, index) {
                    var isComplete = isLessonComplete(lesson.id);
                    var isActive = activeLesson && activeLesson.id === lesson.id;

                    return (
                      <div
                        key={lesson.id}
                        className={
                          isActive
                            ? 'p-4 cursor-pointer bg-orange-500/10 border-l-4 border-orange-500'
                            : 'p-4 cursor-pointer hover:bg-zinc-800/50'
                        }
                        onClick={function () {
                          setActiveLesson(lesson);
                          setShowQuiz(false);
                        }}
                      >
                        <div className="flex items-center">
                          <div
                            className={
                              isComplete
                                ? 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-green-500/20 text-green-400'
                                : 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-zinc-800 text-zinc-400'
                            }
                          >
                            {isComplete ? (
                              <CheckCircle className="w-5 h-5" />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>
                          <div>
                            <p className={isActive ? 'font-medium text-orange-400' : 'font-medium text-zinc-200'}>
                              {lesson.title}
                            </p>
                            <p className="text-xs text-zinc-500">{lesson.duration_minutes} min</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* Quiz Entry */}
                {course.quiz && course.quiz.length > 0 && (
                  <div
                    className={
                      showQuiz
                        ? 'p-4 cursor-pointer bg-orange-500/10 border-l-4 border-orange-500'
                        : lessonsReady
                          ? 'p-4 cursor-pointer hover:bg-zinc-800/50'
                          : 'p-4 cursor-pointer hover:bg-zinc-800/50 opacity-60'
                    }
                    onClick={function () {
                      if (lessonsReady) {
                        setShowQuiz(true);
                        setActiveLesson(null);
                      } else {
                        var remaining = (course.lessons?.length || 0) - completedLessonCount();
                        toast.info('Complete all lessons to unlock the quiz (' + remaining + ' remaining)');
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <div className={
                        lessonsReady
                          ? 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-purple-500/20 text-purple-400'
                          : 'w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-zinc-800 text-zinc-500'
                      }>
                        {lessonsReady ? (
                          <FileText className="w-5 h-5" />
                        ) : (
                          <Lock className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className={showQuiz ? 'font-medium text-orange-400' : 'font-medium text-zinc-200'}>
                          Final Quiz
                        </p>
                        <p className="text-xs text-zinc-500">
                          {lessonsReady
                            ? course.quiz.length + ' questions'
                            : 'Complete all lessons to unlock'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {/* Lesson Content */}
          {activeLesson && !showQuiz && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100">{activeLesson.title}</CardTitle>
                <p className="text-zinc-400 text-sm">{activeLesson.description}</p>
              </CardHeader>
              <CardContent>
                {/* Teaching Beats */}
                {activeLesson.teaching_beats && activeLesson.teaching_beats.length > 0 && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Key Takeaways
                    </h4>
                    <ul className="space-y-1.5">
                      {activeLesson.teaching_beats.map(function (beat, i) {
                        return (
                          <li key={i} className="text-sm text-zinc-300 flex items-start">
                            <Zap className="w-3.5 h-3.5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                            {beat}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="prose prose-invert prose-orange max-w-none text-zinc-300 leading-relaxed prose-headings:text-zinc-100 prose-h1:text-2xl prose-h1:border-b prose-h1:border-zinc-700 prose-h1:pb-2 prose-h2:text-xl prose-h2:text-orange-400 prose-h3:text-lg prose-h3:text-zinc-200 prose-strong:text-white prose-li:text-zinc-300 prose-p:text-zinc-300 prose-a:text-orange-400">
                  <ReactMarkdown>{activeLesson.content}</ReactMarkdown>
                </div>

                {/* Carrier Move / Our Move */}
                {(activeLesson.carrier_move || activeLesson.our_move) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {activeLesson.carrier_move && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center mb-2">
                          <Shield className="w-3.5 h-3.5 mr-1.5" />
                          Carrier Move
                        </h4>
                        <p className="text-sm text-red-200/80">{activeLesson.carrier_move}</p>
                      </div>
                    )}
                    {activeLesson.our_move && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center mb-2">
                          <Crosshair className="w-3.5 h-3.5 mr-1.5" />
                          Our Move
                        </h4>
                        <p className="text-sm text-green-200/80">{activeLesson.our_move}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Completion Criteria */}
                {activeLesson.completion_criteria && (
                  <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg px-4 py-3">
                    <p className="text-xs text-purple-300">
                      <span className="font-semibold uppercase tracking-wider">To complete:</span>{' '}
                      {activeLesson.completion_criteria}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-700">
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
                    <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Completed
                    </Badge>
                  )}

                  {/* Next lesson button */}
                  {course.lessons && (() => {
                    var currentIdx = course.lessons.findIndex(l => l.id === activeLesson.id);
                    var nextLesson = currentIdx >= 0 && currentIdx < course.lessons.length - 1
                      ? course.lessons[currentIdx + 1]
                      : null;
                    if (!nextLesson) return null;
                    return (
                      <Button
                        variant="outline"
                        className="border-zinc-700 text-zinc-300 hover:text-white"
                        onClick={function () {
                          setActiveLesson(nextLesson);
                        }}
                      >
                        Next: {nextLesson.title}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quiz */}
          {showQuiz && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100">Final Quiz</CardTitle>
                <p className="text-zinc-400">Score 70% or higher to earn your certificate</p>
              </CardHeader>
              <CardContent>
                {quizResult ? (
                  <div className="py-6">
                    {/* Score banner */}
                    <div className="text-center mb-8">
                      {quizResult.passed ? (
                        <div>
                          <Award className="w-16 h-16 text-green-400 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-green-400 mb-1">Congratulations!</h3>
                          <p className="text-zinc-400 mb-1">You scored {quizResult.score}% ({quizResult.correct}/{quizResult.total} correct)</p>
                          <p className="text-zinc-500 text-sm mb-4">Certificate earned. You can view it in the Certificates tab.</p>
                          <Button
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={function () { navigate('/university'); }}
                          >
                            <Award className="w-4 h-4 mr-2" />
                            View Certificates
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-red-400 mb-1">Not Quite</h3>
                          <p className="text-zinc-400 mb-1">You scored {quizResult.score}% ({quizResult.correct}/{quizResult.total} correct, 70% required)</p>
                          <p className="text-zinc-500 text-sm mb-4">Review the explanations below, then try again.</p>
                          <div className="flex gap-3 justify-center">
                            <Button
                              variant="outline"
                              className="border-zinc-700"
                              onClick={function () {
                                setQuizResult(null);
                                setQuizAnswers(new Array(course.quiz.length).fill(-1));
                              }}
                            >
                              Retry Quiz
                            </Button>
                            <Button
                              variant="outline"
                              className="border-zinc-700"
                              onClick={function () {
                                setShowQuiz(false);
                                if (course.lessons && course.lessons.length > 0) {
                                  setActiveLesson(course.lessons[0]);
                                }
                              }}
                            >
                              Review Lessons
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Per-question breakdown */}
                    {quizResult.details && quizResult.details.length > 0 && (
                      <div className="space-y-4 border-t border-zinc-700 pt-6">
                        <h4 className="text-lg font-semibold text-zinc-200 mb-3">Question Breakdown</h4>
                        {quizResult.details.map(function (detail, idx) {
                          return (
                            <div key={idx} className={
                              detail.is_correct
                                ? 'p-4 rounded-lg border-2 border-green-500/30 bg-green-500/5'
                                : 'p-4 rounded-lg border-2 border-red-500/30 bg-red-500/5'
                            }>
                              <div className="flex items-start gap-2 mb-2">
                                {detail.is_correct
                                  ? <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                                  : <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                                }
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-zinc-100">{idx + 1}. {detail.question}</span>
                                    {detail.question_type === 'scenario' && (
                                      <Badge className="bg-purple-500/20 text-purple-300 text-xs">Scenario</Badge>
                                    )}
                                    {detail.question_type === 'true_false' && (
                                      <Badge className="bg-blue-500/20 text-blue-300 text-xs">True/False</Badge>
                                    )}
                                  </div>
                                  {!detail.is_correct && detail.options && (
                                    <p className="text-sm mt-1">
                                      <span className="text-red-400">Your answer: {detail.options[detail.user_answer] || 'None'}</span>
                                      <span className="text-zinc-500 mx-2">|</span>
                                      <span className="text-green-400">Correct: {detail.options[detail.correct_answer]}</span>
                                    </p>
                                  )}
                                  {detail.explanation && (
                                    <div className="mt-2 flex items-start gap-2 p-2 bg-zinc-800/60 rounded text-sm">
                                      <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                      <span className="text-zinc-400">{detail.explanation}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {course.quiz &&
                      course.quiz.map(function (question, qIndex) {
                        var qType = question.question_type || 'multiple_choice';
                        var isTrueFalse = qType === 'true_false';
                        var isScenario = qType === 'scenario';

                        return (
                          <div key={question.id} className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                            {/* Question type badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-zinc-500">{qIndex + 1} / {course.quiz.length}</span>
                              {isScenario && (
                                <Badge className="bg-purple-500/20 text-purple-300 text-xs">Scenario</Badge>
                              )}
                              {isTrueFalse && (
                                <Badge className="bg-blue-500/20 text-blue-300 text-xs">True / False</Badge>
                              )}
                            </div>

                            {/* Scenario context */}
                            {isScenario && question.scenario_context && (
                              <div className="mb-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                  <p className="text-sm text-zinc-400 italic">{question.scenario_context}</p>
                                </div>
                              </div>
                            )}

                            <p className="font-medium text-zinc-100 mb-3">
                              {question.question}
                            </p>

                            {/* True/False toggle buttons */}
                            {isTrueFalse ? (
                              <div className="grid grid-cols-2 gap-3">
                                {question.options.map(function (option, oIndex) {
                                  var isSelected = quizAnswers[qIndex] === oIndex;
                                  var isTrue = option === 'True';
                                  return (
                                    <button
                                      key={oIndex}
                                      onClick={function () {
                                        var newAnswers = quizAnswers.slice();
                                        newAnswers[qIndex] = oIndex;
                                        setQuizAnswers(newAnswers);
                                      }}
                                      className={
                                        isSelected
                                          ? (isTrue
                                            ? 'p-4 rounded-lg font-semibold text-center border-2 border-green-500 bg-green-500/15 text-green-300'
                                            : 'p-4 rounded-lg font-semibold text-center border-2 border-red-500 bg-red-500/15 text-red-300')
                                          : 'p-4 rounded-lg font-semibold text-center border-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                                      }
                                    >
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              /* Standard multiple-choice / scenario radio options */
                              <div className="space-y-2">
                                {question.options.map(function (option, oIndex) {
                                  var isSelected = quizAnswers[qIndex] === oIndex;
                                  return (
                                    <label
                                      key={oIndex}
                                      className={
                                        isSelected
                                          ? 'flex items-center p-3 rounded-lg cursor-pointer bg-orange-500/15 border-2 border-orange-500 text-orange-200'
                                          : 'flex items-center p-3 rounded-lg cursor-pointer bg-zinc-900 border-2 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                                      }
                                    >
                                      <input
                                        type="radio"
                                        name={'q' + qIndex}
                                        checked={isSelected}
                                        onChange={function () {
                                          var newAnswers = quizAnswers.slice();
                                          newAnswers[qIndex] = oIndex;
                                          setQuizAnswers(newAnswers);
                                        }}
                                        className="sr-only"
                                      />
                                      <div className={
                                        isSelected
                                          ? 'w-5 h-5 rounded-full border-2 border-orange-500 bg-orange-500 mr-3 flex-shrink-0 flex items-center justify-center'
                                          : 'w-5 h-5 rounded-full border-2 border-zinc-600 mr-3 flex-shrink-0'
                                      }>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                      </div>
                                      <span>{option}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                      onClick={submitQuiz}
                      disabled={quizAnswers.indexOf(-1) !== -1}
                    >
                      Submit Quiz ({quizAnswers.filter(function (a) { return a !== -1; }).length}/{course.quiz.length} answered)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state when no lesson or quiz selected */}
          {!activeLesson && !showQuiz && (
            <Card className="border-zinc-700 border-dashed">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-300">Select a lesson to begin</h3>
                <p className="text-zinc-500 mt-1">Choose a lesson from the sidebar to start learning</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default CourseDetail;
