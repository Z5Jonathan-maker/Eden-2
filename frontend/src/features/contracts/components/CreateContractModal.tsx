import React, { useEffect, useMemo, useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { ClaimItem, ContractMergeFields, CreateContractPayload } from '../types/types';
import SelectClaimModal from './SelectClaimModal';
import { fetchClaimPrefill, toMergeFields, PA_TEMPLATE_ID, DFS_TEMPLATE_ID } from '../api/api';

const DEFAULT_FIELDS: ContractMergeFields = {
  client_name: '',
  client_address: '',
  property_address: '',
  carrier: '',
  policy_number: '',
  loss_date: '',
  claim_number: '',
  fee_percentage: '10',
  adjuster_name: '',
  adjuster_license: '',
  phone: '',
  email: '',
};

const TEMPLATES = [
  {
    id: PA_TEMPLATE_ID,
    name: 'PA Agreement',
    description: 'Full FL-compliant Public Adjuster Agreement with carrier authorization — 22 fields, e-signature ready',
    icon: FileText,
    accent: 'cyan' as const,
  },
  {
    id: DFS_TEMPLATE_ID,
    name: 'DFS Disclosure',
    description: 'Florida DFS-H1-1982 Claim Process Disclosure — required by Rule 69B-220.051, F.A.C.',
    icon: ShieldCheck,
    accent: 'amber' as const,
  },
];

interface Props {
  open: boolean;
  claims: ClaimItem[];
  onClose: () => void;
  onCreate: (payload: CreateContractPayload) => Promise<void>;
}

interface FieldProps {
  label: string;
  value: string;
}

const Field: React.FC<FieldProps> = ({ label, value }) => (
  <div className="flex flex-col">
    <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    <span className="mt-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200">
      {value || '-'}
    </span>
  </div>
);

const CreateContractModal: React.FC<Props> = ({ open, claims, onClose, onCreate }) => {
  const [templateId, setTemplateId] = useState(PA_TEMPLATE_ID);
  const [claimPickerOpen, setClaimPickerOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ClaimItem | null>(null);
  const [fields, setFields] = useState<ContractMergeFields>(DEFAULT_FIELDS);
  const [creating, setCreating] = useState(false);

  const isDfs = templateId === DFS_TEMPLATE_ID;

  useEffect(() => {
    if (!open) {
      setSelectedClaim(null);
      setFields(DEFAULT_FIELDS);
      setTemplateId(PA_TEMPLATE_ID);
    }
  }, [open]);

  const contractName = useMemo(
    () =>
      isDfs
        ? `DFS Disclosure - ${fields.client_name || 'Client'}`
        : `PA Agreement - ${fields.client_name || 'Client'}`,
    [fields.client_name, isDfs]
  );

  const handleClaimSelect = async (claim: ClaimItem) => {
    setSelectedClaim(claim);
    setClaimPickerOpen(false);
    const prefill = await fetchClaimPrefill(claim.id);
    setFields(toMergeFields(claim, prefill));
  };

  const missingRequired = isDfs
    ? !fields.client_name || !selectedClaim
    : !fields.client_name || !fields.email || !fields.adjuster_license || !selectedClaim;

  const submit = async () => {
    if (missingRequired || !selectedClaim) return;
    setCreating(true);
    try {
      await onCreate({
        claimId: selectedClaim.id,
        name: contractName,
        type: isDfs ? 'DFS Disclosure' : 'PA Agreement',
        templateId,
        fields,
      });
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
        <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-slate-700/60 bg-slate-900 p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-tactical text-lg text-white uppercase tracking-wide">
                Create Document
              </h2>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-500">
                Select document → Select claim → Review → Create & Sign
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
              Close
            </button>
          </div>

          {/* ── Template Picker ── */}
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-500">
              Document Type
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const active = templateId === tmpl.id;
                const borderColor = active
                  ? tmpl.accent === 'amber'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-cyan-500 bg-cyan-500/10'
                  : 'border-slate-700/60 hover:border-slate-600';
                const textColor =
                  tmpl.accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';

                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setTemplateId(tmpl.id)}
                    className={`relative rounded-lg border p-3 text-left transition-all ${borderColor}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon
                        className={`h-4 w-4 ${active ? textColor : 'text-slate-500'}`}
                      />
                      <span
                        className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-300'}`}
                      >
                        {tmpl.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {tmpl.description}
                    </p>
                    {active && (
                      <div
                        className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
                          tmpl.accent === 'amber' ? 'bg-amber-500' : 'bg-cyan-500'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Claim Selection ── */}
          <div className="mb-4 rounded-lg border border-cyan-600/30 bg-cyan-950/20 p-3 text-xs text-slate-300">
            <p className="font-semibold text-cyan-300">Claim Selection</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setClaimPickerOpen(true)}
                className="rounded-md border border-cyan-600/50 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/10"
              >
                {selectedClaim ? 'Change Claim' : 'Select Claim'}
              </button>
              <span className="text-slate-400">
                {selectedClaim
                  ? `${selectedClaim.client_name || selectedClaim.insured_name || 'Unknown'} | ${selectedClaim.claim_number || selectedClaim.id}`
                  : 'No claim selected'}
              </span>
            </div>
          </div>

          {/* ── Fields Preview ── */}
          <div className="rounded-xl border border-slate-700/60 bg-[linear-gradient(rgba(20,20,20,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(20,20,20,0.55)_1px,transparent_1px)] bg-[size:18px_18px] bg-slate-900/65 p-4">
            {!selectedClaim ? (
              <div className="py-10 text-center text-slate-500">
                No claim selected
                <div className="mt-1 text-xs text-slate-600">
                  Select a claim to autofill document fields.
                </div>
              </div>
            ) : isDfs ? (
              /* ── DFS Disclosure Fields ── */
              <div className="mt-4 grid grid-cols-2 gap-6">
                <div className="col-span-2 text-xs uppercase tracking-wide text-amber-300">
                  Insured Information
                </div>
                <Field label="Insured Name(s)" value={fields.client_name} />
                <Field label="Date Signed" value={new Date().toLocaleDateString()} />
                <div className="col-span-2 mt-3 rounded-lg border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-slate-400 leading-relaxed">
                  <p className="mb-2 font-semibold text-amber-300">Form DFS-H1-1982</p>
                  <p>This is a 1-page Florida-mandated disclosure form that explains the roles of Company, Independent, and Public Adjusters, and the insured's rights under FL law. The insured's name and signature will be captured on the generated document.</p>
                </div>
              </div>
            ) : (
              /* ── PA Agreement Fields ── */
              <div className="mt-4 grid grid-cols-2 gap-6">
                <div className="col-span-2 text-xs uppercase tracking-wide text-cyan-300">
                  Client Information
                </div>
                <Field label="Client Name" value={fields.client_name} />
                <Field label="Client Address" value={fields.client_address} />

                <div className="col-span-2 mt-4 text-xs uppercase tracking-wide text-amber-300">
                  Property Information
                </div>
                <Field label="Property Address" value={fields.property_address} />
                <Field label="Carrier" value={fields.carrier} />

                <div className="col-span-2 mt-4 text-xs uppercase tracking-wide text-cyan-300">
                  Claim Information
                </div>
                <Field label="Policy Number" value={fields.policy_number} />
                <Field label="Loss Date" value={fields.loss_date} />
                <Field label="Claim Number" value={fields.claim_number} />
                <Field label="Fee Percentage" value={fields.fee_percentage} />

                <div className="col-span-2 mt-4 text-xs uppercase tracking-wide text-amber-300">
                  Adjuster Information
                </div>
                <Field label="Adjuster Name" value={fields.adjuster_name} />
                <Field label="Adjuster License" value={fields.adjuster_license} />
                <Field label="Phone" value={fields.phone} />
                <Field label="Email" value={fields.email} />
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-[10px] font-mono text-slate-600">
              {isDfs ? 'DFS-H1-1982 | Rule 69B-220.051, F.A.C.' : 'FL §626.854 compliant | 22 fields | E-signature ready'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={creating || missingRequired}
                className="btn-tactical px-4 py-2 text-xs uppercase disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? 'Creating...'
                  : isDfs
                    ? 'Create Disclosure'
                    : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <SelectClaimModal
        open={claimPickerOpen}
        claims={claims}
        onClose={() => setClaimPickerOpen(false)}
        onSelect={handleClaimSelect}
      />
    </>
  );
};

export default CreateContractModal;
