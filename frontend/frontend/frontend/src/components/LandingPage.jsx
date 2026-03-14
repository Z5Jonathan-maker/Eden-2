/**
 * LandingPage.jsx - Operation Eden Landing Page
 * AAA Gaming-Level Graphics and UI with Animations
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ChevronRight, Play, X, Check, Loader2,
  Shield, Target, Zap, Users, ArrowRight
} from 'lucide-react';
import { apiPost } from '@/lib/api';
import { APP_LOGO, FEATURE_ICONS, TIER_BADGES } from '../assets/badges';

// Custom hook for intersection observer animations
const useInView = (options = {}) => {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const threshold = options.threshold ?? 0.1;
  const root = options.root ?? null;
  const rootMargin = options.rootMargin ?? '0px';

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
      }
    }, { threshold, root, rootMargin });

    observer.observe(node);

    return () => {
      observer.unobserve(node);
      observer.disconnect();
    };
  }, [threshold, root, rootMargin]);

  return [ref, isInView];
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [showPricing, setShowPricing] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState(null);
  
  // Animation refs
  const [heroRef, heroInView] = useInView();
  const [featuresRef, featuresInView] = useInView();
  const [eveRef, eveInView] = useInView();
  const [pricingRef, pricingInView] = useInView();

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'cancelled') {
      setPaymentMessage({ type: 'info', text: 'Payment was cancelled. You can try again anytime.' });
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams]);

  const handleStartTrial = async (packageId) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { selectedPlan: packageId } });
      return;
    }
    setLoadingPlan(packageId);
    try {
      const originUrl = window.location.origin;
      const res = await apiPost('/api/payments/checkout', {
        package_id: packageId,
        origin_url: originUrl,
      });

      if (!res.ok) {
        throw new Error(res.error || 'Failed to start checkout');
      }

      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error) {
      setPaymentMessage({ type: 'error', text: error.message || 'Failed to start checkout.' });
    } finally {
      setLoadingPlan(null);
    }
  };

  const features = [
    {
      icon: FEATURE_ICONS.scales,
      title: 'Scales',
      subtitle: 'Estimate Warfare',
      description: 'AI-powered Xactimate comparison. Upload carrier vs contractor estimates—instantly identify underpayments and win more at negotiation.',
      tag: 'SIGNATURE WEAPON',
      tagColor: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    },
    {
      icon: FEATURE_ICONS.agent_eve,
      title: 'Agent Eve',
      subtitle: 'AI Intelligence Officer',
      description: 'Your AI analyst. Policy coverage analysis, dispute letter generation, claim strategy recommendations, and document intelligence—all in one workspace.',
      tag: 'AI POWERED',
      tagColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10'
    },
    {
      icon: FEATURE_ICONS.garden,
      title: 'The Garden',
      subtitle: 'Claims Command Center',
      description: 'Full lifecycle claim tracking with Excel/CSV import, client management, status pipelines, team assignments, and real-time collaboration.',
      tag: 'CORE SYSTEM',
      tagColor: 'text-green-400 border-green-500/30 bg-green-500/10'
    },
    {
      icon: FEATURE_ICONS.harvest,
      title: 'Harvest',
      subtitle: 'Territory Conquest',
      description: 'Satellite maps with GPS tracking, door-to-door canvassing pins, team leaderboards, gamification, and territory management.',
      tag: 'CANVASSING',
      tagColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10'
    },
    {
      icon: FEATURE_ICONS.recon,
      title: 'Recon',
      subtitle: 'Field Intelligence',
      description: 'Voice-annotated photo capture with AI transcription. Narrate while shooting—AI organizes notes by room and damage type.',
      tag: 'VOICE + AI',
      tagColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10'
    },
    {
      icon: FEATURE_ICONS.contracts,
      title: 'Contracts',
      subtitle: 'Mission Documents',
      description: 'Digital contracts with fillable templates, one-click e-signatures via SignNow, auto-fill from claim data, and live tracking.',
      tag: 'E-SIGN READY',
      tagColor: 'text-red-400 border-red-500/30 bg-red-500/10'
    },
    {
      icon: FEATURE_ICONS.doctrine,
      title: 'Doctrine',
      subtitle: 'Training Academy',
      description: 'Onboard and level up your team with courses, quizzes, certificates, and custom training content built for adjusters.',
      tag: 'TRAINING',
      tagColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
    },
    {
      icon: FEATURE_ICONS.garden,
      title: 'Client Portal',
      subtitle: 'Policyholder Access',
      description: 'Give your clients real-time claim status visibility. Fewer phone calls, faster communication, and a professional edge competitors lack.',
      tag: 'CLIENT FACING',
      tagColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    },
    {
      icon: FEATURE_ICONS.recon,
      title: 'Weather Intel',
      subtitle: 'Storm Validation',
      description: 'Forensic weather data tied to claim addresses. Verify storm events, wind speeds, and hail reports to strengthen every claim.',
      tag: 'DATA DRIVEN',
      tagColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10'
    },
  ];

  const pricingTiers = [
    {
      id: "starter",
      name: "Solo Operator",
      price: 149,
      badge: TIER_BADGES.recruit,
      rarity: "common",
      features: [
        "Up to 50 active claims",
        "Scales - 10 comparisons/month",
        "Agent Eve - 100 queries/month",
        "Harvest canvassing maps",
        "Unlimited Recon photos",
        "5 contracts/month",
      ],
    },
    {
      id: "professional",
      name: "Field Commander",
      price: 299,
      badge: TIER_BADGES.commander,
      rarity: "epic",
      popular: true,
      features: [
        "Unlimited active claims",
        "Scales - Unlimited comparisons",
        "Agent Eve - Unlimited queries",
        "Harvest with team leaderboards",
        "Unlimited everything",
        "Priority support",
      ],
    },
    {
      id: "enterprise",
      name: "War General",
      price: 599,
      badge: TIER_BADGES.legend,
      rarity: "legendary",
      features: [
        "Everything in Commander",
        "Multi-office management",
        "Custom integrations",
        "Dedicated account manager",
        "White-label options",
        "SLA guarantee",
      ],
    },
  ];

  const getRarityStyle = (rarity) => {
    switch (rarity) {
      case 'legendary': return 'border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.3)]';
      case 'epic': return 'border-purple-500/50 shadow-[0_0_25px_rgba(168,85,247,0.3)]';
      default: return 'border-zinc-700/50';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-tactical-animated opacity-50" />
      <div className="fixed inset-0 grid-pattern opacity-30" />
      
      {/* Floating particles effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Logo with TRUE transparent background */}
              <img
                src={APP_LOGO}
                alt="Operation Eden"
                width={32}
                height={32}
                className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
                style={{ filter: 'drop-shadow(0 0 10px rgba(234, 88, 12, 0.4))' }}
              />
              <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-sm sm:text-xl font-tactical font-bold tracking-wider text-white">OPERATION</span>
                <span className="text-sm sm:text-xl font-tactical font-bold tracking-wider text-orange-500">EDEN</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {isAuthenticated ? (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-tactical px-3 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Enter Command Center</span>
                  <span className="sm:hidden">Enter</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/compare')}
                    className="hidden sm:block px-4 py-2 text-zinc-400 hover:text-white font-tactical text-sm uppercase tracking-wider transition-colors"
                  >
                    Compare
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="hidden sm:block px-4 py-2 text-zinc-400 hover:text-white font-tactical text-sm uppercase tracking-wider transition-colors"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="btn-tactical px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm"
                  >
                    <span className="sm:hidden">Deploy</span>
                    <span className="hidden sm:inline">Deploy Now</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative z-10 pt-12 sm:pt-20 pb-16 sm:pb-32 px-4">
        <div className={`max-w-7xl mx-auto text-center transition-all duration-1000 ${heroInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Main Logo - True transparent background with floating animation */}
          <div className="mb-6 sm:mb-8">
            <div className="relative w-32 h-32 sm:w-48 sm:h-48 mx-auto mb-4 sm:mb-6">
              {/* Animated glow rings */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-orange-500/30 to-amber-500/30 blur-2xl animate-pulse" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-r from-orange-500/40 to-amber-500/40 blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />
              {/* Floating logo with TRUE transparent background */}
              <img
                src={APP_LOGO}
                alt="Operation Eden"
                width={128}
                height={128}
                className="w-32 h-32 sm:w-48 sm:h-48 relative z-10 object-contain animate-float"
                style={{
                  filter: 'drop-shadow(0 10px 30px rgba(234, 88, 12, 0.5)) drop-shadow(0 5px 15px rgba(0,0,0,0.4))'
                }}
              />
            </div>
            <div className="inline-block px-3 sm:px-4 py-1 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] sm:text-xs font-mono uppercase tracking-widest mb-4 sm:mb-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              Tactical Claims Platform
            </div>
          </div>

          {/* Main Headline with staggered animation */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-tactical font-bold mb-4 sm:mb-6 tracking-wider">
            <span className="text-white inline-block animate-fade-in-up" style={{ animationDelay: '0.4s' }}>OPERATION</span>
            <br />
            <span className="text-orange-500 text-glow-orange inline-block animate-fade-in-up" style={{ animationDelay: '0.6s' }}>EDEN</span>
          </h1>
          
          <p className="text-base sm:text-2xl text-zinc-400 max-w-3xl mx-auto mb-8 sm:mb-10 font-mono px-2 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            The Ultimate Command Center for Property Claims Operations
          </p>

          {/* CTA Buttons with animation */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-10 sm:mb-16 px-4 animate-fade-in-up" style={{ animationDelay: '1s' }}>
            <button
              onClick={() => navigate('/register')}
              className="btn-tactical px-8 sm:px-10 py-3 sm:py-4 text-base sm:text-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform"
            >
              <Target className="w-5 h-5" />
              Start Free Trial
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="px-8 sm:px-10 py-3 sm:py-4 rounded border border-zinc-700/50 text-zinc-300 hover:text-white hover:border-orange-500/30 font-tactical uppercase tracking-wider flex items-center justify-center gap-3 transition-all hover:scale-105"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>

          {/* Trust Badges with animation */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-zinc-500 font-mono animate-fade-in-up" style={{ animationDelay: '1.2s' }}>
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              <span>End-to-End Encryption</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>Built for Florida PAs</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              <span>Install as App on Any Device</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="relative z-10 py-12 sm:py-20 px-3 sm:px-4 bg-zinc-900/50 border-y border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className={`text-center mb-10 sm:mb-16 transition-all duration-700 ${featuresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-3 sm:mb-4 tracking-wide">
              TACTICAL ARSENAL
            </h2>
            <p className="text-zinc-500 font-mono uppercase tracking-wider text-xs sm:text-sm px-4">
              Every weapon you need to dominate the claims battlefield
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className={`card-tactical card-tactical-hover p-4 sm:p-6 group cursor-pointer transition-all duration-500 ${featuresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                {/* Feature Icon - TRUE transparent background with glow and float */}
                <div className="mb-3 sm:mb-4 relative h-20 sm:h-24 flex items-center justify-center">
                  {/* Animated glow effect behind icon */}
                  <div 
                    className="absolute w-20 sm:w-24 h-20 sm:h-24 rounded-full opacity-0 group-hover:opacity-80 transition-opacity duration-500 blur-xl"
                    style={{ background: feature.tagColor.includes('yellow') ? '#facc15' : feature.tagColor.includes('blue') ? '#3b82f6' : feature.tagColor.includes('green') ? '#22c55e' : feature.tagColor.includes('purple') ? '#a855f7' : feature.tagColor.includes('red') ? '#ef4444' : feature.tagColor.includes('cyan') ? '#06b6d4' : '#f97316' }}
                  />
                  {/* Icon with TRUE transparent background */}
                  <img
                    src={feature.icon}
                    alt={feature.title}
                    width={64}
                    height={64}
                    loading="lazy"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain relative z-10 group-hover:scale-110 transition-transform duration-500 animate-float-slow"
                    style={{
                      filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))',
                      animationDelay: `${idx * 0.2}s`
                    }}
                  />
                </div>

                {/* Tag with pulse animation on hover */}
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${feature.tagColor} mb-2 sm:mb-3 group-hover:animate-pulse`}>
                  {feature.tag}
                </span>

                {/* Title */}
                <h3 className="text-lg sm:text-xl font-tactical font-bold text-white mb-1 group-hover:text-orange-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-sm text-orange-400 font-mono uppercase tracking-wider mb-2 sm:mb-3">
                  {feature.subtitle}
                </p>

                {/* Description */}
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agent Eve Showcase */}
      <section ref={eveRef} className="relative z-10 py-12 sm:py-20 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className={`relative transition-all duration-700 ${eveInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              {/* Animated glow background */}
              <div className="absolute inset-0 bg-gradient-radial from-blue-500/30 to-transparent blur-3xl scale-150 animate-pulse" />
              <div className="absolute inset-10 bg-gradient-radial from-cyan-500/20 to-transparent blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
              {/* Agent Eve icon with TRUE transparent background and floating animation */}
              <img
                src={FEATURE_ICONS.agent_eve}
                alt="Agent Eve"
                width={192}
                height={192}
                loading="lazy"
                className="w-48 h-48 sm:w-72 sm:h-72 mx-auto object-contain relative z-10 animate-float"
                style={{
                  filter: 'drop-shadow(0 20px 40px rgba(59, 130, 246, 0.4)) drop-shadow(0 10px 20px rgba(0,0,0,0.4))'
                }}
              />
            </div>
            <div className={`transition-all duration-700 delay-200 text-center lg:text-left ${eveInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <span className="inline-block px-3 py-1 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono uppercase tracking-widest mb-4 animate-pulse">
                AI Intelligence
              </span>
              <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-3 sm:mb-4 tracking-wide">
                AGENT EVE
              </h2>
              <p className="text-base sm:text-xl text-zinc-400 mb-4 sm:mb-6 font-mono">
                Your AI-Powered Claims Intelligence Officer
              </p>
              <ul className="space-y-3 text-zinc-300 text-sm sm:text-base text-left max-w-md mx-auto lg:mx-0">
                {[
                  'Upload policies — AI finds coverage gaps instantly',
                  'Generate dispute letters in seconds',
                  'Claim strategy & negotiation recommendations',
                  'Florida statute research built in',
                  'Document analysis & summarization'
                ].map((item, idx) => (
                  <li key={idx} className={`flex items-center gap-3 transition-all duration-500 ${eveInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-5'}`} style={{ transitionDelay: `${400 + idx * 100}ms` }}>
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 sm:mt-8 flex justify-center lg:justify-start">
                <button
                  onClick={() => navigate('/register')}
                  className="px-6 sm:px-8 py-2.5 sm:py-3 rounded border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 font-tactical uppercase tracking-wider flex items-center gap-3 transition-all hover:scale-105 hover:border-blue-400 text-sm sm:text-base"
                >
                  Deploy Agent Eve
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Eden Section */}
      <section className="relative z-10 py-12 sm:py-20 px-3 sm:px-4 bg-zinc-900/50 border-y border-zinc-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-3 sm:mb-4 tracking-wide">
              WHY EDEN WINS
            </h2>
            <p className="text-zinc-500 font-mono uppercase tracking-wider text-xs sm:text-sm px-4">
              Purpose-built for public adjusters — not a generic tool
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { title: 'PA-Specific', desc: 'Every feature designed for public adjusters. Not a generic tool stretched across 5 industries.' },
              { title: 'Transparent Pricing', desc: 'No hidden fees, no sales calls required. See exactly what you pay and what you get.' },
              { title: 'All-in-One Platform', desc: '9 integrated tools — claims, AI, canvassing, contracts, training, weather, photos, and client portal.' },
              { title: 'Florida Statute Library', desc: 'Built-in searchable Florida insurance law database. Reference statutes mid-negotiation.' },
              { title: 'Team Gamification', desc: 'Leaderboards, competitions, and rewards that keep your canvassing team motivated and accountable.' },
              { title: 'Works Offline', desc: 'Progressive Web App installs on any device. Capture photos and data even without cell service.' },
            ].map((item, idx) => (
              <div key={idx} className="p-4 sm:p-5 rounded-lg border border-zinc-800/50 bg-zinc-900/50">
                <h3 className="text-sm sm:text-base font-tactical font-bold text-orange-400 mb-2 uppercase tracking-wider">{item.title}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="relative z-10 py-12 sm:py-20 px-3 sm:px-4 bg-zinc-950/50 border-y border-zinc-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-3 sm:mb-4 tracking-wide">
              CHOOSE YOUR LOADOUT
            </h2>
            <p className="text-zinc-500 font-mono uppercase tracking-wider text-xs sm:text-sm px-4">
              Select the firepower that matches your operation size
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div 
                key={tier.id}
                className={`relative card-tactical p-4 sm:p-6 ${getRarityStyle(tier.rarity)} ${tier.popular ? 'md:scale-105 z-10 ring-1 ring-purple-500/30' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 sm:px-4 py-1 bg-purple-500 text-white text-[10px] sm:text-xs font-mono uppercase tracking-wider rounded">
                    Most Popular
                  </div>
                )}

                {/* Badge */}
                <div className="text-center mb-3 sm:mb-4">
                  <img
                    src={tier.badge}
                    alt={tier.name}
                    width={64}
                    height={64}
                    loading="lazy"
                    className="w-16 h-16 sm:w-20 sm:h-20 mx-auto object-contain"
                  />
                </div>

                {/* Plan Name */}
                <h3 className="text-lg sm:text-xl font-tactical font-bold text-white text-center mb-2">
                  {tier.name}
                </h3>

                {/* Price */}
                <div className="text-center mb-4 sm:mb-6">
                  <span className="text-3xl sm:text-4xl font-tactical font-bold text-orange-400">${tier.price}</span>
                  <span className="text-zinc-500 font-mono text-sm">/month</span>
                </div>

                {/* Features */}
                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs sm:text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleStartTrial(tier.id)}
                  disabled={loadingPlan === tier.id}
                  className={`w-full py-2.5 sm:py-3 rounded font-tactical uppercase tracking-wider flex items-center justify-center gap-2 transition-all text-sm sm:text-base ${
                    tier.popular 
                      ? 'btn-tactical' 
                      : 'border border-zinc-700/50 text-zinc-300 hover:border-orange-500/30 hover:text-orange-400'
                  }`}
                >
                  {loadingPlan === tier.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Start Free Trial
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-12 sm:py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <img
            src={APP_LOGO}
            alt="Operation Eden"
            width={64}
            height={64}
            loading="lazy"
            className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6"
            style={{ filter: 'drop-shadow(0 0 20px rgba(234, 88, 12, 0.4))' }}
          />
          <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-3 sm:mb-4 tracking-wide">
            READY TO DOMINATE?
          </h2>
          <p className="text-zinc-400 mb-6 sm:mb-8 font-mono text-sm sm:text-base">
            Join the ranks of elite claims professionals
          </p>
          <button
            onClick={() => navigate('/register')}
            className="btn-tactical px-8 sm:px-12 py-3 sm:py-4 text-base sm:text-lg"
          >
            Deploy Operation Eden
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-zinc-800/50 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-zinc-600 text-sm font-mono">
            © 2026 Operation Eden. All rights reserved. // Tactical Claims Platform v2.0
          </p>
        </div>
      </footer>

      {/* Payment Message */}
      {/* Demo Walkthrough Modal — Interactive with Visual Mockups */}
      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={() => { setShowDemo(false); setDemoStep(0); }}>
          <div className="relative w-full max-w-5xl mx-4 bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-700/40 rounded-2xl shadow-[0_0_80px_rgba(234,88,12,0.08)] overflow-hidden" onClick={e => e.stopPropagation()}>

            {/* Cinematic Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/60">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-orange-500 animate-ping opacity-40" />
                </div>
                <span className="text-sm font-mono text-zinc-400 uppercase tracking-[0.2em]">Eden Platform</span>
                <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">LIVE DEMO</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-zinc-600 font-mono">{demoStep + 1} / 5</span>
                <button onClick={() => { setShowDemo(false); setDemoStep(0); }} className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-zinc-800" aria-label="Close demo">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area — Two Column: Mockup + Description */}
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[480px]">

              {/* Left: Visual Mockup */}
              <div className="p-8 flex items-center justify-center border-r border-zinc-800/40 bg-zinc-950/50">
                {[
                  /* Step 0: AI Agents Overview */
                  <div key="mock-0" className="w-full max-w-sm space-y-3 transition-all duration-500">
                    <div className="text-xs text-zinc-500 font-mono mb-4 uppercase tracking-wider">ClaimPilot Agent Mesh</div>
                    {['ClaimMonitor','VisionAnalyzer','IntakeParser','EvidenceScorer','NegotiationCopilot','StatuteMatcher','PredictiveAnalytics','EstimateEngine'].map((agent, i) => (
                      <div key={agent} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/30 transition-all duration-300" style={{ animationDelay: `${i * 100}ms`, opacity: 1 }}>
                        <div className={`w-2 h-2 rounded-full ${i < 5 ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} style={{ animationDelay: `${i * 200}ms` }} />
                        <span className="text-xs text-zinc-300 font-mono flex-1">{agent}</span>
                        <span className="text-[10px] text-zinc-600">{i < 5 ? 'ACTIVE' : 'READY'}</span>
                      </div>
                    ))}
                  </div>,

                  /* Step 1: Negotiation Mockup */
                  <div key="mock-1" className="w-full max-w-sm space-y-4 transition-all duration-500">
                    <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">Carrier Response Analysis</div>
                    <div className="p-4 rounded-lg bg-zinc-800/60 border border-zinc-700/30">
                      <div className="text-xs text-zinc-500 mb-2">Carrier Offer</div>
                      <div className="text-2xl font-bold text-red-400 font-mono">$4,200</div>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="text-orange-500 text-xs font-mono flex items-center gap-2"><Zap className="w-3 h-3" /> AI Counter Strategy</div>
                    </div>
                    <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                      <div className="text-xs text-orange-400 mb-2">Recommended Counter</div>
                      <div className="text-2xl font-bold text-green-400 font-mono">$12,600</div>
                      <div className="text-xs text-zinc-500 mt-2">Based on F.S. 627.70131 + 3 comparable settlements</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">3 leverage points</span>
                      <span className="text-[10px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">2 statute violations</span>
                    </div>
                  </div>,

                  /* Step 2: Statute Compliance */
                  <div key="mock-2" className="w-full max-w-sm space-y-3 transition-all duration-500">
                    <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">FL Compliance Dashboard</div>
                    {[
                      { statute: '627.70131', title: '14-Day Acknowledgment', days: 3, status: 'compliant' },
                      { statute: '627.70131(5)', title: 'Investigation Start', days: -2, status: 'overdue' },
                      { statute: '627.70131(7)', title: '90-Day Resolution', days: 23, status: 'approaching' },
                    ].map((s, i) => (
                      <div key={i} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-zinc-300">F.S. {s.statute}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                            s.status === 'compliant' ? 'bg-green-500/20 text-green-400' :
                            s.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>{s.status === 'overdue' ? `${Math.abs(s.days)}d OVERDUE` : `${s.days}d remaining`}</span>
                        </div>
                        <div className="text-xs text-zinc-500">{s.title}</div>
                        <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${
                            s.status === 'compliant' ? 'bg-green-500 w-[85%]' :
                            s.status === 'overdue' ? 'bg-red-500 w-full' :
                            'bg-amber-500 w-[74%]'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>,

                  /* Step 3: Evidence Scoring */
                  <div key="mock-3" className="w-full max-w-sm space-y-4 transition-all duration-500">
                    <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">Evidence Completeness</div>
                    <div className="text-center mb-2">
                      <div className="text-5xl font-bold text-orange-400 font-mono">72%</div>
                      <div className="text-xs text-amber-400 mt-1">Needs Work</div>
                    </div>
                    {[
                      { cat: 'Property Docs', pct: 75, color: 'bg-green-500' },
                      { cat: 'Damage Evidence', pct: 90, color: 'bg-green-500' },
                      { cat: 'Communications', pct: 60, color: 'bg-amber-500' },
                      { cat: 'Financial Records', pct: 35, color: 'bg-red-500' },
                    ].map((c, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-400">{c.cat}</span>
                          <span className="text-zinc-500 font-mono">{c.pct}%</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.color} transition-all duration-1000`} style={{ width: `${c.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    <div className="p-3 rounded bg-red-500/5 border border-red-500/20">
                      <div className="text-[10px] text-red-400 font-mono mb-1">PRIORITY GAP</div>
                      <div className="text-xs text-zinc-300">Missing: contractor estimates, loss inventory</div>
                    </div>
                  </div>,

                  /* Step 4: Approval Queue */
                  <div key="mock-4" className="w-full max-w-sm space-y-3 transition-all duration-500">
                    <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">Approval Queue</div>
                    {[
                      { agent: 'NegotiationCopilot', action: 'Send counter-offer email', confidence: 94 },
                      { agent: 'ClaimMonitor', action: 'Create follow-up task', confidence: 88 },
                      { agent: 'IntakeParser', action: 'Update client phone', confidence: 76 },
                    ].map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-zinc-400">{item.agent}</span>
                          <span className={`text-xs font-mono ${item.confidence >= 85 ? 'text-green-400' : item.confidence >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{item.confidence}%</span>
                        </div>
                        <div className="text-sm text-zinc-200 mb-3">{item.action}</div>
                        <div className="flex gap-2">
                          <button className="flex-1 py-1.5 text-xs rounded bg-green-600/80 text-white font-medium">Approve</button>
                          <button className="flex-1 py-1.5 text-xs rounded bg-zinc-700 text-zinc-300 font-medium">Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>,
                ][demoStep]}
              </div>

              {/* Right: Description */}
              <div className="p-8 flex flex-col justify-center">
                {[
                  { title: "8 AI Agents. Zero Manual Work.", desc: "ClaimPilot deploys specialized AI agents that analyze every aspect of your claims automatically. From intake parsing to settlement prediction — each agent handles a specific domain with expert-level accuracy.", features: ["Stall detection catches idle claims every 2 hours", "Vision AI classifies damage from inspection photos", "Predictive models forecast settlement ranges and litigation risk"] },
                  { title: "Negotiate Like a 20-Year Veteran.", desc: "NegotiationCopilot reads carrier responses, identifies their position, and crafts counter-arguments backed by FL statute citations and comparable settlements.", features: ["Detects lowball offers and recommends 1.5x counter", "Cites specific FL statutes as leverage", "Learns carrier behavior patterns over time"] },
                  { title: "Never Miss a Deadline.", desc: "StatuteMatcher tracks every compliance deadline from F.S. 627. Approaching deadlines trigger alerts. Overdue items escalate automatically.", features: ["14-day acknowledgment tracking", "90-day resolution countdown", "Carrier violation flagging with statute references"] },
                  { title: "Know Exactly What's Missing.", desc: "EvidenceScorer rates your documentation across 4 categories and tells you the exact next piece of evidence to gather — prioritized by impact on negotiation strength.", features: ["4-category scoring: property, damage, comms, financial", "Priority-ranked gap recommendations", "Readiness indicator: ready / needs work / insufficient"] },
                  { title: "AI Recommends. You Decide.", desc: "Every action that changes data or sends communication goes through your approval queue. You see the AI's confidence score, reasoning, and can approve or reject with one click.", features: ["Confidence-scored recommendations", "Full reasoning visible before approval", "Complete audit trail for FL compliance"] },
                ].map((step, i) => (
                  demoStep === i && (
                    <div key={i} className="transition-all duration-500">
                      <h3 className="text-2xl lg:text-3xl font-bold text-zinc-100 mb-4 leading-tight">{step.title}</h3>
                      <p className="text-zinc-400 mb-8 leading-relaxed">{step.desc}</p>
                      <ul className="space-y-4">
                        {step.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-3">
                            <div className="mt-1 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-orange-400" />
                            </div>
                            <span className="text-zinc-300 text-sm leading-relaxed">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Navigation Bar */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-zinc-800/60 bg-zinc-950/80">
              {/* Step Indicators */}
              <div className="flex gap-3">
                {['Agents', 'Negotiate', 'Comply', 'Evidence', 'Approve'].map((label, i) => (
                  <button key={i} onClick={() => setDemoStep(i)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-300 ${
                    demoStep === i
                      ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 scale-105'
                      : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
                  }`} aria-label={`Step ${i + 1}: ${label}`}>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${demoStep === i ? 'bg-orange-500' : 'bg-zinc-700'}`} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-3">
                {demoStep > 0 && (
                  <button onClick={() => setDemoStep(s => s - 1)} className="px-5 py-2.5 text-sm text-zinc-400 hover:text-white border border-zinc-700/50 rounded-lg transition-all hover:border-zinc-600 font-mono">
                    ← Back
                  </button>
                )}
                {demoStep < 4 ? (
                  <button onClick={() => setDemoStep(s => s + 1)} className="px-6 py-2.5 text-sm bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-105">
                    Next →
                  </button>
                ) : (
                  <button onClick={() => { setShowDemo(false); setDemoStep(0); navigate('/login'); }} className="px-6 py-2.5 text-sm bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-lg transition-all font-medium shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-105">
                    Start Free Trial →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentMessage && (
        <div role="alert" aria-live="assertive" className={`fixed top-20 right-4 z-50 p-4 rounded-lg border ${
          paymentMessage.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono">{paymentMessage.text}</span>
            <button onClick={() => setPaymentMessage(null)} className="text-zinc-500 hover:text-white" aria-label="Dismiss payment message">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
