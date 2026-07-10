import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, History, Award, Users, Star, Flame, Trophy, CreditCard as Edit2, Check, X, TrendingUp, Target, Calendar, Shield, ChevronRight, Zap, Lock, DollarSign } from 'lucide-react';
import { supabase, Profile, CycleSnapshot, PerformanceCycle, MonthlyTarget, getCommissionRate } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLevels } from '../contexts/LevelsContext';

type Tab = 'about' | 'history' | 'achievements' | 'team';

const BADGES = [
  { id: 'first_close', icon: '🎯', name: 'First Close', desc: 'Closed your first deal', check: (p: Profile) => p.lifetime_pieces >= 1 },
  { id: 'streak_7', icon: '🔥', name: 'Week Warrior', desc: '7-day streak', check: (p: Profile) => p.current_streak >= 7 },
  { id: 'streak_30', icon: '⚡', name: 'Month Machine', desc: '30-day streak', check: (p: Profile) => p.current_streak >= 30 },
  { id: 'pieces_100', icon: '💯', name: 'Century', desc: '100+ lifetime pieces', check: (p: Profile) => p.lifetime_pieces >= 100 },
  { id: 'pieces_500', icon: '🏅', name: 'High Roller', desc: '500+ lifetime pieces', check: (p: Profile) => p.lifetime_pieces >= 500 },
  { id: 'pieces_1000', icon: '👑', name: 'Four Figures', desc: '1000+ lifetime pieces', check: (p: Profile) => p.lifetime_pieces >= 1000 },
  { id: 'pieces_2000', icon: '💎', name: 'Diamond Tier', desc: '2000+ lifetime pieces', check: (p: Profile) => p.lifetime_pieces >= 2000 },
  { id: 'pieces_5000', icon: '🌟', name: 'Legend', desc: '5000+ lifetime pieces', check: (p: Profile) => p.lifetime_pieces >= 5000 },
  { id: 'sunday', icon: '☀️', name: 'Super Sunday', desc: 'Active Sunday super streak', check: (p: Profile) => p.sunday_super_streak },
  { id: 'commission_50k', icon: '💰', name: 'Fifty Grand', desc: '₹50,000+ lifetime earnings', check: (p: Profile) => p.lifetime_pieces * 8 >= 50000 },
  { id: 'commission_1l', icon: '🤑', name: 'Lakhpati', desc: '₹1,00,000+ lifetime earnings', check: (p: Profile) => p.lifetime_pieces * 8 >= 100000 },
  { id: 'level_elite', icon: '⭐', name: 'Elite Status', desc: 'Reached Elite level', check: (p: Profile) => p.lifetime_pieces >= 2000 },
];

function BadgeCard({ badge, unlocked }: { badge: typeof BADGES[0]; unlocked: boolean }) {
  return (
    <div className={`relative p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 text-center ${
      unlocked
        ? 'bg-gold-500/5 border-gold-500/20'
        : 'bg-surface-50/20 border-white/5 opacity-40'
    }`}>
      <span className="text-2xl">{badge.icon}</span>
      <div className={`text-xs font-semibold ${unlocked ? 'text-white' : 'text-white/30'}`}>{badge.name}</div>
      <div className="text-white/30 text-xs leading-tight">{badge.desc}</div>
      {!unlocked && <Lock className="absolute top-2 right-2 w-3 h-3 text-white/20" />}
    </div>
  );
}

function CountdownTimer({ target, label }: { target: Date; label: string }) {
  const [diff, setDiff] = useState(0);
  useEffect(() => {
    const update = () => setDiff(Math.max(0, target.getTime() - Date.now()));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [target]);

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40 text-xs">{label}:</span>
      <span className="font-mono text-gold-500 text-sm font-bold">
        {d > 0 ? `${d}d ` : ''}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </span>
    </div>
  );
}

interface Props { viewUserId?: string }

export default function ProfilePage({ viewUserId }: Props) {
  const { profile: me, refreshProfile } = useAuth();
  const { getLevel, levels: LEVELS } = useLevels();
  const [tab, setTab] = useState<Tab>('about');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [snapshots, setSnapshots] = useState<(CycleSnapshot & { cycle: PerformanceCycle })[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [teammates, setTeammates] = useState<Profile[]>([]);
  const [selectedTeammate, setSelectedTeammate] = useState<Profile | null>(null);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);

  const targetUserId = viewUserId || me?.id;
  const isOwnProfile = targetUserId === me?.id;

  const load = useCallback(async () => {
    if (!targetUserId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
    if (data) setProfile(data as Profile);

    const now = new Date();
    const [{ data: snaps }, { data: leaves }, { data: target }] = await Promise.all([
      supabase.from('cycle_snapshots')
        .select('*, cycle:performance_cycles(*)')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),
      supabase.from('leave_requests')
        .select('*, reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)')
        .eq('user_id', targetUserId)
        .order('date', { ascending: false })
        .limit(40),
      supabase.from('monthly_targets')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('month', now.getMonth() + 1)
        .eq('year', now.getFullYear())
        .maybeSingle(),
    ]);
    if (snaps) setSnapshots(snaps as any);
    if (leaves) setLeaveHistory(leaves);
    if (target) setMonthlyTarget(target as MonthlyTarget);
  }, [targetUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'team') {
      supabase.from('profiles').select('*')
        .in('role', ['sales_executive', 'manager'])
        .neq('id', targetUserId || '')
        .order('monthly_pieces', { ascending: false })
        .then(({ data }) => { if (data) setTeammates(data as Profile[]); });
    }
  }, [tab, targetUserId]);

  async function saveAbout() {
    if (!me || !isOwnProfile) return;
    setSavingAbout(true);
    await supabase.from('profiles').update({ about: aboutDraft }).eq('id', me.id);
    setProfile(prev => prev ? { ...prev, about: aboutDraft } : prev);
    refreshProfile();
    setSavingAbout(false);
    setEditingAbout(false);
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  const levelInfo = getLevel(profile.lifetime_pieces);
  const commission = profile.lifetime_pieces * 8;
  const unlockedBadges = BADGES.filter(b => b.check(profile));

  const tabs: { key: Tab; icon: React.ReactNode; label: string }[] = [
    { key: 'about', icon: <User className="w-4 h-4" />, label: 'About' },
    { key: 'history', icon: <History className="w-4 h-4" />, label: 'History' },
    { key: 'achievements', icon: <Award className="w-4 h-4" />, label: 'Achievements' },
    { key: 'team', icon: <Users className="w-4 h-4" />, label: 'Team Network' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Profile header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 relative overflow-hidden"
        style={{ border: `1px solid ${levelInfo.current.color}30` }}>
        <div className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(ellipse at top right, ${levelInfo.current.color}, transparent 60%)` }} />
        <div className="relative flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/20 border-2 border-gold-500/40 flex items-center justify-center flex-shrink-0">
            <span className="text-gold-500 font-bold text-2xl">{profile.full_name?.[0]?.toUpperCase() || '?'}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-xl">{profile.full_name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${levelInfo.current.color}15`, color: levelInfo.current.color }}>
                {levelInfo.current.icon} {levelInfo.current.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/5 text-white/40 capitalize">
                {profile.role.replace('_', ' ')}
              </span>
              {profile.current_streak > 0 && (
                <span className={`flex items-center gap-1 text-xs font-bold ${profile.streak_frozen ? 'text-blue-400' : 'text-orange-400'}`}>
                  <Flame className="w-3.5 h-3.5" />{profile.current_streak}d streak
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div><span className="text-white font-semibold">{profile.lifetime_pieces.toLocaleString()}</span><span className="text-white/30 ml-1">pieces</span></div>
              <div><span className="text-emerald-400 font-semibold">₹{commission.toLocaleString('en-IN')}</span><span className="text-white/30 ml-1">earned</span></div>
              <div><span className="text-gold-500 font-semibold">{unlockedBadges.length}</span><span className="text-white/30 ml-1">badges</span></div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key ? 'bg-gold-500/15 text-gold-500 border border-gold-500/30' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

          {/* ── About ── */}
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-gold-500" /> About
                  </h3>
                  {isOwnProfile && !editingAbout && (
                    <button onClick={() => { setAboutDraft(profile.about || ''); setEditingAbout(true); }}
                      className="p-1.5 rounded-lg text-white/30 hover:text-gold-500 hover:bg-gold-500/10 transition-all">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {editingAbout ? (
                  <div className="space-y-3">
                    <textarea value={aboutDraft} onChange={e => setAboutDraft(e.target.value)}
                      rows={4} placeholder="Write a short bio, goals, or message to your team..."
                      className="w-full bg-surface-50 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm resize-none focus:outline-none focus:border-gold-500/40" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingAbout(false)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs hover:text-white/60 transition-all">Cancel</button>
                      <button onClick={saveAbout} disabled={savingAbout}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/15 text-gold-500 text-xs font-medium hover:bg-gold-500/25 transition-all disabled:opacity-50">
                        {savingAbout ? <div className="w-3 h-3 border border-gold-500/30 border-t-gold-500 rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/50 text-sm leading-relaxed">
                    {profile.about || (isOwnProfile ? 'Add a bio to tell your team about yourself.' : 'No bio yet.')}
                  </p>
                )}
              </div>

              {/* Commission Forecast — sales execs only */}
              {profile.role === 'sales_executive' && (() => {
                const rate = getCommissionRate(profile.lifetime_pieces, profile.monthly_pieces, monthlyTarget?.target2 ?? 0);
                const earned = profile.monthly_pieces * rate;
                const lifetimeEarned = profile.lifetime_pieces * rate;
                const t2 = monthlyTarget?.target2 ?? 0;
                const t2Progress = t2 > 0 ? Math.min(100, (profile.monthly_pieces / t2) * 100) : 0;
                const piecesTo5k = Math.max(0, 5000 - profile.lifetime_pieces);
                const piecesToT2 = t2 > 0 ? Math.max(0, t2 - profile.monthly_pieces) : 0;
                const isElite = profile.lifetime_pieces >= 5000;
                const isT2Hit = t2 > 0 && profile.monthly_pieces >= t2;

                const rateColors: Record<number, { bg: string; text: string; border: string }> = {
                  4: { bg: 'bg-white/5', text: 'text-white/60', border: 'border-white/10' },
                  6: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
                  8: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
                };
                const rc = rateColors[rate] || rateColors[4];

                return (
                  <div className={`glass-card p-5 border ${rc.border}`}>
                    <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-emerald-400" /> Commission Forecast
                    </h3>

                    {/* Current tier badge */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${rc.bg} border ${rc.border} mb-4`}>
                      <span className={`text-sm font-bold ${rc.text}`}>₹{rate}/piece</span>
                      <span className="text-white/30 text-xs">
                        {rate === 8 ? '— Target 2 achieved!' : rate === 6 ? '— Elite tier (5000+ lifetime)' : '— Base tier'}
                      </span>
                    </div>

                    {/* Monthly earnings progress */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">This Month</span>
                        <span className="text-emerald-400 font-bold">₹{earned.toLocaleString('en-IN')}</span>
                      </div>
                      {t2 > 0 && (
                        <>
                          <div className="h-2.5 bg-surface-50 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${t2Progress}%` }}
                              transition={{ duration: 0.8 }}
                              className={`h-full rounded-full ${isT2Hit ? 'bg-emerald-400' : 'bg-blue-400'}`}
                              style={{ boxShadow: isT2Hit ? '0 0 8px rgba(52,211,153,0.5)' : undefined }} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-white/30">
                            <span>{profile.monthly_pieces} / {t2} pieces for Target 2</span>
                            <span>{Math.round(t2Progress)}%</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tier gap indicators */}
                    <div className="grid grid-cols-2 gap-3">
                      {!isElite && (
                        <div className="p-3 rounded-xl bg-surface-50/40">
                          <div className="text-white/30 text-xs mb-0.5">To Elite (₹6/pc)</div>
                          <div className="text-blue-400 font-bold text-sm">{piecesTo5k.toLocaleString()} pieces</div>
                          <div className="text-white/20 text-xs">5000 lifetime required</div>
                        </div>
                      )}
                      {isElite && !isT2Hit && t2 > 0 && (
                        <div className="p-3 rounded-xl bg-surface-50/40">
                          <div className="text-white/30 text-xs mb-0.5">To ₹8/pc (Target 2)</div>
                          <div className="text-emerald-400 font-bold text-sm">{piecesToT2} more pieces</div>
                          <div className="text-white/20 text-xs">+₹{(piecesToT2 * 2).toLocaleString()} potential gain</div>
                        </div>
                      )}
                      {isT2Hit && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 col-span-2">
                          <div className="text-emerald-400 text-sm font-medium">Maximum rate achieved — ₹8/piece active!</div>
                        </div>
                      )}
                      <div className="p-3 rounded-xl bg-surface-50/40">
                        <div className="text-white/30 text-xs mb-0.5">Lifetime Earnings</div>
                        <div className="text-gold-500 font-bold text-sm">₹{lifetimeEarned.toLocaleString('en-IN')}</div>
                        <div className="text-white/20 text-xs">{profile.lifetime_pieces} pieces total</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Career level progress */}
              <div className="glass-card p-5" style={{ border: `1px solid ${levelInfo.current.color}20` }}>
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-gold-500" /> Career Progression
                </h3>
                <div className="space-y-2.5">
                  {LEVELS.map((lvl, i) => {
                    const isUnlocked = profile.lifetime_pieces >= lvl.minPieces;
                    const isCurrent = levelInfo.current.name === lvl.name;
                    return (
                      <div key={lvl.name} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                        isCurrent ? 'bg-surface-50/60 ring-1' : isUnlocked ? 'bg-surface-50/20' : 'opacity-40'
                      }`} style={isCurrent ? { ringColor: lvl.color } : {}}>
                        <span className="text-lg w-8 text-center">{lvl.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: isUnlocked ? lvl.color : 'rgba(255,255,255,0.3)' }}>{lvl.name}</span>
                            {isCurrent && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gold-500/15 text-gold-500 font-medium">Current</span>}
                            {isUnlocked && !isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                          </div>
                          <span className="text-xs text-white/30">{lvl.minPieces.toLocaleString()} pieces</span>
                        </div>
                        <span className="text-xs font-bold text-right flex-shrink-0" style={{ color: isUnlocked ? lvl.color : 'rgba(255,255,255,0.2)' }}>
                          {i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── History ── */}
          {tab === 'history' && (
            <div className="space-y-3">
              {snapshots.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <div className="text-white/30">No cycle history yet</div>
                </div>
              ) : snapshots.map(snap => (
                <motion.div key={snap.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-white font-semibold">{snap.cycle?.name || 'Archived Cycle'}</div>
                      <div className="text-white/30 text-xs mt-0.5">
                        {snap.cycle ? `${new Date(snap.cycle.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — ${new Date(snap.cycle.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </div>
                    </div>
                    {snap.rank && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold-500/10 border border-gold-500/20">
                        <Trophy className="w-3.5 h-3.5 text-gold-500" />
                        <span className="text-gold-500 font-bold text-sm">#{snap.rank}</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Pieces', value: snap.pieces, color: '#FFD700' },
                      { label: 'Commission', value: `₹${Number(snap.commission).toLocaleString('en-IN')}`, color: '#10B981' },
                      { label: 'Leads', value: snap.leads, color: '#3b82f6' },
                      { label: 'Closed', value: snap.closed_deals, color: '#10B981' },
                      { label: 'Rings', value: snap.rings, color: '#f59e0b' },
                      { label: 'Accepted', value: snap.accepted_calls, color: '#06b6d4' },
                      { label: 'Billed', value: snap.billed_clients, color: '#f97316' },
                      { label: 'Chat Pos.', value: snap.chat_positive, color: '#a855f7' },
                    ].map(m => (
                      <div key={m.label} className="bg-surface-50/30 rounded-lg p-2.5 text-center">
                        <div className="text-base font-bold" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-white/30 text-xs mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Leave History */}
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4 text-sm">
                  <Calendar className="w-4 h-4 text-gold-500" /> Leave & WFH History
                  <span className="text-white/30 text-xs font-normal">({leaveHistory.length} records)</span>
                </h3>
                {leaveHistory.length === 0 ? (
                  <div className="text-white/30 text-sm text-center py-4">No leave records.</div>
                ) : (
                  <div className="space-y-2">
                    {leaveHistory.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50/30">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${r.type === 'leave' ? 'bg-emerald-500/15' : 'bg-blue-500/15'}`}>
                            {r.type === 'leave' ? '📅' : '🏠'}
                          </span>
                          <div>
                            <div className="text-white/80 text-sm font-medium">
                              {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            {r.reason && <div className="text-white/30 text-xs">{r.reason}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.type === 'leave' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                            {r.type === 'leave' ? 'Leave' : 'WFH'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${r.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : r.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Achievements ── */}
          {tab === 'achievements' && (
            <div className="space-y-5">
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-gold-500" /> Badge Collection
                  <span className="text-white/30 text-xs font-normal">({unlockedBadges.length}/{BADGES.length} unlocked)</span>
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {BADGES.map(badge => (
                    <BadgeCard key={badge.id} badge={badge} unlocked={badge.check(profile)} />
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-gold-500" /> Performance Targets
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Next Level', desc: levelInfo.next ? `Reach ${levelInfo.next.name} (${levelInfo.next.minPieces} pieces)` : 'Maximum level reached', pct: levelInfo.progress, color: levelInfo.current.color, done: !levelInfo.next },
                    { label: '100 Pieces', desc: 'Century milestone', pct: Math.min(100, Math.round((profile.lifetime_pieces/100)*100)), color: '#3b82f6', done: profile.lifetime_pieces >= 100 },
                    { label: '500 Pieces', desc: 'High Roller milestone', pct: Math.min(100, Math.round((profile.lifetime_pieces/500)*100)), color: '#f59e0b', done: profile.lifetime_pieces >= 500 },
                    { label: '₹1,00,000 Earned', desc: 'Lakhpati milestone', pct: Math.min(100, Math.round(((profile.lifetime_pieces*8)/100000)*100)), color: '#10B981', done: profile.lifetime_pieces * 8 >= 100000 },
                  ].map(target => (
                    <div key={target.label} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {target.done ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Zap className="w-3.5 h-3.5 text-white/30" />}
                          <span className="text-sm font-medium text-white">{target.label}</span>
                        </div>
                        <span className="text-xs text-white/30">{target.pct}%</span>
                      </div>
                      <div className="text-xs text-white/30">{target.desc}</div>
                      <div className="h-1.5 bg-surface-50 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${target.pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: target.color, boxShadow: target.done ? `0 0 8px ${target.color}60` : 'none' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coming Soon: Team Performance Rewards */}
              <div className="glass-card p-5 relative overflow-hidden" style={{ border: '1px solid rgba(255,215,0,0.15)' }}>
                <div className="absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at bottom right, #FFD700, transparent 60%)' }} />
                <div className="relative flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-bold text-sm">Team Performance Rewards</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-500 border border-gold-500/20 font-medium">Coming Soon</span>
                    </div>
                    <p className="text-white/40 text-sm leading-relaxed">
                      Earn team-wide rewards, compete for monthly prizes, and unlock exclusive perks based on collective performance. Leaderboard bonuses, streak rewards, and more — launching soon.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {['Monthly Prizes', 'Team Bonuses', 'Streak Rewards', 'Exclusive Perks'].map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface-50/50 text-white/30 border border-white/5">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Team Network ── */}
          {tab === 'team' && (
            <div className="space-y-3">
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-gold-500" /> Your Team
                  <span className="text-white/30 text-xs font-normal">{teammates.length} members</span>
                </h3>
                <div className="space-y-2">
                  {teammates.map(tm => {
                    const tmLevel = getLevel(tm.lifetime_pieces);
                    return (
                      <button key={tm.id} onClick={() => setSelectedTeammate(selectedTeammate?.id === tm.id ? null : tm)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left">
                        <div className="w-9 h-9 rounded-full bg-surface-50 border border-white/10 flex items-center justify-center font-bold text-white/70 flex-shrink-0">
                          {tm.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">{tm.full_name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs" style={{ color: tmLevel.current.color }}>{tmLevel.current.icon} {tmLevel.current.name}</span>
                            {tm.current_streak > 0 && (
                              <span className={`flex items-center gap-0.5 text-xs ${tm.streak_frozen ? 'text-blue-400' : 'text-orange-400'}`}>
                                <Flame className="w-3 h-3" />{tm.current_streak}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-gold-500 text-sm font-bold">{tm.monthly_pieces}p</div>
                          <div className="text-white/30 text-xs">this cycle</div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-white/20 transition-transform ${selectedTeammate?.id === tm.id ? 'rotate-90' : ''}`} />
                      </button>
                    );
                  })}
                  {teammates.length === 0 && (
                    <p className="text-white/30 text-sm text-center py-6">No teammates found.</p>
                  )}
                </div>
              </div>

              {/* Expanded teammate card */}
              <AnimatePresence>
                {selectedTeammate && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="glass-card p-5" style={{ border: `1px solid ${getLevel(selectedTeammate.lifetime_pieces).current.color}30` }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center font-bold text-gold-500 text-xl flex-shrink-0">
                        {selectedTeammate.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="text-white font-bold">{selectedTeammate.full_name}</div>
                        <div className="text-white/30 text-xs capitalize">{selectedTeammate.role.replace('_', ' ')}</div>
                      </div>
                      <button onClick={() => setSelectedTeammate(null)}
                        className="ml-auto p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {(() => {
                      const lvl = getLevel(selectedTeammate.lifetime_pieces);
                      const tmBadges = BADGES.filter(b => b.check(selectedTeammate));
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { label: 'Lifetime Pieces', value: selectedTeammate.lifetime_pieces.toLocaleString(), color: '#FFD700' },
                              { label: 'Monthly Pieces', value: selectedTeammate.monthly_pieces, color: '#3b82f6' },
                              { label: 'Day Streak', value: `${selectedTeammate.current_streak}d`, color: selectedTeammate.streak_frozen ? '#3b82f6' : '#f97316' },
                            ].map(s => (
                              <div key={s.label} className="bg-surface-50/30 rounded-xl p-3 text-center">
                                <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                                <div className="text-white/30 text-xs mt-0.5">{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">Level Progress</div>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{lvl.current.icon}</span>
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                  <span style={{ color: lvl.current.color }}>{lvl.current.name}</span>
                                  {lvl.next && <span className="text-white/30">{lvl.piecesLeft} to {lvl.next.name}</span>}
                                </div>
                                <div className="h-2 bg-surface-50 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${lvl.progress}%`, backgroundColor: lvl.current.color }} />
                                </div>
                              </div>
                            </div>
                          </div>
                          {tmBadges.length > 0 && (
                            <div>
                              <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">Badges ({tmBadges.length})</div>
                              <div className="flex flex-wrap gap-2">
                                {tmBadges.map(b => (
                                  <div key={b.id} title={b.name} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gold-500/5 border border-gold-500/15 text-xs text-white/70">
                                    <span>{b.icon}</span>{b.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedTeammate.about && (
                            <div>
                              <div className="text-white/40 text-xs mb-1 uppercase tracking-wider">About</div>
                              <p className="text-white/50 text-sm">{selectedTeammate.about}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
