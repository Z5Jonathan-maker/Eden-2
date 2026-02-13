import React, { useEffect, useMemo, useState } from 'react';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ContractList from './ContractList';
import ContractDetail from './ContractDetail';
import CreateContractModal from './CreateContractModal';
import SendInviteModal from './SendInviteModal';
import SignOnDeviceModal from './SignOnDeviceModal';
import { ClaimItem, ContractItem, ContractsStats, CreateContractPayload } from '../types/types';
import {
  createContract,
  fetchClaims,
  fetchContracts,
  getContractPdfUrl,
  getEmbeddedSigningUrl,
  markSigned,
  sendInvite,
} from '../api/api';

const ContractsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContract, setDetailContract] = useState<ContractItem | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'email' | 'sms'>('email');
  const [signOpen, setSignOpen] = useState(false);
  const [signUrl, setSignUrl] = useState('');
  const [signLoading, setSignLoading] = useState(false);

  const load = async () => {
    const [contractsData, claimsData] = await Promise.all([fetchContracts(), fetchClaims()]);
    setContracts(contractsData);
    setClaims(claimsData);
  };

  useEffect(() => {
    let alive = true;
    const start = async () => {
      try {
        await load();
      } catch (err: any) {
        if (alive) toast.error(err?.message || 'Failed to load contracts');
      } finally {
        if (alive) setLoading(false);
      }
    };
    start();
    const timer = window.setInterval(() => {
      load().catch(() => null);
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const stats: ContractsStats = useMemo(() => {
    return contracts.reduce(
      (acc, c) => {
        acc.total += 1;
        if (c.status === 'signed') acc.signed += 1;
        if (c.status === 'viewed') acc.viewed += 1;
        if (c.status === 'sent') acc.sent += 1;
        if (c.status === 'draft') acc.draft += 1;
        return acc;
      },
      { total: 0, signed: 0, viewed: 0, sent: 0, draft: 0 }
    );
  }, [contracts]);

  const openDetail = async (contract: ContractItem) => {
    setDetailContract(contract);
    setDetailOpen(true);
    setPdfUrl('');
    try {
      const url = await getContractPdfUrl(contract);
      setPdfUrl(url);
    } catch {
      setPdfUrl(contract.documentUrl || '');
    }
  };

  const handleCreate = async (payload: CreateContractPayload) => {
    try {
      await createContract(payload);
      toast.success('Contract created');
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create contract');
    }
  };

  const openInvite = (mode: 'email' | 'sms') => {
    setInviteMode(mode);
    setInviteOpen(true);
  };

  const handleInvite = async (mode: 'email' | 'sms', recipient: string, signerName: string) => {
    if (!detailContract) return;
    try {
      await sendInvite(detailContract, mode, recipient, signerName);
      toast.success(mode === 'email' ? 'Email invite sent' : 'SMS invite sent');
      await load();
      setInviteOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send invite');
    }
  };

  const openSignOnDevice = async () => {
    if (!detailContract) return;
    setSignOpen(true);
    setSignLoading(true);
    try {
      const url = await getEmbeddedSigningUrl(detailContract);
      setSignUrl(url);
    } catch {
      setSignUrl('');
    } finally {
      setSignLoading(false);
    }
  };

  const completeSignOnDevice = async () => {
    if (!detailContract) return;
    try {
      await markSigned(detailContract);
      toast.success('Contract marked signed');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to mark contract as signed');
    }
  };

  const handleDownload = async (contract: ContractItem) => {
    try {
      const url = await getContractPdfUrl(contract);
      if (url) window.open(url, '_blank');
      else toast.error('PDF unavailable');
    } catch {
      toast.error('Failed to download contract');
    }
  };

  const handleRegenerate = async (contract: ContractItem) => {
    const claim = claims.find((c) => c.id === contract.claimId);
    if (!claim) {
      toast.error('Missing linked claim for regenerate');
      return;
    }
    setCreateOpen(true);
    toast.info('Regenerate flow started. Re-submit with updated fields.');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-wider">Loading contracts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-tactical text-2xl text-white uppercase tracking-wide">
            Active Contracts
          </h1>
          <p className="mt-1 text-xs font-mono uppercase tracking-wider text-zinc-500">
            22 fields | FL compliant | E-signature ready
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="btn-tactical inline-flex items-center gap-2 px-4 py-2 text-xs uppercase"
        >
          <Plus className="h-4 w-4" />
          Create Contract
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: 'Total', value: stats.total },
          { label: 'Draft', value: stats.draft },
          { label: 'Sent', value: stats.sent },
          { label: 'Viewed', value: stats.viewed },
          { label: 'Signed', value: stats.signed },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-zinc-700/40 bg-zinc-900/55 p-3">
            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-700/40 bg-zinc-900/35 p-4">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-400" />
          <p className="text-sm font-semibold text-zinc-100">Contracts</p>
        </div>
        <ContractList
          contracts={contracts}
          onCreate={() => setCreateOpen(true)}
          onOpen={openDetail}
          onDownload={handleDownload}
          onRegenerate={handleRegenerate}
        />
      </div>

      <CreateContractModal
        open={createOpen}
        claims={claims}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <ContractDetail
        contract={detailContract}
        open={detailOpen}
        pdfUrl={pdfUrl}
        onClose={() => setDetailOpen(false)}
        onOpenSignOnDevice={openSignOnDevice}
        onOpenInvite={openInvite}
        onDownload={() => detailContract && handleDownload(detailContract)}
        onRegenerate={() => detailContract && handleRegenerate(detailContract)}
      />

      <SendInviteModal
        open={inviteOpen}
        contract={detailContract}
        mode={inviteMode}
        onClose={() => setInviteOpen(false)}
        onSend={handleInvite}
      />

      <SignOnDeviceModal
        open={signOpen}
        signingUrl={signUrl}
        loading={signLoading}
        onClose={() => setSignOpen(false)}
        onComplete={completeSignOnDevice}
      />
    </div>
  );
};

export default ContractsPage;
