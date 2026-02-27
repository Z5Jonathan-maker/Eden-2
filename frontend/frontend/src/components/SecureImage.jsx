/**
 * SecureImage — Displays images using Authorization header instead of token-in-URL.
 *
 * Fetches images via fetch() with proper auth headers, converts to blob URL,
 * and renders as <img>. Prevents auth token exposure in DOM, browser history,
 * and Referer headers.
 */
import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken, API_URL } from '../lib/api';

const SecureImage = ({ src, alt = '', className = '', fallback, lazy = true, ...props }) => {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const revokeRef = useRef(null);
  const containerRef = useRef(null);

  // IntersectionObserver for lazy loading — only fetch when visible
  useEffect(() => {
    if (!lazy || isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [lazy, isVisible]);

  useEffect(() => {
    if (!src || !isVisible) { if (!src) setError(true); return; }

    let cancelled = false;

    const load = async () => {
      try {
        const fullUrl = src.startsWith('http') ? src : `${API_URL}${src}`;
        const token = getAuthToken();
        const res = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });

        if (!res.ok || cancelled) {
          if (!cancelled) setError(true);
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        revokeRef.current = url;
        setBlobUrl(url);
      } catch {
        if (!cancelled) setError(true);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (revokeRef.current) {
        URL.revokeObjectURL(revokeRef.current);
        revokeRef.current = null;
      }
    };
  }, [src, isVisible]);

  if (error) {
    return fallback || (
      <div className={`flex items-center justify-center bg-zinc-800/50 text-zinc-600 text-xs ${className}`} {...props}>
        Failed to load
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div ref={containerRef} className={`flex items-center justify-center bg-zinc-800/30 animate-pulse ${className}`} {...props} />
    );
  }

  return <img src={blobUrl} alt={alt} className={className} {...props} />;
};

export default SecureImage;
