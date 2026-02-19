import {
  ClaimItem,
  ContractItem,
  ContractMergeFields,
  ContractStatus,
  CreateContractPayload,
} from './types';
import { apiGet, apiPost } from '@/lib/api';

const PA_TEMPLATE_ID = import.meta.env.REACT_APP_SIGNNOW_TEMPLATE_ID || 'care-claims-pa-agreement';
const LOR_TEMPLATE_ID = 'care-claims-lor';
const SIGNNOW_TEMPLATE_ID = PA_TEMPLATE_ID; // backward compat

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

export function toLorFields(claim: ClaimItem, prefill: Record<string, any>): ContractMergeFields {
  const claimName = claim.client_name || claim.insured_name || '';
  return {
    client_name: prefill.insured_name || claimName,
    client_address: prefill.insured_address || claim.property_address || '',
    property_address: prefill.property_address || claim.property_address || '',
    carrier: prefill.insurance_company || claim.insurance_company || '',
    policy_number: prefill.policy_number || claim.policy_number || '',
    loss_date: prefill.date_of_loss || claim.date_of_loss || '',
    claim_number: prefill.claim_number || claim.claim_number || '',
    fee_percentage: String(prefill.fee_percentage || 10),
    adjuster_name: prefill.adjuster_name || '',
    adjuster_license: prefill.adjuster_license || '',
    phone: prefill.insured_phone || claim.phone || claim.insured_phone || '',
    email: prefill.insured_email || claim.email || claim.insured_email || '',
    // LOR-specific extras
    insured_name: prefill.insured_name || claimName,
    insured_email: prefill.insured_email || claim.email || claim.insured_email || '',
    insured_address: prefill.insured_address || claim.property_address || '',
    insured_city: prefill.insured_city || '',
    insured_state: prefill.insured_state || 'FL',
    insured_zip: prefill.insured_zip || '',
    insured_phone: prefill.insured_phone || claim.phone || claim.insured_phone || '',
    insurance_company: prefill.insurance_company || claim.insurance_company || '',
    carrier_address: prefill.carrier_address || '',
    property_city: prefill.property_city || '',
    property_state_zip: prefill.property_state_zip || '',
    date_of_loss: prefill.date_of_loss || claim.date_of_loss || '',
    loss_description: prefill.loss_description || '',
    scope_of_authority: prefill.scope_of_authority || 'Full Claim Representation',
  };
}

export { PA_TEMPLATE_ID, LOR_TEMPLATE_ID };

export async function fetchContracts(): Promise<ContractItem[]> {
  const res = await apiGet('/api/contracts/');
  if (!res.ok) throw new Error('Failed to load contracts');
  const rows = Array.isArray(res.data?.contracts) ? res.data.contracts : Array.isArray(res.data) ? res.data : [];
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
  const res = await apiGet('/api/claims/');
  if (!res.ok) throw new Error('Failed to load claims');
  return Array.isArray(res.data) ? res.data : res.data?.claims || [];
}

export async function fetchClaimPrefill(claimId: string): Promise<Record<string, any>> {
  const res = await apiGet(`/api/contracts/prefill/${claimId}`);
  if (!res.ok) return {};
  return res.data?.prefilled_values || {};
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
    const res = await apiPost(path, body);
    if (res.ok) {
      return {
        id: String(res.data.id || res.data.contract_id || res.data.document_id || Date.now()),
        claimId: payload.claimId,
        documentId: res.data.document_id || '',
        name: res.data.name || payload.name,
        type: payload.type,
        status: normalizeStatus(res.data.status || 'draft'),
        createdAt: res.data.created_at || new Date().toISOString(),
        updatedAt: res.data.updated_at || new Date().toISOString(),
        documentUrl: res.data.document_url || res.data.document_link || '',
      };
    }
  }
  return null;
}

async function createLegacy(payload: CreateContractPayload): Promise<ContractItem> {
  const res = await apiPost('/api/contracts/', {
    template_id: payload.templateId || SIGNNOW_TEMPLATE_ID,
    claim_id: payload.claimId,
    client_name: payload.fields.client_name,
    client_email: payload.fields.email,
    field_values: payload.fields,
  });
  if (!res.ok) throw new Error('Failed to create contract');
  return {
    id: String(res.data.id || res.data.contract_id || Date.now()),
    claimId: payload.claimId,
    documentId: res.data.signnow_document_id || '',
    name: payload.name,
    type: payload.type,
    status: normalizeStatus(res.data.status || 'draft'),
    createdAt: res.data.created_at || new Date().toISOString(),
    updatedAt: res.data.updated_at || new Date().toISOString(),
    documentUrl: res.data.document_url || '',
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

  const inviteTry = await apiPost(`/api/contracts/${contract.id}/invite`, inviteBody);
  if (inviteTry.ok) return;

  const legacyTry = await apiPost(`/api/contracts/${contract.id}/send`, {
    signer_email: channel === 'email' ? recipient : contract.clientEmail || '',
    signer_phone: channel === 'sms' ? recipient : contract.clientPhone || '',
    signer_name: signerName || contract.clientName || '',
    delivery_method: channel,
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
    const res = await apiGet(path);
    if (res.ok) {
      if (res.data?.url) return res.data.url;
      if (res.data?.embedded_url) return res.data.embedded_url;
    }
  }
  return '';
}

export async function markSigned(contract: ContractItem): Promise<void> {
  const res = await apiPost(`/api/contracts/${contract.id}/complete-signing`, {
    signer_name: contract.clientName || 'Signer',
    signed_in_person: true,
    signature_data: 'embedded-signing-complete',
  });
  if (!res.ok) throw new Error('Failed to update contract status');
}

export async function getContractPdfUrl(contract: ContractItem): Promise<string> {
  // For PDF blob downloads, use raw fetch with credentials
  const res = await fetch(`/api/contracts/${contract.id}/pdf`, { credentials: 'include' });
  if (!res.ok) return contract.documentUrl || '';
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  const data = await res.json();
  return data?.pdf_url || contract.documentUrl || '';
}
