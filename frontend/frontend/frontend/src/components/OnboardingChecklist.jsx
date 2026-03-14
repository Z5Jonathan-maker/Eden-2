import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, X, Rocket } from 'lucide-react';

const STORAGE_KEY_COMPLETED = 'onboarding_completed';
const STORAGE_KEY_COLLAPSED = 'onboarding_collapsed';
const STORAGE_KEY_STEPS = 'onboarding_steps';

const ONBOARDING_STEPS = [
  {
    id: 'create_claim',
    label: 'Create your first claim',
    path: '/claims/new',
  },
  {
    id: 'run_inspection',
    label: 'Run an inspection',
    path: '/inspections',
  },
  {
    id: 'try_eve',
    label: 'Try Eve AI',
    path: '/eve',
  },
  {
    id: 'connect_workspace',
    label: 'Connect Google Workspace',
    path: '/workspace',
  },
  {
    id: 'explore_claimpilot',
    label: 'Explore ClaimPilot',
    path: '/claimpilot',
  },
];

const loadStepState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STEPS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (_err) { /* ignore */ }
  return {};
};

const saveStepState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY_STEPS, JSON.stringify(state));
  } catch (_err) { /* ignore */ }
};

const OnboardingChecklist = () => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState({});

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
      setDismissed(isDismissed);

      const isCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === 'true';
      setCollapsed(isCollapsed);

      setCompletedSteps(loadStepState());
    } catch (_err) { /* ignore */ }
  }, []);

  const completedCount = ONBOARDING_STEPS.filter(
    (step) => completedSteps[step.id]
  ).length;
  const totalSteps = ONBOARDING_STEPS.length;
  const progressPercent = (completedCount / totalSteps) * 100;

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
    } catch (_err) { /* ignore */ }
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_COLLAPSED, String(next));
      } catch (_err) { /* ignore */ }
      return next;
    });
  }, []);

  const handleToggleStep = useCallback((stepId) => {
    setCompletedSteps((prev) => {
      const next = { ...prev, [stepId]: !prev[stepId] };
      saveStepState(next);

      // Auto-dismiss when all steps completed
      const allDone = ONBOARDING_STEPS.every((s) => next[s.id]);
      if (allDone) {
        setTimeout(() => {
          setDismissed(true);
          try {
            localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
          } catch (_err) { /* ignore */ }
        }, 1200);
      }
      return next;
    });
  }, []);

  const handleNavigate = useCallback(
    (path) => {
      navigate(path);
    },
    [navigate]
  );

  if (dismissed) return null;

  // Collapsed pill view
  if (collapsed) {
    return (
      <button
        onClick={handleToggleCollapse}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 border border-orange-500/50 text-orange-400 text-sm font-tactical font-semibold hover:bg-orange-500/30 transition-all duration-200 shadow-lg backdrop-blur-sm"
        aria-label={`Setup progress: ${completedCount} of ${totalSteps} complete. Click to expand.`}
      >
        <Rocket className="w-4 h-4" />
        <span>
          Setup {completedCount}/{totalSteps}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-[#1a1a1a] border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
      {/* Progress bar */}
      <div className="h-1 bg-zinc-800 w-full">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-tactical font-bold text-white tracking-wide">
            Getting Started
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-500">
            {completedCount}/{totalSteps}
          </span>
          <button
            onClick={handleToggleCollapse}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors text-xs font-mono"
            aria-label="Collapse checklist"
          >
            &minus;
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            aria-label="Dismiss onboarding checklist"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-3 space-y-1">
        {ONBOARDING_STEPS.map((step) => {
          const isDone = Boolean(completedSteps[step.id]);
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 py-1.5 group"
            >
              <button
                onClick={() => handleToggleStep(step.id)}
                className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-all duration-200 ${
                  isDone
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'border-zinc-600 hover:border-zinc-500 text-transparent hover:text-zinc-600'
                }`}
                aria-label={`Mark "${step.label}" as ${isDone ? 'incomplete' : 'complete'}`}
              >
                <Check className="w-3 h-3" />
              </button>
              <span
                className={`flex-1 text-sm transition-all duration-200 ${
                  isDone
                    ? 'text-emerald-400 line-through opacity-70'
                    : 'text-zinc-300'
                }`}
              >
                {step.label}
              </span>
              <button
                onClick={() => handleNavigate(step.path)}
                className="p-1 rounded text-zinc-600 hover:text-orange-400 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`Navigate to ${step.label}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Dismiss link */}
      <div className="px-4 py-2 border-t border-zinc-800/50">
        <button
          onClick={handleDismiss}
          className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 uppercase tracking-wider transition-colors"
        >
          Dismiss forever
        </button>
      </div>
    </div>
  );
};

export default OnboardingChecklist;
