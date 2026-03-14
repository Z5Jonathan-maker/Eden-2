/**
 * ComparePage.jsx - Eden vs Competitors
 * SEO-optimized comparison page for PA software shoppers
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Minus, ArrowRight, Shield } from 'lucide-react';
import { APP_LOGO } from '../assets/badges';

const ComparePage = () => {
  const navigate = useNavigate();

  const competitors = [
    { key: 'eden', name: 'Eden', highlight: true },
    { key: 'drodat', name: 'Drodat' },
    { key: 'claimwizard', name: 'ClaimWizard' },
    { key: 'brelly', name: 'Brelly' },
  ];

  const categories = [
    {
      label: 'Claims Management',
      features: [
        { name: 'Full lifecycle claim tracking', eden: true, drodat: true, claimwizard: true, brelly: false },
        { name: 'Excel/CSV import', eden: true, drodat: false, claimwizard: true, brelly: false },
        { name: 'Status pipelines (Kanban)', eden: true, drodat: true, claimwizard: true, brelly: false },
        { name: 'Team assignments & collaboration', eden: true, drodat: true, claimwizard: true, brelly: false },
        { name: 'Client portal (policyholder access)', eden: true, drodat: false, claimwizard: true, brelly: false },
        { name: 'Supplement tracking', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Claim timeline / activity log', eden: true, drodat: false, claimwizard: true, brelly: false },
        { name: 'PDF claim report generation', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'Batch operations (status, assign, archive)', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'AI & Intelligence',
      features: [
        { name: 'AI policy coverage analysis', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'AI dispute letter generation', eden: true, drodat: false, claimwizard: false, brelly: true },
        { name: 'AI claim strategy recommendations', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Document upload & AI summarization', eden: true, drodat: true, claimwizard: false, brelly: true },
        { name: 'Florida statute research (built-in)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Forensic weather data', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'AI Agent Mesh (8 autonomous agents)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'AI photo damage analysis (Gemini Vision)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'AI settlement prediction', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Carrier-specific negotiation tactics', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Xactimate category code reference', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Estimates & Negotiation',
      features: [
        { name: 'Xactimate estimate comparison', eden: true, drodat: 'partial', claimwizard: false, brelly: false },
        { name: 'Carrier vs contractor line-item diff', eden: true, drodat: 'partial', claimwizard: false, brelly: false },
        { name: 'Underpayment identification', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Field Operations',
      features: [
        { name: 'Door-to-door canvassing maps', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'GPS tracking & territory management', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Team leaderboards & gamification', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Voice-annotated photo capture', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'AI photo transcription', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'Daily target tracking with progress bar', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Battle pass / incentive system', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Contracts & Documents',
      features: [
        { name: 'Digital contract templates', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'E-signatures (SignNow)', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'Auto-fill from claim data', eden: true, drodat: true, claimwizard: false, brelly: false },
        { name: 'Cloud file management', eden: true, drodat: true, claimwizard: true, brelly: false },
      ],
    },
    {
      label: 'Training & Onboarding',
      features: [
        { name: 'Training courses & quizzes', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Certificates & completion tracking', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Custom content for your team', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Productivity & UX',
      features: [
        { name: 'Command palette (Ctrl+K)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Keyboard shortcuts throughout app', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Notification center with grouped alerts', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Onboarding checklist for new users', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Vision board / goal tracking', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Google Workspace integration (Gmail, Cal, Drive)', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Compliance & Legal',
      features: [
        { name: 'Florida statute database (Ch. 626, 627)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'FL compliance monitoring (90-day deadlines)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'IICRC S500/S520/S540 standards reference', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Post-SB 2A strategy guidance', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
    {
      label: 'Platform & Pricing',
      features: [
        { name: 'Progressive Web App (install on any device)', eden: true, drodat: false, claimwizard: false, brelly: false },
        { name: 'Native mobile app (iOS/Android)', eden: false, drodat: true, claimwizard: false, brelly: false },
        { name: 'Transparent public pricing', eden: true, drodat: false, claimwizard: true, brelly: false },
        { name: 'PA-specific (not multi-industry)', eden: true, drodat: false, claimwizard: true, brelly: true },
        { name: 'Offline capability', eden: true, drodat: false, claimwizard: false, brelly: false },
      ],
    },
  ];

  const renderCell = (value) => {
    if (value === true) return <Check className="w-5 h-5 text-green-500 mx-auto" />;
    if (value === false) return <X className="w-5 h-5 text-zinc-600 mx-auto" />;
    if (value === 'partial') return <Minus className="w-5 h-5 text-yellow-500 mx-auto" />;
    return <span className="text-zinc-500 text-xs">{value}</span>;
  };

  // Count wins
  const allFeatures = categories.flatMap(c => c.features);
  const edenWins = allFeatures.filter(f => f.eden === true).length;
  const totalFeatures = allFeatures.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src={APP_LOGO} alt="Eden" className="w-8 h-8 object-contain" />
              <span className="text-sm sm:text-lg font-tactical font-bold tracking-wider">
                <span className="text-white">OPERATION</span>{' '}
                <span className="text-orange-500">EDEN</span>
              </span>
            </button>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/login')} className="hidden sm:block px-4 py-2 text-zinc-400 hover:text-white font-tactical text-sm uppercase tracking-wider transition-colors">
                Sign In
              </button>
              <button onClick={() => navigate('/register')} className="btn-tactical px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-12 sm:pt-20 pb-8 sm:pb-12 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-3 py-1 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-mono uppercase tracking-widest mb-6">
            Comparison
          </span>
          <h1 className="text-3xl sm:text-5xl font-tactical font-bold mb-4 tracking-wider">
            EDEN VS THE <span className="text-orange-500">COMPETITION</span>
          </h1>
          <p className="text-base sm:text-xl text-zinc-400 font-mono max-w-2xl mx-auto mb-6">
            The only claims platform built exclusively for public adjusters.
            See how Eden stacks up feature-by-feature.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono">
            <Shield className="w-4 h-4" />
            Eden covers {edenWins} of {totalFeatures} features — more than any competitor
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-16 sm:pb-24 px-3 sm:px-4">
        <div className="max-w-6xl mx-auto overflow-x-auto">
          {categories.map((category, catIdx) => (
            <div key={catIdx} className="mb-8">
              <h3 className="text-sm sm:text-base font-tactical font-bold text-orange-400 uppercase tracking-wider mb-3 px-2">
                {category.label}
              </h3>
              <div className="rounded-lg border border-zinc-800/50 overflow-hidden">
                {/* Header row */}
                {catIdx === 0 && (
                  <div className="grid grid-cols-5 bg-zinc-900/80 border-b border-zinc-800/50">
                    <div className="p-3 text-xs font-mono text-zinc-500 uppercase tracking-wider">Feature</div>
                    {competitors.map((comp) => (
                      <div
                        key={comp.key}
                        className={`p-3 text-center text-xs sm:text-sm font-tactical font-bold uppercase tracking-wider ${
                          comp.highlight ? 'text-orange-400 bg-orange-500/5' : 'text-zinc-400'
                        }`}
                      >
                        {comp.name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Feature rows */}
                {category.features.map((feature, fIdx) => (
                  <div
                    key={fIdx}
                    className={`grid grid-cols-5 border-b border-zinc-800/30 last:border-b-0 ${
                      fIdx % 2 === 0 ? 'bg-zinc-900/30' : 'bg-zinc-950/30'
                    }`}
                  >
                    <div className="p-3 text-xs sm:text-sm text-zinc-300 flex items-center">
                      {feature.name}
                    </div>
                    {competitors.map((comp) => (
                      <div
                        key={comp.key}
                        className={`p-3 flex items-center justify-center ${
                          comp.highlight ? 'bg-orange-500/5' : ''
                        }`}
                      >
                        {renderCell(feature[comp.key])}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-12 sm:py-20 px-4 text-center bg-zinc-900/50 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto">
          <img src={APP_LOGO} alt="Eden" className="w-16 h-16 mx-auto mb-6 object-contain" style={{ filter: 'drop-shadow(0 0 20px rgba(234, 88, 12, 0.4))' }} />
          <h2 className="text-2xl sm:text-4xl font-tactical font-bold text-white mb-4 tracking-wide">
            THE CHOICE IS CLEAR
          </h2>
          <p className="text-zinc-400 mb-8 font-mono text-sm sm:text-base">
            More features. Transparent pricing. Built for PAs, not everyone.
          </p>
          <button
            onClick={() => navigate('/register')}
            className="btn-tactical px-8 sm:px-12 py-3 sm:py-4 text-base sm:text-lg inline-flex items-center gap-3"
          >
            Deploy Operation Eden
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-zinc-800/50">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-zinc-600 text-sm font-mono">
            © 2026 Operation Eden. All rights reserved. // Tactical Claims Platform v2.0
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ComparePage;
