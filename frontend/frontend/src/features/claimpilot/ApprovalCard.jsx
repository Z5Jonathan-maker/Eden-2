import { useState } from 'react';
import { useApproveAction, useRejectAction } from './hooks/useClaimpilot';

const CONFIDENCE_THRESHOLDS = {
  HIGH: 85,
  MEDIUM: 60,
};

function getConfidenceColor(confidence) {
  const pct = confidence * 100;
  if (pct >= CONFIDENCE_THRESHOLDS.HIGH) return 'text-green-400';
  if (pct >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'text-yellow-400';
  return 'text-red-400';
}

function getConfidenceBg(confidence) {
  const pct = confidence * 100;
  if (pct >= CONFIDENCE_THRESHOLDS.HIGH) return 'bg-green-900/30';
  if (pct >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'bg-yellow-900/30';
  return 'bg-red-900/30';
}

export default function ApprovalCard({ action }) {
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const approveAction = useApproveAction();
  const rejectAction = useRejectAction();

  const confidencePct = Math.round(action.confidence * 100);
  const isProcessing = approveAction.isPending || rejectAction.isPending;

  function handleApprove() {
    approveAction.mutate(action.id);
  }

  function handleReject() {
    if (!rejectReason.trim()) return;
    rejectAction.mutate(
      { actionId: action.id, reason: rejectReason.trim() },
      { onSuccess: () => { setRejecting(false); setRejectReason(''); } }
    );
  }

  function handleCancelReject() {
    setRejecting(false);
    setRejectReason('');
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-5 shadow-md">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-300">
            {action.agent_name}
          </span>
          <span className="text-xs text-zinc-400">
            Claim #{action.claim_id}
          </span>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-sm font-semibold ${getConfidenceBg(action.confidence)} ${getConfidenceColor(action.confidence)}`}
        >
          {confidencePct}%
        </span>
      </div>

      {/* Action type */}
      <div className="mb-2">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Action
        </span>
        <p className="text-sm font-medium text-zinc-200">
          {action.action_type}
        </p>
      </div>

      {/* Reasoning */}
      <div className="mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Reasoning
        </span>
        <p className="text-sm text-zinc-300">{action.reasoning}</p>
      </div>

      {/* Action data */}
      {action.action_data && Object.keys(action.action_data).length > 0 && (
        <div className="mb-4">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Data
          </span>
          <pre className="mt-1 overflow-x-auto rounded bg-zinc-900 p-2 text-xs text-zinc-400">
            {JSON.stringify(action.action_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Error messages */}
      {approveAction.isError && (
        <p className="mb-2 text-sm text-red-400">
          Approve failed: {approveAction.error.message}
        </p>
      )}
      {rejectAction.isError && (
        <p className="mb-2 text-sm text-red-400">
          Reject failed: {rejectAction.error.message}
        </p>
      )}

      {/* Actions */}
      {rejecting ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="flex-1 rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-zinc-400 focus:outline-none"
            disabled={isProcessing}
            autoFocus
          />
          <button
            onClick={handleReject}
            disabled={isProcessing || !rejectReason.trim()}
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {rejectAction.isPending ? 'Rejecting...' : 'Confirm Reject'}
          </button>
          <button
            onClick={handleCancelReject}
            disabled={isProcessing}
            className="rounded border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleApprove}
            disabled={isProcessing}
            className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
          >
            {approveAction.isPending ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={isProcessing}
            className="rounded border border-zinc-600 px-4 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
