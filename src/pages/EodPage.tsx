import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, CheckCircle, Phone, MessageSquare, Users, Package, FileText, RefreshCw, Calendar, Clock, History } from 'lucide-react';
import { supabase, EodReport } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_FORM = {
  rings_prev: 0,
  rings_new: 0,
  accepted_calls: 0,
  positive_chats: 0,
  billed_clients: 0,
  total_pieces: 0,
  daily_notes: '',
};

interface FieldConfig {
  key: keyof typeof EMPTY_FORM;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const FIELDS: FieldConfig[] = [
  { key: 'rings_prev',      label: 'Previous Rings',  icon: <Phone className="w-4 h-4" />,          color: '#3b82f6' },
  { key: 'rings_new',       label: 'New Rings',        icon: <Phone className="w-4 h-4" />,          color: '#10B981' },
  { key: 'accepted_calls',  label: 'Accepted Calls',   icon: <Phone className="w-4 h-4" />,          color: '#f59e0b' },
  { key: 'positive_chats',  label: 'Positive Chats',   icon: <MessageSquare className="w-4 h-4" />, color: '#8b5cf6' },
  { key: 'billed_clients',  label: 'Billed Clients',   icon: <Users className="w-4 h-4" />,          color: '#f97316' },
  { key: 'total_pieces',    label: 'Total Pieces',     icon: <Package className="w-4 h-4" />,        color: '#FFD700' },
];

type EodTab = 'submit' | 'history';

export default function EodPage() {
  const { profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<EodTab>('submit');
  const [form, setForm] = useState(EMPTY_FORM);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [todayReport, setTodayReport] = useState<EodReport | null>(null);
  const [history, setHistory] = useState<EodReport[]>([]);
  const today = new Date().toISOString().split('T')[0];

  async function loadReportForDate(date: string) {
    if (!profile) return;
    const { data: report } = await supabase
      .from('eod_reports')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', date)
      .maybeSingle();

    if (report) {
      setTodayReport(report as EodReport);
      setForm({
        rings_prev:     report.rings_prev,
        rings_new:      report.rings_new,
        accepted_calls: report.accepted_calls,
        positive_chats: report.positive_chats,
        billed_clients: report.billed_clients,
        total_pieces:   report.total_pieces,
        daily_notes:    report.daily_notes,
      });
      setSubmitted(true);
    } else {
      setTodayReport(null);
      setForm(EMPTY_FORM);
      setSubmitted(false);
    }
  }

  async function loadHistory() {
    if (!profile) return;
    const { data: hist } = await supabase
      .from('eod_reports')
      .select('*')
      .eq('user_id', profile.id)
      .order('date', { ascending: false })
      .limit(30);
    if (hist) setHistory(hist as EodReport[]);
  }

  useEffect(() => {
    if (!profile) return;
    loadReportForDate(reportDate);
  }, [profile, reportDate]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, profile]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const payload = {
      user_id: profile.id,
      date: reportDate,
      ...form,
      total_pieces:   Number(form.total_pieces),
      rings_prev:     Number(form.rings_prev),
      rings_new:      Number(form.rings_new),
      accepted_calls: Number(form.accepted_calls),
      positive_chats: Number(form.positive_chats),
      billed_clients: Number(form.billed_clients),
      submitted_at: new Date().toISOString(),
    };

    if (todayReport) {
      await supabase.from('eod_reports').update(payload).eq('id', todayReport.id);
    } else {
      await supabase.from('eod_reports').insert(payload);

      if (reportDate === today) {
        const isSunday = new Date().getDay() === 0;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];

        let newStreak = 1;
        if (profile.last_eod_date === yStr || isSunday) {
          if (!isSunday && Number(form.total_pieces) > 0) newStreak = profile.current_streak + 1;
          else if (isSunday && Number(form.total_pieces) === 0) newStreak = profile.current_streak;
        }

        const sundayGlow = isSunday && Number(form.total_pieces) > 0;

        await supabase.from('profiles').update({
          current_streak:   Number(form.total_pieces) > 0 ? Math.max(newStreak, 1) : (isSunday ? profile.current_streak : 0),
          last_eod_date:    today,
          sunday_super_streak: sundayGlow,
          monthly_pieces:  (profile.monthly_pieces || 0) + Number(form.total_pieces),
          lifetime_pieces: (profile.lifetime_pieces || 0) + Number(form.total_pieces),
        }).eq('id', profile.id);

        await refreshProfile();
      }
    }

    setSubmitted(true);
    setSaving(false);

    const { data } = await supabase.from('eod_reports').select('*').eq('user_id', profile.id).eq('date', reportDate).maybeSingle();
    if (data) setTodayReport(data as EodReport);
  }

  const target = profile?.manager_daily_target ?? 0;
  const isBackdated = reportDate !== today;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">End-of-Day Report</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Tab switcher */}
        <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
          <button onClick={() => setTab('submit')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'submit' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
            <Send className="w-3.5 h-3.5" /> Submit
          </button>
          <button onClick={() => setTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === 'history' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'submit' && (
          <motion.div key="submit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* Report Date picker */}
            <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-48">
                <Calendar className="w-4 h-4 text-gold-500 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-xs text-white/50 mb-1 uppercase tracking-wider font-medium">Report Date</div>
                  <input type="date" value={reportDate} max={today}
                    onChange={e => setReportDate(e.target.value)}
                    className="input-dark w-full text-sm" />
                </div>
              </div>
              {isBackdated && (
                <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  Backdated report — submitting for {new Date(reportDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
              {todayReport?.submitted_at && (
                <div className="text-white/30 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Submitted: {new Date(todayReport.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>

            {submitted && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <div className="text-emerald-400 font-medium">EOD Submitted!</div>
                  <div className="text-emerald-500/60 text-sm">You can update this report any time.</div>
                </div>
                <button onClick={() => setSubmitted(false)}
                  className="ml-auto p-1.5 rounded-lg text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="glass-card p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-gold-500" /> Daily Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {FIELDS.map(field => (
                    <div key={field.key} className={field.key === 'total_pieces' ? 'col-span-2' : ''}>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                        <span style={{ color: field.color }}>{field.icon}</span>
                        {field.label}
                        {field.key === 'total_pieces' && target > 0 && (
                          <span className="text-white/20 font-normal normal-case ml-1">(target: {target})</span>
                        )}
                      </label>
                      <input type="number" min="0"
                        value={form[field.key] as number}
                        onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                        className="input-dark w-full"
                        style={{ caretColor: field.color }}
                        placeholder={field.key === 'total_pieces' && target > 0 ? String(target) : '0'}
                      />
                      {field.key === 'total_pieces' && Number(form.total_pieces) > 0 && (
                        <div className="mt-1 text-xs text-emerald-500">
                          Commission: ₹{(Number(form.total_pieces) * 8).toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-3 uppercase tracking-wider">
                  <FileText className="w-3.5 h-3.5 text-gold-500" /> Daily Notes
                </label>
                <textarea rows={4} value={form.daily_notes}
                  onChange={e => setForm({ ...form, daily_notes: e.target.value })}
                  placeholder="Any highlights, blockers, or observations from today..."
                  className="input-dark w-full resize-none" />
              </div>

              <button type="submit" disabled={saving}
                className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 text-base">
                {saving
                  ? <div className="w-5 h-5 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" />
                  : <><Send className="w-5 h-5" />{submitted ? 'Update EOD Report' : 'Submit EOD Report'}</>}
              </button>
            </form>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center gap-2">
                <History className="w-4 h-4 text-gold-500" />
                <span className="text-white font-semibold text-sm">Report History</span>
                <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full ml-1">{history.length}</span>
              </div>
              {history.length === 0 ? (
                <div className="p-12 text-center text-white/30 text-sm">No reports submitted yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map(r => {
                    const statusColors = { pending: '#f59e0b', verified: '#10b981', rejected: '#ef4444' };
                    const statusColor = statusColors[r.status as keyof typeof statusColors] || '#6b7280';
                    const isBackdatedReport = r.submitted_at && r.date < r.submitted_at.split('T')[0];
                    return (
                      <div key={r.id} className="p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="text-white font-medium text-sm">
                                {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                                {r.status}
                              </span>
                              {isBackdatedReport && (
                                <span className="text-xs text-amber-400/70 bg-amber-500/10 px-2 py-0.5 rounded-full">backdated</span>
                              )}
                            </div>
                            {r.submitted_at && (
                              <div className="text-white/25 text-xs mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                Submitted: {new Date(r.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-gold-500 font-bold text-sm">{r.total_pieces}p</div>
                            <div className="text-emerald-400 text-xs">₹{(r.total_pieces * 8).toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="text-white/30 text-xs">Calls: {r.accepted_calls}</span>
                          <span className="text-white/30 text-xs">Billed: {r.billed_clients}</span>
                          <span className="text-white/30 text-xs">Chats: {r.positive_chats}</span>
                          {r.rejection_reason && (
                            <span className="text-red-400/70 text-xs">Rejected: {r.rejection_reason}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
