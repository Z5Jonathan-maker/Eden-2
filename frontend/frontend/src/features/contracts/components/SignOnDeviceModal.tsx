import React, { useCallback, useEffect } from 'react';

interface Props {
  open: boolean;
  signingUrl: string;
  loading: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

const SignOnDeviceModal: React.FC<Props> = ({ open, signingUrl, loading, onClose, onComplete }) => {
  const [saving, setSaving] = React.useState(false);
  const [signingDone, setSigningDone] = React.useState(false);

  // Listen for SignNow postMessage events indicating signing completion
  const handleMessage = useCallback((event: MessageEvent) => {
    // SignNow sends postMessage events when signing completes
    const data = event.data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        if (parsed.event === 'signing_complete' || parsed.type === 'document_signed') {
          setSigningDone(true);
        }
      } catch {
        // Not JSON — check for known SignNow string events
        if (data === 'signing_complete' || data.includes('document_signed')) {
          setSigningDone(true);
        }
      }
    } else if (data && typeof data === 'object') {
      if (data.event === 'signing_complete' || data.type === 'document_signed' || data.status === 'completed') {
        setSigningDone(true);
      }
    }
  }, []);

  useEffect(() => {
    if (open && signingUrl) {
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [open, signingUrl, handleMessage]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSigningDone(false);
      setSaving(false);
    }
  }, [open]);

  if (!open) return null;
  const canFinish = Boolean(signingUrl) && !loading && !saving;

  const finish = async () => {
    if (!canFinish) return;
    setSaving(true);
    try {
      await onComplete();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-5xl rounded-xl border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-tactical text-white uppercase tracking-wide">Sign On Device</h3>
            {signingDone && (
              <span className="inline-flex items-center rounded-full border border-green-500/50 bg-green-500/15 px-2 py-0.5 text-[10px] font-mono uppercase text-green-300">
                Signing Complete
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white">
            Close
          </button>
        </div>
        <div className="h-[70vh] rounded-lg border border-zinc-800 bg-zinc-950">
          {loading && (
            <div className="flex h-full items-center justify-center text-zinc-400">
              Loading embedded signing...
            </div>
          )}
          {!loading && signingUrl && (
            <iframe
              title="Embedded SignNow"
              src={signingUrl}
              className="h-full w-full rounded-lg"
              allow="camera;microphone"
            />
          )}
          {!loading && !signingUrl && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
              <p>Embedded signing URL is unavailable.</p>
              <p className="text-xs text-zinc-500">Use Email or SMS invite as fallback.</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] text-zinc-500 font-mono">
            {signingDone
              ? 'Signing detected — click Finish & Save to complete'
              : 'Complete signing above, then click Finish & Save'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-600 px-3 py-2 text-xs text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={!canFinish}
              title={!signingUrl ? 'Embedded signing URL unavailable' : undefined}
              className="btn-tactical px-4 py-2 text-xs uppercase disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Finish & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignOnDeviceModal;
