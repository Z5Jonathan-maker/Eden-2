import React from 'react';
import { X, Loader2 } from 'lucide-react';

const ClaimEditModal = ({ isOpen, editForm, setEditForm, onSave, onCancel, isSaving }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto card-tactical p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-tactical font-bold text-white uppercase tracking-wide">
            Edit Mission
          </h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Client Name
              </label>
              <input
                className="input-tactical w-full px-3 py-2 text-sm"
                value={editForm.client_name || ''}
                onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Status
              </label>
              <select
                className="input-tactical w-full px-3 py-2 text-sm"
                value={editForm.status || 'New'}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Denied">Denied</option>
                <option value="Completed">Completed</option>
                <option value="Closed">Closed</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Property Address
              </label>
              <input
                className="input-tactical w-full px-3 py-2 text-sm"
                value={editForm.property_address || ''}
                onChange={(e) => setEditForm({ ...editForm, property_address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Estimated Value ($)
              </label>
              <input
                className="input-tactical w-full px-3 py-2 text-sm"
                type="number"
                value={editForm.estimated_value || 0}
                onChange={(e) =>
                  setEditForm({ ...editForm, estimated_value: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Priority
              </label>
              <select
                className="input-tactical w-full px-3 py-2 text-sm"
                value={editForm.priority || 'Medium'}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
                Assigned To
              </label>
              <input
                className="input-tactical w-full px-3 py-2 text-sm"
                value={editForm.assigned_to || ''}
                onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-zinc-500 uppercase mb-1 block">
              Description
            </label>
            <textarea
              className="input-tactical w-full px-3 py-2 text-sm min-h-[100px]"
              value={editForm.description || ''}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-700/50">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 font-mono text-xs uppercase transition-all"
            >
              Cancel
            </button>
            <button
              className="btn-tactical px-5 py-2.5 text-sm flex items-center gap-2"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaimEditModal;
