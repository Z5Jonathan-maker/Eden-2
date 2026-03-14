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

  // Validation
  const emailValid = mode !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  const phoneValid = mode !== 'sms' || /^[\d+\-() ]{7,}$/.test(recipient.trim());
  const recipientValid = mode === 'email' ? emailValid : phoneValid;
  const formValid = !!recipient && recipientValid && !!signerName.trim();

  const validationMsg = !signerName.trim()
    ? 'Signer name is required'
    : !recipient
      ? `${mode === 'email' ? 'Email' : 'Phone'} is required`
      : !recipientValid
        ? mode === 'email' ? 'Enter a valid email address' : 'Enter a valid phone number'
        : '';

  const submit = async () => {
    if (!formValid) return;
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
      <div className="w-full max-w-md rounded-xl border border-zinc-700/50 bg-[#1a1a1a] p-5">
        <h3 className="font-tactical text-white uppercase tracking-wide">
          {mode === 'email' ? 'Send To Email' : 'Send To Text'}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">{contract.name}</p>
        <div className="mt-4 space-y-3">
          <label className="block text-xs text-zinc-400">
            Signer Name <span className="text-red-400">*</span>
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700/50 bg-[#0a0a0a] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-orange-500/50"
              placeholder="Full legal name"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            {mode === 'email' ? 'Email' : 'Phone'} <span className="text-red-400">*</span>
            <input
              type={mode === 'email' ? 'email' : 'tel'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-700/50 bg-[#0a0a0a] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-orange-500/50"
              placeholder={mode === 'email' ? 'client@example.com' : '(555) 123-4567'}
            />
          </label>
          {validationMsg && (
            <p className="text-[10px] text-red-400">{validationMsg}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:text-white hover:border-orange-500/30"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !formValid}
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
