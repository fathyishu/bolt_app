import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Target, Flame, Archive, ChevronDown, Check, AlertTriangle,
  UserPlus, X, Eye, EyeOff, Trash2, Key, Snowflake as SnowflakeIcon,
  TrendingUp, Calendar, Clock, CreditCard, Timer,
} from 'lucide-react';
import { supabase, Profile, Role, LevelThreshold, ReviewSchedule } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type AdminTab = 'team' | 'credentials' | 'levels' | 'schedules';

export default function AdminPage() {
  const { profile: currentUser } = useAuth();
  const [tab, setTab] = useState<AdminTab>('team');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthEndLoading, setMonthEndLoading] = useState(false);
  const [monthEndDone, setMonthEndDone] = useState(false);
  const [targetInputs, setTargetInputs] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [thresholds, setThresholds] = useState<LevelThreshold[]>([]);
  const [thresholdEdits, setThresholdEdits] = useState<Record<string, number>>({});
  const [savingLevel, setSavingLevel] = useState<Record<string, boolean>>({});
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([]);
  const [scheduleEdits, setScheduleEdits] = useState<Record<string, Partial<ReviewSchedule>>>({});
  const [savingSchedule, setSavingSchedule] = useState<Record<string, boolean>>({});

  const isAdmin = currentUser?.role === 'admin';

  // Add user state
  const [showAddRep, setShowAddRep] = useState(false);
  const [newRep, setNewRep] = useState({ full_name: '', email: '', password: '', role: 'sales_executive' as Role });
  const [addRepLoading, setAddRepLoading] = useState(false);
  const [addRepError, setAddRepError] = useState('');
  const [addRepSuccess, setAddRepSuccess] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // Credentials view state
  const [credentialEdits, setCredentialEdits] = useState<Record<string, { email: string; password: string }>>({});
  const [showPassFor, setShowPassFor] = useState<Record<string, boolean>>({});
  const [credSaving, setCredSaving] = useState<Record<string, boolean>>({});
  const [credError, setCredError] = useState<Record<string, string>>({});
  const [credSuccess, setCredSuccess] = useState<Record<string, string>>({});
  const [authEmails, setAuthEmails] = useState<Record<string, string>>({});

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').order('monthly_pieces', { ascending: false });
    if (data) {
      setProfiles(data as Profile[]);
      const targets: Record<string, number> = {};
      const creds: Record<string, { email: string; password: string }> = {};
      data.forEach((p: any) => {
        targets[p.id] = p.manager_daily_target;
        creds[p.id] = { email: '', password: '' };
      });
      setTargetInputs(targets);
      setCredentialEdits(creds);
    }
  }

  async function loadAuthEmails() {
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const map: Record<string, string> = {};
        (json.users || []).forEach((u: { id: string; email: string }) => { map[u.id] = u.email; });
        setAuthEmails(map);
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    async function load() {
      await loadProfiles();
      loadAuthEmails();
      const { data: lvl } = await supabase.from('level_thresholds').select('*').order('min_pieces');
      if (lvl) {
        setThresholds(lvl as LevelThreshold[]);
        const edits: Record<string, number> = {};
        (lvl as LevelThreshold[]).forEach(l => { edits[l.id] = l.min_pieces; });
        setThresholdEdits(edits);
      }
      const { data: scheds } = await supabase.from('review_schedules').select('*');
      if (scheds) {
        setSchedules(scheds as ReviewSchedule[]);
        const edits: Record<string, Partial<ReviewSchedule>> = {};
        (scheds as ReviewSchedule[]).forEach(s => {
          edits[s.id] = {
            label: s.label,
            hour_utc: s.hour_utc,
            minute_utc: s.minute_utc,
            day_of_week: s.day_of_week ?? undefined,
            day_of_month: s.day_of_month ?? undefined,
          };
        });
        setScheduleEdits(edits);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleRoleChange(userId: string, newRole: Role) {
    if (!isAdmin) return;
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
  }

  async function handleStreakPardon(userId: string) {
    if (!isAdmin) return;
    const p = profiles.find(x => x.id === userId);
    if (!p) return;
    const newStreak = (p.current_streak || 0) + 1;
    await supabase.from('profiles').update({ current_streak: newStreak }).eq('id', userId);
    setProfiles(prev => prev.map(x => x.id === userId ? { ...x, current_streak: newStreak } : x));
  }

  async function handleStreakFreeze(userId: string) {
    if (!isAdmin) return;
    const p = profiles.find(x => x.id === userId);
    if (!p) return;
    await supabase.from('profiles').update({ streak_frozen: !p.streak_frozen }).eq('id', userId);
    setProfiles(prev => prev.map(x => x.id === userId ? { ...x, streak_frozen: !x.streak_frozen } : x));
  }

  async function handleStreakReset(userId: string) {
    if (!isAdmin) return;
    if (!confirm('Reset this streak to 0?')) return;
    await supabase.from('profiles').update({ current_streak: 0, streak_frozen: false }).eq('id', userId);
    setProfiles(prev => prev.map(x => x.id === userId ? { ...x, current_streak: 0, streak_frozen: false } : x));
  }

  async function handleSetTarget(userId: string) {
    setSaving(prev => ({ ...prev, [userId]: true }));
    await supabase.from('profiles').update({ manager_daily_target: targetInputs[userId] || 0 }).eq('id', userId);
    setSaving(prev => ({ ...prev, [userId]: false }));
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, manager_daily_target: targetInputs[userId] || 0 } : p));
  }

  async function handleAddRep(e: React.FormEvent) {
    e.preventDefault();
    setAddRepError('');
    setAddRepSuccess('');
    if (!newRep.full_name.trim() || !newRep.email.trim() || !newRep.password.trim()) {
      setAddRepError('All fields are required.');
      return;
    }
    if (newRep.password.length < 6) {
      setAddRepError('Password must be at least 6 characters.');
      return;
    }
    setAddRepLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(newRep),
    });
    const json = await res.json();
    setAddRepLoading(false);
    if (!res.ok || json.error) {
      setAddRepError(json.error || 'Failed to create user.');
    } else {
      setAddRepSuccess(`${newRep.full_name} has been added.`);
      setNewRep({ full_name: '', email: '', password: '', role: 'sales_executive' });
      await loadProfiles();
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!isAdmin) return;
    if (!confirm(`Delete ${name}? This removes their account permanently.`)) return;
    await supabase.from('profiles').delete().eq('id', userId);
    setProfiles(prev => prev.filter(p => p.id !== userId));
  }

  async function handleSaveCredentials(userId: string) {
    if (!isAdmin) return;
    const cred = credentialEdits[userId];
    if (!cred?.email?.trim() && !cred?.password?.trim()) return;
    setCredSaving(prev => ({ ...prev, [userId]: true }));
    setCredError(prev => ({ ...prev, [userId]: '' }));
    setCredSuccess(prev => ({ ...prev, [userId]: '' }));
    const { data: { session } } = await supabase.auth.getSession();
    const body: any = { user_id: userId };
    if (cred.email?.trim()) body.email = cred.email.trim();
    if (cred.password?.trim()) body.password = cred.password.trim();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setCredSaving(prev => ({ ...prev, [userId]: false }));
    if (!res.ok || json.error) {
      setCredError(prev => ({ ...prev, [userId]: json.error || 'Failed to update.' }));
    } else {
      setCredSuccess(prev => ({ ...prev, [userId]: 'Credentials updated successfully.' }));
      setCredentialEdits(prev => ({ ...prev, [userId]: { email: '', password: '' } }));
      await loadProfiles();
    }
  }

  async function handleSaveLevel(threshold: LevelThreshold) {
    if (!isAdmin) return;
    setSavingLevel(prev => ({ ...prev, [threshold.id]: true }));
    await supabase.from('level_thresholds').update({
      min_pieces: thresholdEdits[threshold.id],
      updated_by: currentUser!.id,
      updated_at: new Date().toISOString(),
    }).eq('id', threshold.id);
    setSavingLevel(prev => ({ ...prev, [threshold.id]: false }));
    setThresholds(prev => prev.map(t => t.id === threshold.id ? { ...t, min_pieces: thresholdEdits[threshold.id] } : t));
  }

  async function handleSaveSchedule(schedule: ReviewSchedule) {
    if (!isAdmin) return;
    setSavingSchedule(prev => ({ ...prev, [schedule.id]: true }));
    const edit = scheduleEdits[schedule.id];
    await supabase.from('review_schedules').update({
      label: edit.label,
      hour_utc: edit.hour_utc,
      minute_utc: edit.minute_utc,
      day_of_week: schedule.review_type === 'weekly_standup' ? (edit.day_of_week ?? schedule.day_of_week) : null,
      day_of_month: schedule.review_type === 'monthly_review' ? (edit.day_of_month ?? schedule.day_of_month) : null,
      updated_by: currentUser!.id,
      updated_at: new Date().toISOString(),
    }).eq('id', schedule.id);
    setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, ...edit } : s));
    setSavingSchedule(prev => ({ ...prev, [schedule.id]: false }));
  }

  async function handleMonthEnd() {
    if (!isAdmin) return;
    if (!confirm('Archive current cycle stats and reset monthly counters? This CANNOT be undone.')) return;
    setMonthEndLoading(true);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const sorted = [...profiles].sort((a, b) => b.monthly_pieces - a.monthly_pieces);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].monthly_pieces > 0) {
        await supabase.from('trophy_case').upsert({ user_id: sorted[i].id, month, year, pieces: sorted[i].monthly_pieces, rank: i + 1 });
      }
    }
    await supabase.from('profiles').update({ monthly_pieces: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    setProfiles(prev => prev.map(p => ({ ...p, monthly_pieces: 0 })));
    setMonthEndDone(true);
    setMonthEndLoading(false);
  }

  const ROLE_COLORS: Record<Role, string> = {
    admin: '#ef4444', hr: '#3b82f6', manager: '#f59e0b', sales_executive: '#10B981',
  };
  const ROLE_LABELS: Record<Role, string> = {
    admin: 'Admin', hr: 'HR', manager: 'Manager', sales_executive: 'Sales Exec',
  };
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/40 text-sm">Master controls — team, credentials, levels, schedules</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
          { key: 'credentials', label: 'Credentials', icon: <Key className="w-4 h-4" /> },
          { key: 'levels', label: 'Level Thresholds', icon: <TrendingUp className="w-4 h-4" /> },
          { key: 'schedules', label: 'Review Schedules', icon: <Timer className="w-4 h-4" /> },
        ] as { key: AdminTab; label: string; icon: React.ReactNode }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-gold-500/15 text-gold-500 border border-gold-500/30' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}>
            {t.icon} <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

          {/* ── Team Management ── */}
          {tab === 'team' && (
            <div className="space-y-5">
              {/* Add user */}
              {isAdmin && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
                  <button onClick={() => { setShowAddRep(!showAddRep); setAddRepError(''); setAddRepSuccess(''); }}
                    className="w-full flex items-center justify-between p-5 hover:bg-white/3 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-left">
                        <div className="text-white font-semibold text-sm">Add Team Member</div>
                        <div className="text-white/40 text-xs">Create a new account</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-200 ${showAddRep ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showAddRep && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <form onSubmit={handleAddRep} className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Full Name</label>
                              <input type="text" value={newRep.full_name} onChange={e => setNewRep(p => ({ ...p, full_name: e.target.value }))}
                                placeholder="e.g. John Smith" className="input-dark w-full" required />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Email Address</label>
                              <input type="email" value={newRep.email} onChange={e => setNewRep(p => ({ ...p, email: e.target.value }))}
                                placeholder="john@mjsports.in" className="input-dark w-full" required />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Password</label>
                              <div className="relative">
                                <input type={showNewPass ? 'text' : 'password'} value={newRep.password} onChange={e => setNewRep(p => ({ ...p, password: e.target.value }))}
                                  placeholder="Min. 6 characters" className="input-dark w-full pr-10" required />
                                <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Role</label>
                              <div className="relative">
                                <select value={newRep.role} onChange={e => setNewRep(p => ({ ...p, role: e.target.value as Role }))}
                                  className="input-dark w-full appearance-none pr-8">
                                  <option value="sales_executive">Sales Executive</option>
                                  <option value="manager">Manager</option>
                                  <option value="hr">HR</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                              </div>
                            </div>
                          </div>
                          {addRepError && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-sm"><X className="w-4 h-4 flex-shrink-0" />{addRepError}</div>}
                          {addRepSuccess && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 text-sm"><Check className="w-4 h-4 flex-shrink-0" />{addRepSuccess}</div>}
                          <div className="flex justify-end">
                            <button type="submit" disabled={addRepLoading} className="btn-emerald flex items-center gap-2 px-5 py-2.5">
                              {addRepLoading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Month End */}
              {isAdmin && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                      <Archive className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold">Cycle End Archive</div>
                      <p className="text-white/40 text-sm mt-0.5">Archives cycle stats and resets all monthly piece counters. <strong className="text-red-400">Irreversible.</strong></p>
                    </div>
                    <button onClick={handleMonthEnd} disabled={monthEndLoading || monthEndDone}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${monthEndDone ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'}`}>
                      {monthEndLoading ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : monthEndDone ? <><Check className="w-4 h-4" /> Done</> : <><AlertTriangle className="w-4 h-4" /> Run Cycle End</>}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Team list */}
              <div className="glass-card overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b border-white/5">
                  <Users className="w-4 h-4 text-gold-500" />
                  <h3 className="text-white font-semibold">Team Members</h3>
                  <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full ml-1">{profiles.length}</span>
                </div>
                <div className="divide-y divide-white/5">
                  {profiles.map(p => (
                    <div key={p.id} className="p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-50 flex items-center justify-center font-bold text-white/60 flex-shrink-0">
                          {p.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{p.full_name}</div>
                          <div className="text-white/40 text-xs">
                            {p.monthly_pieces}p cycle · {p.lifetime_pieces}p total ·
                            <span className={p.streak_frozen ? 'text-blue-400' : 'text-orange-400'}> {p.current_streak}d {p.streak_frozen ? '(frozen)' : 'streak'}</span>
                          </div>
                        </div>
                        {isAdmin ? (
                          <div className="relative flex-shrink-0">
                            <select value={p.role} onChange={e => handleRoleChange(p.id, e.target.value as Role)}
                              className="appearance-none text-xs font-medium px-2.5 py-1.5 rounded-lg pr-7 border transition-all"
                              style={{ backgroundColor: `${ROLE_COLORS[p.role]}15`, color: ROLE_COLORS[p.role], borderColor: `${ROLE_COLORS[p.role]}30` }}>
                              <option value="admin">Admin</option>
                              <option value="hr">HR</option>
                              <option value="manager">Manager</option>
                              <option value="sales_executive">Sales Exec</option>
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: ROLE_COLORS[p.role] }} />
                          </div>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg border flex-shrink-0"
                            style={{ backgroundColor: `${ROLE_COLORS[p.role]}15`, color: ROLE_COLORS[p.role], borderColor: `${ROLE_COLORS[p.role]}30` }}>
                            {ROLE_LABELS[p.role]}
                          </span>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDeleteUser(p.id, p.full_name)}
                            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Target + streak controls */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 flex-1 min-w-48">
                          <Target className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                          <div className="flex-1">
                            <label className="block text-xs font-bold text-white/40 mb-1">Daily / Cycle Target (pieces)</label>
                            <input type="number" min="0" value={targetInputs[p.id] ?? 0}
                              onChange={e => setTargetInputs(prev => ({ ...prev, [p.id]: Number(e.target.value) }))}
                              placeholder="Enter target pieces for this cycle..."
                              className="input-dark w-full py-1.5 text-xs" />
                          </div>
                          <button onClick={() => handleSetTarget(p.id)} disabled={saving[p.id]}
                            className="btn-emerald text-xs py-1.5 px-3 flex-shrink-0 self-end mb-0.5">
                            {saving[p.id] ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : 'Set'}
                          </button>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap self-end">
                            <button onClick={() => handleStreakPardon(p.id)}
                              className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5 rounded-lg hover:bg-orange-500/20 transition-all">
                              <Flame className="w-3.5 h-3.5" />+1 Pardon
                            </button>
                            <button onClick={() => handleStreakFreeze(p.id)}
                              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${p.streak_frozen ? 'text-blue-400 bg-blue-500/15 border-blue-500/30' : 'text-white/40 bg-white/5 border-white/10 hover:text-blue-400 hover:bg-blue-500/10'}`}>
                              <SnowflakeIcon className="w-3.5 h-3.5" />{p.streak_frozen ? 'Unfreeze' : 'Freeze'}
                            </button>
                            <button onClick={() => handleStreakReset(p.id)}
                              className="flex items-center gap-1.5 text-xs text-white/30 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-all">
                              Reset Streak
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Credentials View ── */}
          {tab === 'credentials' && isAdmin && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <Key className="w-4 h-4 text-gold-500" />
                <div>
                  <h3 className="text-white font-semibold">Credentials Management</h3>
                  <p className="text-white/30 text-xs mt-0.5">Set new email or password for any team member. Leave a field blank to keep it unchanged.</p>
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {profiles.map(p => {
                  const currentEmail = authEmails[p.id];
                  return (
                    <div key={p.id} className="p-5 space-y-4">
                      {/* Header row */}
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-white/60 flex-shrink-0 text-sm">
                          {p.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm">{p.full_name}</div>
                          {currentEmail
                            ? <div className="text-white/40 text-xs font-mono mt-0.5">{currentEmail}</div>
                            : <div className="text-white/20 text-xs mt-0.5 italic">Loading email…</div>
                          }
                        </div>
                        <span className="text-xs px-2 py-1 rounded-lg border flex-shrink-0"
                          style={{ backgroundColor: `${ROLE_COLORS[p.role]}15`, color: ROLE_COLORS[p.role], borderColor: `${ROLE_COLORS[p.role]}30` }}>
                          {ROLE_LABELS[p.role]}
                        </span>
                      </div>

                      {/* Credential fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">
                            New Email Address
                          </label>
                          {currentEmail && (
                            <div className="text-white/25 text-xs mb-1.5 font-mono">Current: {currentEmail}</div>
                          )}
                          <input
                            type="email"
                            value={credentialEdits[p.id]?.email || ''}
                            onChange={e => setCredentialEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], email: e.target.value } }))}
                            placeholder={currentEmail ? `Replace: ${currentEmail}` : 'Enter new email address'}
                            className="input-dark w-full text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">
                            New Password
                          </label>
                          <div className="text-white/25 text-xs mb-1.5">Leave blank to keep current password</div>
                          <div className="relative">
                            <input
                              type={showPassFor[p.id] ? 'text' : 'password'}
                              value={credentialEdits[p.id]?.password || ''}
                              onChange={e => setCredentialEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], password: e.target.value } }))}
                              placeholder="Enter new password (min. 6 characters)"
                              autoComplete="new-password"
                              className="input-dark w-full text-sm pr-10 [&::-ms-reveal]:hidden [&::-webkit-contacts-auto-fill-button]:hidden"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassFor(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                            >
                              {showPassFor[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {credError[p.id] && (
                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
                          <X className="w-3.5 h-3.5 flex-shrink-0" />{credError[p.id]}
                        </div>
                      )}
                      {credSuccess[p.id] && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 text-xs">
                          <Check className="w-3.5 h-3.5 flex-shrink-0" />{credSuccess[p.id]}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveCredentials(p.id)}
                          disabled={credSaving[p.id] || (!credentialEdits[p.id]?.email?.trim() && !credentialEdits[p.id]?.password?.trim())}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/15 text-gold-500 border border-gold-500/30 text-sm font-medium hover:bg-gold-500/25 transition-all disabled:opacity-30"
                        >
                          {credSaving[p.id]
                            ? <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
                            : <Key className="w-4 h-4" />
                          }
                          Update Credentials
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Level Thresholds ── */}
          {tab === 'levels' && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gold-500" />
                <h3 className="text-white font-semibold">Career Level Thresholds</h3>
                <span className="text-white/30 text-xs ml-1">Admin-editable piece requirements</span>
              </div>
              <div className="divide-y divide-white/5">
                {thresholds.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-4 p-4">
                    <div className="w-7 text-center text-white/30 font-bold text-sm flex-shrink-0">{i + 1}</div>
                    <div className="w-36 flex-shrink-0">
                      <div className="text-white font-medium text-sm">{t.level_name}</div>
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-white/40 mb-1">Minimum Pieces Required</label>
                        <input type="number" min="0" value={thresholdEdits[t.id] ?? t.min_pieces}
                          onChange={e => setThresholdEdits(prev => ({ ...prev, [t.id]: Number(e.target.value) }))}
                          disabled={!isAdmin}
                          placeholder="Enter minimum pieces to unlock this level..."
                          className="input-dark w-full sm:w-40 text-sm py-1.5 disabled:opacity-50" />
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleSaveLevel(t)} disabled={savingLevel[t.id] || thresholdEdits[t.id] === t.min_pieces}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 font-medium transition-all disabled:opacity-30 flex-shrink-0">
                        {savingLevel[t.id] ? '...' : 'Save'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Review Schedules ── */}
          {tab === 'schedules' && (
            <div className="space-y-4">
              <div className="glass-card p-4 border border-blue-500/15">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 text-sm font-medium">Countdown Configuration</span>
                </div>
                <p className="text-white/30 text-xs">Review times are stored in UTC. IST = UTC + 5:30. To set 10:00 AM IST, enter hour=4, minute=30.</p>
              </div>

              {schedules.map(sched => {
                const edit = scheduleEdits[sched.id] || {};
                const isWeekly = sched.review_type === 'weekly_standup';
                return (
                  <div key={sched.id} className="glass-card p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isWeekly ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                        {isWeekly ? <Timer className="w-4 h-4 text-amber-400" /> : <Calendar className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div>
                        <div className="text-white font-semibold text-sm">
                          {isWeekly ? 'Weekly Stand-Up' : 'Monthly Performance Review'}
                        </div>
                        <div className="text-white/30 text-xs">{isWeekly ? 'Every Tuesday by default' : '5th of every month by default'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Display Label</label>
                        <input type="text" value={edit.label ?? sched.label}
                          onChange={e => setScheduleEdits(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], label: e.target.value } }))}
                          placeholder="e.g. Weekly Stand-Up — Every Tuesday at 10:00 AM IST"
                          className="input-dark w-full text-sm" disabled={!isAdmin} />
                      </div>

                      {isWeekly ? (
                        <div>
                          <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Day of Week</label>
                          <div className="relative">
                            <select value={edit.day_of_week ?? sched.day_of_week ?? 2}
                              onChange={e => setScheduleEdits(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], day_of_week: Number(e.target.value) } }))}
                              className="input-dark w-full appearance-none pr-8 text-sm" disabled={!isAdmin}>
                              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Day of Month (1–31)</label>
                          <input type="number" min="1" max="31"
                            value={edit.day_of_month ?? sched.day_of_month ?? 5}
                            onChange={e => setScheduleEdits(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], day_of_month: Number(e.target.value) } }))}
                            placeholder="Enter day number (e.g. 5 for 5th of month)"
                            className="input-dark w-full text-sm" disabled={!isAdmin} />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Hour (UTC, 0–23)</label>
                        <input type="number" min="0" max="23"
                          value={edit.hour_utc ?? sched.hour_utc}
                          onChange={e => setScheduleEdits(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], hour_utc: Number(e.target.value) } }))}
                          placeholder="HH (e.g. 4 for 4:00 UTC = 9:30 AM IST)"
                          className="input-dark w-full text-sm" disabled={!isAdmin} />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-white/60 mb-1.5 uppercase tracking-wider">Minute (0–59)</label>
                        <input type="number" min="0" max="59"
                          value={edit.minute_utc ?? sched.minute_utc}
                          onChange={e => setScheduleEdits(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], minute_utc: Number(e.target.value) } }))}
                          placeholder="MM (e.g. 30 for :30)"
                          className="input-dark w-full text-sm" disabled={!isAdmin} />
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex justify-end mt-4">
                        <button onClick={() => handleSaveSchedule(sched)}
                          disabled={savingSchedule[sched.id]}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/15 text-gold-500 border border-gold-500/30 text-sm font-medium hover:bg-gold-500/25 transition-all disabled:opacity-50">
                          {savingSchedule[sched.id] ? <div className="w-4 h-4 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                          Save Schedule
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
