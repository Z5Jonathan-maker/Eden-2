import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, UserPlus, Loader2, Shield } from 'lucide-react';
import { APP_LOGO } from '../assets/badges';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', role: 'adjuster'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match'); return; }
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const result = await register(formData.email, formData.password, formData.fullName, formData.role);
    if (result.success) { navigate('/dashboard'); } else { setError(result.error); }
    setLoading(false);
  };

  const inputClass = "w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono text-sm";
  const labelClass = "block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="min-h-screen bg-zinc-950 bg-tactical-animated flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src={APP_LOGO} alt="Operation Eden" className="w-20 h-20 mx-auto mb-3 animate-glow-breathe" style={{ filter: 'drop-shadow(0 0 25px rgba(234, 88, 12, 0.5))' }} />
          <h1 className="text-2xl font-tactical font-bold tracking-wider">
            <span className="text-white">OPERATION </span>
            <span className="text-orange-500 text-glow-orange">EDEN</span>
          </h1>
          <p className="text-zinc-500 font-mono text-xs uppercase tracking-wider mt-1">Tactical Claims Platform</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-xs font-mono uppercase">System Online</span>
          </div>
        </div>

        {/* Registration Form */}
        <div className="card-tactical p-5 sm:p-6 rounded-xl border border-orange-500/20">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-orange-500 animate-pulse" />
            <h2 className="text-lg font-tactical font-bold text-white uppercase tracking-wider">Request Access</h2>
          </div>
          <p className="text-zinc-500 text-xs font-mono mb-5">Enter credentials to join the operation</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-mono">{error}</span>
              </div>
            )}

            <div>
              <label className={labelClass}>Operator Name *</label>
              <input name="fullName" placeholder="John Doe" value={formData.fullName} onChange={handleChange} required className={inputClass} data-testid="register-name-input" />
            </div>

            <div>
              <label className={labelClass}>Operator ID (Email) *</label>
              <input name="email" type="email" placeholder="operator@eden.tactical" value={formData.email} onChange={handleChange} required className={inputClass} data-testid="register-email-input" />
            </div>

            <div>
              <label className={labelClass}>Clearance Level</label>
              <select name="role" value={formData.role} onChange={handleChange} className={inputClass} data-testid="register-role-select">
                <option value="adjuster">Field Operator</option>
                <option value="admin">Commander</option>
                <option value="client">Observer</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Access Code *</label>
              <input name="password" type="password" placeholder="••••••••" value={formData.password} onChange={handleChange} required className={inputClass} data-testid="register-password-input" />
            </div>

            <div>
              <label className={labelClass}>Confirm Access Code *</label>
              <input name="confirmPassword" type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required className={inputClass} data-testid="register-confirm-password-input" />
            </div>

            <button type="submit" disabled={loading} className="w-full btn-tactical py-3 flex items-center justify-center gap-2 text-sm" data-testid="register-submit-btn">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Request Access</>
              )}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-zinc-500 text-sm font-mono">
              Already have clearance?{' '}
              <Link to="/login" className="text-orange-400 hover:text-orange-300 font-medium">
                Initialize Session
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-zinc-600 text-xs font-mono mt-4 uppercase tracking-wider">
          Operation Eden v2.0 // Secure Channel
        </p>
      </div>
    </div>
  );
};

export default Register;
