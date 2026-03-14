import React, { useState } from 'react';
import { Eye } from 'lucide-react';

const ReflectionBlock = ({ data }) => {
  const { prompt, follow_up, honesty_check } = data.content_payload;
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center gap-3">
        <Eye className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Self-Reflection</span>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-zinc-200 text-sm leading-relaxed font-medium">{prompt}</p>

        {follow_up && (
          <p className="text-zinc-500 text-xs italic">{follow_up}</p>
        )}

        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Be honest with yourself here..."
          rows={4}
          className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
        />

        {!submitted ? (
          <button
            onClick={() => response.trim() && setSubmitted(true)}
            disabled={!response.trim()}
            className="rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 text-white text-sm font-medium px-5 py-2.5 transition-colors"
          >
            Log Reflection
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-950/10 border border-green-800/20 rounded-lg p-4">
              <p className="text-green-400 text-sm">Reflection logged. Revisit this during your next field day.</p>
            </div>
            {honesty_check && (
              <div className="bg-orange-950/10 border border-orange-800/20 rounded-lg p-4">
                <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-1">
                  Honesty Check
                </span>
                <p className="text-zinc-300 text-sm">{honesty_check}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReflectionBlock;
