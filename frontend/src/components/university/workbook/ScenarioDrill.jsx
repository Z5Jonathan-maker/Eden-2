import React, { useState } from 'react';
import { Target, CheckCircle, XCircle } from 'lucide-react';

const ScenarioDrill = ({ data }) => {
  const { scenario, decision_point, options, ideal_response, explanation } = data.content_payload;
  const [selectedOption, setSelectedOption] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const handleSelect = (index) => {
    if (revealed) return;
    setSelectedOption(index);
  };

  const handleReveal = () => {
    setRevealed(true);
  };

  const idealIndex = options?.findIndex(o => o.is_correct);

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <Target className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Scenario Drill</span>
      </div>

      <div className="p-6 space-y-5">
        <div className="bg-zinc-900/50 rounded-lg p-5 border border-zinc-700/30">
          <p className="text-zinc-200 leading-relaxed text-sm">{scenario}</p>
        </div>

        <div>
          <span className="text-zinc-400 font-mono text-[10px] tracking-[0.2em] uppercase block mb-3">
            Decision Point
          </span>
          <p className="text-white font-medium">{decision_point}</p>
        </div>

        {options && options.length > 0 && (
          <div className="space-y-2">
            {options.map((option, i) => {
              const isSelected = selectedOption === i;
              const isCorrect = option.is_correct;
              let borderColor = 'border-zinc-700/50';
              let bgColor = 'bg-zinc-900/30';

              if (revealed && isCorrect) {
                borderColor = 'border-green-500/50';
                bgColor = 'bg-green-950/20';
              } else if (revealed && isSelected && !isCorrect) {
                borderColor = 'border-red-500/50';
                bgColor = 'bg-red-950/20';
              } else if (isSelected) {
                borderColor = 'border-orange-500/50';
                bgColor = 'bg-orange-950/10';
              }

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  className={`w-full text-left rounded-lg border ${borderColor} ${bgColor} p-4 transition-all hover:border-zinc-600/50`}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-xs font-mono text-zinc-400">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <div className="flex-1">
                      <p className="text-zinc-200 text-sm">{option.text}</p>
                      {revealed && isCorrect && (
                        <div className="flex items-center gap-2 mt-2 text-green-400 text-xs">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Correct Response</span>
                        </div>
                      )}
                      {revealed && isSelected && !isCorrect && (
                        <div className="flex items-center gap-2 mt-2 text-red-400 text-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{option.feedback || 'Not the ideal response'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {!revealed && selectedOption !== null && (
          <button
            onClick={handleReveal}
            className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 text-sm transition-colors"
          >
            Reveal Answer
          </button>
        )}

        {revealed && (
          <div className="space-y-4">
            {ideal_response && (
              <div className="bg-green-950/10 border border-green-800/30 rounded-lg p-5">
                <span className="text-green-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-2">Ideal Response</span>
                <p className="text-zinc-200 text-sm leading-relaxed">{ideal_response}</p>
              </div>
            )}
            {explanation && (
              <div className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg p-5">
                <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-2">Why This Matters</span>
                <p className="text-zinc-400 text-sm leading-relaxed">{explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioDrill;
