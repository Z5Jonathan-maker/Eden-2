import React, { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import {
  Plus, CheckCircle2, Circle, Clock, Trash2, Loader2,
  AlertTriangle, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'document_request', label: 'Doc Request' },
  { value: 'carrier_call', label: 'Carrier Call' },
  { value: 'client_contact', label: 'Client Contact' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_COLORS = {
  Low: 'text-zinc-400 border-zinc-500/30',
  Medium: 'text-blue-400 border-blue-500/30',
  High: 'text-amber-400 border-amber-500/30',
  Urgent: 'text-red-400 border-red-500/30',
};

const ClaimTasksPanel = ({ claimId }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', priority: 'Medium', task_type: 'follow_up',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const res = await apiGet(`/api/tasks/claim/${claimId}`, { cache: false });
    if (res.ok) setTasks(res.data || []);
    setLoading(false);
  }, [claimId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setCreating(true);
    const res = await apiPost('/api/tasks/', { ...form, claim_id: claimId });
    if (res.ok) {
      setTasks(prev => [...prev, res.data]);
      setForm({ title: '', description: '', due_date: '', priority: 'Medium', task_type: 'follow_up' });
      setShowForm(false);
      toast.success('Task created');
    } else {
      toast.error(res.error || 'Failed to create task');
    }
    setCreating(false);
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const res = await apiPut(`/api/tasks/${task.id}`, { status: newStatus });
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    }
  };

  const deleteTask = async (taskId) => {
    const res = await apiDelete(`/api/tasks/${taskId}`);
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted');
    }
  };

  const isOverdue = (task) => {
    if (!task.due_date || task.status === 'completed') return false;
    return task.due_date < new Date().toISOString().split('T')[0];
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-tactical font-bold text-white uppercase text-sm tracking-wide">
          Tasks ({pendingTasks.length} pending)
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-mono text-xs uppercase flex items-center gap-1 transition-all"
        >
          <Plus className="w-3 h-3" /> Add Task
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="mb-4 p-4 bg-zinc-800/40 rounded-lg border border-zinc-700/30 space-y-3">
          <input
            placeholder="Task title..."
            value={form.title}
            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            className="input-tactical w-full px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className="input-tactical w-full px-3 py-2 text-sm min-h-[60px]"
            rows={2}
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase mb-1 block">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="input-tactical w-full px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase mb-1 block">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                className="input-tactical w-full px-3 py-2 text-sm"
              >
                {['Low', 'Medium', 'High', 'Urgent'].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono text-zinc-500 uppercase mb-1 block">Type</label>
              <select
                value={form.task_type}
                onChange={(e) => setForm(f => ({ ...f, task_type: e.target.value }))}
                className="input-tactical w-full px-3 py-2 text-sm"
              >
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-tactical px-4 py-2 text-sm flex items-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* Pending Tasks */}
          <div className="space-y-2 mb-4">
            {pendingTasks.length === 0 && !showForm && (
              <p className="text-zinc-500 text-sm font-mono text-center py-4">
                No pending tasks. Add one to stay on track.
              </p>
            )}
            {pendingTasks.map(task => (
              <div
                key={task.id}
                className={`flex items-start gap-3 p-3 rounded border transition-colors ${
                  isOverdue(task)
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-zinc-800/30 border-zinc-700/30'
                }`}
              >
                <button onClick={() => toggleStatus(task)} className="mt-0.5 flex-shrink-0">
                  <Circle className="w-5 h-5 text-zinc-500 hover:text-orange-400 transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-zinc-200 font-medium truncate">{task.title}</p>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium}`}>
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-xs text-zinc-500 mb-1 truncate">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
                    <span className="px-1.5 py-0.5 bg-zinc-800 rounded">{
                      TASK_TYPES.find(t => t.value === task.task_type)?.label || task.task_type
                    }</span>
                    {task.due_date && (
                      <span className={`flex items-center gap-1 ${isOverdue(task) ? 'text-red-400' : ''}`}>
                        {isOverdue(task) && <AlertTriangle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" />
                        {task.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Completed Tasks */}
          {completedTasks.length > 0 && (
            <details className="group">
              <summary className="text-xs font-mono text-zinc-500 uppercase cursor-pointer hover:text-zinc-400 mb-2 flex items-center gap-1">
                <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                Completed ({completedTasks.length})
              </summary>
              <div className="space-y-2">
                {completedTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 bg-zinc-800/20 rounded border border-zinc-700/20 opacity-60">
                    <button onClick={() => toggleStatus(task)} className="mt-0.5 flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-400 line-through truncate">{task.title}</p>
                    </div>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
};

export default ClaimTasksPanel;
