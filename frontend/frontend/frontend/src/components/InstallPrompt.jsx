import React, { useState, useEffect } from 'react';
import { X, Share, Plus, Smartphone, CheckCircle } from 'lucide-react';

const InstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsInStandaloneMode(standalone);
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        if (!localStorage.getItem('pwa-install-prompt-dismissed')) setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!showPrompt || !isIOS || isInStandaloneMode) return null;

  const dismiss = () => { setShowPrompt(false); localStorage.setItem('pwa-install-prompt-dismissed', 'true'); };
  const later = () => setShowPrompt(false);

  const steps = [
    { num: 1, icon: <Share className="w-4 h-4 text-orange-400" />, title: 'Tap the Share button', sub: 'at the bottom of Safari' },
    { num: 2, icon: <Plus className="w-4 h-4 text-orange-400" />, title: 'Tap "Add to Home Screen"', sub: 'look for the plus icon' },
    { num: 3, icon: <Smartphone className="w-4 h-4 text-orange-400" />, title: 'Tap "Add" to confirm', sub: 'Eden appears on your home screen' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-700/50 relative">
          <button onClick={dismiss} className="absolute right-3 top-3 p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-zinc-900 font-tactical font-bold text-xl">E</span>
            </div>
            <div>
              <h2 className="text-white font-tactical font-bold text-lg">INSTALL EDEN</h2>
              <p className="text-zinc-500 text-xs font-mono">Add to Home Screen</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 space-y-2">
            {['Works like a native app', 'Full camera access for recon', 'Works offline in the field', 'No App Store needed'].map((text, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                <p className="text-zinc-300 text-sm">{text}</p>
              </div>
            ))}
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center gap-3 p-3 bg-zinc-800/50 border border-zinc-700/30 rounded-lg">
                <div className="w-7 h-7 bg-orange-500 text-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                  {s.num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{s.title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {s.icon}
                    <p className="text-zinc-500 text-xs">{s.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={later} className="flex-1 py-2.5 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 font-tactical text-sm uppercase transition-all">
              Later
            </button>
            <button onClick={dismiss} className="flex-1 btn-tactical py-2.5 text-sm">
              Got It
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;
