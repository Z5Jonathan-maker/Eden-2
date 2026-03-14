import React, { createContext, useContext, useState, useCallback } from 'react';

const TOAST_TYPES = {
  insight: {
    color: 'bg-orange-500',
    icon: <span className="text-orange-400 text-base" aria-hidden="true">&#128269;</span>,
  },
  approval: {
    color: 'bg-amber-500',
    icon: <span className="text-amber-400 text-base" aria-hidden="true">&#9889;</span>,
  },
  success: {
    color: 'bg-green-500',
    icon: <span className="text-green-400 text-base font-bold" aria-hidden="true">&#10003;</span>,
  },
  error: {
    color: 'bg-red-500',
    icon: <span className="text-red-400 text-base font-bold" aria-hidden="true">&#10005;</span>,
  },
};

const DEFAULT_DURATION = 5000;

function ToastContainer({ toasts, dismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const config = TOAST_TYPES[toast.type] || TOAST_TYPES.insight;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto max-w-sm w-full bg-zinc-900 border border-zinc-700/40 rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-toast-slide-in"
          >
            <div className={`h-1 ${config.color}`} />
            <div className="p-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-100">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-zinc-400 mt-1">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-0.5 bg-zinc-800">
              <div
                className={`h-full ${config.color} animate-toast-shrink`}
                style={{ animationDuration: `${toast.duration || DEFAULT_DURATION}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'insight', title, message, duration = DEFAULT_DURATION }) => {
    const id = Date.now() + Math.random();
    const newToast = { id, type, title, message, duration };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

export default ToastProvider;
