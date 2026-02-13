import {
  ClaimItem,
  ContractItem,
  ContractMergeFields,
  ContractStatus,
  CreateContractPayload,
} from './types';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const SIGNNOW_TEMPLATE_ID = process.env.REACT_APP_SIGNNOW_TEMPLATE_ID || 'care-claims-pa-agreement';

function getToken(): string {
  return localStorage.getItem('eden_token') || '';
}

function headers(extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    ...(extra || {}),
  };
}

function normalizeStatus(raw: string): ContractStatus {
  const v = (raw || '').toLowerCase();
  if (v === 'signed' || v === 'completed') return 'signed';
  if (v === 'viewed' || v === 'opened') return 'viewed';
  if (v === 'sent' || v === 'pending' || v === 'in_person_pending') return 'sent';
  return 'draft';
}

export function toMergeFields(claim: ClaimItem, prefill: Record<string, any>): ContractMergeFields {
  const claimName = claim.client_name || claim.insured_name || '';
  return {
    client_name: prefill.policyholder_name || claimName,
    client_address:
      prefill.policyholder_address || claim.property_address || claim.loss_address || '',
    property_address: prefill.loss_address || claim.property_address || claim.loss_address || '',
    carrier: prefill.insurance_company || claim.insurance_company || '',
    policy_number: prefill.policy_number || claim.policy_number || '',
    loss_date: prefill.date_of_loss || claim.date_of_loss || '',
    claim_number: prefill.claim_number || claim.claim_number || '',
    fee_percentage: String(prefill.fee_percentage || 10),
    adjuster_name: prefill.adjuster_name || '',
    adjuster_license: prefill.adjuster_license || '',
    phone: prefill.policyholder_phone || claim.phone || claim.insured_phone || '',
    email: prefill.policyholder_email || claim.email || claim.insured_email || '',
  };
}

export async function fetchContracts(): Promise<ContractItem[]> {
  const res = await fetch(`${API_URL}/api/contracts/`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to load contracts');
  const data = await res.json();
  const rows = Array.isArray(data?.contracts) ? data.contracts : Array.isArray(data) ? data : [];
  return rows.map((c: any) => ({
    id: String(c.id),
    claimId: c.claim_id || '',
    documentId: c.signnow_document_id || c.document_id || '',
    name: c.template_name || c.name || `PA Agreement - ${c.client_name || 'Client'}`,
    type: c.template_type || c.type || 'PA Agreement',
    status: normalizeStatus(c.status),
    createdAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at || c.created_at || new Date().toISOString(),
    documentUrl: c.document_url || '',
    clientName: c.client_name || '',
    clientEmail: c.client_email || '',
    clientPhone: c.client_phone || '',
  }));
}

export async function fetchClaims(): Promise<ClaimItem[]> {
  const res = await fetch(`${API_URL}/api/claims/`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to load claims');
  const data = await res.json();
  return Array.isArray(data) ? data : data?.claims || [];
}

export async function fetchClaimPrefill(claimId: string): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}/api/contracts/prefill/${claimId}`, { headers: headers() });
  if (!res.ok) return {};
  const data = await res.json();
  return data?.prefilled_values || {};
}

async function createViaConstruct(payload: CreateContractPayload): Promise<ContractItem | null> {
  const body = {
    template_id: payload.templateId || SIGNNOW_TEMPLATE_ID,
    name: payload.name,
    fields: payload.fields,
    claim_id: payload.claimId,
    type: payload.type,
  };
  const endpoints = ['/api/contracts/signnow/construct', '/api/contracts/construct'];
  for (const path of endpoints) {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: String(data.id || data.contract_id || data.document_id || Date.now()),
        claimId: payload.claimId,
        documentId: data.document_id || '',
        name: data.name || payload.name,
        type: payload.type,
        status: normalizeStatus(data.status || 'draft'),
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || new Date().toISOString(),
        documentUrl: data.document_url || data.document_link || '',
      };
    }
  }
  return null;
}

async function createLegacy(payload: CreateContractPayload): Promise<ContractItem> {
  const res = await fetch(`${API_URL}/api/contracts/`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      template_id: payload.templateId || SIGNNOW_TEMPLATE_ID,
      claim_id: payload.claimId,
      client_name: payload.fields.client_name,
      client_email: payload.fields.email,
      field_values: payload.fields,
    }),
  });
  if (!res.ok) throw new Error('Failed to create contract');
  const data = await res.json();
  return {
    id: String(data.id || data.contract_id || Date.now()),
    claimId: payload.claimId,
    documentId: data.signnow_document_id || '',
    name: payload.name,
    type: payload.type,
    status: normalizeStatus(data.status || 'draft'),
    createdAt: data.created_at || new Date().toISOString(),
    updatedAt: data.updated_at || new Date().toISOString(),
    documentUrl: data.document_url || '',
    clientName: payload.fields.client_name,
    clientEmail: payload.fields.email,
    clientPhone: payload.fields.phone,
  };
}

export async function createContract(payload: CreateContractPayload): Promise<ContractItem> {
  const constructed = await createViaConstruct(payload);
  if (constructed) return constructed;
  return createLegacy(payload);
}

export async function sendInvite(
  contract: ContractItem,
  channel: 'email' | 'sms',
  recipient: string,
  signerName: string
): Promise<void> {
  const primaryId = contract.documentId || contract.id;
  const inviteBody = {
    document_id: primaryId,
    email: channel === 'email' ? recipient : undefined,
    phone: channel === 'sms' ? recipient : undefined,
    role: 'Signer',
    order: 1,
    delivery_method: channel === 'sms' ? 'sms' : 'email',
    signer_name: signerName,
  };

  const inviteTry = await fetch(`${API_URL}/api/contracts/${contract.id}/invite`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(inviteBody),
  });
  if (inviteTry.ok) return;

  const legacyTry = await fetch(`${API_URL}/api/contracts/${contract.id}/send`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      signer_email: channel === 'email' ? recipient : contract.clientEmail || '',
      signer_phone: channel === 'sms' ? recipient : contract.clientPhone || '',
      signer_name: signerName || contract.clientName || '',
      delivery_method: channel,
    }),
  });
  if (!legacyTry.ok) throw new Error('Failed to send invite');
}

export async function getEmbeddedSigningUrl(contract: ContractItem): Promise<string> {
  const docId = contract.documentId || contract.id;
  const paths = [
    `/api/contracts/${contract.id}/embedded-signing`,
    `/api/contracts/${docId}/embedded-signing`,
  ];
  for (const path of paths) {
    const res = await fetch(`${API_URL}${path}`, { headers: headers() });
    if (res.ok) {
      const data = await res.json();
      if (data?.url) return data.url;
      if (data?.embedded_url) return data.embedded_url;
    }
  }
  return '';
}

export async function markSigned(contract: ContractItem): Promise<void> {
  const res = await fetch(`${API_URL}/api/contracts/${contract.id}/complete-signing`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      signer_name: contract.clientName || 'Signer',
      signed_in_person: true,
      signature_data: 'embedded-signing-complete',
    }),
  });
  if (!res.ok) throw new Error('Failed to update contract status');
}

export async function getContractPdfUrl(contract: ContractItem): Promise<string> {
  const res = await fetch(`${API_URL}/api/contracts/${contract.id}/pdf`, { headers: headers() });
  if (!res.ok) return contract.documentUrl || '';
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const data = await res.json();
  return data?.pdf_url || contract.documentUrl || '';
}
