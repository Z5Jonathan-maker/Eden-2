import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../shared/ui/button';
import { apiPost } from '@/lib/api';
import { ArrowLeft, Save, Loader2, AlertCircle, Target } from 'lucide-react';
import { NAV_ICONS } from '../assets/badges';

const NewClaim = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    claim_number: `CLM-${Date.now().toString().slice(-6)}`,
    client_name: '',
    client_email: '',
    property_address: '',
    date_of_loss: '',
    claim_type: 'Water Damage',
    policy_number: '',
    estimated_value: '',
    description: ''
  });

  const claimTypes = [
    'Water Damage', 'Fire Damage', 'Hurricane Damage', 'Hail Damage',
    'Wind Damage', 'Flood Damage', 'Theft', 'Vandalism', 'Other'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'estimated_value' ? (value ? parseFloat(value) : '') : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
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

      navigate(`/claims/${res.data.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 font-mono text-sm";
  const labelClass = "block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="p-3 sm:p-6 lg:p-8 min-h-screen">
      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <button
          onClick={() => navigate('/claims')}
          className="mb-4 px-3 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-orange-400 hover:border-orange-500/30 font-mono text-xs uppercase flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Garden
        </button>
        <div className="flex items-center gap-3 mb-2">
          <img src={NAV_ICONS.new_mission} alt="New Mission" className="w-10 h-10 object-contain icon-3d-shadow" />
          <h1 className="text-xl sm:text-3xl font-tactical font-bold text-white tracking-wide text-glow-orange">NEW MISSION</h1>
        </div>
        <p className="text-zinc-500 font-mono text-xs sm:text-sm uppercase tracking-wider">Create a new claim file</p>
      </div>

      <div className="card-tactical p-4 sm:p-6 max-w-3xl animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-mono">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Claim Number *</label>
              <input name="claim_number" value={formData.claim_number} onChange={handleChange} required className={inputClass} data-testid="new-claim-number" />
            </div>
            <div>
              <label className={labelClass}>Policy Number</label>
              <input name="policy_number" placeholder="POL-XXXXXX" value={formData.policy_number} onChange={handleChange} className={inputClass} data-testid="new-claim-policy" />
            </div>
            <div>
              <label className={labelClass}>Client Name *</label>
              <input name="client_name" placeholder="John Doe" value={formData.client_name} onChange={handleChange} required className={inputClass} data-testid="new-claim-client-name" />
            </div>
            <div>
              <label className={labelClass}>Client Email</label>
              <input name="client_email" type="email" placeholder="client@example.com" value={formData.client_email} onChange={handleChange} className={inputClass} data-testid="new-claim-client-email" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Property Address *</label>
              <input name="property_address" placeholder="123 Main St, City, State ZIP" value={formData.property_address} onChange={handleChange} required className={inputClass} data-testid="new-claim-address" />
            </div>
            <div>
              <label className={labelClass}>Date of Loss</label>
              <input name="date_of_loss" type="date" value={formData.date_of_loss} onChange={handleChange} className={`${inputClass} [color-scheme:dark]`} data-testid="new-claim-date" />
            </div>
            <div>
              <label className={labelClass}>Claim Type</label>
              <select name="claim_type" value={formData.claim_type} onChange={handleChange} className={inputClass} data-testid="new-claim-type">
                {claimTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Estimated Value ($)</label>
              <input name="estimated_value" type="number" min="0" step="0.01" placeholder="25000" value={formData.estimated_value} onChange={handleChange} className={inputClass} data-testid="new-claim-value" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Description</label>
              <textarea name="description" rows={3} placeholder="Describe the claim details..." value={formData.description} onChange={handleChange} className={`${inputClass} resize-none`} data-testid="new-claim-description" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => navigate('/claims')} className="px-6 py-2.5 rounded-lg border border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-600 font-tactical text-sm uppercase transition-all">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-tactical px-6 py-2.5 text-sm flex items-center justify-center gap-2" data-testid="new-claim-submit">
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
