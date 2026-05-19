import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Calendar, Flag, ChevronDown, Grip, Users, User } from 'lucide-react';
import { supabase, Task, TaskStatus, Priority, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'To Do', color: '#3b82f6' },
  { status: 'in_progress', label: 'In Progress', color: '#f59e0b' },
  { status: 'done', label: 'Done', color: '#10B981' },
];

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#6b7280' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#ef4444' },
};

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'todo' as TaskStatus,
  priority: 'medium' as Priority,
  due_date: '',
  assigned_to: '' as string,
  assign_to_team: false,
};

export default function TasksPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reps, setReps] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');

  const canManage = profile?.role === 'admin' || profile?.role === 'manager';

  const fetchTasks = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetchTasks();
    if (canManage) {
      supabase
        .from('profiles')
        .select('*')
        .order('full_name')
        .then(({ data }) => { if (data) setReps(data as Profile[]); });
    }
  }, [fetchTasks, canManage]);

  function openCreate(defaultStatus?: TaskStatus) {
    setEditTask(null);
    setForm({ ...EMPTY_FORM, status: defaultStatus ?? 'todo' });
    setShowModal(true);
  }

  function openEdit(task: Task) {
    setEditTask(task);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ?? '',
      assigned_to: task.assigned_to ?? '',
      assign_to_team: task.assign_to_team,
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date || null,
      assign_to_team: form.assign_to_team,
      assigned_to: form.assign_to_team ? null : (form.assigned_to || null),
      updated_at: new Date().toISOString(),
    };

    if (editTask) {
      await supabase.from('tasks').update(payload).eq('id', editTask.id);
    } else {
      await supabase.from('tasks').insert({ ...payload, created_by: profile.id });
    }

    await fetchTasks();
    setShowModal(false);
    setSaving(false);
  }

  async function moveTask(taskId: string, newStatus: TaskStatus) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', taskId);
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('taskId', taskId);
  }

  function handleDrop(e: React.DragEvent, status: TaskStatus) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) moveTask(taskId, status);
    setDragOver(null);
  }

  function getRepName(id: string | null) {
    if (!id) return null;
    return reps.find((r) => r.id === id)?.full_name ?? null;
  }

  const filteredTasks = tasks.filter((t) => {
    if (!canManage) return true;
    if (filterAssignee === 'all') return true;
    if (filterAssignee === 'team') return t.assign_to_team;
    return t.assigned_to === filterAssignee;
  });

  const getColumnTasks = (status: TaskStatus) => filteredTasks.filter((t) => t.status === status);

  const assigneeFilterOptions = [
    { value: 'all', label: 'All Tasks' },
    { value: 'team', label: 'Team Tasks' },
    ...reps.map((r) => ({ value: r.id, label: r.full_name })),
  ];

  return (
    <div className="p-6 h-full flex flex-col space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Board</h1>
          <p className="text-white/40 text-sm mt-0.5">Drag & drop to move tasks</p>
        </div>
        {canManage && (
          <button onClick={() => openCreate()} className="btn-gold flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        )}
      </div>

      {/* Assignee filter — admin/manager only */}
      {canManage && (
        <div className="flex items-center gap-2 flex-wrap">
          {assigneeFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterAssignee(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filterAssignee === opt.value
                  ? 'bg-gold-500/15 text-gold-500 border-gold-500/30'
                  : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70 hover:bg-white/8'
              }`}
            >
              {opt.value === 'team' ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {COLUMNS.map((col) => {
            const colTasks = getColumnTasks(col.status);
            return (
              <div
                key={col.status}
                className={`glass-card flex flex-col min-h-80 transition-all ${
                  dragOver === col.status ? 'ring-1' : ''
                }`}
                style={dragOver === col.status ? { ringColor: col.color } : {}}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-white font-semibold text-sm">{col.label}</span>
                    <span className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => openCreate(col.status)}
                      className="p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                  <AnimatePresence>
                    {colTasks.map((task) => {
                      const repName = getRepName(task.assigned_to);
                      return (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          draggable
                          onDragStart={(e) => handleDragStart(e as any, task.id)}
                          className="p-3 rounded-xl bg-surface-50/60 border border-white/5 hover:border-white/10 cursor-grab active:cursor-grabbing group transition-all"
                        >
                          <div className="flex items-start gap-2">
                            <Grip className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0 group-hover:text-white/40 transition-colors" />
                            <div className="flex-1 min-w-0">
                              <div
                                className={`text-white text-sm font-medium transition-colors ${canManage ? 'cursor-pointer hover:text-gold-500' : 'cursor-default'}`}
                                onClick={() => canManage && openEdit(task)}
                              >
                                {task.title}
                              </div>
                              {task.description && (
                                <p className="text-white/40 text-xs mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                  style={{
                                    color: PRIORITY_CONFIG[task.priority].color,
                                    backgroundColor: `${PRIORITY_CONFIG[task.priority].color}15`,
                                  }}
                                >
                                  <Flag className="w-2.5 h-2.5 inline mr-0.5" />
                                  {PRIORITY_CONFIG[task.priority].label}
                                </span>
                                {task.due_date && (
                                  <span className="text-xs text-white/30 flex items-center gap-0.5">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}
                                {/* Assignment badge */}
                                {task.assign_to_team ? (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 flex items-center gap-0.5">
                                    <Users className="w-2.5 h-2.5" />
                                    Team
                                  </span>
                                ) : repName ? (
                                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 flex items-center gap-0.5">
                                    <User className="w-2.5 h-2.5" />
                                    {repName.split(' ')[0]}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {canManage && (
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {colTasks.length === 0 && (
                    <div
                      className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl transition-colors"
                      style={{ borderColor: dragOver === col.status ? col.color : 'rgba(255,255,255,0.06)' }}
                    >
                      <p className="text-white/20 text-sm">Drop tasks here</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold">{editTask ? 'Edit Task' : 'New Task'}</h2>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Title *</label>
                  <input type="text" required value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="input-dark w-full" placeholder="Task title..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Description</label>
                  <textarea rows={3} value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input-dark w-full resize-none" placeholder="Optional description..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                        className="input-dark w-full appearance-none pr-8">
                        {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Priority</label>
                    <div className="relative">
                      <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                        className="input-dark w-full appearance-none pr-8">
                        {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                          <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Due Date</label>
                  <input type="date" value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="input-dark w-full" />
                </div>

                {/* Assignment — admin/manager only */}
                {canManage && (
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-medium text-white/50 uppercase tracking-wider">Assign To</label>

                    {/* Team toggle */}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, assign_to_team: !f.assign_to_team, assigned_to: '' }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        form.assign_to_team
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/60'
                      }`}
                    >
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium">Entire Team</span>
                      <div className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        form.assign_to_team ? 'bg-blue-500 border-blue-500' : 'border-white/20'
                      }`}>
                        {form.assign_to_team && <div className="w-2 h-2 bg-white rounded-sm" />}
                      </div>
                    </button>

                    {/* Individual rep picker */}
                    {!form.assign_to_team && (
                      <div className="relative">
                        <select
                          value={form.assigned_to}
                          onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                          className="input-dark w-full appearance-none pr-8"
                        >
                          <option value="">— Unassigned —</option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>{r.full_name} ({r.role.replace('_', ' ')})</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-outline-gold flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-gold flex-1 flex items-center justify-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" />}
                    {editTask ? 'Update' : 'Create Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
