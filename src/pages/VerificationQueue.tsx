import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Zap, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase, Profile, EodReport } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface QueueItem extends EodReport { profile: Profile }

export default function VerificationQueue() {
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
    const ch = supabase.channel('verify-queue-page')
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
    if (!me || queue.length === 0) return;
    for (const item of queue) {
      await handleVerify(item.id, item.user_id, item.pieces_sold);
    }
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#FFD700', '#10B981', '#f97316'] });
    confetti({ particleCount: 200, spread: 100, origin: { x: 0.1, y: 0.6 }, colors: ['#3b82f6', '#FFD700'] });
    confetti({ particleCount: 200, spread: 100, origin: { x: 0.9, y: 0.6 }, colors: ['#10B981', '#f97316'] });
  }

  const totalPending = queue.length;
  const piecesPending = queue.reduce((s, r) => s + r.pieces_sold, 0);
  const commissionPending = piecesPending * 8;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Verification Queue</h1>
        <p className="text-white/40 text-sm mt-1">Review and verify EOD reports before pieces count toward rankings.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Pending Reports', value: totalPending, color: 'text-amber-400' },
          { label: 'Pieces Pending', value: piecesPending, color: 'text-blue-400' },
          { label: 'Commission Pending', value: `₹${commissionPending.toLocaleString()}`, color: 'text-emerald-400' },
          { label: 'Verified Today', value: verifiedToday, color: 'text-gold-500' },
        ].map(card => (
          <div key={card.label} className="bg-surface-100 border border-white/5 rounded-xl p-4">
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-white/40 text-xs mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {queue.length > 1 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={verifyAll}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Verify All ({queue.length})
          </button>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="bg-surface-100 border border-white/5 rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
          <div className="text-white/40">No pending reports</div>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-surface-100 border border-white/5 rounded-xl overflow-hidden"
            >
              <div className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-gold-500 font-bold text-sm">
                    {item.profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">{item.profile?.full_name || 'Unknown'}</div>
                  <div className="text-white/40 text-xs">{item.date}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-white font-semibold">{item.pieces_sold} pcs</div>
                  <div className="text-emerald-400 text-xs">₹{(item.pieces_sold * 8).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleVerify(item.id, item.user_id, item.pieces_sold)}
                    disabled={verifying === item.id}
                    className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRejectModal({ id: item.id, userId: item.user_id })}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    {expanded === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {expanded === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                      {[
                        ['Product', item.product_category],
                        ['Call Type', item.call_type],
                        ['Lead Source', item.lead_source],
                        ['Revenue', item.revenue ? `₹${Number(item.revenue).toLocaleString()}` : '—'],
                        ['Notes', item.notes || '—'],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div className="text-white/30 text-xs mb-0.5">{k}</div>
                          <div className="text-white/70 capitalize">{v}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-surface-200 border border-white/10 rounded-2xl p-6 w-full max-w-md"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <h3 className="text-white font-semibold">Reject Report</h3>
              </div>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason (optional)..."
                className="w-full bg-surface-100 border border-white/10 rounded-xl px-3 py-2 text-white/80 text-sm resize-none h-24 focus:outline-none focus:border-gold-500/40"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setRejectModal(null)}
                  className="flex-1 py-2 rounded-xl text-white/50 hover:text-white/80 hover:bg-white/5 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(rejectModal.id, rejectModal.userId, reason)}
                  className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
