import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────

export interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  date_of_loss: string;
  property_address: string;
  estimated_value: number;
  policy_number: string;
  assigned_to?: string;
  status: string;
  description?: string;
  claim_type?: string;
  insurance_company?: string;
  adjuster_email?: string;
  carrier_email?: string;
  insurance_company_email?: string;
  [key: string]: unknown;
}

export interface ClaimNote {
  id: string;
  content: string;
  created_at: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface ClaimDocument {
  id: string;
  filename: string;
  size?: number;
  [key: string]: unknown;
}

export interface ClaimPhoto {
  id: string;
  url: string;
  [key: string]: unknown;
}

export interface FloridaReadiness {
  deadlines?: Array<{
    label: string;
    status: string;
    days_remaining?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ── Query Key Factory ──────────────────────────────────────────────

export const claimKeys = {
  all: ['claims'] as const,
  detail: (id: string) => ['claim', id] as const,
  notes: (id: string) => ['claim-notes', id] as const,
  documents: (id: string) => ['claim-documents', id] as const,
  photos: (id: string) => ['claim-photos', id] as const,
  floridaReadiness: (id: string) => ['claim-florida-readiness', id] as const,
  activity: (id: string) => ['claim-activity', id] as const,
  tasks: (id: string) => ['claim-tasks', id] as const,
  gammaPage: (id: string) => ['claim-gamma-page', id] as const,
};

// ── Queries ────────────────────────────────────────────────────────

export function useClaimDetails(claimId: string) {
  return useQuery<Claim>({
    queryKey: claimKeys.detail(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}`);
      if (!result.ok) throw new Error(result.error as string);
      return result.data as Claim;
    },
    enabled: !!claimId,
  });
}

export function useClaimNotes(claimId: string) {
  return useQuery<ClaimNote[]>({
    queryKey: claimKeys.notes(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/notes`);
      if (!result.ok) throw new Error(result.error as string);
      return result.data as ClaimNote[];
    },
    enabled: !!claimId,
  });
}

export function useClaimDocuments(claimId: string) {
  return useQuery<ClaimDocument[]>({
    queryKey: claimKeys.documents(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/documents`);
      if (!result.ok) throw new Error(result.error as string);
      return result.data as ClaimDocument[];
    },
    enabled: !!claimId,
  });
}

export function useClaimPhotos(claimId: string) {
  return useQuery<ClaimPhoto[]>({
    queryKey: claimKeys.photos(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/inspections/claim/${claimId}/photos`);
      if (!result.ok) return [];
      return (result.data as { photos?: ClaimPhoto[] })?.photos ?? [];
    },
    enabled: !!claimId,
  });
}

export function useFloridaReadiness(claimId: string) {
  return useQuery<FloridaReadiness | null>({
    queryKey: claimKeys.floridaReadiness(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/florida-readiness`);
      if (!result.ok) return null;
      return result.data as FloridaReadiness;
    },
    enabled: !!claimId,
  });
}

export function useClaimGammaPage(claimId: string) {
  return useQuery<{ exists: boolean; url?: string; page_id?: string } | null>({
    queryKey: claimKeys.gammaPage(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/gamma/claim-page/${claimId}`);
      if (!result.ok) return null;
      const data = result.data as { exists: boolean; url?: string; page_id?: string };
      return data?.exists ? data : null;
    },
    enabled: !!claimId,
  });
}

export function useClaimActivity(claimId: string, limit = 50) {
  return useQuery<Array<Record<string, unknown>>>({
    queryKey: claimKeys.activity(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/claims/${claimId}/activity?limit=${limit}`);
      if (!result.ok) return [];
      return (result.data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: !!claimId,
  });
}

export function useClaimTasks(claimId: string) {
  return useQuery<Array<Record<string, unknown>>>({
    queryKey: claimKeys.tasks(claimId),
    queryFn: async () => {
      const result = await apiGet(`/api/tasks/claim/${claimId}`, { cache: false });
      if (!result.ok) return [];
      return (result.data ?? []) as Array<Record<string, unknown>>;
    },
    enabled: !!claimId,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

export function useUpdateClaim(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Claim>) => {
      const result = await apiPut(`/api/claims/${claimId}`, data);
      if (!result.ok) throw new Error((result.error as string) || 'Failed to update claim');
      return result.data as Claim;
    },
    onSuccess: (updatedClaim) => {
      queryClient.setQueryData(claimKeys.detail(claimId), updatedClaim);
      queryClient.invalidateQueries({ queryKey: claimKeys.activity(claimId) });
    },
  });
}

export function useAddNote(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const result = await apiPost(`/api/claims/${claimId}/notes`, {
        claim_id: claimId,
        content,
        tags: [],
      });
      if (!result.ok) throw new Error((result.error as string) || 'Failed to add note');
      return result.data as ClaimNote;
    },
    onSuccess: (newNote) => {
      queryClient.setQueryData<ClaimNote[]>(claimKeys.notes(claimId), (old) =>
        old ? [newNote, ...old] : [newNote]
      );
    },
  });
}

export function useCreateTask(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: Record<string, unknown>) => {
      const result = await apiPost('/api/tasks/', { ...task, claim_id: claimId });
      if (!result.ok) throw new Error((result.error as string) || 'Failed to create task');
      return result.data as Record<string, unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.tasks(claimId) });
    },
  });
}

export function useUpdateTask(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Record<string, unknown> }) => {
      const result = await apiPut(`/api/tasks/${taskId}`, data);
      if (!result.ok) throw new Error((result.error as string) || 'Failed to update task');
      return result.data as Record<string, unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimKeys.tasks(claimId) });
    },
  });
}

export function useDeleteTask(claimId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { apiDelete } = await import('@/lib/api');
      const result = await apiDelete(`/api/tasks/${taskId}`);
      if (!result.ok) throw new Error((result.error as string) || 'Failed to delete task');
      return taskId;
    },
    onSuccess: (deletedId) => {
      queryClient.setQueryData<Array<Record<string, unknown>>>(
        claimKeys.tasks(claimId),
        (old) => old?.filter((t) => t.id !== deletedId) ?? []
      );
    },
  });
}
