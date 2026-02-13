import React from 'react';
import { Button } from '../shared/ui/button';
import { Smartphone, Share, Plus, CheckCircle, Download, ExternalLink, Shield, Target, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_LOGO } from '../assets/badges';

const InstallGuide = () => {
  const navigate = useNavigate();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                             window.navigator.standalone === true;

  return (
    <div className="p-4 sm:p-8 min-h-screen bg-tactical-animated">
      <div className="max-w-4xl mx-auto">
        {/* Header - Tactical Style */}
        <div className="mb-8 text-center animate-fade-in-up">
          <img 
            src={APP_LOGO} 
            alt="Operation Eden" 
            className="w-20 h-20 mx-auto mb-4 animate-glow-breathe"
            style={{ filter: 'drop-shadow(0 0 25px rgba(234, 88, 12, 0.5))' }}
          />
          <h1 className="text-2xl sm:text-3xl font-tactical font-bold text-white tracking-wide mb-2">
            <span className="text-glow-orange">INSTALL EDEN</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-wider">Deploy to your iPhone • No App Store required</p>
        </div>

        {/* Status Check - Already Installed */}
        {isInStandaloneMode && (
          <div className="mb-6 card-tactical p-4 border-l-2 border-green-500 animate-fade-in-up">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="font-tactical font-semibold text-green-400 uppercase">Deployment Complete</p>
                <p className="text-sm text-zinc-500 font-mono">Eden is running as an installed app</p>
              </div>
            </div>
          </div>
        )}

        {/* Not on iPhone Warning */}
        {!isIOS && (
          <div className="mb-6 card-tactical p-4 border-l-2 border-blue-500 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Smartphone className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="font-tactical font-semibold text-blue-400 uppercase">Device Not Detected</p>
                <p className="text-sm text-zinc-500 font-mono">Access this page on your iPhone using Safari to install Eden</p>
              </div>
            </div>
          </div>
        )}

        {/* Benefits - Tactical Style */}
        <div className="card-tactical p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3 mb-5">
            <Zap className="w-5 h-5 text-orange-500 animate-bounce-gentle" />
            <h2 className="font-tactical font-bold text-white uppercase text-lg tracking-wide">Why Deploy Eden?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: <Smartphone className="w-5 h-5" />, title: 'Native App Experience', desc: 'Works exactly like App Store apps' },
              { icon: <Target className="w-5 h-5" />, title: 'Full Camera Access', desc: 'Capture inspection photos in the field' },
              { icon: <Shield className="w-5 h-5" />, title: 'Works Offline', desc: 'Access data without internet connection' },
              { icon: <Zap className="w-5 h-5" />, title: 'Home Screen Icon', desc: 'Quick access from your iPhone' },
              { icon: <CheckCircle className="w-5 h-5" />, title: 'Instant Updates', desc: 'Always get the latest features' },
              { icon: <Download className="w-5 h-5" />, title: 'No Download Required', desc: 'No App Store, no waiting' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30 hover:border-orange-500/30 transition-all">
                <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="font-tactical font-medium text-white text-sm">{item.title}</p>
                  <p className="text-xs text-zinc-500 font-mono">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Installation Steps - Tactical Style */}
        <div className="card-tactical p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3 mb-5">
            <Target className="w-5 h-5 text-orange-500 animate-scale-pulse" />
            <h2 className="font-tactical font-bold text-white uppercase text-lg tracking-wide">Installation Protocol</h2>
          </div>
          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-orange-500/30">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 text-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 font-tactical font-bold">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-tactical font-semibold text-white mb-1">Open Safari Browser</h4>
                <p className="text-sm text-zinc-400 font-mono mb-2">Ensure you're using Safari (not Chrome or other browsers)</p>
                <p className="text-xs text-zinc-600 font-mono">Navigate to your Eden URL in Safari</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-blue-500/30">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 font-tactical font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-tactical font-semibold text-white mb-1">Tap the Share Button</h4>
                <div className="flex items-center gap-2 mb-2">
                  <Share className="w-5 h-5 text-blue-400" />
                  <p className="text-sm text-zinc-400 font-mono">Tap the share icon at the bottom of Safari</p>
                </div>
                <p className="text-xs text-zinc-600 font-mono">It's the square with an arrow pointing up</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-green-500/30">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 text-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 font-tactical font-bold">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-tactical font-semibold text-white mb-1">Select "Add to Home Screen"</h4>
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-zinc-400 font-mono">Scroll down and tap "Add to Home Screen"</p>
                </div>
                <p className="text-xs text-zinc-600 font-mono">Look for the plus (+) icon next to the text</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-purple-500/30">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 text-zinc-900 rounded-full flex items-center justify-center flex-shrink-0 font-tactical font-bold">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-tactical font-semibold text-white mb-1">Tap "Add" to Confirm</h4>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-purple-400" />
                  <p className="text-sm text-zinc-400 font-mono">Confirm by tapping "Add" in the top right</p>
                </div>
                <p className="text-xs text-zinc-600 font-mono">Eden will appear on your home screen!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Video Tutorial - Tactical Style */}
        <div className="card-tactical p-5 mb-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-5">
            <ExternalLink className="w-5 h-5 text-orange-500" />
            <h2 className="font-tactical font-bold text-white uppercase text-lg tracking-wide">Need Visual Help?</h2>
          </div>
          <div className="p-6 bg-zinc-800/30 rounded-lg text-center border border-zinc-700/30">
            <Download className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 mb-4 font-mono text-sm">Having trouble? Watch a quick video tutorial</p>
            <button className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 font-mono text-sm uppercase flex items-center gap-2 mx-auto transition-all">
              <ExternalLink className="w-4 h-4" />
              Watch Tutorial
            </button>
          </div>
        </div>

        {/* FAQ - Tactical Style */}
        <div className="card-tactical p-5 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-orange-500" />
            <h2 className="font-tactical font-bold text-white uppercase text-lg tracking-wide">Intel FAQ</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: 'Do I need to download from App Store?', a: 'No! Eden installs directly from Safari. No App Store needed.' },
              { q: 'Will it work like a real app?', a: 'Yes! It works exactly like a native app with full camera and offline access.' },
              { q: 'How do I update the app?', a: 'Updates happen automatically when you open the app. No manual updates needed!' },
              { q: 'Can I use it without internet?', a: 'Yes! Once installed, many features work offline for field inspections.' },
            ].map((item, i) => (
              <div key={i} className="p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/30">
                <h4 className="font-tactical font-semibold text-white mb-1 text-sm">{item.q}</h4>
                <p className="text-xs text-zinc-500 font-mono">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="btn-tactical px-8 py-3 text-sm"
            data-testid="get-started-btn"
          >
            <Zap className="w-4 h-4 mr-2 inline" />
            Enter Command Center
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs font-mono mt-6 uppercase tracking-wider">
          Operation Eden v2.0 // Secure Deployment
        </p>
      </div>
    </div>
  );
};

export default InstallGuide;
