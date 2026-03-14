import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/button';
import { apiPost } from '@/lib/api';
import { ArrowLeft, Save, Loader2, AlertCircle, Target } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';
import { CLAIM_TYPES } from '../lib/core';

// User-scoped draft key to prevent data leaks on shared devices
const getDraftKey = () => {
  try {
    const token = localStorage.getItem('eden_token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return `eden_new_claim_draft_${payload.sub || payload.id || 'anon'}`;
    }
  } catch { /* ignore */ }
  return 'eden_new_claim_draft';
};

const NewClaim = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const draftKey = getDraftKey();
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return {
      claim_number: `CLM-${Date.now().toString().slice(-6)}`,
      client_name: '',
      client_email: '',
      property_address: '',
      date_of_loss: '',
      claim_type: 'Water Damage',
      policy_number: '',
      estimated_value: '',
      description: ''
    };
  });

  // Auto-save draft every 2 seconds
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(formData)); } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [formData]);

  const claimTypes = CLAIM_TYPES;

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimated_value' ? (value ? parseFloat(value) : '') : value
    }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.claim_number.trim()) errors.claim_number = 'Claim number is required';
    if (!formData.client_name.trim()) errors.client_name = 'Client name is required';
    if (!formData.property_address.trim()) errors.property_address = 'Property address is required';
    if (formData.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.client_email)) {
      errors.client_email = 'Enter a valid email address';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const claimData = {
        ...formData,
        estimated_value: parseFloat(formData.estimated_value) || 0
      };
      const res = await apiPost('/api/claims/', claimData);

      if (!res.ok) {
        throw new Error(res.error || 'Failed to create claim');
      }

      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      navigate(`/claims/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (name) => {
    const base = "w-full px-3 py-2.5 bg-zinc-800 border rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 font-mono text-sm";
    return fieldErrors[name]
      ? `${base} border-red-500/70 focus:ring-red-500/50 focus:border-red-500/50`
      : `${base} border-zinc-700/50 focus:ring-orange-500/50 focus:border-orange-500/50`;
  };
  const labelClass = "block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1.5";
  const errorClass = "text-xs text-red-400 font-mono mt-1";

  return (
    <div className="p-3 sm:p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <button
          onClick={() => navigate('/claims')}
          className="mb-4 px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Garden
        </button>
        <div className="flex items-center gap-3 mb-2">
          <img src={NAV_ICONS.new_mission} alt="New Mission" width={40} height={40} className="w-10 h-10 object-contain icon-3d-shadow" />
          <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">NEW MISSION</h1>
        </div>
        <p className="text-zinc-400 font-mono text-xs sm:text-sm uppercase tracking-wider">Create a new claim file</p>
      </div>

      <div className="card-tactical p-4 sm:p-6 max-w-3xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-mono">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="claim_number" className={labelClass}>Claim Number *</label>
              <input id="claim_number" name="claim_number" value={formData.claim_number} onChange={handleChange} className={inputClass('claim_number')} aria-describedby={fieldErrors.claim_number ? 'claim_number-error' : undefined} data-testid="new-claim-number" />
              {fieldErrors.claim_number && <p id="claim_number-error" className={errorClass}>{fieldErrors.claim_number}</p>}
            </div>
            <div>
              <label htmlFor="policy_number" className={labelClass}>Policy Number</label>
              <input id="policy_number" name="policy_number" placeholder="POL-XXXXXX" value={formData.policy_number} onChange={handleChange} className={inputClass('policy_number')} data-testid="new-claim-policy" />
            </div>
            <div>
              <label htmlFor="client_name" className={labelClass}>Client Name *</label>
              <input id="client_name" name="client_name" placeholder="John Doe" value={formData.client_name} onChange={handleChange} className={inputClass('client_name')} aria-describedby={fieldErrors.client_name ? 'client_name-error' : undefined} data-testid="new-claim-client-name" />
              {fieldErrors.client_name && <p id="client_name-error" className={errorClass}>{fieldErrors.client_name}</p>}
            </div>
            <div>
              <label htmlFor="client_email" className={labelClass}>Client Email</label>
              <input id="client_email" name="client_email" type="email" placeholder="client@example.com" value={formData.client_email} onChange={handleChange} className={inputClass('client_email')} aria-describedby={fieldErrors.client_email ? 'client_email-error' : undefined} data-testid="new-claim-client-email" />
              {fieldErrors.client_email && <p id="client_email-error" className={errorClass}>{fieldErrors.client_email}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="property_address" className={labelClass}>Property Address *</label>
              <input id="property_address" name="property_address" placeholder="123 Main St, City, State ZIP" value={formData.property_address} onChange={handleChange} className={inputClass('property_address')} aria-describedby={fieldErrors.property_address ? 'property_address-error' : undefined} data-testid="new-claim-address" />
              {fieldErrors.property_address && <p id="property_address-error" className={errorClass}>{fieldErrors.property_address}</p>}
            </div>
            <div>
              <label htmlFor="date_of_loss" className={labelClass}>Date of Loss</label>
              <input id="date_of_loss" name="date_of_loss" type="date" value={formData.date_of_loss} onChange={handleChange} className={`${inputClass('date_of_loss')} [color-scheme:dark]`} data-testid="new-claim-date" />
            </div>
            <div>
              <label htmlFor="claim_type" className={labelClass}>Claim Type</label>
              <select id="claim_type" name="claim_type" value={formData.claim_type} onChange={handleChange} className={inputClass('claim_type')} data-testid="new-claim-type">
                {claimTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="estimated_value" className={labelClass}>Estimated Value ($)</label>
              <input id="estimated_value" name="estimated_value" type="number" min="0" step="0.01" placeholder="0.00" value={formData.estimated_value} onChange={handleChange} className={inputClass('estimated_value')} data-testid="new-claim-value" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="description" className={labelClass}>Description</label>
              <textarea id="description" name="description" rows={3} placeholder="Describe the claim details..." value={formData.description} onChange={handleChange} className={`${inputClass('description')} resize-none`} data-testid="new-claim-description" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate('/claims')} className="px-6 py-2.5 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 font-tactical text-sm uppercase transition-all focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-tactical px-6 py-2.5 text-sm flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900" data-testid="new-claim-submit">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><Save className="w-4 h-4" /> Create Claim</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewClaim;
