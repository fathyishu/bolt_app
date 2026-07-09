import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, Star, TrendingUp, History, ChevronDown, Calendar } from 'lucide-react';
import { supabase, Profile, TrophyCase, CycleSnapshot, PerformanceCycle } from '../lib/supabase';
import { useLevels } from '../contexts/LevelsContext';

function PodiumBlock({ rank, profile, pieces }: { rank: 1 | 2 | 3; profile: Profile | null; pieces: number }) {
  const { getLevel } = useLevels();
  const heights = { 1: 'h-36', 2: 'h-24', 3: 'h-20' };
  const colors = {
    1: { main: '#FFD700', bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)' },
    2: { main: '#C0C0C0', bg: 'rgba(192,192,192,0.1)', border: 'rgba(192,192,192,0.3)' },
    3: { main: '#CD7F32', bg: 'rgba(205,127,50,0.1)', border: 'rgba(205,127,50,0.3)' },
  };
  const icons = { 1: <Crown className="w-5 h-5" />, 2: <Medal className="w-4 h-4" />, 3: <Star className="w-4 h-4" /> };
  const c = colors[rank];
  const level = profile ? getLevel(profile.lifetime_pieces) : null;

  return (
    <div className={`flex flex-col items-center ${rank === 1 ? 'z-10' : ''}`}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.1 + 0.3 }}
        className="mb-2 relative">
        {rank === 1 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-float">👑</div>}
        <div className={`${rank === 1 ? 'w-16 h-16' : 'w-12 h-12'} rounded-full flex items-center justify-center text-xl font-bold border-2`}
          style={{ backgroundColor: c.bg, borderColor: c.border }}>
          <span style={{ color: c.main }}>{profile?.full_name?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: c.main, color: '#000' }}>
          {rank}
        </div>
      </motion.div>
      <div className="text-center mb-2">
        <div className={`font-bold ${rank === 1 ? 'text-base text-white' : 'text-sm text-white/80'}`}>
          {profile?.full_name?.split(' ')[0] || 'TBD'}
        </div>
        {level && <div className="text-xs mt-0.5" style={{ color: level.current.color }}>{level.current.name}</div>}
        <div className="font-bold text-sm mt-0.5" style={{ color: c.main }}>{pieces}p</div>
      </div>
      <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: rank * 0.15 + 0.5, duration: 0.5, ease: 'easeOut' }}
        style={{ originY: 1, backgroundColor: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 0 20px ${c.main}20` }}
        className={`${heights[rank]} w-20 rounded-t-xl flex flex-col items-center justify-end pb-3`}>
        <div style={{ color: c.main }}>{icons[rank]}</div>
      </motion.div>
    </div>
  );
}

type MainTab = 'monthly' | 'career' | 'history';

// ── Snapshot row shape from the DB query ─────────────────────────────────────
type SnapRow = CycleSnapshot & { profile?: Profile };
type MonthEntry = { month: number; year: number; label: string };

export default function LeaderboardPage() {
  const { getLevel } = useLevels();
  const [monthlyTop, setMonthlyTop] = useState<Profile[]>([]);
  const [careerLegends, setCareerLegends] = useState<Profile[]>([]);
  const [trophyHistory, setTrophyHistory] = useState<TrophyCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainTab>('monthly');

  // History state
  const [historyMode, setHistoryMode] = useState<'monthly' | 'cycle' | 'lifetime'>('monthly');
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [historySnapshots, setHistorySnapshots] = useState<SnapRow[]>([]);
  const [historyProfiles, setHistoryProfiles] = useState<Profile[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    async function load() {
      const [{ data: monthly }, { data: career }, { data: trophy }, { data: cyc }] = await Promise.all([
        supabase.from('profiles').select('*').neq('role', 'admin').eq('is_active', true).order('monthly_pieces', { ascending: false }).limit(10),
        supabase.from('profiles').select('*').neq('role', 'admin').eq('is_active', true).order('lifetime_pieces', { ascending: false }).limit(10),
        supabase.from('trophy_case').select('*, profile:profiles(full_name, role)').order('year', { ascending: false }).order('month', { ascending: false }).limit(30),
        supabase.from('performance_cycles').select('*').order('start_date', { ascending: false }).limit(24),
      ]);
      if (monthly) setMonthlyTop(monthly as Profile[]);
      if (career) setCareerLegends(career as Profile[]);
      if (trophy) setTrophyHistory(trophy as TrophyCase[]);
      if (cyc) {
        setCycles(cyc as PerformanceCycle[]);
        if (cyc.length > 0) setSelectedCycleId(cyc[0].id);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Build month options from trophy history + current month
  const monthOptions: MonthEntry[] = React.useMemo(() => {
    const now = new Date();
    const seen = new Set<string>();
    const entries: MonthEntry[] = [];
    // Current month first
    entries.push({ month: now.getMonth() + 1, year: now.getFullYear(), label: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}` });
    seen.add(`${now.getFullYear()}-${now.getMonth() + 1}`);
    // Past months from trophy history
    trophyHistory.forEach(t => {
      const key = `${t.year}-${t.month}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ month: t.month, year: t.year, label: `${MONTH_NAMES[(t.month || 1) - 1]} ${t.year}` });
      }
    });
    return entries;
  }, [trophyHistory]);

  useEffect(() => {
    if (monthOptions.length > 0 && !selectedMonth) {
      setSelectedMonth(`${monthOptions[0].year}-${monthOptions[0].month}`);
    }
  }, [monthOptions, selectedMonth]);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistorySnapshots([]);
    setHistoryProfiles([]);

    if (historyMode === 'cycle' && selectedCycleId) {
      const { data } = await supabase
        .from('cycle_snapshots')
        .select('*, profile:profiles!cycle_snapshots_user_id_fkey(full_name, lifetime_pieces, role)')
        .eq('cycle_id', selectedCycleId)
        .order('pieces', { ascending: false });
      if (data) setHistorySnapshots(data as SnapRow[]);

    } else if (historyMode === 'monthly' && selectedMonth) {
      const [yr, mo] = selectedMonth.split('-').map(Number);
      // Try trophy_case first
      const { data: trophy } = await supabase
        .from('trophy_case')
        .select('*, profile:profiles(full_name, lifetime_pieces)')
        .eq('month', mo)
        .eq('year', yr)
        .order('rank', { ascending: true });
      if (trophy && trophy.length > 0) {
        // Convert to SnapRow-like shape for display
        const rows: SnapRow[] = trophy.map((t: any) => ({
          id: t.id, cycle_id: '', user_id: t.user_id, full_name: t.profile?.full_name || '?',
          pieces: t.pieces, leads: 0, rings: 0, accepted_calls: 0, positive_chats: 0,
          billed_clients: 0, closed_deals: 0, chat_positive: 0, commission: t.pieces * 4,
          rank: t.rank, created_at: t.archived_at, profile: t.profile,
        }));
        setHistorySnapshots(rows);
      } else {
        // Fall back to live profiles if no trophy data
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .neq('role', 'admin')
          .eq('is_active', true)
          .order('monthly_pieces', { ascending: false })
          .limit(10);
        if (prof) setHistoryProfiles(prof as Profile[]);
      }

    } else if (historyMode === 'lifetime') {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .eq('is_active', true)
        .order('lifetime_pieces', { ascending: false })
        .limit(20);
      if (data) setHistoryProfiles(data as Profile[]);
    }

    setHistoryLoading(false);
  }

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, historyMode, selectedCycleId, selectedMonth]);

  const activeList = tab === 'monthly' ? monthlyTop : careerLegends;
  const top3 = activeList.slice(0, 3);
  const rest = activeList.slice(3);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-gold-500" /> Leaderboard
        </h1>
        <p className="text-white/40 text-sm mt-0.5">Rankings, records & history</p>
      </div>

      {/* Main tab toggle */}
      <div className="flex bg-surface-200 rounded-xl p-1 w-fit gap-1">
        {([
          { key: 'monthly', label: 'Monthly Top' },
          { key: 'career', label: 'Career Legends' },
          { key: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" /> },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-gold-500 text-dark-400' : 'text-white/50 hover:text-white/80'}`}>
            {(t as any).icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Live rankings ── */}
      {(tab === 'monthly' || tab === 'career') && (
        <>
          {top3.length > 0 && (
            <div className="glass-card p-8">
              <div className="flex items-end justify-center gap-4">
                {top3[1] ? <PodiumBlock rank={2} profile={top3[1]} pieces={tab === 'monthly' ? top3[1].monthly_pieces : top3[1].lifetime_pieces} /> : <PodiumBlock rank={2} profile={null} pieces={0} />}
                <PodiumBlock rank={1} profile={top3[0]} pieces={tab === 'monthly' ? top3[0].monthly_pieces : top3[0].lifetime_pieces} />
                {top3[2] ? <PodiumBlock rank={3} profile={top3[2]} pieces={tab === 'monthly' ? top3[2].monthly_pieces : top3[2].lifetime_pieces} /> : <PodiumBlock rank={3} profile={null} pieces={0} />}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Rankings</h3>
              </div>
              <div className="divide-y divide-white/5">
                {rest.map((p, idx) => {
                  const pieces = tab === 'monthly' ? p.monthly_pieces : p.lifetime_pieces;
                  const level = getLevel(p.lifetime_pieces);
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                      <div className="w-6 text-center text-white/30 font-bold text-sm">#{idx + 4}</div>
                      <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                        {p.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm">{p.full_name}</div>
                        <div className="text-xs mt-0.5" style={{ color: level.current.color }}>{level.current.icon} {level.current.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">{pieces.toLocaleString()}</div>
                        <div className="text-white/30 text-xs">pieces</div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'monthly' && trophyHistory.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold-500" /> Trophy Case — Hall of Fame
              </h3>
              <div className="space-y-2">
                {trophyHistory.slice(0, 6).map(t => (
                  <div key={t.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-50/30">
                    <div className="text-gold-500 font-bold w-16 text-sm flex-shrink-0">{MONTH_NAMES[(t.month || 1) - 1]} {t.year}</div>
                    <div className="flex-1 text-white/70 text-sm truncate">{(t as any).profile?.full_name || 'Unknown'}</div>
                    <div className="font-bold text-white text-sm">{t.pieces}p</div>
                    {t.rank === 1 && <Crown className="w-4 h-4 text-gold-500" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── History Tab ── */}
      {tab === 'history' && (
        <div className="space-y-5">
          {/* History mode + filter selectors */}
          <div className="glass-card p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="w-4 h-4 text-gold-500" />
              <span className="text-white font-semibold text-sm">Filter History</span>
            </div>

            {/* Mode tabs */}
            <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1 w-fit">
              {([
                { key: 'monthly', label: 'By Month' },
                { key: 'cycle', label: 'By Cycle' },
                { key: 'lifetime', label: 'Lifetime' },
              ] as const).map(m => (
                <button key={m.key} onClick={() => setHistoryMode(m.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${historyMode === m.key ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Month selector */}
            {historyMode === 'monthly' && monthOptions.length > 0 && (
              <div className="relative w-fit">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className="input-dark pr-8 appearance-none cursor-pointer text-sm">
                  {monthOptions.map(m => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            )}

            {/* Cycle selector */}
            {historyMode === 'cycle' && cycles.length > 0 && (
              <div className="relative w-fit">
                <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)}
                  className="input-dark pr-8 appearance-none cursor-pointer text-sm">
                  {cycles.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Results */}
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold-500" />
                <span className="text-white font-semibold text-sm">
                  {historyMode === 'monthly' ? `${monthOptions.find(m => `${m.year}-${m.month}` === selectedMonth)?.label ?? ''} Rankings` :
                   historyMode === 'cycle' ? `${cycles.find(c => c.id === selectedCycleId)?.name ?? 'Cycle'} Rankings` :
                   'All-Time Career Leaderboard'}
                </span>
              </div>

              {/* Cycle / monthly snapshot rows */}
              {historySnapshots.length > 0 && (
                <div className="divide-y divide-white/5">
                  {historySnapshots.map((snap, idx) => {
                    const level = snap.profile ? getLevel(snap.profile.lifetime_pieces) : null;
                    return (
                      <motion.div key={snap.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                        <div className="w-6 text-center font-bold text-sm" style={{ color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#fff4' }}>
                          #{idx + 1}
                        </div>
                        <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                          {snap.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{snap.full_name}</div>
                          {level && <div className="text-xs mt-0.5" style={{ color: level.current.color }}>{level.current.icon} {level.current.name}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{snap.pieces.toLocaleString()}</div>
                          <div className="text-white/30 text-xs">pieces</div>
                        </div>
                        {historyMode === 'cycle' && (
                          <div className="text-right hidden sm:block">
                            <div className="text-emerald-400 font-medium text-sm">₹{Number(snap.commission).toLocaleString('en-IN')}</div>
                            <div className="text-white/30 text-xs">commission</div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Lifetime profile rows */}
              {historyProfiles.length > 0 && (
                <div className="divide-y divide-white/5">
                  {historyProfiles.map((p, idx) => {
                    const pieces = historyMode === 'lifetime' ? p.lifetime_pieces : p.monthly_pieces;
                    const level = getLevel(p.lifetime_pieces);
                    return (
                      <motion.div key={p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                        <div className="w-6 text-center font-bold text-sm" style={{ color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : '#fff4' }}>
                          #{idx + 1}
                        </div>
                        <div className="w-9 h-9 rounded-full bg-surface-50 flex items-center justify-center font-bold text-sm text-white/60 flex-shrink-0">
                          {p.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium text-sm">{p.full_name}</div>
                          <div className="text-xs mt-0.5" style={{ color: level.current.color }}>{level.current.icon} {level.current.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">{pieces.toLocaleString()}</div>
                          <div className="text-white/30 text-xs">pieces</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {historySnapshots.length === 0 && historyProfiles.length === 0 && !historyLoading && (
                <div className="text-center py-12 text-white/30">
                  <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No data for this period.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {(tab === 'monthly' || tab === 'career') && activeList.length === 0 && (
        <div className="text-center py-16 text-white/30">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No data yet. Start selling to appear here!</p>
        </div>
      )}
    </div>
  );
}
