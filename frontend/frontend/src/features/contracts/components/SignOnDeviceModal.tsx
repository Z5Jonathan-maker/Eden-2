import React from 'react';

interface Props {
  open: boolean;
  signingUrl: string;
  loading: boolean;
  onClose: () => void;
  onComplete: () => Promise<void>;
}

const SignOnDeviceModal: React.FC<Props> = ({ open, signingUrl, loading, onClose, onComplete }) => {
  const [saving, setSaving] = React.useState(false);
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
          <h3 className="font-tactical text-white uppercase tracking-wide">Sign On Device</h3>
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
            <iframe title="Embedded SignNow" src={signingUrl} className="h-full w-full" />
          )}
          {!loading && !signingUrl && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-400">
              <p>Embedded signing URL is unavailable.</p>
              <p className="text-xs text-zinc-500">Use Email or SMS invite as fallback.</p>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
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
  );
};

export default SignOnDeviceModal;
