import React from 'react';
import { Building2, Phone, Mail, User } from 'lucide-react';

const ClaimCarrierInfo = ({ claim }) => {
  const hasCarrierInfo = claim.carrier_name || claim.carrier_adjuster_name || claim.carrier_claim_number;

  if (!hasCarrierInfo) return null;

  return (
    <div className="card-tactical p-5">
      <div className="flex items-center gap-3 mb-4">
        <Building2 className="w-5 h-5 text-cyan-500" />
        <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
          Carrier Intel
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {claim.carrier_name && (
          <div>
            <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Insurance Carrier</p>
            <p className="text-sm font-medium text-zinc-200">{claim.carrier_name}</p>
          </div>
        )}
        {claim.carrier_claim_number && (
          <div>
            <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Carrier Claim #</p>
            <p className="text-sm font-mono text-zinc-200">{claim.carrier_claim_number}</p>
          </div>
        )}
        {claim.carrier_adjuster_name && (
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Carrier Adjuster</p>
              <p className="text-sm text-zinc-200">{claim.carrier_adjuster_name}</p>
            </div>
          </div>
        )}
        {claim.carrier_adjuster_phone && (
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Adjuster Phone</p>
              <a href={`tel:${claim.carrier_adjuster_phone}`} className="text-sm text-cyan-400 hover:underline">
                {claim.carrier_adjuster_phone}
              </a>
            </div>
          </div>
        )}
        {claim.carrier_adjuster_email && (
          <div className="flex items-start gap-2 sm:col-span-2">
            <Mail className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-zinc-600 uppercase mb-1">Adjuster Email</p>
              <a href={`mailto:${claim.carrier_adjuster_email}`} className="text-sm text-cyan-400 hover:underline">
                {claim.carrier_adjuster_email}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimCarrierInfo;
