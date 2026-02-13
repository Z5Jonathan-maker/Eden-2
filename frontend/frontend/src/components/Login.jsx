import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, LogIn, Loader2, Shield, Crosshair } from 'lucide-react';
import { APP_LOGO } from '../assets/badges';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState('INITIALIZING');

  useEffect(() => {
    // Simulate tactical boot sequence
    const timer = setTimeout(() => setSystemStatus('ONLINE'), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (result.success) {
      const storedUser = localStorage.getItem('eden_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.role === 'client') {
          navigate('/client');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-tactical-animated relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 grid-pattern opacity-50" />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Operation Eden Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <img 
              src={APP_LOGO} 
              alt="Operation Eden" 
              className="w-24 h-24 mx-auto mb-4 animate-glow-breathe"
              style={{ filter: 'drop-shadow(0 0 30px rgba(234, 88, 12, 0.5))' }}
            />
            {/* Status Indicator */}
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${systemStatus === 'ONLINE' ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ boxShadow: systemStatus === 'ONLINE' ? '0 0 15px rgba(34, 197, 94, 0.8)' : '0 0 15px rgba(234, 179, 8, 0.8)' }} />
          </div>
          <h1 className="text-3xl font-tactical font-bold mb-2 tracking-wider">
            <span className="text-white">OPERATION</span>
            <span className="text-orange-500 ml-2 text-glow-orange">EDEN</span>
          </h1>
          <p className="text-zinc-500 font-mono text-sm uppercase tracking-widest">Tactical Claims Platform</p>
          
          {/* System Status */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-mono">
            <Shield className="w-3 h-3 text-green-500" />
            <span className={`${systemStatus === 'ONLINE' ? 'text-green-400' : 'text-yellow-400'}`}>
              SYSTEM {systemStatus}
            </span>
          </div>
        </div>

        {/* Login Card - Tactical Style */}
        <div className="card-tactical p-6 relative scanlines">
          {/* Corner Accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-orange-500/50" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-orange-500/50" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-orange-500/50" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-orange-500/50" />

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Crosshair className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-tactical font-bold text-white uppercase tracking-wide">Access Terminal</h2>
            </div>
            <p className="text-zinc-500 text-sm">Enter credentials to authenticate</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 flex items-center gap-3 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium font-mono">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                Operator ID
              </label>
              <input
                id="email"
                type="email"
                placeholder="operator@eden.tactical"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-tactical w-full px-4 py-3 text-sm"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-mono uppercase tracking-wider text-zinc-400">
                Access Code
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-tactical w-full px-4 py-3 text-sm"
                data-testid="login-password-input"
              />
            </div>

            <button
              type="submit"
              className="btn-tactical w-full py-3 text-sm flex items-center justify-center gap-2"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>
                  <div className="spinner-tactical w-4 h-4 border-2" />
                  <span>AUTHENTICATING...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>INITIALIZE SESSION</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-zinc-700/50 text-center">
            <p className="text-zinc-500 text-sm">
              New operator?{' '}
              <Link to="/register" className="text-orange-500 hover:text-orange-400 font-semibold transition-colors hover-line">
                Request Access
              </Link>
            </p>
          </div>
        </div>

        {/* Version Info */}
        <div className="mt-6 text-center">
          <p className="text-zinc-600 text-xs font-mono">
            OPERATION EDEN v2.0 // SECURE CHANNEL
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
