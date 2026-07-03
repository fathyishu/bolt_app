import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, TrendingUp, Target, DollarSign, ChevronDown, ChevronUp,
  Award, Flame, BarChart3, Circle, ArrowUp, ArrowDown, Timer,
} from 'lucide-react';
import { supabase, Profile, Lead, LeadStatus, CycleSnapshot } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLevels } from '../contexts/LevelsContext';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  new_lead:        { label: 'New Lead',        color: '#3b82f6' },
  follow_up:       { label: 'Follow-Up',       color: '#f59e0b' },
  dead_lead:       { label: 'Dead Lead',        color: '#6b7280' },
  bill_declined:   { label: 'Bill Declined',   color: '#ef4444' },
  pending_payment: { label: 'Pending Payment', color: '#f97316' },
  cod_lead:        { label: 'COD Lead',         color: '#8b5cf6' },
  closed_lead:     { label: 'Closed',           color: '#10b981' },
};

interface RepRow {
  profile: Profile;
  leads: Lead[];
}

function StatPill({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ backgroundColor: `${color}10` }}>
      <span className="text-base font-bold" style={{ color }}>{value}</span>
      <span className="text-white/40 text-xs mt-0.5">{label}</span>
    </div>
  );
}

function RepCard({ rep }: { rep: RepRow }) {
  const { getLevel } = useLevels();
  const [expanded, setExpanded] = useState(false);
  const { profile, leads } = rep;
  const level = getLevel(profile.lifetime_pieces);
  const closedLeads = leads.filter((l) => l.status === 'closed_lead');
  const pendingLeads = leads.filter((l) => ['pending_payment', 'cod_lead'].includes(l.status));
  const followUps = leads.filter((l) => l.status === 'follow_up');
  const commission = profile.monthly_pieces * 8;

  const statusGroups = Object.keys(STATUS_CONFIG).reduce((acc, key) => {
    const s = key as LeadStatus;
    const group = leads.filter((l) => l.status === s);
    if (group.length > 0) acc[s] = group;
    return acc;
  }, {} as Partial<Record<LeadStatus, Lead[]>>);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-white/3 transition-colors text-left">
        <div className="w-11 h-11 rounded-full bg-surface-50 border border-white/10 flex items-center justify-center font-bold text-white/70 text-lg flex-shrink-0">
          {profile.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{profile.full_name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: `${level.current.color}15`, color: level.current.color }}>
              {level.current.icon} {level.current.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-white/40 text-xs">{leads.length} leads</span>
            <span className="text-emerald-400 text-xs font-medium">₹{commission.toLocaleString('en-IN')}</span>
            {profile.current_streak > 0 && (
              <span className={`flex items-center gap-1 text-xs ${profile.streak_frozen ? 'text-blue-400' : 'text-orange-400'}`}>
                <Flame className="w-3 h-3" />{profile.current_streak}d streak
              </span>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <StatPill value={profile.monthly_pieces} label="Pieces" color="#FFD700" />
          <StatPill value={closedLeads.length} label="Closed" color="#10b981" />
          <StatPill value={pendingLeads.length} label="Pending" color="#f97316" />
          <StatPill value={followUps.length} label="Follow-up" color="#f59e0b" />
        </div>
        <div className="flex-shrink-0 text-white/30 ml-2">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      <div className="sm:hidden flex items-center gap-2 px-4 pb-3 flex-wrap">
        <StatPill value={profile.monthly_pieces} label="Pieces" color="#FFD700" />
        <StatPill value={closedLeads.length} label="Closed" color="#10b981" />
        <StatPill value={pendingLeads.length} label="Pending" color="#f97316" />
        <StatPill value={followUps.length} label="Follow-up" color="#f59e0b" />
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-4">
          {Object.entries(statusGroups).map(([status, statusLeads]) => {
            const cfg = STATUS_CONFIG[status as LeadStatus];
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-2">
                  <Circle className="w-2.5 h-2.5 fill-current flex-shrink-0" style={{ color: cfg.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-white/20 text-xs ml-1">{statusLeads!.length}</span>
                </div>
                <div className="space-y-1 pl-4">
                  {statusLeads!.map((lead) => (
                    <div key={lead.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-surface-50/20 hover:bg-surface-50/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <span className="text-white/80 text-sm truncate block">{lead.contact_name || lead.title}</span>
                        {lead.phone && <span className="text-white/30 text-xs">{lead.phone}</span>}
                      </div>
                      {lead.pieces_count > 0 && <span className="text-gold-500 text-xs font-bold flex-shrink-0">{lead.pieces_count}p</span>}
                      {lead.next_payment_date && (
                        <span className="text-white/30 text-xs flex-shrink-0">
                          {new Date(lead.next_payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {leads.length === 0 && <p className="text-white/20 text-sm text-center py-2">No leads assigned yet.</p>}
        </div>
      )}
    </motion.div>
  );
}

interface ManagerTrackerProps {
  reps: RepRow[];
  teamTarget: number;
  aprilSnapshot: CycleSnapshot[];
}

function ManagerTracker({ reps, teamTarget, aprilSnapshot }: ManagerTrackerProps) {
  const totalPieces = reps.reduce((s, r) => s + r.profile.monthly_pieces, 0);
  const progressPct = teamTarget > 0 ? Math.min(100, Math.round((totalPieces / teamTarget) * 100)) : 0;

  const aprilTotal = aprilSnapshot.reduce((s, snap) => s + snap.pieces, 0);
  const momPct = aprilTotal > 0 ? Math.round((totalPieces / aprilTotal) * 100) : 0;
  const momDelta = totalPieces - aprilTotal;

  return (
    <div className="space-y-4">
      {/* Team Target Tracker */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5" style={{ border: '1px solid rgba(255,215,0,0.15)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-gold-500" />
          <h3 className="text-white font-semibold text-sm">Team Target Progress</h3>
          <span className="ml-auto text-gold-500 font-bold">{totalPieces} / {teamTarget > 0 ? teamTarget : '—'} pcs</span>
        </div>
        {teamTarget > 0 ? (
          <>
            <div className="h-3 bg-surface-50 rounded-full overflow-hidden mb-2">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: progressPct >= 100 ? 'linear-gradient(90deg, #10B981, #34d399)' : 'linear-gradient(90deg, #FFD70080, #FFD700)', boxShadow: '0 0 8px rgba(255,215,0,0.4)' }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">{progressPct}% complete</span>
              {teamTarget - totalPieces > 0
                ? <span className="text-amber-400">{teamTarget - totalPieces} more pieces needed</span>
                : <span className="text-emerald-400 font-semibold">Target reached!</span>}
            </div>
          </>
        ) : (
          <p className="text-white/30 text-sm">Set a team target in Admin Panel to track progress.</p>
        )}
      </motion.div>

      {/* Month-over-Month Comparison */}
      {aprilTotal > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gold-500" />
            <h3 className="text-white font-semibold text-sm">vs April Cycle</h3>
            <div className={`ml-auto flex items-center gap-1 text-sm font-bold ${momDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {momDelta >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              {Math.abs(momDelta)} pcs ({momPct}%)
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-50/40 rounded-xl p-3">
              <div className="text-white/40 text-xs mb-1">April Cycle</div>
              <div className="text-white font-bold text-lg">{aprilTotal}</div>
              <div className="text-white/30 text-xs">total pieces</div>
            </div>
            <div className="bg-surface-50/40 rounded-xl p-3">
              <div className="text-white/40 text-xs mb-1">Current Cycle</div>
              <div className={`font-bold text-lg ${momDelta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalPieces}</div>
              <div className="text-white/30 text-xs">total pieces</div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {reps.map(r => {
              const aprilSnap = aprilSnapshot.find(s => s.user_id === r.profile.id);
              const aprilPieces = aprilSnap?.pieces || 0;
              const delta = r.profile.monthly_pieces - aprilPieces;
              return (
                <div key={r.profile.id} className="flex items-center gap-2 text-xs">
                  <span className="text-white/60 w-20 truncate">{r.profile.full_name?.split(' ')[0]}</span>
                  <span className="text-white/30 w-12 text-right">{aprilPieces}p</span>
                  <span className="text-white/20 mx-1">→</span>
                  <span className="text-white font-medium w-12">{r.profile.monthly_pieces}p</span>
                  <span className={`ml-auto font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta >= 0 ? '+' : ''}{delta}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { profile: me } = useAuth();
  const [reps, setReps] = useState<RepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aprilSnaps, setAprilSnaps] = useState<CycleSnapshot[]>([]);
  const isManager = me?.role === 'manager';

  // Use manager_daily_target as team target for managers
  const teamTarget = me ? (me.manager_daily_target || 0) : 0;

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: leads }] = await Promise.all([
        supabase.from('profiles').select('*').order('monthly_pieces', { ascending: false }),
        supabase.from('leads').select('*'),
      ]);

      if (profiles && leads) {
        const rows: RepRow[] = (profiles as Profile[])
          .filter((p) => ['sales_executive', 'manager'].includes(p.role))
          .map((p) => ({
            profile: p,
            leads: (leads as Lead[]).filter((l) => l.assigned_to === p.id),
          }));
        setReps(rows);
      }

      // Load April cycle snapshots for MoM comparison
      const { data: aprilCycle } = await supabase
        .from('performance_cycles').select('id').eq('name', 'April Cycle').maybeSingle();
      if (aprilCycle) {
        const { data: snaps } = await supabase
          .from('cycle_snapshots').select('*').eq('cycle_id', aprilCycle.id);
        if (snaps) setAprilSnaps(snaps as CycleSnapshot[]);
      }

      setLoading(false);
    }
    load();
  }, []);

  const totalMonthly = reps.reduce((s, r) => s + r.profile.monthly_pieces, 0);
  const totalLeads = reps.reduce((s, r) => s + r.leads.length, 0);
  const totalClosed = reps.reduce((s, r) => s + r.leads.filter((l) => l.status === 'closed_lead').length, 0);
  const totalCommission = totalMonthly * 8;
  const totalPending = reps.reduce((s, r) => s + r.leads.filter((l) => ['pending_payment', 'cod_lead'].includes(l.status)).length, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-bold text-white">
            Team <span className="text-gold-500">Overview</span>
          </motion.h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{reps.length} active reps
          </p>
        </div>
      </div>

      {/* Team-wide summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Monthly Pieces', value: totalMonthly.toLocaleString(), icon: <TrendingUp className="w-5 h-5" />, color: '#FFD700' },
          { label: 'Total Leads', value: totalLeads, icon: <Users className="w-5 h-5" />, color: '#3b82f6' },
          { label: 'Closed Deals', value: totalClosed, icon: <Award className="w-5 h-5" />, color: '#10b981' },
          { label: 'Pending Collection', value: totalPending, icon: <Target className="w-5 h-5" />, color: '#f97316' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${s.color}15` }}>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-white/40 text-sm mt-0.5">{s.label}</div>
            <div className="absolute bottom-0 right-0 w-20 h-20 rounded-tl-full opacity-5" style={{ backgroundColor: s.color }} />
          </motion.div>
        ))}
      </div>

      {/* Commission summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="glass-card p-4 flex items-center gap-4" style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <span className="text-white/60 text-sm">Total Team Commission This Cycle</span>
        </div>
        <div className="text-emerald-400 font-bold text-xl">₹{totalCommission.toLocaleString('en-IN')}</div>
      </motion.div>

      {/* Manager-exclusive trackers */}
      {isManager && (
        <ManagerTracker reps={reps} teamTarget={teamTarget} aprilSnapshot={aprilSnaps} />
      )}

      {/* Performance ranking bar */}
      {reps.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gold-500" />
            <h3 className="text-white font-semibold text-sm">Monthly Pieces — Ranking</h3>
          </div>
          <div className="space-y-2.5">
            {reps.map((r, i) => {
              const max = reps[0].profile.monthly_pieces || 1;
              const pct = Math.round((r.profile.monthly_pieces / max) * 100);
              const colors = ['#FFD700', '#C0C0C0', '#cd7f32'];
              const barColor = colors[i] || '#3b82f6';
              return (
                <div key={r.profile.id} className="flex items-center gap-3">
                  <span className="text-white/30 text-xs w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-white/70 text-sm w-28 truncate flex-shrink-0">{r.profile.full_name}</span>
                  <div className="flex-1 h-2 bg-surface-50 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.05 + 0.3, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}60` }} />
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: barColor }}>
                    {r.profile.monthly_pieces}p
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Per-rep cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-gold-500" />
          <h2 className="text-white font-semibold">Sales Reps</h2>
          <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full">{reps.length}</span>
        </div>
        <div className="space-y-3">
          {reps.map((rep) => <RepCard key={rep.profile.id} rep={rep} />)}
          {reps.length === 0 && (
            <div className="glass-card p-8 text-center text-white/30 text-sm">No sales reps found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
