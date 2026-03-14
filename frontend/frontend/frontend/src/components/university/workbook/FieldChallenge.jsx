import React, { useState } from 'react';
import { Flame, CheckSquare, Upload, FileText } from 'lucide-react';

const FieldChallenge = ({ data }) => {
  const { title, description, success_criteria, proof_requirements, time_limit } = data.content_payload;
  const [accepted, setAccepted] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="col-span-full rounded-xl border border-orange-600/30 bg-gradient-to-br from-zinc-900 via-zinc-800/90 to-zinc-900 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-orange-600/20 flex items-center gap-3">
        <Flame className="w-5 h-5 text-orange-500" />
        <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Field Challenge</span>
        {time_limit && (
          <span className="text-zinc-500 text-xs ml-auto font-mono">{time_limit}</span>
        )}
      </div>

      <div className="p-6 space-y-5">
        <div>
          <h4 className="text-white text-lg font-bold">{title}</h4>
          <p className="text-zinc-300 text-sm mt-2 leading-relaxed">{description}</p>
        </div>

        {success_criteria && success_criteria.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg p-5">
            <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-3">
              Success Criteria
            </span>
            <div className="space-y-2">
              {success_criteria.map((criterion, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckSquare className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-300 text-sm">{criterion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {proof_requirements && proof_requirements.length > 0 && (
          <div className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg p-5">
            <span className="text-orange-500 font-mono text-[10px] tracking-[0.2em] uppercase block mb-3">
              Required Proof of Completion
            </span>
            <div className="space-y-2">
              {proof_requirements.map((req, i) => (
                <div key={i} className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <span className="text-zinc-300 text-sm">{req}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!accepted && !submitted && (
          <button
            onClick={() => setAccepted(true)}
            className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 text-sm tracking-wider uppercase transition-colors"
          >
            Accept Challenge
          </button>
        )}

        {accepted && !submitted && (
          <div className="space-y-4">
            <div className="bg-orange-950/15 border border-orange-800/20 rounded-lg p-4">
              <p className="text-orange-300 text-sm font-medium">Challenge accepted. Complete the task and submit your proof below.</p>
            </div>

            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Describe what you did, what happened, and what you learned..."
              rows={5}
              className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
            />

            <div className="flex gap-3">
              <button className="flex items-center gap-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm px-5 py-2.5 transition-colors">
                <Upload className="w-4 h-4" />
                Attach Proof
              </button>
              <button
                onClick={() => completionNotes.trim() && setSubmitted(true)}
                disabled={!completionNotes.trim()}
                className="flex-1 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-30 text-white font-medium py-2.5 text-sm transition-colors"
              >
                Submit Challenge
              </button>
            </div>
          </div>
        )}

        {submitted && (
          <div className="bg-green-950/10 border border-green-800/30 rounded-xl p-6 text-center">
            <CheckSquare className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <p className="text-green-400 font-medium">Challenge submitted for review.</p>
            <p className="text-zinc-500 text-xs mt-1">Your manager will verify completion.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FieldChallenge;
