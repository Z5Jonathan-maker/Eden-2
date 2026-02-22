import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';

const SelfAssessmentScale = ({ data }) => {
  const { title, statements, scale_labels } = data.content_payload;
  const [ratings, setRatings] = useState({});
  const [showResults, setShowResults] = useState(false);

  const labels = scale_labels || ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

  const handleRate = (index, value) => {
    setRatings({ ...ratings, [index]: value });
  };

  const allRated = statements.every((_, i) => ratings[i] !== undefined);
  const averageScore = allRated
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / statements.length).toFixed(1)
    : null;

  const getScoreColor = (score) => {
    if (score >= 4) return 'text-green-400';
    if (score >= 3) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score) => {
    if (score >= 4.5) return 'Operating at a high level';
    if (score >= 3.5) return 'Solid foundation, room to sharpen';
    if (score >= 2.5) return 'Significant gaps to address';
    return 'Requires immediate attention';
  };

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <BarChart3 className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Self-Assessment</span>
        {title && <span className="text-zinc-400 text-sm ml-2">{title}</span>}
      </div>

      <div className="p-6 space-y-6">
        <div className="hidden md:grid grid-cols-[1fr_repeat(5,48px)] gap-2 items-end px-1">
          <div />
          {labels.map((label, i) => (
            <span key={i} className="text-zinc-500 text-[9px] text-center font-mono leading-tight">
              {label}
            </span>
          ))}
        </div>

        {statements.map((statement, si) => (
          <div key={si} className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_repeat(5,48px)] gap-2 items-center">
              <p className="text-zinc-200 text-sm pr-4">{statement}</p>
              <div className="flex md:contents gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    onClick={() => handleRate(si, value)}
                    className={`w-10 h-10 md:w-auto md:h-10 rounded-lg border text-sm font-mono transition-all ${
                      ratings[si] === value
                        ? 'bg-orange-600 border-orange-500 text-white'
                        : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-500 hover:border-zinc-600/50'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            {si < statements.length - 1 && (
              <div className="h-px bg-zinc-800/50" />
            )}
          </div>
        ))}

        {allRated && !showResults && (
          <button
            onClick={() => setShowResults(true)}
            className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 text-sm transition-colors"
          >
            See Your Assessment
          </button>
        )}

        {showResults && averageScore && (
          <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl p-6 text-center">
            <span className="text-zinc-500 font-mono text-xs tracking-wider uppercase block mb-2">
              Your Score
            </span>
            <p className={`text-4xl font-bold font-mono ${getScoreColor(parseFloat(averageScore))}`}>
              {averageScore}
            </p>
            <p className="text-zinc-400 text-sm mt-2">{getScoreLabel(parseFloat(averageScore))}</p>

            <div className="mt-6 grid grid-cols-5 gap-1">
              {statements.map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-orange-600/70"
                    style={{ height: `${(ratings[i] / 5) * 60}px` }}
                  />
                  <span className="text-zinc-600 text-[9px] font-mono">Q{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfAssessmentScale;
