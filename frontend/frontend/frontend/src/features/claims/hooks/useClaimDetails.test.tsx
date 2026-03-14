import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useClaimDetails, useClaimNotes, useClaimDocuments } from './useClaimDetails';
import * as api from '@/lib/api';

// Mock the API module
vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
}));

// Create a wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useClaimDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch claim details successfully', async () => {
    const mockClaim = {
      id: 'claim-123',
      claim_number: 'CLM-2024-001',
      status: 'open',
      claimant_name: 'John Doe',
    };

    vi.mocked(api.apiGet).mockResolvedValueOnce({
      ok: true,
      data: mockClaim,
    });

    const { result } = renderHook(() => useClaimDetails('claim-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.apiGet).toHaveBeenCalledWith('/api/claims/claim-123');
    expect(result.current.data).toEqual(mockClaim);
  });

  it('should handle API errors', async () => {
    vi.mocked(api.apiGet).mockResolvedValueOnce({
      ok: false,
      error: 'Claim not found',
    });

    const { result } = renderHook(() => useClaimDetails('claim-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it('should not fetch when claimId is empty', () => {
    const { result } = renderHook(() => useClaimDetails(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(api.apiGet).not.toHaveBeenCalled();
  });
});

describe('useClaimNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch claim notes successfully', async () => {
    const mockNotes = [
      { id: '1', content: 'First note', created_at: '2024-01-01' },
      { id: '2', content: 'Second note', created_at: '2024-01-02' },
    ];

    vi.mocked(api.apiGet).mockResolvedValueOnce({
      ok: true,
      data: mockNotes,
    });

    const { result } = renderHook(() => useClaimNotes('claim-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.apiGet).toHaveBeenCalledWith('/api/claims/claim-123/notes');
    expect(result.current.data).toEqual(mockNotes);
  });
});

describe('useClaimDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch claim documents successfully', async () => {
    const mockDocuments = [
      { id: '1', filename: 'invoice.pdf', size: 12345 },
      { id: '2', filename: 'photo.jpg', size: 67890 },
    ];

    vi.mocked(api.apiGet).mockResolvedValueOnce({
      ok: true,
      data: mockDocuments,
    });

    const { result } = renderHook(() => useClaimDocuments('claim-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.apiGet).toHaveBeenCalledWith('/api/claims/claim-123/documents');
    expect(result.current.data).toEqual(mockDocuments);
  });

  it('should cache documents with correct query key', async () => {
    const mockDocuments = [{ id: '1', filename: 'test.pdf' }];

    vi.mocked(api.apiGet).mockResolvedValueOnce({
      ok: true,
      data: mockDocuments,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useClaimDocuments('claim-123'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check that data is cached with correct key
    const cachedData = queryClient.getQueryData(['claim-documents', 'claim-123']);
    expect(cachedData).toEqual(mockDocuments);
  });
});
