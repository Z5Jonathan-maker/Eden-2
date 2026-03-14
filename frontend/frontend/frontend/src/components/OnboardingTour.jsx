import React, { useState, useCallback } from 'react';
import { useOnboarding } from '../hooks/useOnboarding';
import {
  Shield,
  Brain,
  AlertTriangle,
  FileSearch,
  TrendingUp,
  Scale,
  Clock,
  Zap,
  ChevronRight,
  X,
  Sparkles,
  CheckCircle2,
  Target,
} from 'lucide-react';

const TOTAL_STEPS = 5;

const AI_AGENTS = [
  { icon: AlertTriangle, label: 'Stall Detection', color: 'text-red-400' },
  { icon: FileSearch, label: 'Evidence Gaps', color: 'text-blue-400' },
  { icon: TrendingUp, label: 'Settlement Predict', color: 'text-green-400' },
  { icon: Scale, label: 'Statute Compliance', color: 'text-purple-400' },
  { icon: Clock, label: 'Timeline Monitor', color: 'text-yellow-400' },
  { icon: Shield, label: 'Fraud Screen', color: 'text-cyan-400' },
  { icon: Zap, label: 'Priority Triage', color: 'text-orange-400' },
  { icon: Brain, label: 'Pattern Analysis', color: 'text-pink-400' },
];

const StepDots = ({ current, total }) => (
  <div className="flex items-center gap-2 mt-6">
    {Array.from({ length: total }, (_, i) => (
      <div
        key={i}
        className={`rounded-full transition-all duration-300 ${
          i === current
            ? 'w-8 h-2 bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.5)]'
            : i < current
              ? 'w-2 h-2 bg-orange-500/50'
              : 'w-2 h-2 bg-zinc-600'
        }`}
      />
    ))}
  </div>
);

const TourCard = ({ children, className = '' }) => (
  <div
    className={`
      relative bg-zinc-900 border border-zinc-700/40 rounded-2xl
      shadow-[0_0_60px_rgba(0,0,0,0.6),0_0_30px_rgba(234,88,12,0.08)]
      p-8 max-w-lg w-full mx-4
      animate-tour-card-enter
      ${className}
    `}
  >
    {children}
  </div>
);

const SpotlightOverlay = ({ direction, children, onSkip }) => {
  const spotlightStyles = {
    center: '',
    'main-content': 'lg:pl-64',
    sidebar: '',
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Dark overlay with backdrop blur */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Spotlight pulse indicator */}
      {direction === 'main-content' && (
        <div className="absolute top-1/2 left-1/2 lg:left-[calc(50%+8rem)] -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-3xl border-2 border-orange-500/20 animate-spotlight-pulse pointer-events-none" />
      )}
      {direction === 'sidebar' && (
        <div className="absolute top-1/2 left-32 -translate-y-1/2 w-[200px] h-[300px] rounded-2xl border-2 border-orange-500/20 animate-spotlight-pulse pointer-events-none" />
      )}

      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute top-6 right-6 z-10 flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors duration-200 group"
      >
        <span className="group-hover:underline">Skip Tour</span>
        <X className="w-4 h-4" />
      </button>

      {/* Card container */}
      <div className={`relative z-10 flex items-center justify-center ${spotlightStyles[direction] || ''}`}>
        {children}
      </div>
    </div>
  );
};

/* --- Step Components --- */

const StepWelcome = ({ onNext, onSkip }) => (
  <SpotlightOverlay direction="center" onSkip={onSkip}>
    <TourCard>
      <div className="text-center">
        {/* Logo area */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(234,88,12,0.2)] animate-glow-breathe">
          <Target className="w-10 h-10 text-orange-500" />
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
          Welcome to <span className="text-orange-500">Eden</span>
        </h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-2">
          Your AI-powered claims command center.
        </p>
        <p className="text-zinc-500 text-xs leading-relaxed mb-8">
          8 AI agents are now monitoring your claims 24/7.
          <br />
          Let us show you around.
        </p>

        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)]"
        >
          Let&apos;s Go
          <ChevronRight className="w-4 h-4" />
        </button>

        <StepDots current={0} total={TOTAL_STEPS} />
      </div>
    </TourCard>
  </SpotlightOverlay>
);

const StepDashboard = ({ onNext, onBack, onSkip }) => (
  <SpotlightOverlay direction="main-content" onSkip={onSkip}>
    <TourCard>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Your Claims Dashboard</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            This is your mission control. Every claim, every status, at a glance.
          </p>
        </div>
      </div>

      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/30 p-4 mb-6">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Filter by status, search by client
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Switch between table and pipeline views
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            Real-time updates across all claims
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_15px_rgba(234,88,12,0.25)]"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center">
        <StepDots current={1} total={TOTAL_STEPS} />
      </div>
    </TourCard>
  </SpotlightOverlay>
);

const StepClaimPilot = ({ onNext, onBack, onSkip }) => (
  <SpotlightOverlay direction="main-content" onSkip={onSkip}>
    <TourCard className="max-w-xl">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 animate-pulse">
          <Brain className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">
            ClaimPilot <span className="text-orange-500">AI</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            ClaimPilot&apos;s 8 AI agents analyze every claim automatically.
            Stall detection, evidence gaps, settlement predictions, statute
            compliance &mdash; all handled.
          </p>
        </div>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {AI_AGENTS.map((agent) => {
          const Icon = agent.icon;
          return (
            <div
              key={agent.label}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/30 hover:border-orange-500/20 transition-colors"
            >
              <Icon className={`w-4 h-4 ${agent.color} flex-shrink-0`} />
              <span className="text-xs text-zinc-300 font-medium truncate">
                {agent.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_15px_rgba(234,88,12,0.25)]"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center">
        <StepDots current={2} total={TOTAL_STEPS} />
      </div>
    </TourCard>
  </SpotlightOverlay>
);

const StepApprovalQueue = ({ onNext, onBack, onSkip }) => (
  <SpotlightOverlay direction="sidebar" onSkip={onSkip}>
    <TourCard>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Approval Queue</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            When AI recommends an action, it goes to your approval queue.
          </p>
        </div>
      </div>

      <div className="bg-zinc-800/50 rounded-xl border border-zinc-700/30 p-4 mb-6">
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            You stay in control at all times
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Review, approve, or reject with one click
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            AI explains its reasoning for every recommendation
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_15px_rgba(234,88,12,0.25)]"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center">
        <StepDots current={3} total={TOTAL_STEPS} />
      </div>
    </TourCard>
  </SpotlightOverlay>
);

const StepReady = ({ onComplete, onBack, onSkip }) => (
  <SpotlightOverlay direction="center" onSkip={onSkip}>
    <TourCard>
      <div className="text-center">
        {/* Success icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/10 border border-green-500/30 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
          You&apos;re Ready
        </h2>
        <p className="text-zinc-400 text-sm leading-relaxed mb-2">
          Your claims are already being analyzed.
        </p>
        <p className="text-zinc-500 text-xs leading-relaxed mb-8">
          Check the AI insights panel on any claim to see what ClaimPilot found.
        </p>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all duration-200 shadow-[0_0_20px_rgba(234,88,12,0.3)] hover:shadow-[0_0_30px_rgba(234,88,12,0.5)]"
          >
            Start Working
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Back
          </button>
        </div>

        <StepDots current={4} total={TOTAL_STEPS} />
      </div>
    </TourCard>
  </SpotlightOverlay>
);

/* --- Main Component --- */

const OnboardingTour = () => {
  const { showTour, completeTour } = useOnboarding();
  const [step, setStep] = useState(0);

  const handleNext = useCallback(() => {
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const handleBack = useCallback(() => {
    setStep((prev) => Math.max(prev - 1, 0));
  }, []);

  if (!showTour) return null;

  const stepProps = {
    onNext: handleNext,
    onBack: handleBack,
    onSkip: completeTour,
    onComplete: completeTour,
  };

  const steps = [
    <StepWelcome key="welcome" {...stepProps} />,
    <StepDashboard key="dashboard" {...stepProps} />,
    <StepClaimPilot key="claimpilot" {...stepProps} />,
    <StepApprovalQueue key="approval" {...stepProps} />,
    <StepReady key="ready" {...stepProps} />,
  ];

  return steps[step] || null;
};

export default OnboardingTour;
