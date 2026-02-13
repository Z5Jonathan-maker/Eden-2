import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export function useClaimDetails(claimId: string) {
  return useQuery({
    queryKey: ['claim', claimId],
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!claimId,
  });
}

export function useClaimNotes(claimId: string) {
  return useQuery({
    queryKey: ['claim-notes', claimId],
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/notes`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!claimId,
  });
}

export function useClaimDocuments(claimId: string) {
  return useQuery({
    queryKey: ['claim-documents', claimId],
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/documents`);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    enabled: !!claimId,
  });
}
