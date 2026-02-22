import React, { useState } from 'react';
import { ClipboardCheck, CheckCircle, XCircle, Award } from 'lucide-react';

const QuizBlock = ({ data }) => {
  const { title, questions, passing_score } = data.content_payload;
  const passScore = passing_score || 70;
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (qi, optionIndex) => {
    if (submitted) return;
    setAnswers({ ...answers, [qi]: optionIndex });
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length < questions.length) return;
    setSubmitted(true);
  };

  const getScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct_answer) correct++;
    });
    return { correct, total: questions.length, percent: Math.round((correct / questions.length) * 100) };
  };

  const score = submitted ? getScore() : null;
  const passed = score ? score.percent >= passScore : false;

  return (
    <div className="col-span-full rounded-xl border border-zinc-700/50 bg-zinc-800/60 overflow-hidden">
      <div className="bg-zinc-900/80 px-6 py-4 border-b border-zinc-700/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-orange-500" />
          <span className="text-orange-500 font-mono text-[10px] tracking-[0.3em] uppercase">Knowledge Check</span>
          {title && <span className="text-zinc-400 text-sm ml-2">{title}</span>}
        </div>
        <span className="text-zinc-500 text-xs font-mono">Pass: {passScore}%</span>
      </div>

      <div className="p-6 space-y-8">
        {questions.map((q, qi) => {
          const isCorrect = submitted && answers[qi] === q.correct_answer;
          const isWrong = submitted && answers[qi] !== q.correct_answer;

          return (
            <div key={qi} className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700/50 flex items-center justify-center text-xs font-mono text-zinc-400">
                  {qi + 1}
                </span>
                <p className="text-zinc-200 text-sm font-medium pt-1">{q.question}</p>
              </div>

              <div className="ml-10 space-y-2">
                {q.options.map((option, oi) => {
                  const isSelected = answers[qi] === oi;
                  const isCorrectOption = submitted && oi === q.correct_answer;
                  let style = 'border-zinc-700/50 bg-zinc-900/30';

                  if (submitted) {
                    if (isCorrectOption) style = 'border-green-500/50 bg-green-950/20';
                    else if (isSelected) style = 'border-red-500/50 bg-red-950/20';
                  } else if (isSelected) {
                    style = 'border-orange-500/50 bg-orange-950/10';
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => handleAnswer(qi, oi)}
                      className={`w-full text-left rounded-lg border p-3 transition-all text-sm ${style} ${
                        !submitted ? 'hover:border-zinc-600/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {submitted && isCorrectOption && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        {submitted && isSelected && !isCorrectOption && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        <span className="text-zinc-200">{option}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {submitted && isWrong && q.coaching_feedback && (
                <div className="ml-10 bg-red-950/10 border border-red-800/20 rounded-lg p-3">
                  <p className="text-red-300 text-xs leading-relaxed">{q.coaching_feedback}</p>
                </div>
              )}

              {submitted && isCorrect && q.reasoning && (
                <div className="ml-10 bg-green-950/10 border border-green-800/20 rounded-lg p-3">
                  <p className="text-green-300 text-xs leading-relaxed">{q.reasoning}</p>
                </div>
              )}
            </div>
          );
        })}

        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="w-full rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-medium py-3 text-sm transition-colors"
          >
            Submit Answers ({Object.keys(answers).length}/{questions.length})
          </button>
        )}

        {submitted && score && (
          <div className={`rounded-xl p-6 text-center border ${
            passed
              ? 'bg-green-950/10 border-green-700/30'
              : 'bg-red-950/10 border-red-700/30'
          }`}>
            {passed && <Award className="w-10 h-10 text-green-400 mx-auto mb-3" />}
            <p className={`text-3xl font-bold font-mono ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {score.percent}%
            </p>
            <p className="text-zinc-400 text-sm mt-1">
              {score.correct}/{score.total} correct
            </p>
            <p className={`text-sm mt-2 font-medium ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {passed ? 'Knowledge check passed.' : `${passScore}% required to pass. Review and retry.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizBlock;
