/**
 * New Quiz Type Renderers: Matching, Fill-in-the-Blank, Ordering
 */
import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, Link2, Type, ListOrdered } from 'lucide-react';
import { Badge } from '../../shared/ui/badge';

/* ═══ Matching Question ═══ */
export function MatchingQuestion({ question, value, onChange }) {
  const [selectedLeft, setSelectedLeft] = useState(null);
  const matches = value || []; // [[left, right], ...]

  const shuffledRight = useMemo(() => {
    const rights = (question.matching_pairs || []).map(p => p.right);
    return [...rights].sort(() => Math.random() - 0.5);
  }, [question.matching_pairs]);

  const matchedLefts = new Set(matches.map(m => m[0]));
  const matchedRights = new Set(matches.map(m => m[1]));

  function handleLeftClick(left) {
    if (matchedLefts.has(left)) {
      // Unmatch
      const newMatches = matches.filter(m => m[0] !== left);
      onChange(newMatches);
      return;
    }
    setSelectedLeft(left);
  }

  function handleRightClick(right) {
    if (!selectedLeft) return;
    if (matchedRights.has(right)) return;
    const newMatches = [...matches, [selectedLeft, right]];
    onChange(newMatches);
    setSelectedLeft(null);
  }

  const matchColors = ['text-orange-400 border-orange-500/50 bg-orange-500/10', 'text-blue-400 border-blue-500/50 bg-blue-500/10', 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10', 'text-purple-400 border-purple-500/50 bg-purple-500/10', 'text-pink-400 border-pink-500/50 bg-pink-500/10', 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10'];

  function getMatchColor(item, side) {
    const idx = matches.findIndex(m => m[side === 'left' ? 0 : 1] === item);
    return idx >= 0 ? matchColors[idx % matchColors.length] : '';
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge className="bg-cyan-500/20 text-cyan-300 text-xs"><Link2 className="w-3 h-3 mr-1" />Match</Badge>
      </div>
      <p className="font-medium text-zinc-100 mb-4">{question.question}</p>
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {(question.matching_pairs || []).map((pair, i) => {
            const isMatched = matchedLefts.has(pair.left);
            const isSelected = selectedLeft === pair.left;
            return (
              <button key={i} onClick={() => handleLeftClick(pair.left)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                  isMatched ? `${getMatchColor(pair.left, 'left')} border-2` :
                  isSelected ? 'border-orange-500 bg-orange-500/15 text-orange-200' :
                  'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                }`}>
                {pair.left}
              </button>
            );
          })}
        </div>
        {/* Right column */}
        <div className="space-y-2">
          {shuffledRight.map((right, i) => {
            const isMatched = matchedRights.has(right);
            return (
              <button key={i} onClick={() => handleRightClick(right)}
                disabled={isMatched && !selectedLeft}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                  isMatched ? `${getMatchColor(right, 'right')} border-2` :
                  selectedLeft ? 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:border-orange-500/50 hover:bg-orange-500/5 cursor-pointer' :
                  'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}>
                {right}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-zinc-500 mt-3">Click a term on the left, then click its match on the right. Click a matched term to undo.</p>
    </div>
  );
}

/* ═══ Fill-in-the-Blank Question ═══ */
export function FillBlankQuestion({ question, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge className="bg-amber-500/20 text-amber-300 text-xs"><Type className="w-3 h-3 mr-1" />Fill in the Blank</Badge>
      </div>
      <p className="font-medium text-zinc-100 mb-4">{question.question}</p>
      {question.blank_placeholder && (
        <p className="text-sm text-zinc-500 mb-3 italic">Hint: {question.blank_placeholder}</p>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer..."
        className="w-full bg-zinc-900 border-2 border-zinc-700 rounded-xl px-4 py-3.5 text-zinc-200 text-base
                   focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none transition-all
                   placeholder:text-zinc-600"
      />
    </div>
  );
}

/* ═══ Ordering / Sequence Question ═══ */
export function OrderingQuestion({ question, value, onChange }) {
  const items = value || [];

  // Initialize shuffled on first render if empty
  React.useEffect(() => {
    if (items.length === 0 && question.correct_order?.length > 0) {
      const shuffled = [...question.correct_order].sort(() => Math.random() - 0.5);
      onChange(shuffled);
    }
  }, [question.correct_order]);

  function moveItem(fromIndex, dir) {
    const toIndex = fromIndex + dir;
    if (toIndex < 0 || toIndex >= items.length) return;
    const newItems = [...items];
    [newItems[fromIndex], newItems[toIndex]] = [newItems[toIndex], newItems[fromIndex]];
    onChange(newItems);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge className="bg-indigo-500/20 text-indigo-300 text-xs"><ListOrdered className="w-3 h-3 mr-1" />Put in Order</Badge>
      </div>
      <p className="font-medium text-zinc-100 mb-4">{question.question}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 p-3 bg-zinc-900 border-2 border-zinc-700 rounded-xl group hover:border-zinc-600 transition-colors">
            <span className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0">
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-zinc-200">{item}</span>
            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ArrowUp className="w-4 h-4" />
              </button>
              <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}
                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 mt-3">Use the arrows to arrange items in the correct order.</p>
    </div>
  );
}
