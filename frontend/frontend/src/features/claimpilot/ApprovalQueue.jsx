import { usePendingActions } from './hooks/useClaimpilot';
import ApprovalCard from './ApprovalCard';

export default function ApprovalQueue() {
  const { data, isLoading, isError, error } = usePendingActions();

  const actions = data?.pending_actions ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-100">
          ClaimPilot Approval Queue
        </h1>
        {actions.length > 0 && (
          <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            {actions.length}
          </span>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <span className="ml-3 text-zinc-400">Loading pending actions...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
          Failed to load pending actions: {error?.message || 'Unknown error'}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && actions.length === 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-6 py-16 text-center">
          <p className="text-lg text-zinc-400">No pending actions. All clear.</p>
        </div>
      )}

      {/* Action cards */}
      {actions.length > 0 && (
        <div className="flex flex-col gap-4">
          {actions.map((action) => (
            <ApprovalCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}
