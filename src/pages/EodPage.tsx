import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Phone, MessageSquare, Users, Package, FileText, RefreshCw } from 'lucide-react';
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
  type: 'number' | 'textarea';
}

const FIELDS: FieldConfig[] = [
  { key: 'rings_prev', label: 'Previous Rings', icon: <Phone className="w-4 h-4" />, color: '#3b82f6', type: 'number' },
  { key: 'rings_new', label: 'New Rings', icon: <Phone className="w-4 h-4" />, color: '#10B981', type: 'number' },
  { key: 'accepted_calls', label: 'Accepted Calls', icon: <Phone className="w-4 h-4" />, color: '#f59e0b', type: 'number' },
  { key: 'positive_chats', label: 'Positive Chats', icon: <MessageSquare className="w-4 h-4" />, color: '#8b5cf6', type: 'number' },
  { key: 'billed_clients', label: 'Billed Clients', icon: <Users className="w-4 h-4" />, color: '#f97316', type: 'number' },
  { key: 'total_pieces', label: 'Total Pieces', icon: <Package className="w-4 h-4" />, color: '#FFD700', type: 'number' },
];

export default function EodPage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [todayReport, setTodayReport] = useState<EodReport | null>(null);
  const [history, setHistory] = useState<EodReport[]>([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const { data: report } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('user_id', profile!.id)
        .eq('date', today)
        .maybeSingle();

      if (report) {
        setTodayReport(report as EodReport);
        setForm({
          rings_prev: report.rings_prev,
          rings_new: report.rings_new,
          accepted_calls: report.accepted_calls,
          positive_chats: report.positive_chats,
          billed_clients: report.billed_clients,
          total_pieces: report.total_pieces,
          daily_notes: report.daily_notes,
        });
        setSubmitted(true);
      }

      const { data: hist } = await supabase
        .from('eod_reports')
        .select('*')
        .eq('user_id', profile!.id)
        .neq('date', today)
        .order('date', { ascending: false })
        .limit(7);
      if (hist) setHistory(hist as EodReport[]);
    }
    load();
  }, [profile, today]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const payload = {
      user_id: profile.id,
      date: today,
      ...form,
      total_pieces: Number(form.total_pieces),
      rings_prev: Number(form.rings_prev),
      rings_new: Number(form.rings_new),
      accepted_calls: Number(form.accepted_calls),
      positive_chats: Number(form.positive_chats),
      billed_clients: Number(form.billed_clients),
    };

    if (todayReport) {
      await supabase.from('eod_reports').update(payload).eq('id', todayReport.id);
    } else {
      await supabase.from('eod_reports').insert(payload);

      // Update streak and pieces
      const isSunday = new Date().getDay() === 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (profile.last_eod_date === yStr || isSunday) {
        newStreak = (profile.current_streak || 0) + (Number(form.total_pieces) > 0 && !isSunday ? 1 : 0);
        if (isSunday && Number(form.total_pieces) === 0) newStreak = profile.current_streak;
        if (!isSunday && Number(form.total_pieces) > 0) newStreak = profile.current_streak + 1;
      }

      const sundayGlow = isSunday && Number(form.total_pieces) > 0;

      await supabase.from('profiles').update({
        current_streak: Number(form.total_pieces) > 0 ? Math.max(newStreak, 1) : (isSunday ? profile.current_streak : 0),
        last_eod_date: today,
        sunday_super_streak: sundayGlow,
        monthly_pieces: (profile.monthly_pieces || 0) + Number(form.total_pieces),
        lifetime_pieces: (profile.lifetime_pieces || 0) + Number(form.total_pieces),
      }).eq('id', profile.id);

      await refreshProfile();
    }

    setSubmitted(true);
    setSaving(false);

    const { data } = await supabase
      .from('eod_reports')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', today)
      .maybeSingle();
    if (data) setTodayReport(data as EodReport);
  }

  const target = profile?.manager_daily_target ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">End-of-Day Report</h1>
        <p className="text-white/40 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {submitted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div>
            <div className="text-emerald-400 font-medium">EOD Submitted!</div>
            <div className="text-emerald-500/60 text-sm">You can update it until end of day.</div>
          </div>
          <button
            onClick={() => setSubmitted(false)}
            className="ml-auto p-1.5 rounded-lg text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-gold-500" />
            Daily Metrics
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {FIELDS.map((field) => (
              <div key={field.key} className={field.key === 'total_pieces' ? 'col-span-2' : ''}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                  <span style={{ color: field.color }}>{field.icon}</span>
                  {field.label}
                  {field.key === 'total_pieces' && target > 0 && (
                    <span className="text-white/20 font-normal normal-case ml-1">(target: {target})</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={form[field.key] as number}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="input-dark w-full"
                    style={{
                      caretColor: field.color,
                    }}
                    placeholder={field.key === 'total_pieces' && target > 0 ? String(target) : '0'}
                  />
                  {field.key === 'total_pieces' && target > 0 && (
                    <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                      <span className="text-white/10 text-sm">
                        {form.total_pieces === 0 ? target : ''}
                      </span>
                    </div>
                  )}
                </div>
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
            <FileText className="w-3.5 h-3.5 text-gold-500" />
            Daily Notes
          </label>
          <textarea
            rows={4}
            value={form.daily_notes}
            onChange={(e) => setForm({ ...form, daily_notes: e.target.value })}
            placeholder="Any highlights, blockers, or observations from today..."
            className="input-dark w-full resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-gold w-full py-3.5 flex items-center justify-center gap-2 text-base"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              {submitted ? 'Update EOD Report' : 'Submit EOD Report'}
            </>
          )}
        </button>
      </form>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-white font-semibold mb-4">Recent History</h3>
          <div className="space-y-2">
            {history.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-50/30">
                <div className="text-white/40 text-sm w-24 flex-shrink-0">
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
                <div className="flex items-center gap-4 flex-1 flex-wrap">
                  <span className="text-gold-500 font-bold text-sm">{r.total_pieces}p</span>
                  <span className="text-white/40 text-xs">Calls: {r.accepted_calls}</span>
                  <span className="text-white/40 text-xs">Billed: {r.billed_clients}</span>
                </div>
                <div className="text-emerald-500 text-xs font-medium">
                  ₹{(r.total_pieces * 8).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
