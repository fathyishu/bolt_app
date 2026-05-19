import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Plus, Search, Filter, Phone, Mail, Calendar, Clock, X, ChevronDown, CreditCard as Edit3, Trash2, DollarSign } from 'lucide-react';
import { supabase, Lead, LeadStatus } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new_lead: { label: 'New Lead', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)' },
  follow_up: { label: 'Follow-Up', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  dead_lead: { label: 'Dead Lead', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  bill_declined: { label: 'Bill Declined', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
  pending_payment: { label: 'Pending Payment', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' },
  cod_lead: { label: 'COD Lead', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)' },
  closed_lead: { label: 'Closed', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
};

function getDaysLabel(dateStr: string | null): { text: string; color: string } | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: '#ef4444' };
  if (diff === 0) return { text: 'Due today', color: '#f97316' };
  if (diff <= 3) return { text: `Due in ${diff}d`, color: '#f59e0b' };
  return { text: `Due in ${diff}d`, color: '#3b82f6' };
}

function getBorderColor(lead: Lead): string {
  if (!['pending_payment', 'cod_lead'].includes(lead.status)) return 'rgba(255,255,255,0.06)';
  const label = getDaysLabel(lead.next_payment_date);
  if (!label) return 'rgba(255,255,255,0.06)';
  return `${label.color}50`;
}

const EMPTY_FORM = {
  title: '',
  contact_name: '',
  phone: '',
  email: '',
  status: 'new_lead' as LeadStatus,
  pieces_count: 0,
  next_payment_date: '',
  notes: '',
};

export default function LeadsPage() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('leads').select('*').order('updated_at', { ascending: false });
    if (!isAdmin) q = q.eq('assigned_to', profile?.id ?? '');
    const { data } = await q;
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, [profile, isAdmin]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  function openCreate() {
    setEditLead(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setForm({
      title: lead.title,
      contact_name: lead.contact_name,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      pieces_count: lead.pieces_count,
      next_payment_date: lead.next_payment_date ?? '',
      notes: lead.notes,
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const prevStatus = editLead?.status;
    const payload = {
      ...form,
      pieces_count: Number(form.pieces_count),
      assigned_to: editLead?.assigned_to ?? profile.id,
      next_payment_date: form.next_payment_date || null,
      updated_at: new Date().toISOString(),
    };

    if (editLead) {
      await supabase.from('leads').update(payload).eq('id', editLead.id);

      // Update pieces on profile if status changed to closed
      if (prevStatus !== 'closed_lead' && form.status === 'closed_lead') {
        const diff = form.pieces_count;
        await supabase.from('profiles').update({
          monthly_pieces: (profile.monthly_pieces || 0) + diff,
          lifetime_pieces: (profile.lifetime_pieces || 0) + diff,
        }).eq('id', profile.id);

        // Broadcast to closing news feed (display only — no impact on verified metrics)
        await supabase.from('closing_news_feed').insert({
          user_id: profile.id,
          staff_name: profile.full_name || 'Someone',
          lead_title: form.contact_name || form.title || 'a lead',
        });

        // Confetti!
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#10B981', '#ffffff', '#f97316'],
        });
      }
    } else {
      await supabase.from('leads').insert({
        ...payload,
        assigned_to: profile.id,
        last_follow_up: new Date().toISOString(),
      });
    }

    await fetchLeads();
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lead?')) return;
    await supabase.from('leads').delete().eq('id', id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  const filtered = leads.filter((l) => {
    const matchSearch = !search ||
      l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const commission = leads
    .filter((l) => l.status === 'closed_lead')
    .reduce((sum, l) => sum + l.pieces_count * 8, 0);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {filtered.length} leads — Commission:{' '}
            <span className="text-emerald-500 font-semibold">₹{commission.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <button onClick={openCreate} className="btn-gold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Lead
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="input-dark w-full pl-9"
          />
        </div>
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'all')}
            className="input-dark pr-8 appearance-none cursor-pointer"
          >
            <option value="all">All Status</option>
            {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([s, cfg]) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`p-2.5 rounded-xl text-center transition-all border ${
                filterStatus === s ? 'scale-95' : 'hover:scale-95'
              }`}
              style={{
                backgroundColor: filterStatus === s ? cfg.bg : 'rgba(255,255,255,0.03)',
                borderColor: filterStatus === s ? cfg.border : 'rgba(255,255,255,0.06)',
              }}
            >
              <div className="text-lg font-bold" style={{ color: cfg.color }}>{count}</div>
              <div className="text-xs text-white/40 leading-tight mt-0.5">{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((lead) => {
              const cfg = STATUS_CONFIG[lead.status];
              const countdown = getDaysLabel(lead.next_payment_date);
              const borderColor = getBorderColor(lead);

              return (
                <motion.div
                  key={lead.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card p-4 cursor-pointer hover:bg-surface-100/50 transition-all"
                  style={{ borderColor }}
                >
                  <div className="flex items-start gap-3">
                    {/* Status dot */}
                    <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-offset-1 ring-offset-surface-200"
                      style={{ backgroundColor: cfg.color, ringColor: `${cfg.color}50` }} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="text-white font-semibold">{lead.contact_name || lead.title}</div>
                          {lead.title && lead.contact_name && (
                            <div className="text-white/40 text-xs">{lead.title}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                            {cfg.label}
                          </span>
                          {lead.pieces_count > 0 && (
                            <span className="text-xs font-bold text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded-full">
                              {lead.pieces_count}p
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                            <Phone className="w-3 h-3" />
                            {lead.phone}
                          </a>
                        )}
                        {lead.email && (
                          <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                            <Mail className="w-3 h-3" />
                            {lead.email}
                          </a>
                        )}
                        {countdown && (
                          <div className="flex items-center gap-1 text-xs font-medium"
                            style={{ color: countdown.color }}>
                            <Clock className="w-3 h-3" />
                            {countdown.text}
                          </div>
                        )}
                        {lead.next_payment_date && (
                          <div className="flex items-center gap-1 text-white/30 text-xs">
                            <Calendar className="w-3 h-3" />
                            {new Date(lead.next_payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="text-white/30 text-xs mt-1.5 truncate">{lead.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => openEdit(lead)}
                        className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(lead.id)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && !loading && (
            <div className="text-center py-16 text-white/30">
              <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No leads found. Add your first lead!</p>
            </div>
          )}
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold text-lg">
                  {editLead ? 'Edit Lead' : 'Add New Lead'}
                </h2>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Contact Name *</label>
                    <input type="text" required value={form.contact_name}
                      onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                      className="input-dark w-full" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Phone</label>
                    <input type="tel" value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="input-dark w-full" placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Email <span className="text-white/20 normal-case font-normal">(optional)</span></label>
                    <input type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="input-dark w-full" placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Lead Title</label>
                    <input type="text" value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="input-dark w-full" placeholder="e.g. Cricket Kit Order" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <select value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                        className="input-dark w-full appearance-none pr-8">
                        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Pieces</label>
                    <input type="number" min="0" value={form.pieces_count}
                      onChange={(e) => setForm({ ...form, pieces_count: Number(e.target.value) })}
                      className="input-dark w-full" />
                    {form.pieces_count > 0 && (
                      <div className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Commission: ₹{(form.pieces_count * 8).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  {['pending_payment', 'cod_lead'].includes(form.status) && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Next Payment Date</label>
                      <input type="date" value={form.next_payment_date}
                        onChange={(e) => setForm({ ...form, next_payment_date: e.target.value })}
                        className="input-dark w-full" />
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Notes</label>
                    <textarea rows={3} value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="input-dark w-full resize-none" placeholder="Any additional notes..." />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="btn-outline-gold flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-gold flex-1 flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" /> : null}
                    {editLead ? 'Update Lead' : 'Save Lead'}
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

