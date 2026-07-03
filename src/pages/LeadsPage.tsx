import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Plus, Search, Filter, Phone, Calendar, Clock, X, ChevronDown, CreditCard as Edit3, Trash2, DollarSign, LayoutList, Columns2 as Columns, AlertCircle, Truck, Package, CreditCard } from 'lucide-react';
import { supabase, Lead, LeadStatus, PaymentType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const KANBAN_COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'new_lead',       label: 'New Lead',       color: '#3b82f6' },
  { status: 'follow_up',      label: 'Follow-Up',      color: '#f59e0b' },
  { status: 'pre_booking',    label: 'Pre-Booking',    color: '#06b6d4' },
  { status: 'cod_lead',       label: 'Pass COD',       color: '#8b5cf6' },
  { status: 'pending_payment',label: 'Pending Payment',color: '#f97316' },
  { status: 'dead_lead',      label: 'Build/Dead Lead',color: '#6b7280' },
  { status: 'closed_lead',    label: 'Closed',         color: '#10b981' },
];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new_lead:        { label: 'New Lead',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  follow_up:       { label: 'Follow-Up',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  pre_booking:     { label: 'Pre-Booking',    color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.3)' },
  dead_lead:       { label: 'Dead Lead',      color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  bill_declined:   { label: 'Bill Declined',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  pending_payment: { label: 'Pending Payment',color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  cod_lead:        { label: 'COD Lead',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)' },
  closed_lead:     { label: 'Closed',         color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)' },
};

function getDaysLabel(dateStr: string | null): { text: string; color: string; overdue: number } | null {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: '#ef4444', overdue: Math.abs(diff) };
  if (diff === 0) return { text: 'Due today', color: '#f97316', overdue: 0 };
  if (diff <= 3) return { text: `Due in ${diff}d`, color: '#f59e0b', overdue: 0 };
  return { text: `Due in ${diff}d`, color: '#3b82f6', overdue: 0 };
}

function getFollowUpUrgency(lead: Lead): 'past_due' | 'today' | 'future' | 'none' {
  if (lead.status !== 'follow_up' || !lead.follow_up_date) return 'none';
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(lead.follow_up_date); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return 'past_due';
  if (diff === 0) return 'today';
  return 'future';
}

function sortLeadsForFollowUp(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const ua = getFollowUpUrgency(a);
    const ub = getFollowUpUrgency(b);
    const order: Record<string, number> = { past_due: 0, today: 1, future: 2, none: 3 };
    if (order[ua] !== order[ub]) return order[ua] - order[ub];
    if (!a.follow_up_date && !b.follow_up_date) return 0;
    if (!a.follow_up_date) return 1;
    if (!b.follow_up_date) return -1;
    return a.follow_up_date.localeCompare(b.follow_up_date);
  });
}

const EMPTY_FORM = {
  title: '',
  contact_name: '',
  phone: '',
  status: 'new_lead' as LeadStatus,
  payment_type: '' as PaymentType | '',
  pieces_count: 0,
  date_of_entry: new Date().toISOString().split('T')[0],
  follow_up_date: '',
  next_payment_date: '',
  date_of_closing: '',
  date_of_dispatch: '',
  date_of_delivery: '',
  notes: '',
};

type ViewMode = 'list' | 'kanban';
type PaymentFilter = 'all' | 'prepaid' | 'cod';

export default function LeadsPage() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const dragLeadId = useRef<string | null>(null);

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

  function openCreate(preStatus?: LeadStatus) {
    setEditLead(null);
    setForm({ ...EMPTY_FORM, status: preStatus ?? 'new_lead', date_of_entry: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setForm({
      title: lead.title,
      contact_name: lead.contact_name,
      phone: lead.phone,
      status: lead.status,
      payment_type: lead.payment_type ?? '',
      pieces_count: lead.pieces_count,
      date_of_entry: lead.date_of_entry ?? new Date().toISOString().split('T')[0],
      follow_up_date: lead.follow_up_date ?? '',
      next_payment_date: lead.next_payment_date ?? '',
      date_of_closing: lead.date_of_closing ?? '',
      date_of_dispatch: lead.date_of_dispatch ?? '',
      date_of_delivery: lead.date_of_delivery ?? '',
      notes: lead.notes,
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const prevStatus = editLead?.status;
    const isCod = form.status === 'cod_lead' || form.payment_type === 'cod';
    const payload: Record<string, unknown> = {
      title: form.title,
      contact_name: form.contact_name,
      phone: form.phone,
      status: form.status,
      payment_type: form.payment_type || null,
      pieces_count: Number(form.pieces_count),
      date_of_entry: form.date_of_entry || null,
      follow_up_date: form.follow_up_date || null,
      next_payment_date: form.next_payment_date || null,
      date_of_closing: form.date_of_closing || null,
      date_of_dispatch: isCod ? (form.date_of_dispatch || null) : null,
      date_of_delivery: isCod ? (form.date_of_delivery || null) : null,
      notes: form.notes,
      assigned_to: editLead?.assigned_to ?? profile.id,
      updated_at: new Date().toISOString(),
    };

    if (editLead) {
      await supabase.from('leads').update(payload).eq('id', editLead.id);

      if (prevStatus !== 'closed_lead' && form.status === 'closed_lead') {
        const diff = form.pieces_count;
        await supabase.from('profiles').update({
          monthly_pieces: (profile.monthly_pieces || 0) + diff,
          lifetime_pieces: (profile.lifetime_pieces || 0) + diff,
        }).eq('id', profile.id);

        await supabase.from('closing_news_feed').insert({
          user_id: profile.id,
          staff_name: profile.full_name || 'Someone',
          lead_title: form.contact_name || form.title || 'a lead',
          pieces_count: diff,
        });

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700','#10B981','#ffffff','#f97316'] });
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
    setLeads(prev => prev.filter(l => l.id !== id));
  }

  async function handleDrop(targetStatus: LeadStatus, leadId: string) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;
    await supabase.from('leads').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: targetStatus } : l));
    setDragOverCol(null);
    dragLeadId.current = null;
  }

  const allFiltered = leads.filter(l => {
    const matchSearch = !search ||
      l.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search);
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchPayment = paymentFilter === 'all' || l.payment_type === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const filtered = filterStatus === 'follow_up'
    ? sortLeadsForFollowUp(allFiltered)
    : allFiltered;

  const commission = leads.filter(l => l.status === 'closed_lead').reduce((sum, l) => sum + l.pieces_count * 8, 0);

  const needsFollowUpDate = form.status === 'follow_up';
  const isCodForm = form.status === 'cod_lead' || form.payment_type === 'cod';
  const needsPaymentDate = ['pending_payment', 'cod_lead'].includes(form.status);

  return (
    <div className="p-6 space-y-5 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Pipeline</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {filtered.length} leads — Commission:{' '}
            <span className="text-emerald-500 font-semibold">₹{commission.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
            <button onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'kanban' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              <Columns className="w-3.5 h-3.5" /> CRM View
            </button>
          </div>
          <button onClick={() => openCreate()} className="btn-gold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads..." className="input-dark w-full pl-9" />
        </div>
        {viewMode === 'list' && (
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as LeadStatus | 'all')}
              className="input-dark pr-8 appearance-none cursor-pointer">
              <option value="all">All Status</option>
              {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          </div>
        )}
        {/* Payment filter */}
        <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
          {(['all', 'prepaid', 'cod'] as const).map(f => (
            <button key={f} onClick={() => setPaymentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${paymentFilter === f ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              {f === 'all' ? 'All' : f === 'prepaid' ? 'Prepaid' : 'COD'}
            </button>
          ))}
        </div>
      </div>

      {/* Status summary (list mode) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {(Object.entries(STATUS_CONFIG) as [LeadStatus, typeof STATUS_CONFIG[LeadStatus]][]).map(([s, cfg]) => {
            const count = leads.filter(l => l.status === s).length;
            return (
              <button key={s} onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className={`p-2 rounded-xl text-center transition-all border ${filterStatus === s ? 'scale-95' : 'hover:scale-95'}`}
                style={{ backgroundColor: filterStatus === s ? cfg.bg : 'rgba(255,255,255,0.03)', borderColor: filterStatus === s ? cfg.border : 'rgba(255,255,255,0.06)' }}>
                <div className="text-lg font-bold" style={{ color: cfg.color }}>{count}</div>
                <div className="text-xs text-white/40 leading-tight mt-0.5">{cfg.label}</div>
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : viewMode === 'list' ? (
        <ListView leads={filtered} isAdmin={isAdmin} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <KanbanView
          leads={filtered}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={handleDelete}
          onAddLead={openCreate}
          dragLeadId={dragLeadId}
          dragOverCol={dragOverCol}
          setDragOverCol={setDragOverCol}
          onDrop={handleDrop}
        />
      )}

      {/* Lead Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold text-lg">{editLead ? 'Edit Lead' : 'Add New Lead'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Contact Name *</label>
                    <input type="text" required value={form.contact_name}
                      onChange={e => setForm({ ...form, contact_name: e.target.value })}
                      className="input-dark w-full" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Phone</label>
                    <input type="tel" value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="input-dark w-full" placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Lead Title</label>
                    <input type="text" value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      className="input-dark w-full" placeholder="e.g. Cricket Kit Order" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Status</label>
                    <div className="relative">
                      <select value={form.status}
                        onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })}
                        className="input-dark w-full appearance-none pr-8">
                        {(Object.keys(STATUS_CONFIG) as LeadStatus[]).map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Payment Type</label>
                    <div className="flex gap-2">
                      {(['prepaid', 'cod'] as const).map(t => (
                        <button key={t} type="button"
                          onClick={() => setForm({ ...form, payment_type: form.payment_type === t ? '' : t })}
                          className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${form.payment_type === t ? (t === 'prepaid' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30') : 'bg-white/5 text-white/40 border-white/10 hover:text-white/60'}`}>
                          {t === 'prepaid' ? 'Prepaid' : 'COD'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Date of Entry</label>
                    <input type="date" value={form.date_of_entry}
                      onChange={e => setForm({ ...form, date_of_entry: e.target.value })}
                      className="input-dark w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Pieces</label>
                    <input type="number" min="0" value={form.pieces_count}
                      onChange={e => setForm({ ...form, pieces_count: Number(e.target.value) })}
                      className="input-dark w-full" />
                    {form.pieces_count > 0 && (
                      <div className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Commission: ₹{(form.pieces_count * 8).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>

                  {/* Follow-up date — mandatory when status is follow_up */}
                  {needsFollowUpDate && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                        Follow-Up Date <span className="text-amber-400">*</span>
                      </label>
                      <input type="date" value={form.follow_up_date} required
                        onChange={e => setForm({ ...form, follow_up_date: e.target.value })}
                        className="input-dark w-full" />
                    </div>
                  )}

                  {/* Payment / COD dates */}
                  {needsPaymentDate && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Next Payment Date</label>
                      <input type="date" value={form.next_payment_date}
                        onChange={e => setForm({ ...form, next_payment_date: e.target.value })}
                        className="input-dark w-full" />
                    </div>
                  )}

                  {isCodForm && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Date of Closing</label>
                        <input type="date" value={form.date_of_closing}
                          onChange={e => setForm({ ...form, date_of_closing: e.target.value })}
                          className="input-dark w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Date of Dispatch</label>
                        <input type="date" value={form.date_of_dispatch}
                          onChange={e => setForm({ ...form, date_of_dispatch: e.target.value })}
                          className="input-dark w-full" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Date of Delivery</label>
                        <input type="date" value={form.date_of_delivery}
                          onChange={e => setForm({ ...form, date_of_delivery: e.target.value })}
                          className="input-dark w-full" />
                      </div>
                    </>
                  )}

                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Notes</label>
                    <textarea rows={3} value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="input-dark w-full resize-none" placeholder="Any additional notes..." />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-outline-gold flex-1">Cancel</button>
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

// ── List View ────────────────────────────────────────────────────────────────
function ListView({ leads, isAdmin, onEdit, onDelete }: {
  leads: Lead[];
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-white/30">
        <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No leads found. Add your first lead!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {leads.map(lead => {
          const cfg = STATUS_CONFIG[lead.status];
          const countdown = getDaysLabel(lead.next_payment_date);
          const urgency = getFollowUpUrgency(lead);
          const followUpLabel = lead.follow_up_date ? getDaysLabel(lead.follow_up_date) : null;

          let borderColor = 'rgba(255,255,255,0.06)';
          if (urgency === 'past_due') borderColor = 'rgba(239,68,68,0.5)';
          else if (urgency === 'today') borderColor = 'rgba(249,115,22,0.5)';
          else if (['pending_payment','cod_lead'].includes(lead.status) && countdown) borderColor = `${countdown.color}50`;

          return (
            <motion.div key={lead.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card p-4 cursor-pointer hover:bg-surface-100/50 transition-all relative"
              style={{ borderColor }}>

              {/* Urgency badge for follow-up */}
              {urgency === 'past_due' && followUpLabel && (
                <div className="absolute top-2 right-12 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30">
                  <AlertCircle className="w-3 h-3 text-red-400" />
                  <span className="text-red-400 text-xs font-bold">{followUpLabel.overdue}d late</span>
                </div>
              )}
              {urgency === 'today' && (
                <div className="absolute top-2 right-12 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30">
                  <Clock className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-400 text-xs font-bold">Due Today</span>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}60` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-white font-semibold">{lead.contact_name || lead.title}</div>
                      {lead.title && lead.contact_name && <div className="text-white/40 text-xs">{lead.title}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lead.payment_type && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${lead.payment_type === 'prepaid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {lead.payment_type === 'prepaid' ? 'Prepaid' : 'COD'}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>
                      {lead.pieces_count > 0 && (
                        <span className="text-xs font-bold text-gold-500 bg-gold-500/10 px-2 py-0.5 rounded-full">{lead.pieces_count}p</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                        <Phone className="w-3 h-3" />{lead.phone}
                      </a>
                    )}
                    {countdown && (
                      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: countdown.color }}>
                        <Clock className="w-3 h-3" />{countdown.text}
                      </div>
                    )}
                    {lead.follow_up_date && urgency !== 'none' && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: urgency === 'past_due' ? '#ef4444' : urgency === 'today' ? '#f97316' : '#3b82f6' }}>
                        <Calendar className="w-3 h-3" />
                        Follow-up: {new Date(lead.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                    {lead.date_of_dispatch && (
                      <div className="flex items-center gap-1 text-white/30 text-xs">
                        <Truck className="w-3 h-3" />
                        Dispatch: {new Date(lead.date_of_dispatch).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                    {lead.date_of_delivery && (
                      <div className="flex items-center gap-1 text-white/30 text-xs">
                        <Package className="w-3 h-3" />
                        Delivery: {new Date(lead.date_of_delivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>

                  {lead.notes && <p className="text-white/30 text-xs mt-1.5 truncate">{lead.notes}</p>}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onEdit(lead)} className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button onClick={() => onDelete(lead.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ── Kanban View ───────────────────────────────────────────────────────────────
function KanbanView({ leads, isAdmin, onEdit, onDelete, onAddLead, dragLeadId, dragOverCol, setDragOverCol, onDrop }: {
  leads: Lead[];
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onAddLead: (status: LeadStatus) => void;
  dragLeadId: React.MutableRefObject<string | null>;
  dragOverCol: LeadStatus | null;
  setDragOverCol: (s: LeadStatus | null) => void;
  onDrop: (status: LeadStatus, leadId: string) => void;
}) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: `${KANBAN_COLUMNS.length * 220}px` }}>
        {KANBAN_COLUMNS.map(col => {
          const colLeads = leads.filter(l => l.status === col.status);
          const isDragTarget = dragOverCol === col.status;
          return (
            <div key={col.status}
              className={`flex-shrink-0 w-52 rounded-2xl border transition-all ${isDragTarget ? 'border-2 scale-[1.01]' : 'border'}`}
              style={{
                backgroundColor: isDragTarget ? `${col.color}08` : 'rgba(255,255,255,0.02)',
                borderColor: isDragTarget ? col.color : 'rgba(255,255,255,0.07)',
                minHeight: 200,
              }}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.status); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => { e.preventDefault(); if (dragLeadId.current) onDrop(col.status, dragLeadId.current); }}>
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-xs font-semibold text-white/70">{col.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                    {colLeads.length}
                  </span>
                  <button onClick={() => onAddLead(col.status)}
                    className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2">
                {colLeads.map(lead => (
                  <KanbanCard key={lead.id} lead={lead} isAdmin={isAdmin}
                    onEdit={onEdit} onDelete={onDelete} dragLeadId={dragLeadId} />
                ))}
                {colLeads.length === 0 && (
                  <div className="py-6 text-center text-white/20 text-xs">No leads</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ lead, isAdmin, onEdit, onDelete, dragLeadId }: {
  lead: Lead;
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  dragLeadId: React.MutableRefObject<string | null>;
}) {
  const urgency = getFollowUpUrgency(lead);
  let borderColor = 'rgba(255,255,255,0.07)';
  if (urgency === 'past_due') borderColor = 'rgba(239,68,68,0.5)';
  else if (urgency === 'today') borderColor = 'rgba(249,115,22,0.5)';

  return (
    <div
      draggable
      onDragStart={() => { dragLeadId.current = lead.id; }}
      onDragEnd={() => { dragLeadId.current = null; }}
      className="p-2.5 rounded-xl bg-surface-100/60 border cursor-grab active:cursor-grabbing select-none group"
      style={{ borderColor }}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="text-white/90 text-xs font-semibold truncate">{lead.contact_name || lead.title}</div>
          {lead.phone && <div className="text-white/30 text-xs truncate mt-0.5">{lead.phone}</div>}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(lead); }}
            className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-all">
            <Edit3 className="w-3 h-3" />
          </button>
          {isAdmin && (
            <button onClick={e => { e.stopPropagation(); onDelete(lead.id); }}
              className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {lead.payment_type && (
          <span className={`text-xs px-1.5 rounded font-medium ${lead.payment_type === 'prepaid' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {lead.payment_type === 'prepaid' ? 'Prepaid' : 'COD'}
          </span>
        )}
        {lead.pieces_count > 0 && <span className="text-gold-500 text-xs font-bold">{lead.pieces_count}p</span>}
        {urgency === 'past_due' && (
          <span className="text-red-400 text-xs flex items-center gap-0.5">
            <AlertCircle className="w-2.5 h-2.5" />
            Overdue
          </span>
        )}
        {urgency === 'today' && (
          <span className="text-orange-400 text-xs flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            Today
          </span>
        )}
      </div>
      {lead.follow_up_date && urgency !== 'none' && (
        <div className="text-xs mt-1" style={{ color: urgency === 'past_due' ? '#ef4444' : urgency === 'today' ? '#f97316' : '#60a5fa' }}>
          {new Date(lead.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  );
}
