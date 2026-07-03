import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck, Clock, Calendar, Cake, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Plus, AlertCircle, Zap, RefreshCw,
  Package, Users, Shield, Coffee, Archive, AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  supabase, Profile, EodReport, AttendanceLog,
  LeaveRequest, LeaveBalance, LateCakeSlice, BreakLog,
} from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getLevel } from '../lib/levels';

type Tab = 'verify' | 'attendance' | 'leave' | 'breaks' | 'cake';

// ── Shared helpers ──────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon, label, badge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
        active ? 'bg-gold-500/15 text-gold-500 border border-gold-500/30' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-dark-400 text-xs font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Verify Tab ──────────────────────────────────────────────────────────────
interface QueueItem extends EodReport { profile: Profile }

function VerifyTab() {
  const { profile: me } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; userId: string } | null>(null);
  const [reason, setReason] = useState('');
  const [verifiedToday, setVerifiedToday] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('eod_reports')
      .select('*, profile:profiles(*)')
      .eq('status', 'pending')
      .order('date', { ascending: false });
    if (data) setQueue(data as QueueItem[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('hr-verify-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function handleVerify(reportId: string, userId: string, pieces: number) {
    if (!me) return;
    setVerifying(reportId);
    await supabase.from('eod_reports').update({
      status: 'verified', verified_by: me.id, verified_at: new Date().toISOString(),
    }).eq('id', reportId);
    const { data: rep } = await supabase.from('profiles').select('monthly_pieces,lifetime_pieces').eq('id', userId).maybeSingle();
    if (rep) {
      await supabase.from('profiles').update({
        monthly_pieces: (rep.monthly_pieces || 0) + pieces,
        lifetime_pieces: (rep.lifetime_pieces || 0) + pieces,
        updated_at: new Date().toISOString(),
      }).eq('id', userId);
    }
    await supabase.channel(`user-${userId}`).send({ type: 'broadcast', event: 'report_verified', payload: { reportId, pieces } });
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700', '#10B981', '#3b82f6', '#f97316'] });
    setVerifiedToday(n => n + 1);
    setVerifying(null);
    load();
  }

  async function handleReject(reportId: string, userId: string, rejectReason: string) {
    if (!me) return;
    await supabase.from('eod_reports').update({
      status: 'rejected', verified_by: me.id, verified_at: new Date().toISOString(),
      rejection_reason: rejectReason || null,
    }).eq('id', reportId);
    await supabase.channel(`user-${userId}`).send({ type: 'broadcast', event: 'report_rejected', payload: { reportId, reason: rejectReason || null } });
    setRejectModal(null);
    setReason('');
    load();
  }

  async function verifyAll() {
    for (const item of queue) {
      await handleVerify(item.id, item.user_id, item.total_pieces);
      await new Promise(r => setTimeout(r, 120));
    }
    confetti({ particleCount: 250, spread: 120, origin: { y: 0.5 }, colors: ['#FFD700', '#10B981', '#f97316', '#3b82f6'] });
  }

  const pending = queue.length;
  const pendingPieces = queue.reduce((s, r) => s + r.total_pieces, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Pending', value: pending, color: '#f59e0b' },
            { label: 'Pieces Pending', value: pendingPieces, color: '#FFD700' },
            { label: 'Verified Today', value: verifiedToday, color: '#10B981' },
          ].map(s => (
            <div key={s.label} className="glass-card p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-white/40 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {pending > 0 && (
          <button onClick={verifyAll} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all font-medium text-sm border border-emerald-500/20">
            <Zap className="w-4 h-4" /> Verify All ({pending})
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
          <div className="text-white/50">Queue is empty — all reports verified!</div>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(item => {
            const level = getLevel(item.profile.lifetime_pieces);
            const isOpen = expanded === item.id;
            return (
              <motion.div key={item.id} layout className="glass-card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border"
                    style={{ backgroundColor: `${level.current.color}15`, borderColor: `${level.current.color}30`, color: level.current.color }}>
                    {item.profile.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold text-sm">{item.profile.full_name}</div>
                    <div className="text-white/40 text-xs flex items-center gap-2">
                      <span>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</span>
                      <span className="text-gold-500 font-bold">{item.total_pieces}p</span>
                      <span className="text-emerald-400/70">₹{(item.total_pieces * 8).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : item.id)} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setRejectModal({ id: item.id, userId: item.user_id })} className="p-2 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleVerify(item.id, item.user_id, item.total_pieces)} disabled={verifying === item.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-all text-sm font-medium disabled:opacity-30">
                      {verifying === item.id ? <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Verify
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/5 overflow-hidden">
                      <div className="p-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {[
                          { l: 'Prev Rings', v: item.rings_prev, c: '#3b82f6' },
                          { l: 'New Rings', v: item.rings_new, c: '#10B981' },
                          { l: 'Calls', v: item.accepted_calls, c: '#f59e0b' },
                          { l: 'Chats', v: item.positive_chats, c: '#8b5cf6' },
                          { l: 'Billed', v: item.billed_clients, c: '#f97316' },
                        ].map(d => (
                          <div key={d.l} className="text-center p-2 rounded-lg" style={{ backgroundColor: `${d.c}10` }}>
                            <div className="text-base font-bold" style={{ color: d.c }}>{d.v}</div>
                            <div className="text-white/40 text-xs">{d.l}</div>
                          </div>
                        ))}
                      </div>
                      {item.daily_notes && (
                        <div className="px-4 pb-4">
                          <div className="p-3 rounded-lg bg-surface-50/30">
                            <div className="text-white/30 text-xs uppercase tracking-wider mb-1">Notes</div>
                            <div className="text-white/70 text-sm">{item.daily_notes}</div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {rejectModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setRejectModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-md p-6 space-y-4">
              <div className="flex items-center gap-2 text-red-400 font-semibold">
                <AlertCircle className="w-5 h-5" /> Reject Report
              </div>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} autoFocus
                placeholder="Reason (optional)..." className="input-dark w-full" />
              <div className="flex gap-3">
                <button onClick={() => { setRejectModal(null); setReason(''); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white/80 transition-all">Cancel</button>
                <button onClick={() => handleReject(rejectModal.id, rejectModal.userId, reason)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium transition-all">Confirm Reject</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Attendance Tab ──────────────────────────────────────────────────────────
function AttendanceTab() {
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTimes, setEntryTimes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase.from('profiles').select('*').eq('is_active', true).neq('role', 'admin').order('full_name');
      if (p) {
        setProfiles(p as Profile[]);
        const times: Record<string, string> = {};
        const n: Record<string, string> = {};
        (p as Profile[]).forEach(pr => { times[pr.id] = ''; n[pr.id] = ''; });
        setEntryTimes(times);
        setNotes(n);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function loadLogs() {
      const { data } = await supabase.from('attendance_logs').select('*').eq('date', selectedDate);
      if (data) {
        setLogs(data as AttendanceLog[]);
        const times: Record<string, string> = {};
        const n: Record<string, string> = {};
        (data as AttendanceLog[]).forEach(l => { times[l.user_id] = l.entry_time || ''; n[l.user_id] = l.notes; });
        setEntryTimes(prev => ({ ...prev, ...times }));
        setNotes(prev => ({ ...prev, ...n }));
      }
    }
    loadLogs();
  }, [selectedDate]);

  async function handleSave(userId: string) {
    if (!me) return;
    setSaving(prev => ({ ...prev, [userId]: true }));
    const existing = logs.find(l => l.user_id === userId);
    const payload = { user_id: userId, date: selectedDate, entry_time: entryTimes[userId] || null, notes: notes[userId] || '', logged_by: me.id };
    if (existing) {
      await supabase.from('attendance_logs').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('attendance_logs').insert(payload);
    }
    setSaving(prev => ({ ...prev, [userId]: false }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gold-500" />
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="input-dark text-sm" />
        </div>
        <div className="text-white/40 text-sm">{profiles.length} staff members</div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 text-white/60 text-xs uppercase tracking-wider grid grid-cols-12 gap-3">
          <div className="col-span-3">Staff</div>
          <div className="col-span-3">Entry Time</div>
          <div className="col-span-4">Notes</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        <div className="divide-y divide-white/5">
          {profiles.map(p => {
            const log = logs.find(l => l.user_id === p.id);
            return (
              <div key={p.id} className="p-4 grid grid-cols-12 gap-3 items-center">
                <div className="col-span-3">
                  <div className="text-white text-sm font-medium">{p.full_name}</div>
                  <div className="text-white/40 text-xs capitalize">{p.role.replace('_', ' ')}</div>
                </div>
                <div className="col-span-3">
                  <input type="time" value={entryTimes[p.id] || ''}
                    onChange={e => setEntryTimes(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="input-dark w-full text-sm py-1.5" />
                </div>
                <div className="col-span-4">
                  <input type="text" value={notes[p.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Any notes..." className="input-dark w-full text-sm py-1.5" />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button onClick={() => handleSave(p.id)} disabled={saving[p.id]}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${log ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}>
                    {saving[p.id] ? <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" /> : log ? 'Update' : 'Log'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Leave Tab ───────────────────────────────────────────────────────────────
function LeaveTab() {
  const { profile: me } = useAuth();
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [leaveType, setLeaveType] = useState<'leave' | 'wfh'>('leave');
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const MAX_LEAVES = 2;
  const MAX_WFH = 2;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const load = useCallback(async () => {
    const [{ data: bals }, { data: profs }] = await Promise.all([
      supabase.from('leave_balances').select('*').eq('month', month).eq('year', year),
      supabase.from('profiles').select('*').eq('is_active', true).neq('role', 'admin').order('full_name'),
    ]);
    if (bals) setBalances(bals as LeaveBalance[]);
    if (profs) setProfiles(profs as Profile[]);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  function getBalance(userId: string) {
    return balances.find(b => b.user_id === userId) ?? { id: '', user_id: userId, month, year, leaves_remaining: MAX_LEAVES, wfh_remaining: MAX_WFH };
  }

  async function handleLogLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !selectedUser) return;
    setSaving(true);
    setSaveMsg('');
    setSaveError('');

    const bal = getBalance(selectedUser);
    const field = leaveType === 'leave' ? 'leaves_remaining' : 'wfh_remaining';
    const current = leaveType === 'leave' ? bal.leaves_remaining : bal.wfh_remaining;
    const max = leaveType === 'leave' ? MAX_LEAVES : MAX_WFH;

    if (current <= 0) {
      setSaveError(`This employee has used all ${max} ${leaveType === 'leave' ? 'leave(s)' : 'WFH day(s)'} for this month.`);
      setSaving(false);
      return;
    }

    await supabase.from('leave_requests').insert({
      user_id: selectedUser,
      type: leaveType,
      date: leaveDate,
      reason: leaveReason || '',
      status: 'approved',
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
    });

    const existingBal = balances.find(b => b.user_id === selectedUser);
    if (existingBal) {
      await supabase.from('leave_balances').update({ [field]: Math.max(0, current - 1) }).eq('id', existingBal.id);
    } else {
      await supabase.from('leave_balances').insert({
        user_id: selectedUser, month, year,
        leaves_remaining: MAX_LEAVES,
        wfh_remaining: MAX_WFH,
        [field]: leaveType === 'leave' ? MAX_LEAVES - 1 : MAX_WFH - 1,
      });
    }

    setSaveMsg(`Leave logged. ${current - 1} ${leaveType === 'leave' ? 'leave(s)' : 'WFH day(s)'} remaining.`);
    setSaving(false);
    setLeaveReason('');
    load();
  }

  async function handleResetMonth() {
    if (!me) return;
    if (!confirm(`Archive ${new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })} leave data and reset all balances to ${MAX_LEAVES}L / ${MAX_WFH}W? This cannot be undone.`)) return;
    setResetting(true);
    setResetMsg('');

    // Snapshot current balances
    const snapshot = profiles.map(p => {
      const bal = getBalance(p.id);
      return { user_id: p.id, full_name: p.full_name, leaves_remaining: bal.leaves_remaining, wfh_remaining: bal.wfh_remaining };
    });

    await supabase.from('monthly_leave_archives').insert({ month, year, archived_by: me.id, data: snapshot });

    // Reset all balances
    for (const bal of balances) {
      await supabase.from('leave_balances').update({ leaves_remaining: MAX_LEAVES, wfh_remaining: MAX_WFH }).eq('id', bal.id);
    }
    // Create fresh balances for anyone who doesn't have one
    for (const p of profiles) {
      const existing = balances.find(b => b.user_id === p.id);
      if (!existing) {
        await supabase.from('leave_balances').insert({ user_id: p.id, month, year, leaves_remaining: MAX_LEAVES, wfh_remaining: MAX_WFH });
      }
    }

    setResetMsg('Month archived and all balances reset.');
    setResetting(false);
    load();
  }

  return (
    <div className="space-y-4">
      {/* Direct Leave Logger */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-gold-500" />
          <span className="text-white font-semibold">Log Leave / WFH</span>
          <span className="text-white/30 text-xs">Max: {MAX_LEAVES} leaves · {MAX_WFH} WFH per month</span>
        </div>
        <form onSubmit={handleLogLeave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Select Staff Member</label>
              <div className="relative">
                <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                  className="input-dark w-full appearance-none pr-8" required>
                  <option value="">Select employee name...</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Leave Type</label>
              <div className="flex gap-2">
                {(['leave', 'wfh'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setLeaveType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${leaveType === t ? (t === 'leave' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/15 text-blue-400 border-blue-500/30') : 'bg-white/5 text-white/40 border-white/10 hover:text-white/60'}`}>
                    {t === 'leave' ? 'Leave Day' : 'WFH Day'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Leave Date</label>
              <input type="date" value={leaveDate} onChange={e => setLeaveDate(e.target.value)}
                className="input-dark w-full" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Reason / Notes (Optional)</label>
              <input type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                placeholder="e.g. Medical appointment, personal leave..."
                className="input-dark w-full" />
            </div>
          </div>
          {selectedUser && (() => {
            const bal = getBalance(selectedUser);
            const leavesUsed = MAX_LEAVES - bal.leaves_remaining;
            const wfhUsed = MAX_WFH - bal.wfh_remaining;
            return (
              <div className="p-3 rounded-xl bg-surface-50/30 text-sm flex flex-wrap gap-4">
                <div>
                  <span className="text-white/40">Leaves: </span>
                  <span className={`font-medium ${bal.leaves_remaining === 0 ? 'text-red-400' : 'text-emerald-400'}`}>{bal.leaves_remaining} remaining</span>
                  <span className="text-white/20 ml-1">({leavesUsed}/{MAX_LEAVES} used)</span>
                </div>
                <div>
                  <span className="text-white/40">WFH: </span>
                  <span className={`font-medium ${bal.wfh_remaining === 0 ? 'text-red-400' : 'text-blue-400'}`}>{bal.wfh_remaining} remaining</span>
                  <span className="text-white/20 ml-1">({wfhUsed}/{MAX_WFH} used)</span>
                </div>
              </div>
            );
          })()}
          {saveError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{saveError}
            </div>
          )}
          {saveMsg && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />{saveMsg}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !selectedUser}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-500 border border-gold-500/30 text-sm font-medium hover:bg-gold-500/25 transition-all disabled:opacity-40">
              {saving ? <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Log Leave
            </button>
          </div>
        </form>
      </div>

      {/* Balance Overview */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gold-500" />
            <span className="text-white font-semibold text-sm">Balances — {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
            <span className="text-white/30 text-xs">({MAX_LEAVES}L / {MAX_WFH}W max per month)</span>
          </div>
          <div className="flex items-center gap-2">
            {resetMsg && <span className="text-emerald-400 text-xs">{resetMsg}</span>}
            <button onClick={handleResetMonth} disabled={resetting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-all disabled:opacity-40">
              {resetting ? <div className="w-3 h-3 border border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Reset & Store Data
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {profiles.map(p => {
            const bal = getBalance(p.id);
            return (
              <div key={p.id} className="p-3 rounded-xl bg-surface-50/30">
                <div className="text-white/70 text-xs font-medium truncate mb-1.5">{p.full_name}</div>
                <div className="flex justify-between text-xs gap-2">
                  <div className="flex flex-col items-center">
                    <span className={`font-bold text-sm ${bal.leaves_remaining === 0 ? 'text-red-400' : 'text-emerald-400'}`}>{bal.leaves_remaining}</span>
                    <span className="text-white/30">leave</span>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div className="flex flex-col items-center">
                    <span className={`font-bold text-sm ${bal.wfh_remaining === 0 ? 'text-red-400' : 'text-blue-400'}`}>{bal.wfh_remaining}</span>
                    <span className="text-white/30">WFH</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Break Monitor Tab ────────────────────────────────────────────────────────
function BreakTab() {
  const { profile: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [breakLogs, setBreakLogs] = useState<BreakLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({ user_id: '', start_time: '', end_time: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').neq('role', 'admin').order('full_name')
      .then(({ data }) => { if (data) setProfiles(data as Profile[]); });
  }, []);

  useEffect(() => {
    supabase.from('break_logs').select('*').eq('date', selectedDate).order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setBreakLogs(data as BreakLog[]); });
  }, [selectedDate]);

  async function handleLogBreak(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !form.user_id || !form.start_time) return;
    setSaving(true);
    setSaveMsg('');
    let duration: number | null = null;
    if (form.start_time && form.end_time) {
      const [sh, sm] = form.start_time.split(':').map(Number);
      const [eh, em] = form.end_time.split(':').map(Number);
      duration = (eh * 60 + em) - (sh * 60 + sm);
      if (duration < 0) duration = null;
    }
    await supabase.from('break_logs').insert({
      user_id: form.user_id,
      date: selectedDate,
      start_time: form.start_time,
      end_time: form.end_time || null,
      duration_minutes: duration,
      notes: form.notes || '',
      logged_by: me.id,
    });
    setSaveMsg('Break logged successfully.');
    setForm(prev => ({ ...prev, start_time: '', end_time: '', notes: '' }));
    setSaving(false);
    const { data } = await supabase.from('break_logs').select('*').eq('date', selectedDate).order('created_at', { ascending: false });
    if (data) setBreakLogs(data as BreakLog[]);
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Coffee className="w-4 h-4 text-gold-500" />
          <span className="text-white font-semibold">Log Break</span>
        </div>
        <form onSubmit={handleLogBreak} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Date</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="input-dark w-full" />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Select Employee</label>
              <div className="relative">
                <select value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}
                  className="input-dark w-full appearance-none pr-8" required>
                  <option value="">Select employee name...</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Break Start Time (HH:MM)</label>
              <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                placeholder="HH:MM" className="input-dark w-full" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Break End Time (HH:MM, optional)</label>
              <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                placeholder="HH:MM" className="input-dark w-full" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Notes (Optional)</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Lunch break, prayer break, personal..."
                className="input-dark w-full" />
            </div>
          </div>
          {saveMsg && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <CheckCircle className="w-4 h-4" />{saveMsg}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-500 border border-gold-500/30 text-sm font-medium hover:bg-gold-500/25 transition-all disabled:opacity-40">
              {saving ? <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
              Log Break
            </button>
          </div>
        </form>
      </div>

      {/* Today's break log */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <Coffee className="w-4 h-4 text-gold-500" />
          <span className="text-white font-semibold text-sm">Break Log — {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full ml-1">{breakLogs.length}</span>
        </div>
        {breakLogs.length === 0 ? (
          <div className="p-8 text-center text-white/30 text-sm">No breaks logged for this date.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {breakLogs.map(log => {
              const staff = profiles.find(p => p.id === log.user_id);
              return (
                <div key={log.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                    {staff?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">{staff?.full_name || 'Unknown'}</div>
                    <div className="text-white/40 text-xs flex items-center gap-2 mt-0.5">
                      <span>{log.start_time}{log.end_time ? ` — ${log.end_time}` : ' (ongoing)'}</span>
                      {log.duration_minutes && <span className="text-amber-400">{log.duration_minutes}min</span>}
                      {log.notes && <span className="text-white/30">· {log.notes}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Late Cake Tab ───────────────────────────────────────────────────────────
function CakeTab() {
  const { profile: me } = useAuth();
  const [slices, setSlices] = useState<(LateCakeSlice & { profile: Profile })[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [addInput, setAddInput] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [purchasing, setPurchasing] = useState(false);

  const cycleId = new Date().toISOString().slice(0, 7);

  const load = useCallback(async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from('late_cake_slices').select('*, profile:profiles(*)').eq('cycle_id', cycleId),
      supabase.from('profiles').select('*').neq('role', 'admin').order('full_name'),
    ]);
    if (s) setSlices(s as any);
    if (p) {
      setProfiles(p as Profile[]);
      const inputs: Record<string, number> = {};
      (p as Profile[]).forEach(pr => { inputs[pr.id] = 0; });
      setAddInput(inputs);
    }
  }, [cycleId]);

  useEffect(() => { load(); }, [load]);

  async function addSlices(userId: string) {
    if (!me || !addInput[userId]) return;
    setSaving(prev => ({ ...prev, [userId]: true }));
    const existing = slices.find(s => s.user_id === userId);
    if (existing) {
      await supabase.from('late_cake_slices').update({ slices: existing.slices + addInput[userId], updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('late_cake_slices').insert({ user_id: userId, slices: addInput[userId], cycle_id: cycleId });
    }
    setSaving(prev => ({ ...prev, [userId]: false }));
    setAddInput(prev => ({ ...prev, [userId]: 0 }));
    load();
  }

  async function handlePurchase() {
    if (!me || !confirm('Finalize this cake cycle and reset all slices to zero?')) return;
    setPurchasing(true);
    const total = slices.reduce((s, r) => s + r.slices, 0);
    const contributions = slices.map(s => ({
      user_id: s.user_id,
      full_name: (s as any).profile?.full_name || '',
      slices: s.slices,
      share_pct: total > 0 ? Math.round((s.slices / total) * 100 * 10) / 10 : 0,
    }));
    await supabase.from('late_cake_cycles').insert({ total_slices: total, contributions, triggered_by: me.id });
    for (const s of slices) {
      await supabase.from('late_cake_slices').update({ slices: 0, updated_at: new Date().toISOString() }).eq('id', s.id);
    }
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, colors: ['#FFD700', '#f97316', '#ec4899', '#10B981'] });
    setPurchasing(false);
    load();
  }

  const total = slices.reduce((s, r) => s + r.slices, 0);

  const allProfiles = profiles.map(p => ({
    profile: p,
    sliceData: slices.find(s => s.user_id === p.id),
  })).sort((a, b) => (b.sliceData?.slices || 0) - (a.sliceData?.slices || 0));

  return (
    <div className="space-y-4">
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-gold-500" />
              <span className="text-white font-semibold">Late Cake — {cycleId}</span>
            </div>
            <div className="text-white/40 text-sm mt-0.5">
              {total} total slices · 10 slices = 1 cake
            </div>
          </div>
          <button onClick={handlePurchase} disabled={purchasing || total === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/15 text-gold-500 hover:bg-gold-500/25 transition-all font-medium text-sm border border-gold-500/20 disabled:opacity-30">
            {purchasing ? <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /> : <Cake className="w-4 h-4" />}
            Purchase Cake & Reset
          </button>
        </div>

        {/* Visual cake progress */}
        {total > 0 && (
          <div className="mb-4">
            <div className="h-3 bg-surface-50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (total / 10) * 100)}%` }}
                className="h-full rounded-full bg-gold-500"
                style={{ boxShadow: '0 0 10px rgba(255,215,0,0.5)' }}
              />
            </div>
            <div className="text-white/40 text-xs mt-1">{total}/10 slices toward next cake</div>
          </div>
        )}

        <div className="space-y-3">
          {allProfiles.map(({ profile: p, sliceData }) => {
            const currentSlices = sliceData?.slices || 0;
            const sharePct = total > 0 ? Math.round((currentSlices / total) * 100 * 10) / 10 : 0;
            return (
              <div key={p.id} className="flex items-center gap-3 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                  {p.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/70 text-sm font-medium">{p.full_name}</span>
                    {currentSlices > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-500 font-medium">
                        {currentSlices} {currentSlices === 1 ? 'slice' : 'slices'} · {sharePct}%
                      </span>
                    )}
                  </div>
                  {currentSlices > 0 && total > 0 && (
                    <div className="mt-1 h-1.5 bg-surface-50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gold-500/60" style={{ width: `${sharePct}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input type="number" min="0" value={addInput[p.id] || ''}
                    onChange={e => setAddInput(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                    className="input-dark w-20 text-sm py-1.5 text-center" placeholder="0" />
                  <button onClick={() => addSlices(p.id)} disabled={saving[p.id] || !addInput[p.id]}
                    className="px-3 py-1.5 rounded-lg bg-gold-500/15 text-gold-500 hover:bg-gold-500/25 text-sm font-medium transition-all disabled:opacity-30">
                    {saving[p.id] ? '...' : '+ Add'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main HR Page ────────────────────────────────────────────────────────────
export default function HRPage() {
  const [tab, setTab] = useState<Tab>('verify');
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function loadCounts() {
      const { count: ec } = await supabase
        .from('eod_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      setPendingCount(ec ?? 0);
    }
    loadCounts();
    const ch = supabase.channel('hr-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eod_reports' }, loadCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">HR Portal</h1>
          <p className="text-white/40 text-sm">Verification, Attendance, Leave & Cake</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabBtn active={tab === 'verify'} onClick={() => setTab('verify')} icon={<UserCheck className="w-4 h-4" />} label="Verify EODs" badge={pendingCount} />
        <TabBtn active={tab === 'attendance'} onClick={() => setTab('attendance')} icon={<Clock className="w-4 h-4" />} label="Attendance" />
        <TabBtn active={tab === 'leave'} onClick={() => setTab('leave')} icon={<Calendar className="w-4 h-4" />} label="Leave / WFH" />
        <TabBtn active={tab === 'breaks'} onClick={() => setTab('breaks')} icon={<Coffee className="w-4 h-4" />} label="Breaks" />
        <TabBtn active={tab === 'cake'} onClick={() => setTab('cake')} icon={<Cake className="w-4 h-4" />} label="Late Cake" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {tab === 'verify' && <VerifyTab />}
          {tab === 'attendance' && <AttendanceTab />}
          {tab === 'leave' && <LeaveTab />}
          {tab === 'breaks' && <BreakTab />}
          {tab === 'cake' && <CakeTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
