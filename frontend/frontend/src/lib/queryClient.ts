import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 15000), // 1s, 2s, 4s... max 15s (Render cold starts)
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});
