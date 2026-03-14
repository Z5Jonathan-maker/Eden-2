import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const REFETCH_INTERVAL_MS = 30000;

async function fetchOrThrow(endpoint) {
  const result = await api(endpoint);
  if (!result.ok) {
    throw new Error(result.error || 'Request failed');
  }
  return result.data;
}

async function postOrThrow(endpoint, body = undefined) {
  const result = await api(endpoint, { method: 'POST', body, cache: false });
  if (!result.ok) {
    throw new Error(result.error || 'Request failed');
  }
  return result.data;
}

export function usePendingActions(claimId = null) {
  const params = new URLSearchParams();
  if (claimId) params.set('claim_id', claimId);
  const qs = params.toString();
  const endpoint = `/api/claimpilot/pending${qs ? `?${qs}` : ''}`;

  return useQuery({
    queryKey: ['claimpilot', 'pending', claimId],
    queryFn: () => fetchOrThrow(endpoint),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}

export function useClaimInsights(claimId) {
  return useQuery({
    queryKey: ['claimpilot', 'insights', claimId],
    queryFn: () => fetchOrThrow(`/api/claimpilot/claims/${claimId}/insights`),
    enabled: !!claimId,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (actionId) =>
      postOrThrow(`/api/claimpilot/pending/${actionId}/approve`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['claimpilot', 'pending'] }),
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ actionId, reason }) =>
      postOrThrow(
        `/api/claimpilot/pending/${actionId}/reject?reason=${encodeURIComponent(reason)}`
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['claimpilot', 'pending'] }),
  });
}

export function useRunAgent(claimId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentName) =>
      postOrThrow(`/api/claimpilot/claims/${claimId}/run/${agentName}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['claimpilot', 'insights', claimId],
      }),
  });
}

export function useClaimpilotAnalytics() {
  return useQuery({
    queryKey: ['claimpilot', 'analytics'],
    queryFn: () => fetchOrThrow('/api/claimpilot/analytics'),
  });
}
