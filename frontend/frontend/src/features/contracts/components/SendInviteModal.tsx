import React, { useState } from 'react';
import { ContractItem } from '../types/types';

interface Props {
  open: boolean;
  contract: ContractItem | null;
  mode: 'email' | 'sms';
  onClose: () => void;
  onSend: (mode: 'email' | 'sms', recipient: string, signerName: string) => Promise<void>;
}

const SendInviteModal: React.FC<Props> = ({ open, contract, mode, onClose, onSend }) => {
  const [recipient, setRecipient] = useState('');
  const [signerName, setSignerName] = useState('');
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (open && contract) {
      setSignerName(contract.clientName || '');
      setRecipient(mode === 'email' ? contract.clientEmail || '' : contract.clientPhone || '');
    }
  }, [open, contract, mode]);

  if (!open || !contract) return null;

  const submit = async () => {
    setSending(true);
    try {
      await onSend(mode, recipient, signerName);
      onClose();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5">
        <h3 className="font-tactical text-white uppercase tracking-wide">
          {mode === 'email' ? 'Send To Email' : 'Send To Text'}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">{contract.name}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-400">
            Signer Name
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            {mode === 'email' ? 'Email' : 'Phone'}
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-600 px-3 py-2 text-xs text-zinc-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !recipient}
            className="btn-tactical px-4 py-2 text-xs uppercase disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendInviteModal;
