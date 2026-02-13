import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';

export const claimsApi = {
  getClaim: (id: string) => apiGet(`/api/claims/${id}`),
  getClaims: (params?: any) => apiGet('/api/claims/', params),
  createClaim: (data: any) => apiPost('/api/claims/', data),
  updateClaim: (id: string, data: any) => apiPut(`/api/claims/${id}`, data),
  deleteClaim: (id: string) => apiDelete(`/api/claims/${id}`),

  getNotes: (claimId: string) => apiGet(`/api/claims/${claimId}/notes`),
  addNote: (claimId: string, data: any) => apiPost(`/api/claims/${claimId}/notes`, data),

  getDocuments: (claimId: string) => apiGet(`/api/claims/${claimId}/documents`),
  uploadDocument: (claimId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiPost(`/api/claims/${claimId}/documents`, formData, { formData: true });
  },
};
