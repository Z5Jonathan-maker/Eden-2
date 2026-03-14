import { useEffect } from 'react';
import { toast } from 'sonner';
import { API_URL, apiGet } from '../lib/api';

const STORAGE_KEY = 'eden_connectivity_toast_v1';

function isLocalhost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export default function ApiConnectivityToast() {
  useEffect(() => {
    // Only show once per browser/session (reduce noise for end users)
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, '1');

    // HTTPS requirement reminder for camera/GPS (prod)
    if (!window.isSecureContext && !isLocalhost()) {
      toast.error('Camera + GPS require HTTPS. Open the app on https:// (or install as PWA).', {
        duration: 8000,
      });
    }

    const controller = new AbortController();

    const check = async () => {
      try {
        // Prefer /health (no auth) and fast.
        const res = await apiGet('/health', {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status || 'unreachable'}`);
        // If we got here, backend is reachable.
      } catch (e) {
        // If backend unreachable, most actions appear "dead" (buttons feel broken).
        toast.error('Unable to connect to server. Some features may be temporarily unavailable.', {
          duration: 10000,
          description:
            'Please check your internet connection and try refreshing the page.',
        });
      }
    };

    // Run slightly after boot to avoid delaying initial render.
    const t = window.setTimeout(check, 800);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, []);

  return null;
}
