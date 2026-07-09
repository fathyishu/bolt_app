import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Plus, Search, Filter, Phone, Calendar, Clock, X, ChevronDown,
  CreditCard as Edit3, Trash2, DollarSign, LayoutList, Columns2 as Columns,
  AlertCircle, Truck, Package, MessageCircle, CheckCircle2, ExternalLink,
  User, Hash, MapPin, ChevronRight,
} from 'lucide-react';
import { supabase, Lead, LeadStatus, PaymentType, Customer } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── Column definitions ────────────────────────────────────────────────────────
const KANBAN_COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'new_lead',        label: 'New Lead',       color: '#3b82f6' },
  { status: 'follow_up',       label: 'Follow-Up',      color: '#f59e0b' },
  { status: 'pre_booking',     label: 'Pre-Booking',    color: '#06b6d4' },
  { status: 'cod_lead',        label: 'Pass COD',       color: '#8b5cf6' },
  { status: 'pending_payment', label: 'Pending Pmt',    color: '#f97316' },
  { status: 'dead_lead',       label: 'Dead Lead',      color: '#6b7280' },
  { status: 'closed_lead',     label: 'Closed',         color: '#10b981' },
];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  new_lead:        { label: 'New Lead',        color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  follow_up:       { label: 'Follow-Up',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  pre_booking:     { label: 'Pre-Booking',     color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.3)' },
  dead_lead:       { label: 'Dead Lead',       color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.3)' },
  bill_declined:   { label: 'Bill Declined',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  pending_payment: { label: 'Pending Payment', color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  cod_lead:        { label: 'COD Lead',        color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)' },
  closed_lead:     { label: 'Closed',          color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function isCodDeliveryPast(lead: Lead): boolean {
  if (!lead.date_of_delivery) return false;
  const delivery = new Date(lead.date_of_delivery); delivery.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  return now >= delivery;
}

type FormState = {
  customer_id: string;
  title: string;
  contact_name: string;
  phone: string;
  status: LeadStatus;
  payment_type: PaymentType | '';
  pieces_count: number;
  tracking_id: string;
  date_of_entry: string;
  follow_up_date: string;
  next_payment_date: string;
  date_of_closing: string;
  date_of_dispatch: string;
  date_of_delivery: string;
  notes: string;
  assigned_to: string;
};

const EMPTY_FORM: FormState = {
  customer_id: '',
  title: '',
  contact_name: '',
  phone: '',
  status: 'new_lead',
  payment_type: '',
  pieces_count: 0,
  tracking_id: '',
  date_of_entry: new Date().toISOString().split('T')[0],
  follow_up_date: '',
  next_payment_date: '',
  date_of_closing: '',
  date_of_dispatch: '',
  date_of_delivery: '',
  notes: '',
  assigned_to: '',
};

type ViewMode = 'list' | 'kanban';
type PaymentFilter = 'all' | 'prepaid' | 'cod';
type OwnerFilter = 'mine' | 'all';

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const { profile } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('mine');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const dragLeadId = useRef<string | null>(null);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const isSalesExec = profile?.role === 'sales_executive';

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('leads')
      .select('*, customer:customers(*), profile:profiles!leads_assigned_to_fkey(full_name, role)')
      .order('updated_at', { ascending: false });

    if (isSalesExec || ownerFilter === 'mine') {
      q = q.eq('owner_id', profile?.id ?? '');
    }

    const { data } = await q;
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  }, [profile, isSalesExec, ownerFilter]);

  useEffect(() => {
    fetchLeads();
    supabase.from('customers').select('id, full_name, phone, city').order('full_name').then(({ data }) => {
      if (data) setCustomers(data as Customer[]);
    });
    if (isAdmin) {
      supabase.from('profiles').select('id, full_name').eq('is_active', true).in('role', ['sales_executive','manager']).order('full_name').then(({ data }) => {
        if (data) setProfiles(data as { id: string; full_name: string }[]);
      });
    }
  }, [fetchLeads, isAdmin]);

  function openCreate(preStatus?: LeadStatus) {
    setEditLead(null);
    setForm({
      ...EMPTY_FORM,
      status: preStatus ?? 'new_lead',
      date_of_entry: new Date().toISOString().split('T')[0],
      assigned_to: profile?.id ?? '',
    });
    setCustomerSearch('');
    setShowModal(true);
  }

  function openEdit(lead: Lead) {
    setEditLead(lead);
    setForm({
      customer_id: lead.customer_id ?? '',
      title: lead.title,
      contact_name: lead.contact_name,
      phone: lead.phone,
      status: lead.status,
      payment_type: lead.payment_type ?? '',
      pieces_count: lead.pieces_count,
      tracking_id: lead.tracking_id ?? '',
      date_of_entry: lead.date_of_entry ?? new Date().toISOString().split('T')[0],
      follow_up_date: lead.follow_up_date ?? '',
      next_payment_date: lead.next_payment_date ?? '',
      date_of_closing: lead.date_of_closing ?? '',
      date_of_dispatch: lead.date_of_dispatch ?? '',
      date_of_delivery: lead.date_of_delivery ?? '',
      notes: lead.notes,
      assigned_to: lead.assigned_to ?? profile?.id ?? '',
    });
    setCustomerSearch(lead.customer?.full_name ?? lead.contact_name);
    setShowModal(true);
    setShowEditDrawer(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);

    const prevStatus = editLead?.status;
    const isCod = form.status === 'cod_lead' || form.payment_type === 'cod';

    // Tracking ID mandatory for COD dispatched
    if (isCod && form.date_of_dispatch && !form.tracking_id.trim()) {
      alert('Tracking ID is mandatory for dispatched COD orders.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      customer_id: form.customer_id || null,
      title: form.title,
      contact_name: form.contact_name,
      phone: form.phone,
      status: form.status,
      payment_type: form.payment_type || null,
      pieces_count: Number(form.pieces_count),
      tracking_id: form.tracking_id,
      date_of_entry: form.date_of_entry || null,
      follow_up_date: form.follow_up_date || null,
      next_payment_date: form.next_payment_date || null,
      date_of_closing: form.date_of_closing || null,
      date_of_dispatch: isCod ? (form.date_of_dispatch || null) : null,
      date_of_delivery: isCod ? (form.date_of_delivery || null) : null,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    };

    if (editLead) {
      // Only admins/managers can change owner
      if (isAdmin) {
        payload.assigned_to = form.assigned_to || profile.id;
        payload.owner_id = form.assigned_to || profile.id;
      }
      await supabase.from('leads').update(payload).eq('id', editLead.id);

      if (prevStatus !== 'closed_lead' && form.status === 'closed_lead') {
        const diff = form.pieces_count;
        const ownerId = editLead.owner_id ?? editLead.assigned_to ?? profile.id;
        await supabase.from('profiles').update({
          monthly_pieces: (profile.monthly_pieces || 0) + diff,
          lifetime_pieces: (profile.lifetime_pieces || 0) + diff,
        }).eq('id', ownerId);

        await supabase.from('closing_news_feed').insert({
          user_id: ownerId,
          staff_name: profile.full_name || 'Someone',
          lead_title: form.contact_name || form.title || 'a sale',
          pieces_count: diff,
        });

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#FFD700','#10B981','#ffffff','#f97316'] });
      }
    } else {
      const ownerId = isAdmin ? (form.assigned_to || profile.id) : profile.id;
      await supabase.from('leads').insert({
        ...payload,
        assigned_to: ownerId,
        owner_id: ownerId,
        last_follow_up: new Date().toISOString(),
      });
    }

    await fetchLeads();
    setShowModal(false);
    setDetailLead(null);
    setShowEditDrawer(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this sale?')) return;
    await supabase.from('leads').delete().eq('id', id);
    setLeads(prev => prev.filter(l => l.id !== id));
    if (detailLead?.id === id) setDetailLead(null);
  }

  async function handleDrop(targetStatus: LeadStatus, leadId: string) {
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;
    await supabase.from('leads').update({ status: targetStatus, updated_at: new Date().toISOString() }).eq('id', leadId);
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: targetStatus } : l));
    setDragOverCol(null);
    dragLeadId.current = null;
  }

  async function handleCodPaymentUpdate(lead: Lead, checked: boolean) {
    await supabase.from('leads').update({
      cod_payment_updated: checked,
      cod_payment_updated_at: checked ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, cod_payment_updated: checked, cod_payment_updated_at: checked ? new Date().toISOString() : null } : l));
    if (detailLead?.id === lead.id) {
      setDetailLead(prev => prev ? { ...prev, cod_payment_updated: checked } : prev);
    }
  }

  const allFiltered = leads.filter(l => {
    const name = l.contact_name || l.customer?.full_name || l.title;
    const matchSearch = !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search) ||
      l.customer?.phone?.includes(search) || false;
    const matchStatus = filterStatus === 'all' || l.status === filterStatus;
    const matchPayment = paymentFilter === 'all' || l.payment_type === paymentFilter;
    return matchSearch && matchStatus && matchPayment;
  });

  const filtered = filterStatus === 'follow_up'
    ? sortLeadsForFollowUp(allFiltered)
    : allFiltered;

  const commission = leads.filter(l => l.status === 'closed_lead').reduce((sum, l) => sum + l.pieces_count * 4, 0);

  const needsFollowUpDate = form.status === 'follow_up';
  const isCodForm = form.status === 'cod_lead' || form.payment_type === 'cod';
  const needsPaymentDate = ['pending_payment', 'cod_lead'].includes(form.status);

  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c =>
        c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
      ).slice(0, 8)
    : [];

  function selectCustomer(c: Customer) {
    setForm(f => ({
      ...f,
      customer_id: c.id,
      contact_name: f.contact_name || c.full_name,
      phone: f.phone || c.phone,
    }));
    setCustomerSearch(c.full_name);
    setShowCustomerDropdown(false);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
          <p className="text-white/40 text-sm mt-0.5">
            {filtered.length} sales · Commission:{' '}
            <span className="text-emerald-500 font-semibold">₹{commission.toLocaleString('en-IN')}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Owner filter — only admin/manager */}
          {isAdmin && (
            <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
              {(['mine', 'all'] as const).map(f => (
                <button key={f} onClick={() => setOwnerFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ownerFilter === f ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
                  {f === 'mine' ? 'Mine' : 'All Team'}
                </button>
              ))}
            </div>
          )}
          {/* View toggle */}
          <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
            <button onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
            <button onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'kanban' ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              <Columns className="w-3.5 h-3.5" /> CRM
            </button>
          </div>
          <button onClick={() => openCreate()} className="btn-gold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Sale
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sales, phone..." className="input-dark w-full pl-9" />
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
        <div className="flex bg-surface-50/30 border border-white/10 rounded-xl p-1 gap-1">
          {(['all', 'prepaid', 'cod'] as const).map(f => (
            <button key={f} onClick={() => setPaymentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${paymentFilter === f ? 'bg-gold-500/15 text-gold-500' : 'text-white/40 hover:text-white/70'}`}>
              {f === 'all' ? 'All' : f === 'prepaid' ? 'Prepaid' : 'COD'}
            </button>
          ))}
        </div>
      </div>

      {/* Status summary */}
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
        <ListView
          leads={filtered}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={handleDelete}
          onOpenDetail={setDetailLead}
          onCodPaymentUpdate={handleCodPaymentUpdate}
        />
      ) : (
        <KanbanView
          leads={filtered}
          isAdmin={isAdmin}
          onEdit={openEdit}
          onDelete={handleDelete}
          onAddSale={openCreate}
          onOpenDetail={setDetailLead}
          onCodPaymentUpdate={handleCodPaymentUpdate}
          dragLeadId={dragLeadId}
          dragOverCol={dragOverCol}
          setDragOverCol={setDragOverCol}
          onDrop={handleDrop}
        />
      )}

      {/* ── Add/Edit Sale Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold text-lg">{editLead ? 'Edit Sale' : 'Add New Sale'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                {/* Customer lookup */}
                <div className="relative">
                  <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                    Link Customer Record
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) setForm(f => ({ ...f, customer_id: '' })); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search customer database..."
                      className="input-dark w-full pl-9"
                    />
                    {form.customer_id && (
                      <button type="button" onClick={() => { setForm(f => ({ ...f, customer_id: '' })); setCustomerSearch(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-surface-200 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button"
                          onMouseDown={() => selectCustomer(c)}
                          className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors">
                          <div className="text-white/90 text-sm font-medium">{c.full_name}</div>
                          <div className="text-white/30 text-xs">{c.phone}{c.city ? ` · ${c.city}` : ''}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {form.customer_id && (
                    <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Customer linked
                    </div>
                  )}
                </div>

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
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Sale Title</label>
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
                        Est. Commission: ₹{(form.pieces_count * 4).toLocaleString('en-IN')}+
                      </div>
                    )}
                  </div>

                  {/* Tracking ID */}
                  <div className={isCodForm ? 'col-span-2' : 'col-span-2'}>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                      Tracking ID {isCodForm && form.date_of_dispatch && <span className="text-red-400">*</span>}
                      {!isCodForm && <span className="text-white/20 font-normal ml-1">(optional)</span>}
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                      <input type="text" value={form.tracking_id}
                        onChange={e => setForm({ ...form, tracking_id: e.target.value })}
                        placeholder="e.g. DTDC1234567"
                        className="input-dark w-full pl-9"
                        required={!!(isCodForm && form.date_of_dispatch)} />
                    </div>
                  </div>

                  {/* Follow-up date */}
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

                  {/* Assign to (admin/manager only) */}
                  {isAdmin && (
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Assign To</label>
                      <div className="relative">
                        <select value={form.assigned_to}
                          onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                          className="input-dark w-full appearance-none pr-8">
                          <option value="">Select staff member...</option>
                          {profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                      </div>
                    </div>
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
                    {saving && <div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" />}
                    {editLead ? 'Update Sale' : 'Save Sale'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {detailLead && !showModal && (
          <SaleDetailModal
            lead={detailLead}
            isAdmin={isAdmin}
            onClose={() => { setDetailLead(null); setShowEditDrawer(false); }}
            onEdit={() => { openEdit(detailLead); setDetailLead(null); }}
            onDelete={() => handleDelete(detailLead.id)}
            onCodPaymentUpdate={handleCodPaymentUpdate}
            showEditDrawer={showEditDrawer}
            setShowEditDrawer={setShowEditDrawer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sale Detail Modal ──────────────────────────────────────────────────────────
function SaleDetailModal({ lead, isAdmin, onClose, onEdit, onDelete, onCodPaymentUpdate, showEditDrawer, setShowEditDrawer }: {
  lead: Lead;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCodPaymentUpdate: (lead: Lead, checked: boolean) => void;
  showEditDrawer: boolean;
  setShowEditDrawer: (v: boolean) => void;
}) {
  const cfg = STATUS_CONFIG[lead.status];
  const isCod = lead.payment_type === 'cod' || lead.status === 'cod_lead';
  const showCodCheckbox = isCod && lead.date_of_delivery && isCodDeliveryPast(lead) && !lead.cod_payment_updated;
  const phone = lead.phone || lead.customer?.phone || '';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="glass-card w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl"
        style={{ borderColor: lead.cod_payment_updated ? '#10b981' : cfg.border, borderWidth: 1, borderStyle: 'solid', backgroundColor: lead.cod_payment_updated ? 'rgba(16,185,129,0.08)' : undefined }}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: lead.cod_payment_updated ? '#10b981' : cfg.color, boxShadow: `0 0 8px ${lead.cod_payment_updated ? '#10b98180' : cfg.color + '60'}` }} />
            <div>
              <div className="text-white font-bold">{lead.contact_name || lead.customer?.full_name || lead.title}</div>
              <div className="text-white/30 text-xs mt-0.5">{lead.title || lead.customer?.city || ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEditDrawer(!showEditDrawer)}
              className="p-2 rounded-lg text-white/40 hover:text-gold-500 hover:bg-gold-500/10 transition-all">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status + payment badges */}
        <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-b border-white/5">
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
          {lead.payment_type && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${lead.payment_type === 'prepaid' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
              {lead.payment_type === 'prepaid' ? 'Prepaid' : 'COD'}
            </span>
          )}
          {lead.pieces_count > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-gold-500/10 text-gold-500">
              {lead.pieces_count} pieces
            </span>
          )}
          {lead.cod_payment_updated && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> COD Collected
            </span>
          )}
        </div>

        {/* Contact quick actions */}
        {phone && (
          <div className="flex gap-3 px-5 py-3 border-b border-white/5">
            <a href={`tel:${phone}`}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium">
              <Phone className="w-4 h-4" /> Call
            </a>
            <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-medium">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          </div>
        )}

        {/* Details grid */}
        <div className="p-5 space-y-4">
          {/* COD Payment Updated checkbox */}
          {(showCodCheckbox || lead.cod_payment_updated) && isCod && (
            <div className={`p-4 rounded-xl border transition-all ${lead.cod_payment_updated ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={lead.cod_payment_updated}
                  onChange={e => onCodPaymentUpdate(lead, e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <div>
                  <div className={`text-sm font-semibold ${lead.cod_payment_updated ? 'text-emerald-400' : 'text-amber-400'}`}>
                    COD Payment is Updated
                  </div>
                  <div className="text-white/30 text-xs mt-0.5">
                    {lead.cod_payment_updated ? 'Cash collected and recorded by accounts' : 'Delivery date has passed — waiting for cash confirmation'}
                  </div>
                </div>
              </label>
            </div>
          )}

          {/* Customer info */}
          {lead.customer && (
            <div className="p-3 rounded-xl bg-surface-50/30 space-y-1">
              <div className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Customer Record</div>
              <div className="text-white/80 text-sm font-medium">{lead.customer.full_name}</div>
              {lead.customer.city && <div className="text-white/40 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.customer.city}</div>}
            </div>
          )}

          {/* Date fields */}
          <div className="grid grid-cols-2 gap-3">
            {lead.date_of_entry && <DetailField label="Entry Date" value={formatDate(lead.date_of_entry)} />}
            {lead.date_of_closing && <DetailField label="Closing Date" value={formatDate(lead.date_of_closing)} />}
            {lead.date_of_dispatch && <DetailField label="Dispatch Date" value={formatDate(lead.date_of_dispatch)} icon={<Truck className="w-3 h-3" />} />}
            {lead.date_of_delivery && <DetailField label="Delivery Date" value={formatDate(lead.date_of_delivery)} icon={<Package className="w-3 h-3" />} />}
            {lead.follow_up_date && <DetailField label="Follow-Up" value={formatDate(lead.follow_up_date)} icon={<Calendar className="w-3 h-3" />} />}
            {lead.next_payment_date && <DetailField label="Next Payment" value={formatDate(lead.next_payment_date)} icon={<Clock className="w-3 h-3" />} />}
          </div>

          {/* Tracking ID */}
          {lead.tracking_id && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-50/30">
              <Hash className="w-4 h-4 text-white/30 flex-shrink-0" />
              <div>
                <div className="text-white/30 text-xs">Tracking ID</div>
                <div className="text-white/80 text-sm font-mono">{lead.tracking_id}</div>
              </div>
            </div>
          )}

          {/* Notes */}
          {lead.notes && (
            <div className="p-3 rounded-xl bg-surface-50/30">
              <div className="text-white/30 text-xs mb-1">Notes</div>
              <div className="text-white/70 text-sm">{lead.notes}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-500 hover:bg-gold-500/20 transition-all text-sm font-medium">
              <Edit3 className="w-4 h-4" /> Edit Sale
            </button>
            {isAdmin && (
              <button onClick={onDelete}
                className="py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DetailField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-xl bg-surface-50/30">
      <div className="text-white/30 text-xs flex items-center gap-1 mb-0.5">{icon}{label}</div>
      <div className="text-white/80 text-sm">{value}</div>
    </div>
  );
}

function formatDate(d: string) {
  return new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── List View ─────────────────────────────────────────────────────────────────
function ListView({ leads, isAdmin, onEdit, onDelete, onOpenDetail, onCodPaymentUpdate }: {
  leads: Lead[];
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (lead: Lead) => void;
  onCodPaymentUpdate: (lead: Lead, checked: boolean) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-white/30">
        <Filter className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No sales found. Add your first sale!</p>
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
          const isCod = lead.payment_type === 'cod' || lead.status === 'cod_lead';
          const showCodCheck = isCod && lead.date_of_delivery && isCodDeliveryPast(lead);

          let borderColor = 'rgba(255,255,255,0.06)';
          if (lead.cod_payment_updated) borderColor = 'rgba(16,185,129,0.5)';
          else if (urgency === 'past_due') borderColor = 'rgba(239,68,68,0.5)';
          else if (urgency === 'today') borderColor = 'rgba(249,115,22,0.5)';
          else if (['pending_payment','cod_lead'].includes(lead.status) && countdown) borderColor = `${countdown.color}50`;

          return (
            <motion.div key={lead.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => onOpenDetail(lead)}
              className="glass-card p-4 cursor-pointer hover:bg-surface-100/50 transition-all relative"
              style={{ borderColor, backgroundColor: lead.cod_payment_updated ? 'rgba(16,185,129,0.05)' : undefined }}>

              {/* Urgency badges */}
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
                  style={{ backgroundColor: lead.cod_payment_updated ? '#10b981' : cfg.color, boxShadow: `0 0 6px ${lead.cod_payment_updated ? '#10b98160' : cfg.color + '60'}` }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="text-white font-semibold">{lead.contact_name || lead.title}</div>
                      {lead.title && lead.contact_name && <div className="text-white/40 text-xs">{lead.title}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
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
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-2 flex-wrap" onClick={e => e.stopPropagation()}>
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
                        {new Date(lead.date_of_dispatch).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                    {lead.tracking_id && (
                      <div className="flex items-center gap-1 text-white/30 text-xs">
                        <Hash className="w-3 h-3" />{lead.tracking_id}
                      </div>
                    )}
                    {lead.cod_payment_updated && (
                      <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> COD Collected
                      </div>
                    )}
                  </div>

                  {/* COD Payment checkbox (inline for list) */}
                  {showCodCheck && !lead.cod_payment_updated && (
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      <label className="flex items-center gap-2 cursor-pointer w-fit">
                        <input type="checkbox" checked={false}
                          onChange={e => onCodPaymentUpdate(lead, e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-emerald-500" />
                        <span className="text-amber-400 text-xs font-medium">Mark COD Payment Updated</span>
                      </label>
                    </div>
                  )}

                  {lead.notes && <p className="text-white/30 text-xs mt-1.5 truncate">{lead.notes}</p>}
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
function KanbanView({ leads, isAdmin, onEdit, onDelete, onAddSale, onOpenDetail, onCodPaymentUpdate, dragLeadId, dragOverCol, setDragOverCol, onDrop }: {
  leads: Lead[];
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onAddSale: (status: LeadStatus) => void;
  onOpenDetail: (lead: Lead) => void;
  onCodPaymentUpdate: (lead: Lead, checked: boolean) => void;
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
              <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-xs font-semibold text-white/70">{col.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${col.color}20`, color: col.color }}>{colLeads.length}</span>
                  <button onClick={() => onAddSale(col.status)}
                    className="w-5 h-5 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {colLeads.map(lead => (
                  <KanbanCard key={lead.id} lead={lead} isAdmin={isAdmin}
                    onEdit={onEdit} onDelete={onDelete} onOpenDetail={onOpenDetail}
                    onCodPaymentUpdate={onCodPaymentUpdate} dragLeadId={dragLeadId} />
                ))}
                {colLeads.length === 0 && (
                  <div className="py-6 text-center text-white/20 text-xs">No sales</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ lead, isAdmin, onEdit, onDelete, onOpenDetail, onCodPaymentUpdate, dragLeadId }: {
  lead: Lead;
  isAdmin: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onOpenDetail: (lead: Lead) => void;
  onCodPaymentUpdate: (lead: Lead, checked: boolean) => void;
  dragLeadId: React.MutableRefObject<string | null>;
}) {
  const urgency = getFollowUpUrgency(lead);
  const isCod = lead.payment_type === 'cod' || lead.status === 'cod_lead';
  const showCodCheck = isCod && lead.date_of_delivery && isCodDeliveryPast(lead) && !lead.cod_payment_updated;

  let borderColor = 'rgba(255,255,255,0.07)';
  if (lead.cod_payment_updated) borderColor = 'rgba(16,185,129,0.5)';
  else if (urgency === 'past_due') borderColor = 'rgba(239,68,68,0.5)';
  else if (urgency === 'today') borderColor = 'rgba(249,115,22,0.5)';

  return (
    <div
      draggable
      onDragStart={() => { dragLeadId.current = lead.id; }}
      onDragEnd={() => { dragLeadId.current = null; }}
      className="p-2.5 rounded-xl border cursor-grab active:cursor-grabbing select-none group"
      style={{ borderColor, backgroundColor: lead.cod_payment_updated ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.04)' }}
      onClick={() => onOpenDetail(lead)}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex-1 min-w-0">
          <div className="text-white/90 text-xs font-semibold truncate">{lead.contact_name || lead.title}</div>
          {lead.phone && <div className="text-white/30 text-xs truncate mt-0.5">{lead.phone}</div>}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(lead)} className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-all">
            <Edit3 className="w-3 h-3" />
          </button>
          {isAdmin && (
            <button onClick={() => onDelete(lead.id)} className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
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
        {lead.cod_payment_updated && <span className="text-emerald-400 text-xs flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Paid</span>}
        {urgency === 'past_due' && <span className="text-red-400 text-xs flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" />Overdue</span>}
        {urgency === 'today' && <span className="text-orange-400 text-xs flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Today</span>}
      </div>
      {/* COD payment checkbox on card */}
      {showCodCheck && (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={false}
              onChange={e => onCodPaymentUpdate(lead, e.target.checked)}
              className="w-3 h-3 rounded accent-emerald-500" />
            <span className="text-amber-400 text-xs">COD Paid?</span>
          </label>
        </div>
      )}
    </div>
  );
}
