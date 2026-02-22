import React, { useState, useEffect } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import { apiGet } from '@/lib/api';

const SECTIONS = ['Core', 'Carrier', 'Financials'];

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">{label}</label>
    {children}
  </div>
);

const Input = ({ value, onChange, type = 'text', ...props }) => (
  <input className="input-tactical w-full px-3 py-2 text-sm" type={type} value={value ?? ''} onChange={onChange} {...props} />
);

const ClaimEditModal = ({ isOpen, editForm, setEditForm, onSave, onCancel, isSaving }) => {
  const [section, setSection] = useState('Core');
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    apiGet('/api/users/team').then(res => {
      if (res.ok) setTeamMembers(res.data || []);
    }).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (key) => (e) => {
    const val = e.target.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value;
    setEditForm({ ...editForm, [key]: val });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto card-tactical p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-tactical font-bold text-white uppercase tracking-wide">
            Edit Mission
          </h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-700/50 pb-2">
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-3 py-1.5 text-xs font-mono uppercase rounded transition-all ${
                section === s ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {section === 'Core' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client Name">
                <Input value={editForm.client_name} onChange={set('client_name')} />
              </Field>
              <Field label="Client Email">
                <Input value={editForm.client_email} onChange={set('client_email')} type="email" />
              </Field>
              <Field label="Client Phone">
                <Input value={editForm.client_phone} onChange={set('client_phone')} type="tel" />
              </Field>
              <Field label="Status">
                <select className="input-tactical w-full px-3 py-2 text-sm" value={editForm.status || 'New'} onChange={set('status')}>
                  {['New', 'In Progress', 'Under Review', 'Approved', 'Denied', 'Completed', 'Closed', 'Archived'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Property Address">
                <Input value={editForm.property_address} onChange={set('property_address')} />
              </Field>
              <Field label="Date of Loss">
                <Input value={editForm.date_of_loss} onChange={set('date_of_loss')} type="date" />
              </Field>
              <Field label="Claim Type">
                <select className="input-tactical w-full px-3 py-2 text-sm" value={editForm.claim_type || 'Water Damage'} onChange={set('claim_type')}>
                  {['Water Damage', 'Wind/Hurricane', 'Fire', 'Hail', 'Flood', 'Mold', 'Theft', 'Vandalism', 'Roof Damage', 'Plumbing', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Policy Number">
                <Input value={editForm.policy_number} onChange={set('policy_number')} />
              </Field>
              <Field label="Priority">
                <select className="input-tactical w-full px-3 py-2 text-sm" value={editForm.priority || 'Medium'} onChange={set('priority')}>
                  {['Low', 'Medium', 'High'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Assigned To">
                <div className="relative">
                  <select
                    className="input-tactical w-full px-3 py-2 text-sm appearance-none"
                    value={editForm.assigned_to || ''}
                    onChange={set('assigned_to')}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.full_name}>
                        {m.full_name} ({m.role})
                      </option>
                    ))}
                  </select>
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                </div>
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea className="input-tactical w-full px-3 py-2 text-sm min-h-[80px]" value={editForm.description || ''} onChange={set('description')} rows={3} />
                </Field>
              </div>
            </div>
          )}

          {section === 'Carrier' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Insurance Carrier">
                <Input value={editForm.carrier_name} onChange={set('carrier_name')} />
              </Field>
              <Field label="Carrier Claim Number">
                <Input value={editForm.carrier_claim_number} onChange={set('carrier_claim_number')} />
              </Field>
              <Field label="Carrier Adjuster Name">
                <Input value={editForm.carrier_adjuster_name} onChange={set('carrier_adjuster_name')} />
              </Field>
              <Field label="Carrier Adjuster Email">
                <Input value={editForm.carrier_adjuster_email} onChange={set('carrier_adjuster_email')} type="email" />
              </Field>
              <Field label="Carrier Adjuster Phone">
                <Input value={editForm.carrier_adjuster_phone} onChange={set('carrier_adjuster_phone')} type="tel" />
              </Field>
              <Field label="Insurance Company Email">
                <Input value={editForm.insurance_company_email} onChange={set('insurance_company_email')} type="email" />
              </Field>
            </div>
          )}

          {section === 'Financials' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Estimated Value ($)">
                <Input value={editForm.estimated_value} onChange={set('estimated_value')} type="number" />
              </Field>
              <Field label="Replacement Cost Value ($)">
                <Input value={editForm.replacement_cost_value} onChange={set('replacement_cost_value')} type="number" />
              </Field>
              <Field label="Actual Cash Value ($)">
                <Input value={editForm.actual_cash_value} onChange={set('actual_cash_value')} type="number" />
              </Field>
              <Field label="Depreciation ($)">
                <Input value={editForm.depreciation} onChange={set('depreciation')} type="number" />
              </Field>
              <Field label="Deductible ($)">
                <Input value={editForm.deductible} onChange={set('deductible')} type="number" />
              </Field>
              <Field label="Net Claim Value ($)">
                <Input value={editForm.net_claim_value} onChange={set('net_claim_value')} type="number" />
              </Field>
              <Field label="Settlement Amount ($)">
                <Input value={editForm.settlement_amount} onChange={set('settlement_amount')} type="number" />
              </Field>
              <Field label="Mortgage Company">
                <Input value={editForm.mortgage_company} onChange={set('mortgage_company')} />
              </Field>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700/50">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase transition-all"
            >
              Cancel
            </button>
            <button
              className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimEditModal;
