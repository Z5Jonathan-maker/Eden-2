/**
 * Quizlet-Style Flashcard Study Mode
 * 3D flip cards, keyboard nav, self-grading, progress tracking
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ArrowLeft, ArrowRight, Shuffle, CheckCircle, XCircle, Eye, Layers } from 'lucide-react';

export default function FlashcardStudy({ flashcards = [], onClose }) {
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [known, setKnown] = useState(new Set());
  const [unknown, setUnknown] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [direction, setDirection] = useState(0);

  useEffect(() => { setDeck([...flashcards]); }, [flashcards]);

  const card = deck[currentIndex];
  const total = deck.length;
  const graded = known.size + unknown.size;
  const progress = total > 0 ? Math.round((graded / total) * 100) : 0;

  const flip = useCallback(() => setIsFlipped(f => !f), []);

  const markKnown = useCallback(() => {
    if (!card) return;
    setKnown(prev => new Set(prev).add(currentIndex));
    setUnknown(prev => { const n = new Set(prev); n.delete(currentIndex); return n; });
    goNext();
  }, [card, currentIndex]);

  const markUnknown = useCallback(() => {
    if (!card) return;
    setUnknown(prev => new Set(prev).add(currentIndex));
    setKnown(prev => { const n = new Set(prev); n.delete(currentIndex); return n; });
    goNext();
  }, [card, currentIndex]);

  function goNext() {
    if (currentIndex < total - 1) {
      setDirection(1);
      setIsFlipped(false);
      setCurrentIndex(i => i + 1);
    } else if (graded + 1 >= total) {
      setShowResults(true);
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setDirection(-1);
      setIsFlipped(false);
      setCurrentIndex(i => i - 1);
    }
  }

  function shuffleDeck() {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setShowResults(false);
  }

  function restudyUnknown() {
    const unknownCards = [...unknown].map(i => deck[i]);
    if (unknownCards.length === 0) return;
    setDeck(unknownCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setShowResults(false);
  }

  function restart() {
    setDeck([...flashcards]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setKnown(new Set());
    setUnknown(new Set());
    setShowResults(false);
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'Enter': e.preventDefault(); flip(); break;
        case 'ArrowRight': if (isFlipped) markKnown(); else { setDirection(1); setIsFlipped(false); if (currentIndex < total - 1) setCurrentIndex(i => i + 1); } break;
        case 'ArrowLeft': goPrev(); break;
        case '1': if (isFlipped) markKnown(); break;
        case '2': if (isFlipped) markUnknown(); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [flip, markKnown, markUnknown, isFlipped, currentIndex, total]);

  if (!deck.length) {
    return (
      <div className="text-center py-16">
        <Layers className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400">No flashcards available for this course yet.</p>
      </div>
    );
  }

  /* ─── Results screen ─── */
  if (showResults) {
    const pct = total > 0 ? Math.round((known.size / total) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto py-8">
        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${pct >= 70 ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
            <span className={`text-3xl font-bold ${pct >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>{pct}%</span>
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {pct >= 90 ? 'Mastered!' : pct >= 70 ? 'Great Progress!' : 'Keep Studying!'}
          </h3>
          <p className="text-zinc-400">
            {known.size} of {total} cards mastered
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
            <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-emerald-400">{known.size}</p>
            <p className="text-xs text-emerald-300/70">Got it</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <XCircle className="w-6 h-6 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-400">{unknown.size}</p>
            <p className="text-xs text-red-300/70">Study again</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {unknown.size > 0 && (
            <button onClick={restudyUnknown}
              className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors">
              Re-study {unknown.size} missed cards
            </button>
          )}
          <button onClick={restart}
            className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium rounded-xl border border-zinc-700 transition-colors">
            <RotateCcw className="w-4 h-4 inline mr-2" />
            Start Over
          </button>
        </div>
      </div>
    );
  }

  /* ─── Card view ─── */
  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-zinc-500">{currentIndex + 1} / {total}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-emerald-400">{known.size} known</span>
          <span className="text-xs text-red-400">{unknown.size} learning</span>
          <button onClick={shuffleDeck} className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors" title="Shuffle">
            <Shuffle className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-6">
        <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Flashcard */}
      <div className="perspective-[1000px] mb-6" style={{ perspective: '1000px' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: direction * 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -50 }}
            transition={{ duration: 0.2 }}
          >
            <div
              onClick={flip}
              className="relative w-full min-h-[280px] cursor-pointer select-none"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 25 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="w-full min-h-[280px]"
              >
                {/* Front */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-zinc-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  {card?.category && (
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-4">{card.category}</span>
                  )}
                  <p className="text-xl font-semibold text-white leading-relaxed">{card?.front}</p>
                  {card?.hint && (
                    <p className="text-sm text-zinc-500 mt-4 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" /> Hint: {card.hint}
                    </p>
                  )}
                  <p className="text-xs text-zinc-600 mt-6">Click or press Space to flip</p>
                </div>

                {/* Back */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-850 border-2 border-orange-500/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {card?.category && (
                    <span className="text-xs text-orange-400/60 uppercase tracking-wider mb-4">{card.category}</span>
                  )}
                  <p className="text-lg text-zinc-200 leading-relaxed">{card?.back}</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation + grading */}
      <div className="flex items-center justify-between">
        <button onClick={goPrev} disabled={currentIndex === 0}
          className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {isFlipped ? (
          <div className="flex items-center gap-4">
            <button onClick={markUnknown}
              className="flex items-center gap-2 px-6 py-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 rounded-xl font-medium transition-colors">
              <XCircle className="w-5 h-5" />
              Study Again
            </button>
            <button onClick={markKnown}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 rounded-xl font-medium transition-colors">
              <CheckCircle className="w-5 h-5" />
              Got It
            </button>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Flip the card to grade yourself</p>
        )}

        <button onClick={() => { if (currentIndex < total - 1) { setDirection(1); setIsFlipped(false); setCurrentIndex(i => i + 1); } }}
          disabled={currentIndex >= total - 1}
          className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600 mt-4">
        ← → navigate &nbsp;|&nbsp; Space = flip &nbsp;|&nbsp; 1 = got it &nbsp;|&nbsp; 2 = study again
      </p>
    </div>
  );
}
