export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed';

export interface ContractItem {
  id: string;
  claimId?: string;
  documentId?: string;
  name: string;
  type: string;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
  documentUrl?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export interface ClaimItem {
  id: string;
  client_name?: string;
  insured_name?: string;
  claim_number?: string;
  policy_number?: string;
  date_of_loss?: string;
  insurance_company?: string;
  property_address?: string;
  loss_address?: string;
  phone?: string;
  email?: string;
  insured_email?: string;
  insured_phone?: string;
}

export interface ContractMergeFields {
  client_name: string;
  client_address: string;
  property_address: string;
  carrier: string;
  policy_number: string;
  loss_date: string;
  claim_number: string;
  fee_percentage: string;
  adjuster_name: string;
  adjuster_license: string;
  phone: string;
  email: string;
  [key: string]: string;
}

export interface CreateContractPayload {
  claimId: string;
  name: string;
  type: string;
  templateId: string;
  fields: ContractMergeFields;
}

export interface ContractsStats {
  total: number;
  signed: number;
  viewed: number;
  sent: number;
  draft: number;
}
