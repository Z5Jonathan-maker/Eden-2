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
      description: 'AI-powered Xactimate comparison. Upload carrier vs contractor estimates—instantly identify underpayments worth $5K-$15K.',
      tag: 'SIGNATURE WEAPON',
      tagColor: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10'
    },
    {
      icon: FEATURE_ICONS.agent_eve,
      title: 'Agent Eve',
      subtitle: 'AI Intelligence Officer',
      description: 'Your GPT-4o powered analyst. Dispute letters, policy analysis, claim strategies, and instant expert guidance.',
      tag: 'AI POWERED',
      tagColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10'
    },
    {
      icon: FEATURE_ICONS.garden,
      title: 'The Garden',
      subtitle: 'Claims Command Center',
      description: 'Full lifecycle tracking with Excel import, client management, status pipelines, and team collaboration.',
      tag: 'CORE SYSTEM',
      tagColor: 'text-green-400 border-green-500/30 bg-green-500/10'
    },
    {
      icon: FEATURE_ICONS.harvest,
      title: 'Harvest',
      subtitle: 'Territory Conquest',
      description: 'FREE satellite maps with GPS tracking, door-to-door canvassing, leaderboards, and team competitions.',
      tag: 'FREE MAPS',
      tagColor: 'text-orange-400 border-orange-500/30 bg-orange-500/10'
    },
    {
      icon: FEATURE_ICONS.recon,
      title: 'Recon',
      subtitle: 'Field Intelligence',
      description: 'Voice-annotated photo capture with AI transcription. Narrate while shooting—AI matches notes to images.',
      tag: 'VOICE + AI',
      tagColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10'
    },
    {
      icon: FEATURE_ICONS.contracts,
      title: 'Contracts',
      subtitle: 'Mission Documents',
      description: 'Digital contracts with fillable templates, one-click e-signatures via SignNow, auto-fill from claim data.',
      tag: 'E-SIGN READY',
      tagColor: 'text-red-400 border-red-500/30 bg-red-500/10'
    },
    {
      icon: FEATURE_ICONS.doctrine,
      title: 'Doctrine',
      subtitle: 'Training Academy',
      description: 'Internal knowledge hub with courses, quizzes, certificates, and custom content for your team.',
      tag: 'TRAINING',
      tagColor: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
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
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Users className="w-4 h-4 text-green-500" />
              <span>1,000+ Operators</span>
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
                  'Instant dispute letter generation',
                  'Policy coverage analysis',
                  'Claim strategy recommendations',
                  'Document upload & analysis'
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

      {/* Pricing Section */}
      <section className="relative z-10 py-12 sm:py-20 px-3 sm:px-4 bg-zinc-900/50 border-y border-zinc-800/50">
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
      {paymentMessage && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg border ${
          paymentMessage.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono">{paymentMessage.text}</span>
            <button onClick={() => setPaymentMessage(null)} className="text-zinc-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
