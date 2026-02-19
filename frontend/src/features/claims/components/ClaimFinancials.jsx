import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calculator } from 'lucide-react';

const fmt = (val) => {
  if (val == null || val === 0) return '-';
  return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const ClaimFinancials = ({ claim }) => {
  const rows = [
    { label: 'Estimated Value', value: claim.estimated_value, icon: DollarSign, color: 'text-orange-400' },
    { label: 'Replacement Cost (RCV)', value: claim.replacement_cost_value, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Actual Cash Value (ACV)', value: claim.actual_cash_value, icon: Calculator, color: 'text-blue-400' },
    { label: 'Depreciation', value: claim.depreciation, icon: TrendingDown, color: 'text-red-400' },
    { label: 'Deductible', value: claim.deductible, icon: DollarSign, color: 'text-amber-400' },
    { label: 'Net Claim Value', value: claim.net_claim_value, icon: DollarSign, color: 'text-purple-400' },
    { label: 'Settlement Amount', value: claim.settlement_amount, icon: DollarSign, color: 'text-emerald-400' },
  ];

  const hasFinancials = rows.some(r => r.value != null && r.value !== 0);

  return (
    <div className="card-tactical p-5">
      <div className="flex items-center gap-3 mb-4">
        <DollarSign className="w-5 h-5 text-green-500" />
        <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
          Financials
        </h3>
      </div>

      {!hasFinancials ? (
        <p className="text-zinc-500 text-sm font-mono text-center py-4">
          No financial data yet. Edit the claim to add values.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            if (row.value == null || row.value === 0) return null;
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${row.color}`} />
                  <span className="text-xs font-mono text-zinc-400">{row.label}</span>
                </div>
                <span className={`font-tactical font-bold text-sm ${row.color}`}>
                  {fmt(row.value)}
                </span>
              </div>
            );
          })}

          {/* Recovery ratio */}
          {claim.estimated_value > 0 && claim.settlement_amount > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-700/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Recovery Ratio</span>
                <span className="font-tactical font-bold text-sm text-white">
                  {((claim.settlement_amount / claim.estimated_value) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-green-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (claim.settlement_amount / claim.estimated_value) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {claim.mortgage_company && (
            <div className="mt-3 pt-3 border-t border-zinc-700/30">
              <span className="text-[10px] font-mono text-zinc-600 uppercase">Mortgage Company</span>
              <p className="text-sm text-zinc-300">{claim.mortgage_company}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClaimFinancials;
