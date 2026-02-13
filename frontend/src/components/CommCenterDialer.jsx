import React, { useState } from 'react';
import { PhoneCall, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { apiPost } from '../lib/api';

const CommCenterDialer = ({ claimId, defaultNumber }) => {
  const [phoneNumber, setPhoneNumber] = useState(defaultNumber || '');
  const [script, setScript] = useState('');
  const [calling, setCalling] = useState(false);
  const [recordCall, setRecordCall] = useState(false);

  const handleCall = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Enter a phone number');
      return;
    }

    setCalling(true);
    const { ok, data, error } = await apiPost('/api/twilio/voice/outbound', {
      to: phoneNumber,
      claim_id: claimId || null,
      script: script || null,
      record: recordCall,
    });
    setCalling(false);

    if (!ok) {
      toast.error(error || 'Failed to place call');
      return;
    }

    toast.success(`Call initiated (${data.call_sid || 'pending'})`);
  };

  return (
    <div className="card-tactical p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PhoneCall className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-tactical text-zinc-200 uppercase tracking-wider">Dialer</h3>
      </div>
      <Input
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="+1 (555) 555-5555"
        className="input-tactical"
      />
      <Textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Optional call script (TTS)"
        className="input-tactical min-h-[80px]"
      />
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={recordCall}
          onChange={(e) => setRecordCall(e.target.checked)}
          className="accent-orange-500"
        />
        Record call
      </label>
      <Button onClick={handleCall} className="btn-tactical w-full" disabled={calling}>
        {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
        <span>Initiate Call</span>
      </Button>
    </div>
  );
};

export default CommCenterDialer;
