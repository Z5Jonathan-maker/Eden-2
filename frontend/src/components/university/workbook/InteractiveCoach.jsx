import React, { useState } from 'react';
import { MessageSquare, ThumbsUp, AlertTriangle } from 'lucide-react';

const InteractiveCoach = ({ data }) => {
  const { prompt, options, coaching_tone } = data.content_payload;
  const [selectedOption, setSelectedOption] = useState(null);

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Interactive Coach</span>
        {coaching_tone && (
          <span className="text-zinc-500 text-xs ml-auto">{coaching_tone}</span>
        )}
      </div>

      <div className="p-6 space-y-5">
        <p className="text-zinc-200 text-sm leading-relaxed">{prompt}</p>

        <div className="space-y-2">
          {options.map((option, i) => {
            const isSelected = selectedOption === i;
            const isCorrect = option.is_correct;

            return (
              <div key={i}>
                <button
                  onClick={() => setSelectedOption(i)}
                  className={`w-full text-left rounded-lg border p-4 transition-all ${
                    isSelected
                      ? isCorrect
                        ? 'border-green-500/50 bg-green-950/20'
                        : 'border-red-500/50 bg-red-950/20'
                      : 'border-zinc-700/50 bg-zinc-900/30 hover:border-zinc-600/50'
                  }`}
                >
                  <p className="text-zinc-200 text-sm">{option.text}</p>
                </button>

                {isSelected && (
                  <div className={`mt-2 rounded-lg p-4 ${
                    isCorrect
                      ? 'bg-green-950/10 border border-green-800/30'
                      : 'bg-red-950/10 border border-red-800/30'
                  }`}>
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <ThumbsUp className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <p className={`text-sm leading-relaxed ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                        {option.feedback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InteractiveCoach;
