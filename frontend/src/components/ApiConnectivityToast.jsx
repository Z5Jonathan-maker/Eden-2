import { useEffect } from 'react';
import { toast } from 'sonner';
import { API_URL } from '../lib/api';

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
        const url = `${API_URL}/health`;
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // If we got here, backend is reachable.
      } catch (e) {
        // If backend unreachable, most actions appear "dead" (buttons feel broken).
        toast.error('Backend not reachable. Most buttons/saves will fail until API is connected.', {
          duration: 10000,
          description:
            'Fix: serve backend on same origin (/api) or set BACKEND_URL in eden-config.js.',
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
