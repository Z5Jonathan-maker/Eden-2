/**
 * useUnreadCount — Lightweight hook for nav sidebar unread badge
 * Polls /api/comm/inbox every 30s and returns total unread count.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/api';

export default function useUnreadCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet('/api/comm/inbox', { cache: false });
      if (res.ok) {
        const items = res.data?.items || [];
        setCount(items.reduce((sum, item) => sum + (item.unread_count || 0), 0));
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return count;
}
