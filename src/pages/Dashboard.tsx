
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, TrendingUp, Target, Award, Users, ChevronRight, Zap,
  Clock, CheckCircle, XCircle, Timer, Megaphone, BarChart3, Calendar,
  Cake, CheckSquare, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLevels } from '../contexts/LevelsContext';
import { supabase, Lead, EodReport, ReviewSchedule, ClosingNewsFeed } from '../lib/supabase';
import AdminDashboard from './AdminDashboard';

function StatCard({ label, value, icon, color, suffix = '' }: {
  label: string; value: number | string; icon: React.ReactNode; color: string; suffix?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}{suffix}</div>
      <div className="text-white/40 text-sm mt-0.5">{label}</div>
      <div className="absolute bottom-0 right-0 w-20 h-20 rounded-tl-full opacity-5" style={{ backgroundColor: color }} />
    </motion.div>
  );
}

interface Notification {
  id: string;
  type: 'verified' | 'rejected';
  pieces?: number;
  reason?: string;
  ts: number;
}

function getNextOccurrence(schedule: ReviewSchedule): Date {
  const now = new Date();
  // Work in IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60000;
  const result = new Date(now);

  if (schedule.review_type === 'weekly_standup' && schedule.day_of_week != null) {
    const targetDay = schedule.day_of_week;
    const currentDay = now.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0) {
      // Check if we've already passed today's time
      const todayTarget = new Date(now);
      todayTarget.setUTCHours(schedule.hour_utc, schedule.minute_utc, 0, 0);
      if (now >= todayTarget) daysUntil = 7;
    }
    result.setDate(now.getDate() + daysUntil);
    result.setUTCHours(schedule.hour_utc, schedule.minute_utc, 0, 0);
  } else if (schedule.review_type === 'monthly_review' && schedule.day_of_month != null) {
    const target = new Date(now);
    target.setDate(schedule.day_of_month);
    target.setUTCHours(schedule.hour_utc, schedule.minute_utc, 0, 0);
    if (now >= target) {
      target.setMonth(target.getMonth() + 1);
      target.setDate(schedule.day_of_month);
    }
    return target;
  }
  return result;
}

function Countdown({ target, label, icon }: { target: Date; label: string; icon: React.ReactNode }) {
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
    <div className="flex-1 p-3 rounded-xl bg-surface-50/40 border border-white/5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-gold-500">{icon}</div>
        <span className="text-white/60 text-xs font-medium truncate">{label}</span>
      </div>
      <div className="font-mono text-base font-bold text-gold-500">
        {d > 0 ? `${d}d ` : ''}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile, refreshProfile } = useAuth();
  const { getLevel } = useLevels();
  const [todayLeads, setTodayLeads] = useState<Lead[]>([]);
  const [followUpCount, setFollowUpCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingReports, setPendingReports] = useState<EodReport[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reviewSchedules, setReviewSchedules] = useState<ReviewSchedule[]>([]);
  const [newsFeed, setNewsFeed] = useState<ClosingNewsFeed[]>([]);
  const [conversionRate, setConversionRate] = useState<number | null>(null);
  const [mySlices, setMySlices] = useState(0);
  const [totalSlices, setTotalSlices] = useState(0);
  const [cakeLeaders, setCakeLeaders] = useState<{ name: string; slices: number }[]>([]);
  const [weeklyTasksDone, setWeeklyTasksDone] = useState<boolean | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!profile) return;

    const [
      { data: leads },
      { count: fu },
      { count: pend },
      { data: schedules },
    ] = await Promise.all([
      supabase.from('leads').select('*').eq('assigned_to', profile.id)
        .order('updated_at', { ascending: false }).limit(5),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile.id).eq('status', 'follow_up'),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile.id).in('status', ['pending_payment', 'cod_lead']),
      supabase.from('review_schedules').select('*'),
    ]);

    if (leads) setTodayLeads(leads as Lead[]);
    setFollowUpCount(fu ?? 0);
    setPendingCount(pend ?? 0);
    if (schedules) setReviewSchedules(schedules as ReviewSchedule[]);

    if (profile.role === 'sales_executive') {
      const { data: pendingEod } = await supabase
        .from('eod_reports').select('*')
        .eq('user_id', profile.id).eq('status', 'pending')
        .order('date', { ascending: false });
      if (pendingEod) setPendingReports(pendingEod as EodReport[]);

      // Conversion rate from verified EODs
      const { data: verifiedReports } = await supabase
        .from('eod_reports').select('closed_deals, new_leads_contacted')
        .eq('user_id', profile.id).eq('status', 'verified');
      if (verifiedReports && verifiedReports.length > 0) {
        const totalClosed = verifiedReports.reduce((s: number, r: any) => s + (r.closed_deals || 0), 0);
        const totalContacted = verifiedReports.reduce((s: number, r: any) => s + (r.new_leads_contacted || 0), 0);
        if (totalContacted > 0) setConversionRate(Math.round((totalClosed / totalContacted) * 100 * 10) / 10);
      }

      // Late cake slices
      const cycleId = new Date().toISOString().slice(0, 7);
      const { data: allSlices } = await supabase
        .from('late_cake_slices')
        .select('*, profile:profiles(full_name)')
        .eq('cycle_id', cycleId);
      if (allSlices) {
        const total = allSlices.reduce((s: number, r: any) => s + r.slices, 0);
        setTotalSlices(total);
        const mine = allSlices.find((s: any) => s.user_id === profile.id);
        setMySlices(mine?.slices || 0);
        const leaders = allSlices
          .filter((s: any) => s.slices > 0)
          .sort((a: any, b: any) => b.slices - a.slices)
          .slice(0, 5)
          .map((s: any) => ({ name: s.profile?.full_name || 'Unknown', slices: s.slices }));
        setCakeLeaders(leaders);
      }

      // Weekly tasks ring: tasks assigned to me due this week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const { data: weeklyTasks } = await supabase
        .from('tasks')
        .select('status')
        .eq('assigned_to', profile.id)
        .gte('due_date', startOfWeek.toISOString().split('T')[0])
        .lte('due_date', endOfWeek.toISOString().split('T')[0]);

      if (weeklyTasks && weeklyTasks.length > 0) {
        const allDone = weeklyTasks.every((t: any) => t.status === 'done');
        setWeeklyTasksDone(allDone);
      } else {
        setWeeklyTasksDone(null);
      }
    }
  }, [profile]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Closing news feed
  useEffect(() => {
    async function loadFeed() {
      const { data } = await supabase
        .from('closing_news_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNewsFeed(data as ClosingNewsFeed[]);
    }
    loadFeed();

    const ch = supabase.channel('news-feed-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'closing_news_feed' }, () => loadFeed())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Real-time broadcast for verify/reject notifications
  useEffect(() => {
    if (!profile || profile.role !== 'sales_executive') return;
    const channel = supabase
      .channel(`user-${profile.id}`)
      .on('broadcast', { event: 'report_verified' }, ({ payload }) => {
        setNotifications(prev => [{ id: payload.reportId, type: 'verified', pieces: payload.pieces, ts: Date.now() }, ...prev.slice(0, 3)]);
        refreshProfile();
        setPendingReports(prev => prev.filter(r => r.id !== payload.reportId));
      })
      .on('broadcast', { event: 'report_rejected' }, ({ payload }) => {
        setNotifications(prev => [{ id: payload.reportId, type: 'rejected', reason: payload.reason, ts: Date.now() }, ...prev.slice(0, 3)]);
        setPendingReports(prev => prev.filter(r => r.id !== payload.reportId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, refreshProfile]);

  if (!profile) return null;

  if (profile.role === 'admin' || profile.role === 'manager') {
    return <AdminDashboard />;
  }

  if (profile.role === 'hr') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="glass-card p-8 text-center space-y-3">
          <div className="text-white font-bold text-xl">Welcome, {profile.full_name?.split(' ')[0]}</div>
          <p className="text-white/50 text-sm">Use the HR Portal to manage verifications, attendance, leave requests, and the late cake tracker.</p>
          <a href="/hr" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25 transition-all font-medium text-sm mt-2">
            Open HR Portal
          </a>
        </div>
      </div>
    );
  }

  const levelInfo = getLevel(profile.lifetime_pieces);
  const commission = profile.monthly_pieces * 8;
  const pendingPieces = pendingReports.reduce((s, r) => s + (r.pieces_sold || r.total_pieces), 0);
  const pendingCommission = pendingPieces * 8;
  const isSunday = new Date().getDay() === 0;

  const weeklySchedule = reviewSchedules.find(s => s.review_type === 'weekly_standup');
  const monthlySchedule = reviewSchedules.find(s => s.review_type === 'monthly_review');

  const statusColors: Record<string, string> = {
    new_lead: '#3b82f6', follow_up: '#f59e0b', dead_lead: '#6b7280',
    bill_declined: '#ef4444', pending_payment: '#f97316', cod_lead: '#8b5cf6', closed_lead: '#10b981',
  };
  const statusLabels: Record<string, string> = {
    new_lead: 'New Lead', follow_up: 'Follow-up', dead_lead: 'Dead Lead',
    bill_declined: 'Bill Declined', pending_payment: 'Pending Payment', cod_lead: 'COD Lead', closed_lead: 'Closed',
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Live notifications */}
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div key={`${n.id}-${n.ts}`}
            initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }} transition={{ duration: 0.3 }}
            className={`rounded-xl p-4 flex items-center gap-3 border ${n.type === 'verified' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {n.type === 'verified' ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
            <div className="flex-1">
              {n.type === 'verified' ? (
                <>
                  <div className="text-emerald-400 font-semibold text-sm">Report Verified!</div>
                  <div className="text-emerald-400/70 text-xs">{n.pieces}p confirmed — ₹{((n.pieces || 0) * 8).toLocaleString('en-IN')} added to your commission.</div>
                </>
              ) : (
                <>
                  <div className="text-red-400 font-semibold text-sm">Report Rejected — Please Resubmit</div>
                  {n.reason && <div className="text-red-400/70 text-xs">{n.reason}</div>}
                </>
              )}
            </div>
            <button onClick={() => setNotifications(prev => prev.filter(x => !(x.id === n.id && x.ts === n.ts)))}
              className="text-white/20 hover:text-white/50 transition-colors text-lg leading-none">×</button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-bold text-white">
            Welcome back, <span className="text-gold-500">{profile.full_name?.split(' ')[0] || 'Champ'}</span>
          </motion.h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {isSunday && <span className="ml-2 text-gold-500 font-medium">Super Sunday</span>}
          </p>
        </div>
        <div className="text-right space-y-1">
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider">This Cycle</div>
            <div className="text-xl font-bold text-emerald-500">₹{commission.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider">Lifetime</div>
            <div className="text-base font-semibold text-emerald-400/70">₹{(profile.lifetime_pieces * 8).toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Countdown timers */}
      {(weeklySchedule || monthlySchedule) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
          {weeklySchedule && (
            <Countdown
              target={getNextOccurrence(weeklySchedule)}
              label={weeklySchedule.label || 'Weekly Stand-Up'}
              icon={<Timer className="w-4 h-4" />}
            />
          )}
          {monthlySchedule && (
            <Countdown
              target={getNextOccurrence(monthlySchedule)}
              label={monthlySchedule.label || 'Monthly Review'}
              icon={<Calendar className="w-4 h-4" />}
            />
          )}
        </motion.div>
      )}

      {/* Pending Approval Banner */}
      {pendingReports.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border border-amber-500/20" style={{ background: 'rgba(245,158,11,0.05)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-amber-400 font-semibold text-sm">Pending Approval</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">
                  {pendingReports.length} report{pendingReports.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-white/50 text-xs mt-0.5">
                <span className="text-gold-500 font-semibold">{pendingPieces}p</span> awaiting verification —{' '}
                <span className="text-amber-400 font-medium">₹{pendingCommission.toLocaleString('en-IN')} commission pending</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              {pendingReports.slice(0, 2).map(r => (
                <div key={r.id} className="text-xs text-white/30">
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} — {r.pieces_sold || r.total_pieces}p
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* GOAT Level Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-card p-6 relative overflow-hidden"
        style={{ border: `1px solid ${levelInfo.current.color}30`, boxShadow: `0 0 30px ${levelInfo.current.color}10` }}>
        <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(ellipse at top right, ${levelInfo.current.color}, transparent 70%)` }} />
        <div className="relative flex items-start gap-4">
          <div className="text-4xl">{levelInfo.current.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="text-xl font-bold" style={{ color: levelInfo.current.color }}>{levelInfo.current.name}</div>
              <div className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: levelInfo.current.bgColor, color: levelInfo.current.color }}>
                Level {['Rookie','Novice','Apprentice','Performer','Pro','Specialist','Expert','Veteran','Elite','Master','Champion','Grandmaster','Legend','Mythic','Immortal','GOAT'].indexOf(levelInfo.current.name) + 1}
              </div>
            </div>
            <div className="mb-2">
              <div className="h-3 bg-surface-50 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${levelInfo.progress}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full relative"
                  style={{ background: `linear-gradient(90deg, ${levelInfo.current.color}80, ${levelInfo.current.color})`, boxShadow: `0 0 10px ${levelInfo.current.color}60` }}>
                  <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)' }} />
                </motion.div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              {levelInfo.next ? (
                <span className="text-white/50">
                  <span className="text-white font-medium">{levelInfo.piecesLeft.toLocaleString()}</span> pieces to{' '}
                  <span style={{ color: levelInfo.next.color }}>{levelInfo.next.icon} {levelInfo.next.name}</span>
                </span>
              ) : (
                <span className="text-gold-500 font-medium">You are the GOAT. Maximum level reached.</span>
              )}
              <span className="text-white/30 text-xs">{profile.lifetime_pieces.toLocaleString()} verified pieces</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Cycle Pieces" value={profile.monthly_pieces} icon={<TrendingUp className="w-5 h-5" />} color="#FFD700" />
        <StatCard label="Lifetime Pieces" value={profile.lifetime_pieces.toLocaleString()} icon={<Award className="w-5 h-5" />} color="#10B981" />
        <StatCard label="Day Streak" value={profile.current_streak} icon={<Flame className="w-5 h-5" />} color={profile.streak_frozen ? '#3b82f6' : '#f97316'} suffix={profile.streak_frozen ? ' (frozen)' : ' days'} />
        {conversionRate !== null ? (
          <StatCard label="Conversion Rate" value={conversionRate} icon={<BarChart3 className="w-5 h-5" />} color="#10b981" suffix="%" />
        ) : (
          <StatCard label="Follow-Ups" value={followUpCount} icon={<Users className="w-5 h-5" />} color="#3b82f6" />
        )}
      </div>

      {/* Weekly Task Performance Ring */}
      {weeklyTasksDone !== null && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className={`glass-card p-4 flex items-center gap-4 border ${weeklyTasksDone ? 'border-emerald-500/30' : 'border-red-500/30'}`}
          style={{ background: weeklyTasksDone ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)' }}>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${weeklyTasksDone ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-500 bg-red-500/10'}`}
            style={{ boxShadow: weeklyTasksDone ? '0 0 16px rgba(16,185,129,0.4)' : '0 0 16px rgba(239,68,68,0.4)' }}>
            {weeklyTasksDone
              ? <CheckSquare className="w-6 h-6 text-emerald-400" />
              : <AlertTriangle className="w-6 h-6 text-red-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`font-bold text-sm ${weeklyTasksDone ? 'text-emerald-400' : 'text-red-400'}`}>
              {weeklyTasksDone ? 'Weekly task completed — very good, congratulations!' : 'Weekly Task Pending'}
            </div>
            <div className="text-white/40 text-xs mt-0.5">
              {weeklyTasksDone ? 'All tasks for this week are done.' : 'You have tasks due this week that need attention.'}
            </div>
          </div>
          <a href="/tasks" className={`text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0 transition-all ${weeklyTasksDone ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25' : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'}`}>
            View Tasks
          </a>
        </motion.div>
      )}

      {/* Late Cake Wall */}
      {(totalSlices > 0 || mySlices > 0) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Cake className="w-4 h-4 text-gold-500" /> Late Cake Board
            <span className="ml-1 text-white/30 text-xs font-normal">Company accountability — {new Date().toISOString().slice(0, 7)}</span>
          </h3>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/40">Company total:</span>
              <span className="text-gold-500 font-bold">{totalSlices} slices</span>
              <span className="text-white/20">·</span>
              <span className="text-amber-400 font-medium">{Math.floor(totalSlices / 10)} cake{Math.floor(totalSlices / 10) !== 1 ? 's' : ''}</span>
            </div>
            {mySlices > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white/40">Your slices:</span>
                <span className="text-red-400 font-bold">{mySlices}</span>
              </div>
            )}
          </div>
          {cakeLeaders.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {cakeLeaders.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-50/30 text-xs">
                  <span className="text-gold-500 font-bold">{i + 1}.</span>
                  <span className="text-white/70">{c.name}</span>
                  <span className="text-amber-400 font-medium">{c.slices}s</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Closing News Feed + Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Closing News Feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-gold-500" /> Closing Feed
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {newsFeed.length === 0 && (
              <p className="text-white/30 text-sm text-center py-4">No closings yet — be the first!</p>
            )}
            {newsFeed.map(item => (
              <motion.div key={item.id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <span className="text-lg flex-shrink-0">🎉</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    <span className="text-gold-500">{item.staff_name}</span> just closed a deal{item.pieces_count > 0 ? ` — ${item.pieces_count} pieces!` : '!'}
                  </div>
                  {item.lead_title && <div className="text-white/30 text-xs truncate">{item.lead_title}</div>}
                </div>
                <div className="text-white/20 text-xs flex-shrink-0">
                  {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-gold-500" /> Recent Leads
          </h3>
          <div className="space-y-2">
            {todayLeads.length === 0 && <p className="text-white/30 text-sm text-center py-4">No leads yet. Add your first lead!</p>}
            {todayLeads.map(lead => (
              <div key={lead.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-50/50 transition-colors">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: statusColors[lead.status] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{lead.contact_name || lead.title}</div>
                  <div className="text-white/40 text-xs">{statusLabels[lead.status]}</div>
                </div>
                {lead.pieces_count > 0 && <div className="text-gold-500 text-xs font-bold">{lead.pieces_count}p</div>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass-card p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-gold-500" /> Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Lead', href: '/leads', color: '#3b82f6' },
            { label: 'Submit EOD', href: '/eod', color: '#FFD700' },
            { label: 'View Tasks', href: '/tasks', color: '#10B981' },
            { label: 'Leaderboard', href: '/leaderboard', color: '#f97316' },
            { label: 'My Profile', href: '/profile', color: '#ec4899' },
          ].map(a => (
            <a key={a.label} href={a.href}
              className="p-3 rounded-xl border border-white/5 hover:border-white/10 bg-surface-50/30 hover:bg-surface-50/50 transition-all group flex items-center justify-between">
              <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">{a.label}</span>
              <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
            </a>
          ))}
        </div>
      </motion.div>

      {/* Manager target banner */}
      {profile.manager_daily_target > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="glass-card p-4 flex items-center gap-4" style={{ border: '1px solid rgba(255,215,0,0.2)' }}>
          <Target className="w-5 h-5 text-gold-500 flex-shrink-0" />
          <div className="flex-1">
            <span className="text-white/70 text-sm">Target: </span>
            <span className="text-gold-500 font-bold">{profile.manager_daily_target} pieces</span>
          </div>
          <div className="text-white/30 text-xs">
            {profile.monthly_pieces >= profile.manager_daily_target
              ? <span className="text-emerald-500 font-medium">Target reached!</span>
              : `${profile.manager_daily_target - profile.monthly_pieces} more needed`}
          </div>
        </motion.div>
      )}
    </div>
  );
}
