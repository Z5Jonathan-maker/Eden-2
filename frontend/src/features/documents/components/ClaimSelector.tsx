import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface ClaimRecord {
  id: string;
  claim_number?: string;
  client_name?: string;
  insured_name?: string;
  property_address?: string;
  insurance_company?: string;
  carrier?: string;
}

interface Props {
  selectedClaimId: string | null;
  onSelect: (claimId: string | null) => void;
}

const ClaimSelector: React.FC<Props> = ({ selectedClaimId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchClaims = async () => {
      setLoading(true);
      try {
        const endpoints = [
          '/api/claims/?include_archived=false&limit=200',
          '/api/claims/',
        ];
        for (const endpoint of endpoints) {
          const res = await apiGet(endpoint);
          if (!res.ok) continue;
          const data = res.data;
          const rows = Array.isArray(data) ? data : data?.claims || [];
          if (rows.length > 0 || endpoint.includes('/api/claims/')) {
            setClaims(rows);
            break;
          }
        }
      } catch {
        setClaims([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClaims();
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectedClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId) || null,
    [claims, selectedClaimId]
  );

  const filteredClaims = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return claims.slice(0, 12);
    return claims.filter((claim) => {
      const combined =
        `${claim.claim_number || ''} ${claim.client_name || claim.insured_name || ''} ${claim.property_address || ''} ${claim.insurance_company || claim.carrier || ''}`.toLowerCase();
      return combined.includes(q);
    });
  }, [claims, query]);

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
        Claim Context
      </label>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mt-1 flex w-full items-center justify-between rounded-lg border border-zinc-700/50 bg-zinc-900/75 px-3 py-2.5 text-left text-sm text-zinc-200 transition-all hover:border-cyan-500/40 focus:border-cyan-500/60 focus:outline-none"
      >
        <span className="truncate">
          {selectedClaim
            ? `${selectedClaim.claim_number || selectedClaim.id} | ${selectedClaim.client_name || selectedClaim.insured_name || 'Client'}`
            : 'Select a claim to view or upload documents'}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-700/60 bg-zinc-950 p-3 shadow-[0_0_35px_rgba(6,182,212,0.12)]">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search client, address, claim ID, carrier..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none focus:border-cyan-500/60"
            />
          </div>

          <div className="max-h-72 space-y-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading claims...
              </div>
            ) : filteredClaims.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">No claims found</p>
            ) : (
              filteredClaims.map((claim) => (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => {
                    onSelect(claim.id);
                    setOpen(false);
                  }}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-all ${
                    selectedClaimId === claim.id
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
                  }`}
                >
                  <p className="truncate text-xs font-semibold text-zinc-100">
                    {claim.client_name || claim.insured_name || 'Unknown Client'}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {claim.property_address || 'No property address'}{' '}
                  </p>
                  <p className="truncate text-[10px] font-mono uppercase tracking-wider text-zinc-600">
                    {claim.claim_number || claim.id} |{' '}
                    {claim.insurance_company || claim.carrier || 'No carrier'}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedClaimId && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-300"
            >
              <X className="h-3 w-3" />
              Clear Selection
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimSelector;
