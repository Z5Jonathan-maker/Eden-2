import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Layers,
  RotateCcw,
  Dumbbell,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import LessonMarkdown from './university/MarkdownRenderer';
import FlashcardStudy from './university/FlashcardStudy';
import { MatchingQuestion, FillBlankQuestion, OrderingQuestion } from './university/QuizTypes';
import Confetti from './university/Confetti';

const TRACK_LABELS = {
  foundation: 'Foundation',
  operator: 'Operator',
  'advanced-elite': 'Advanced-Elite',
  training: 'Training',
  industry: 'Industry',
  advanced: 'Advanced',
};

function CourseDetail() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [loading, setLoading] = useState(true);

  // Study mode: 'learn' | 'flashcards' | 'practice' | 'test'
  const [viewMode, setViewMode] = useState('learn');

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);

  // Practice mode
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceAnswer, setPracticeAnswer] = useState(null);

  // Flashcards
  const [flashcards, setFlashcards] = useState([]);

  // Confetti
  const [showConfetti, setShowConfetti] = useState(false);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/university/courses/' + courseId);
      if (res.ok) {
        setCourse(res.data);
        if (res.data.lessons?.length > 0) setActiveLesson(res.data.lessons[0]);
        // Initialize quiz answers as object keyed by question index
        if (res.data.quiz) {
          const answers = {};
          res.data.quiz.forEach((_, i) => { answers[i] = null; });
          setQuizAnswers(answers);
        }
      }
    } catch (err) {
      console.error('Failed to fetch course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  // Build flashcards from course data (always works, no backend dependency)
  useEffect(() => {
    if (!course?.lessons) return;
    const cards = [];
    course.lessons.forEach(lesson => {
      // Use explicit flashcards if present on lesson
      if (lesson.flashcards?.length > 0) {
        cards.push(...lesson.flashcards);
        return;
      }
      // Auto-generate from teaching_beats
      if (lesson.teaching_beats?.length > 0) {
        lesson.teaching_beats.forEach((beat, i) => {
          cards.push({
            id: `${lesson.id}-beat-${i}`,
            front: beat,
            back: `Key concept from: ${lesson.title}`,
            category: lesson.title,
          });
        });
      }
      // Auto-generate from carrier_move / our_move
      if (lesson.carrier_move && lesson.our_move) {
        cards.push({
          id: `${lesson.id}-move`,
          front: `Carrier Move: ${lesson.carrier_move}`,
          back: `Our Counter: ${lesson.our_move}`,
          category: lesson.title,
        });
      }
    });
    setFlashcards(cards);
    // Also try API for richer flashcards (will override when backend deploys)
    if (courseId) {
      apiGet(`/api/university/courses/${courseId}/flashcards`)
        .then(res => {
          if (res.ok && res.data?.flashcards?.length > 0) {
            setFlashcards(res.data.flashcards);
          }
        })
        .catch(() => {});
    }
  }, [course, courseId]);

  async function markLessonComplete(lessonId) {
    try {
      await apiPost('/api/university/progress/lesson', { course_id: courseId, lesson_id: lessonId });
      fetchCourse();
    } catch (err) {
      console.error('Failed to mark lesson complete:', err);
    }
  }

  async function submitQuiz() {
    try {
      // Convert answers object to array for backend
      const answersArray = [];
      const quiz = course.quiz || [];
      for (let i = 0; i < quiz.length; i++) {
        const q = quiz[i];
        const ans = quizAnswers[i];
        const qType = q.question_type || 'multiple_choice';
        if (qType === 'matching' || qType === 'fill_blank' || qType === 'ordering') {
          // New types: encode as -1 for legacy endpoint, handle in v2
          answersArray.push(-1);
        } else {
          answersArray.push(ans ?? -1);
        }
      }
      const res = await apiPost('/api/university/quiz/submit', { course_id: courseId, answers: answersArray });
      if (res.ok) {
        setQuizResult(res.data);
        if (res.data.passed) setShowConfetti(true);
        fetchCourse();
      }
    } catch (err) {
      console.error('Failed to submit quiz:', err);
    }
  }

  function isLessonComplete(lessonId) {
    return course?.user_progress?.completed_lessons?.includes(lessonId) || false;
  }

  function getProgress() {
    if (!course?.lessons?.length || !course?.user_progress) return 0;
    const completed = course.user_progress.completed_lessons?.length || 0;
    return Math.round((completed / course.lessons.length) * 100);
  }

  function allLessonsComplete() {
    if (!course?.lessons?.length || !course?.user_progress?.completed_lessons) return false;
    return course.user_progress.completed_lessons.length >= course.lessons.length;
  }

  const lessonsReady = allLessonsComplete();
  const completedCount = course?.user_progress?.completed_lessons?.length || 0;

  function isAllAnswered() {
    if (!course?.quiz) return false;
    return course.quiz.every((q, i) => {
      const ans = quizAnswers[i];
      const qType = q.question_type || 'multiple_choice';
      if (qType === 'fill_blank') return ans && ans.trim().length > 0;
      if (qType === 'matching') return Array.isArray(ans) && ans.length === (q.matching_pairs?.length || 0);
      if (qType === 'ordering') return Array.isArray(ans) && ans.length > 0;
      return ans !== null && ans !== undefined && ans !== -1;
    });
  }

  if (loading) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
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
            <Button className="mt-4" onClick={() => navigate('/university')}>Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trackLabel = TRACK_LABELS[course.track] || TRACK_LABELS[course.category] || course.category;
  const quizQuestions = course.quiz || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen">
      <Confetti show={showConfetti} />

      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/university')} className="mb-4 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to University
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-orange-500/40 text-orange-400">{trackLabel}</Badge>
              {course.difficulty && <span className="text-orange-500 text-sm">{'★'.repeat(course.difficulty)}</span>}
            </div>
            <h1 className="text-3xl font-tactical font-bold text-white tracking-wide">{course.title}</h1>
            <p className="text-zinc-400 mt-2">{course.description}</p>
          </div>
          {course.user_progress?.quiz_passed && (
            <Badge className="bg-green-600 text-lg px-4 py-2">
              <Award className="w-5 h-5 mr-2" /> Completed
            </Badge>
          )}
        </div>

        {/* Why This Matters + Outcomes */}
        {(course.why_this_matters || course.outcomes?.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {course.why_this_matters && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-300 flex items-center mb-2">
                  <Target className="w-4 h-4 mr-1.5" /> Why This Matters
                </h4>
                <p className="text-sm text-orange-200/80">{course.why_this_matters}</p>
              </div>
            )}
            {course.outcomes?.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-300 flex items-center mb-2">
                  <CheckCircle className="w-4 h-4 mr-1.5" /> What You'll Learn
                </h4>
                <ul className="space-y-1">
                  {course.outcomes.map((o, i) => (
                    <li key={i} className="text-sm text-blue-200/80 flex items-start">
                      <span className="text-blue-400 mr-2 mt-0.5">→</span>{o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Step Progress Dots */}
        {course.lessons?.length > 1 && (
          <div className="flex items-center gap-0 overflow-x-auto py-4 mt-2 scrollbar-none">
            {course.lessons.map((lesson, i) => {
              const complete = isLessonComplete(lesson.id);
              const active = activeLesson?.id === lesson.id && viewMode === 'learn';
              return (
                <React.Fragment key={lesson.id}>
                  {i > 0 && (
                    <div className={`h-0.5 w-6 sm:w-10 flex-shrink-0 transition-colors ${complete ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                  )}
                  <button
                    onClick={() => { setActiveLesson(lesson); setViewMode('learn'); }}
                    title={lesson.title}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                      complete ? 'bg-emerald-500 text-white' :
                      active ? 'bg-orange-500 text-white ring-2 ring-orange-500/40 animate-pulse-soft' :
                      'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:border-zinc-500'
                    }`}
                  >
                    {complete ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-sm text-zinc-400 mb-1">
            <span>Progress</span>
            <span>{getProgress()}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5">
            <div className="bg-orange-500 h-2.5 rounded-full transition-all" style={{ width: getProgress() + '%' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Sidebar ─── */}
        <div className="lg:col-span-1">
          <Card className="border-zinc-700">
            <CardHeader>
              <CardTitle className="flex items-center text-zinc-200">
                <BookOpen className="w-5 h-5 mr-2 text-orange-400" /> Lessons
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-800">
                {course.lessons?.map((lesson, index) => {
                  const isComplete = isLessonComplete(lesson.id);
                  const isActive = activeLesson?.id === lesson.id && viewMode === 'learn';
                  return (
                    <div key={lesson.id}
                      className={`p-4 cursor-pointer transition-colors ${isActive ? 'bg-orange-500/10 border-l-4 border-orange-500' : 'hover:bg-zinc-800/50'}`}
                      onClick={() => { setActiveLesson(lesson); setViewMode('learn'); setQuizResult(null); }}>
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isComplete ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
                          {isComplete ? <CheckCircle className="w-5 h-5" /> : <span>{index + 1}</span>}
                        </div>
                        <div>
                          <p className={`font-medium ${isActive ? 'text-orange-400' : 'text-zinc-200'}`}>{lesson.title}</p>
                          <p className="text-xs text-zinc-500">{lesson.duration_minutes} min</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Study Modes Section */}
                {lessonsReady && (
                  <>
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Study Modes</p>
                    </div>

                    {/* Flashcards */}
                    <div
                      className={`p-4 cursor-pointer transition-colors ${viewMode === 'flashcards' ? 'bg-blue-500/10 border-l-4 border-blue-500' : 'hover:bg-zinc-800/50'}`}
                      onClick={() => { setViewMode('flashcards'); setActiveLesson(null); setQuizResult(null); }}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-blue-500/20 text-blue-400">
                          <Layers className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-medium ${viewMode === 'flashcards' ? 'text-blue-400' : 'text-zinc-200'}`}>Flashcards</p>
                          <p className="text-xs text-zinc-500">{flashcards.length} cards</p>
                        </div>
                      </div>
                    </div>

                    {/* Practice */}
                    <div
                      className={`p-4 cursor-pointer transition-colors ${viewMode === 'practice' ? 'bg-emerald-500/10 border-l-4 border-emerald-500' : 'hover:bg-zinc-800/50'}`}
                      onClick={() => { setViewMode('practice'); setActiveLesson(null); setQuizResult(null); setPracticeIndex(0); setPracticeRevealed(false); setPracticeAnswer(null); }}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-emerald-500/20 text-emerald-400">
                          <Dumbbell className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-medium ${viewMode === 'practice' ? 'text-emerald-400' : 'text-zinc-200'}`}>Practice</p>
                          <p className="text-xs text-zinc-500">Instant feedback</p>
                        </div>
                      </div>
                    </div>

                    {/* Test */}
                    <div
                      className={`p-4 cursor-pointer transition-colors ${viewMode === 'test' ? 'bg-purple-500/10 border-l-4 border-purple-500' : 'hover:bg-zinc-800/50'}`}
                      onClick={() => { setViewMode('test'); setActiveLesson(null); }}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-purple-500/20 text-purple-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={`font-medium ${viewMode === 'test' ? 'text-purple-400' : 'text-zinc-200'}`}>Final Quiz</p>
                          <p className="text-xs text-zinc-500">{quizQuestions.length} questions</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Locked quiz prompt */}
                {!lessonsReady && quizQuestions.length > 0 && (
                  <div className="p-4 cursor-pointer hover:bg-zinc-800/50 opacity-60"
                    onClick={() => { const remaining = (course.lessons?.length || 0) - completedCount; toast.info(`Complete all lessons to unlock study modes (${remaining} remaining)`); }}>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-zinc-800 text-zinc-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-400">Study & Quiz</p>
                        <p className="text-xs text-zinc-600">Complete all lessons to unlock</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Main Content Area ─── */}
        <div className="lg:col-span-2">

          {/* ═══ LEARN MODE ═══ */}
          {viewMode === 'learn' && activeLesson && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100">{activeLesson.title}</CardTitle>
                <p className="text-zinc-400 text-sm">{activeLesson.description}</p>
              </CardHeader>
              <CardContent>
                {/* Teaching Beats */}
                {activeLesson.teaching_beats?.length > 0 && (
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 mb-6">
                    <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Key Takeaways</h4>
                    <ul className="space-y-1.5">
                      {activeLesson.teaching_beats.map((beat, i) => (
                        <li key={i} className="text-sm text-zinc-300 flex items-start">
                          <Zap className="w-3.5 h-3.5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />{beat}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Rich Markdown Content */}
                <LessonMarkdown content={activeLesson.content} />

                {/* Carrier Move / Our Move */}
                {(activeLesson.carrier_move || activeLesson.our_move) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    {activeLesson.carrier_move && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center mb-2">
                          <Shield className="w-3.5 h-3.5 mr-1.5" /> Carrier Move
                        </h4>
                        <p className="text-sm text-red-200/80">{activeLesson.carrier_move}</p>
                      </div>
                    )}
                    {activeLesson.our_move && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center mb-2">
                          <Crosshair className="w-3.5 h-3.5 mr-1.5" /> Our Move
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
                      <span className="font-semibold uppercase tracking-wider">To complete:</span> {activeLesson.completion_criteria}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-700">
                  {!isLessonComplete(activeLesson.id) ? (
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => markLessonComplete(activeLesson.id)}>
                      <CheckCircle className="w-4 h-4 mr-2" /> Mark Complete
                    </Button>
                  ) : (
                    <Badge className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2">
                      <CheckCircle className="w-4 h-4 mr-2" /> Completed
                    </Badge>
                  )}
                  {(() => {
                    const idx = course.lessons.findIndex(l => l.id === activeLesson.id);
                    const next = idx >= 0 && idx < course.lessons.length - 1 ? course.lessons[idx + 1] : null;
                    if (!next) return null;
                    return (
                      <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white"
                        onClick={() => setActiveLesson(next)}>
                        Next: {next.title} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ═══ FLASHCARDS MODE ═══ */}
          {viewMode === 'flashcards' && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-400" /> Flashcards
                </CardTitle>
                <p className="text-zinc-400 text-sm">Flip through key concepts. Grade yourself to track mastery.</p>
              </CardHeader>
              <CardContent>
                <FlashcardStudy flashcards={flashcards} />
              </CardContent>
            </Card>
          )}

          {/* ═══ PRACTICE MODE ═══ */}
          {viewMode === 'practice' && quizQuestions.length > 0 && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100 flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-emerald-400" /> Practice Mode
                </CardTitle>
                <p className="text-zinc-400 text-sm">Answer one at a time with instant feedback. No grade recorded.</p>
              </CardHeader>
              <CardContent>
                {(() => {
                  const q = quizQuestions[practiceIndex];
                  if (!q) return null;
                  const qType = q.question_type || 'multiple_choice';
                  const isCorrect = practiceRevealed && (
                    qType === 'fill_blank' ? (practiceAnswer || '').toLowerCase().trim() === (q.correct_text || '').toLowerCase().trim() :
                    qType === 'matching' ? true : // simplified
                    qType === 'ordering' ? JSON.stringify(practiceAnswer) === JSON.stringify(q.correct_order) :
                    practiceAnswer === q.correct_answer
                  );

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-zinc-500">{practiceIndex + 1} / {quizQuestions.length}</span>
                        <div className="w-full max-w-xs bg-zinc-800 rounded-full h-1.5 ml-4">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${((practiceIndex + 1) / quizQuestions.length) * 100}%` }} />
                        </div>
                      </div>

                      {/* Scenario context */}
                      {qType === 'scenario' && q.scenario_context && (
                        <div className="mb-4 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-zinc-400 italic">{q.scenario_context}</p>
                          </div>
                        </div>
                      )}

                      <p className="font-medium text-zinc-100 text-lg mb-4">{q.question}</p>

                      {/* Answer options */}
                      {(qType === 'multiple_choice' || qType === 'true_false' || qType === 'scenario') && (
                        <div className="space-y-2 mb-4">
                          {q.options.map((opt, oi) => {
                            const selected = practiceAnswer === oi;
                            const isRight = oi === q.correct_answer;
                            return (
                              <button key={oi}
                                onClick={() => { if (!practiceRevealed) setPracticeAnswer(oi); }}
                                disabled={practiceRevealed}
                                className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                                  practiceRevealed && isRight ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200' :
                                  practiceRevealed && selected && !isRight ? 'border-red-500 bg-red-500/15 text-red-200' :
                                  selected ? 'border-orange-500 bg-orange-500/15 text-orange-200' :
                                  'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                                }`}>
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {qType === 'fill_blank' && (
                        <div className="mb-4">
                          <input type="text" value={practiceAnswer || ''} onChange={(e) => setPracticeAnswer(e.target.value)}
                            disabled={practiceRevealed} placeholder="Type your answer..."
                            className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 focus:border-orange-500 outline-none" />
                          {practiceRevealed && (
                            <p className="mt-2 text-sm text-emerald-400">Correct answer: {q.correct_text}</p>
                          )}
                        </div>
                      )}

                      {/* Reveal / Next */}
                      <div className="flex items-center gap-3">
                        {!practiceRevealed ? (
                          <Button className="bg-orange-600 hover:bg-orange-700" disabled={practiceAnswer === null}
                            onClick={() => setPracticeRevealed(true)}>
                            Check Answer
                          </Button>
                        ) : (
                          <>
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${isCorrect ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                              {isCorrect ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                              {isCorrect ? 'Correct!' : 'Incorrect'}
                            </div>
                            <Button variant="outline" className="border-zinc-700 ml-auto"
                              onClick={() => {
                                if (practiceIndex < quizQuestions.length - 1) {
                                  setPracticeIndex(i => i + 1);
                                  setPracticeRevealed(false);
                                  setPracticeAnswer(null);
                                } else {
                                  setPracticeIndex(0);
                                  setPracticeRevealed(false);
                                  setPracticeAnswer(null);
                                  toast.success('Practice complete! Starting over.');
                                }
                              }}>
                              {practiceIndex < quizQuestions.length - 1 ? 'Next Question' : 'Start Over'}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Explanation */}
                      {practiceRevealed && q.explanation && (
                        <div className="mt-4 flex items-start gap-2 p-3 bg-zinc-800/60 rounded-xl text-sm">
                          <Info className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                          <span className="text-zinc-400">{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* ═══ TEST MODE (Graded Quiz) ═══ */}
          {viewMode === 'test' && (
            <Card className="border-zinc-700">
              <CardHeader>
                <CardTitle className="text-zinc-100">Final Quiz</CardTitle>
                <p className="text-zinc-400">Score 70% or higher to earn your certificate</p>
              </CardHeader>
              <CardContent>
                {quizResult ? (
                  <div className="py-6">
                    <div className="text-center mb-8">
                      {quizResult.passed ? (
                        <div>
                          <Award className="w-16 h-16 text-green-400 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-green-400 mb-1">Congratulations!</h3>
                          <p className="text-zinc-400 mb-1">You scored {quizResult.score}% ({quizResult.correct}/{quizResult.total} correct)</p>
                          <p className="text-zinc-500 text-sm mb-4">Certificate earned. View it in the Certificates tab.</p>
                          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => navigate('/university')}>
                            <Award className="w-4 h-4 mr-2" /> View Certificates
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                          <h3 className="text-2xl font-bold text-red-400 mb-1">Not Quite</h3>
                          <p className="text-zinc-400 mb-1">You scored {quizResult.score}% ({quizResult.correct}/{quizResult.total} correct, 70% required)</p>
                          <p className="text-zinc-500 text-sm mb-4">Review the explanations below, then try again.</p>
                          <div className="flex gap-3 justify-center">
                            <Button variant="outline" className="border-zinc-700" onClick={() => {
                              setQuizResult(null);
                              const answers = {};
                              quizQuestions.forEach((_, i) => { answers[i] = null; });
                              setQuizAnswers(answers);
                            }}>
                              <RotateCcw className="w-4 h-4 mr-2" /> Retry Quiz
                            </Button>
                            <Button variant="outline" className="border-zinc-700" onClick={() => {
                              setViewMode('learn');
                              setQuizResult(null);
                              if (course.lessons?.length) setActiveLesson(course.lessons[0]);
                            }}>
                              Review Lessons
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Per-question breakdown */}
                    {quizResult.details?.length > 0 && (
                      <div className="space-y-4 border-t border-zinc-700 pt-6">
                        <h4 className="text-lg font-semibold text-zinc-200 mb-3">Question Breakdown</h4>
                        {quizResult.details.map((detail, idx) => (
                          <div key={idx} className={`p-4 rounded-xl border-2 ${detail.is_correct ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <div className="flex items-start gap-2 mb-2">
                              {detail.is_correct ? <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1">
                                <span className="font-medium text-zinc-100">{idx + 1}. {detail.question}</span>
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
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {quizQuestions.map((question, qIndex) => {
                      const qType = question.question_type || 'multiple_choice';

                      return (
                        <div key={question.id || qIndex} className="p-5 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-semibold text-zinc-500">{qIndex + 1} / {quizQuestions.length}</span>
                            {qType === 'scenario' && <Badge className="bg-purple-500/20 text-purple-300 text-xs">Scenario</Badge>}
                            {qType === 'true_false' && <Badge className="bg-blue-500/20 text-blue-300 text-xs">True / False</Badge>}
                          </div>

                          {qType === 'scenario' && question.scenario_context && (
                            <div className="mb-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-zinc-400 italic">{question.scenario_context}</p>
                              </div>
                            </div>
                          )}

                          {/* New Quiz Types */}
                          {qType === 'matching' && (
                            <MatchingQuestion question={question} value={quizAnswers[qIndex]}
                              onChange={(v) => setQuizAnswers(prev => ({ ...prev, [qIndex]: v }))} />
                          )}
                          {qType === 'fill_blank' && (
                            <FillBlankQuestion question={question} value={quizAnswers[qIndex]}
                              onChange={(v) => setQuizAnswers(prev => ({ ...prev, [qIndex]: v }))} />
                          )}
                          {qType === 'ordering' && (
                            <OrderingQuestion question={question} value={quizAnswers[qIndex]}
                              onChange={(v) => setQuizAnswers(prev => ({ ...prev, [qIndex]: v }))} />
                          )}

                          {/* Standard MCQ / True-False */}
                          {(qType === 'multiple_choice' || qType === 'scenario') && (
                            <>
                              <p className="font-medium text-zinc-100 mb-3">{question.question}</p>
                              <div className="space-y-2">
                                {question.options.map((option, oIndex) => {
                                  const isSelected = quizAnswers[qIndex] === oIndex;
                                  return (
                                    <label key={oIndex}
                                      className={`flex items-center p-3.5 rounded-xl cursor-pointer transition-all ${
                                        isSelected ? 'bg-orange-500/15 border-2 border-orange-500 text-orange-200' : 'bg-zinc-900 border-2 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                                      }`}>
                                      <input type="radio" name={`q${qIndex}`} checked={isSelected} className="sr-only"
                                        onChange={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))} />
                                      <div className={`w-5 h-5 rounded-full border-2 mr-3 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-zinc-600'}`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                      </div>
                                      <span>{option}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {qType === 'true_false' && (
                            <>
                              <p className="font-medium text-zinc-100 mb-3">{question.question}</p>
                              <div className="grid grid-cols-2 gap-3">
                                {question.options.map((option, oIndex) => {
                                  const isSelected = quizAnswers[qIndex] === oIndex;
                                  const isTrue = option === 'True';
                                  return (
                                    <button key={oIndex}
                                      onClick={() => setQuizAnswers(prev => ({ ...prev, [qIndex]: oIndex }))}
                                      className={`p-4 rounded-xl font-semibold text-center border-2 transition-all ${
                                        isSelected ? (isTrue ? 'border-green-500 bg-green-500/15 text-green-300' : 'border-red-500 bg-red-500/15 text-red-300') :
                                        'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                                      }`}>
                                      {option}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    <Button className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-base py-3"
                      onClick={submitQuiz} disabled={!isAllAnswered()}>
                      Submit Quiz ({Object.values(quizAnswers).filter(a => a !== null && a !== undefined && a !== -1).length}/{quizQuestions.length} answered)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {viewMode === 'learn' && !activeLesson && (
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
