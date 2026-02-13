import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ClaimItem } from './types';

interface Props {
  open: boolean;
  claims: ClaimItem[];
  onClose: () => void;
  onSelect: (claim: ClaimItem) => void;
}

const SelectClaimModal: React.FC<Props> = ({ open, claims, onClose, onSelect }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return claims.slice(0, 100);
    return claims.filter((c) => {
      const text =
        `${c.client_name || c.insured_name || ''} ${c.property_address || ''} ${c.claim_number || ''} ${c.insurance_company || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [claims, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-zinc-700/60 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-tactical text-white uppercase tracking-wide">Select Claim</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search client, address, carrier, claim id"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="max-h-[420px] space-y-2 overflow-auto">
          {filtered.map((claim) => (
            <div
              key={claim.id}
              className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="text-xs text-zinc-300">
                <p className="font-semibold text-white">
                  {claim.client_name || claim.insured_name || 'Unknown Client'}
                </p>
                <p className="mt-1 text-zinc-400">
                  {claim.property_address || claim.loss_address || 'No address'}
                </p>
                <p className="mt-1 text-zinc-500">
                  {claim.insurance_company || 'No carrier'} • {claim.claim_number || claim.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelect(claim)}
                className="btn-tactical px-3 py-2 text-[11px] uppercase"
              >
                Select Claim
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="py-6 text-center text-sm text-zinc-500">No claims match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectClaimModal;
