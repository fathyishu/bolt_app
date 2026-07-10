import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, X, Phone, MapPin, User, MessageCircle, ChevronRight, Package, Clock, CreditCard as Edit3, Trash2, BookUser, Download, UserCog } from 'lucide-react';
import { supabase, Customer, Lead, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ExportRange = 'last_month' | '3mo' | '6mo' | 'all';

function exportToCSV(customers: Customer[], range: ExportRange) {
  const now = new Date();
  const cutoff = new Date();
  if (range === 'last_month') cutoff.setMonth(now.getMonth() - 1);
  else if (range === '3mo') cutoff.setMonth(now.getMonth() - 3);
  else if (range === '6mo') cutoff.setMonth(now.getMonth() - 6);
  else cutoff.setFullYear(2000);

  const rows = customers.filter(c => new Date(c.created_at) >= cutoff);

  const headers = ['Name', 'Phone', 'Email', 'City', 'Address', 'Notes', 'Added By', 'Date Added'];
  const data = rows.map(c => [
    c.full_name,
    c.phone,
    c.email || '',
    c.city || '',
    c.address || '',
    c.notes || '',
    (c as any).added_by_profile?.full_name || '',
    new Date(c.created_at).toLocaleDateString('en-IN'),
  ]);

  const csv = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customers_${range}_${now.toISOString().slice(0, 10)}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  notes: '',
};

type CustomerWithPurchases = Customer & { purchases?: Lead[] };

export default function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<CustomerWithPurchases[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<CustomerWithPurchases | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportRange, setExportRange] = useState<ExportRange>('all');

  // Reassignment state
  const [reassignCustomer, setReassignCustomer] = useState<Customer | null>(null);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [reassignTo, setReassignTo] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*, added_by_profile:profiles!customers_added_by_fkey(full_name)')
      .order('full_name');
    if (data) setCustomers(data as CustomerWithPurchases[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  async function openReassign(customer: Customer) {
    setReassignCustomer(customer);
    setReassignTo('');
    if (staffList.length === 0) {
      const { data } = await supabase.from('profiles').select('*').in('role', ['sales_executive', 'manager']).eq('is_active', true).order('full_name');
      if (data) setStaffList(data as Profile[]);
    }
  }

  async function handleReassign() {
    if (!reassignCustomer || !reassignTo) return;
    setReassigning(true);
    await supabase.from('customers').update({ added_by: reassignTo, updated_at: new Date().toISOString() }).eq('id', reassignCustomer.id);
    await fetchCustomers();
    setReassignCustomer(null);
    setReassigning(false);
  }

  async function openDetail(customer: CustomerWithPurchases) {
    setDetailCustomer(customer);
    setLoadingDetail(true);
    const { data } = await supabase
      .from('leads')
      .select('*, profile:profiles!leads_assigned_to_fkey(full_name)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });
    setDetailCustomer(prev => prev ? { ...prev, purchases: (data ?? []) as Lead[] } : prev);
    setLoadingDetail(false);
  }

  function openCreate() {
    setEditCustomer(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(customer: Customer) {
    setEditCustomer(customer);
    setForm({
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      city: customer.city,
      notes: customer.notes,
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    if (editCustomer) {
      await supabase.from('customers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editCustomer.id);
    } else {
      await supabase.from('customers').insert({ ...form, added_by: profile.id });
    }
    await fetchCustomers();
    setShowModal(false);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this customer? Linked sales will lose their customer reference.')) return;
    await supabase.from('customers').delete().eq('id', id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    if (detailCustomer?.id === id) setDetailCustomer(null);
  }

  const filtered = customers.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  const RANGE_LABELS: Record<ExportRange, string> = {
    last_month: 'Last Month',
    '3mo': 'Last 3 Months',
    '6mo': 'Last 6 Months',
    all: 'All Time',
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookUser className="w-6 h-6 text-gold-500" />
            Customer Database
          </h1>
          <p className="text-white/40 text-sm mt-0.5">{customers.length} registered customers</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button onClick={() => setShowExport(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          <button onClick={openCreate} className="btn-gold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Export Panel */}
      <AnimatePresence>
        {showExport && isAdmin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="glass-card p-4 border border-blue-500/20">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/60 text-sm font-medium">Export range:</span>
                {(['last_month', '3mo', '6mo', 'all'] as ExportRange[]).map(r => (
                  <button key={r} onClick={() => setExportRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      exportRange === r
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}>
                    {RANGE_LABELS[r]}
                  </button>
                ))}
                <button onClick={() => exportToCSV(customers, exportRange)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-300 hover:bg-blue-500/25 text-sm font-medium transition-all">
                  <Download className="w-4 h-4" /> Download CSV
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, city..."
          className="input-dark w-full pl-9" />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <BookUser className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No customers yet. Register your first customer to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(c => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                onClick={() => openDetail(c)}
                className="glass-card p-4 cursor-pointer hover:bg-surface-100/50 transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold-500 font-bold">{c.full_name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white font-semibold">{c.full_name}</div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {isAdmin && (
                          <>
                            <button onClick={() => openReassign(c)} className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Reassign customer">
                              <UserCog className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-white/30 hover:text-gold-500 hover:bg-gold-500/10 transition-all">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-white/40 hover:text-white/70 text-xs transition-colors">
                          <Phone className="w-3 h-3" />{c.phone}
                        </a>
                      )}
                      {c.city && (
                        <span className="flex items-center gap-1 text-white/30 text-xs">
                          <MapPin className="w-3 h-3" />{c.city}
                        </span>
                      )}
                      {(c as any).added_by_profile && (
                        <span className="flex items-center gap-1 text-white/20 text-xs">
                          <User className="w-3 h-3" /> Added by {(c as any).added_by_profile.full_name}
                        </span>
                      )}
                    </div>
                    {c.notes && <p className="text-white/25 text-xs mt-1 truncate">{c.notes}</p>}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-white font-bold text-lg">{editCustomer ? 'Edit Customer' : 'Register New Customer'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Full Name *</label>
                    <input type="text" required value={form.full_name}
                      onChange={e => setForm({ ...form, full_name: e.target.value })}
                      className="input-dark w-full" placeholder="Customer's full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Phone *</label>
                    <input type="tel" required value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="input-dark w-full" placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
                    <input type="email" value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="input-dark w-full" placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">City</label>
                    <input type="text" value={form.city}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                      className="input-dark w-full" placeholder="Mumbai, Delhi..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Address</label>
                    <input type="text" value={form.address}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                      className="input-dark w-full" placeholder="Street, area..." />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">Notes</label>
                    <textarea rows={3} value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="input-dark w-full resize-none" placeholder="Any customer notes..." />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-outline-gold flex-1">Cancel</button>
                  <button type="submit" disabled={saving} className="btn-gold flex-1 flex items-center justify-center gap-2">
                    {saving && <div className="w-4 h-4 border-2 border-dark-400/30 border-t-dark-400 rounded-full animate-spin" />}
                    {editCustomer ? 'Update Customer' : 'Register Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {detailCustomer && !showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={e => e.target === e.currentTarget && setDetailCustomer(null)}>
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="glass-card gold-border w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold-500 font-bold text-lg">{detailCustomer.full_name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="text-white font-bold">{detailCustomer.full_name}</div>
                    {detailCustomer.city && <div className="text-white/30 text-xs">{detailCustomer.city}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button onClick={() => { openEdit(detailCustomer); setDetailCustomer(null); }}
                      className="p-2 rounded-lg text-white/40 hover:text-gold-500 hover:bg-gold-500/10 transition-all">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setDetailCustomer(null)} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contact actions */}
              {detailCustomer.phone && (
                <div className="flex gap-3 px-5 py-3 border-b border-white/5">
                  <a href={`tel:${detailCustomer.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm font-medium">
                    <Phone className="w-4 h-4" /> {detailCustomer.phone}
                  </a>
                  <a href={`https://wa.me/${detailCustomer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-sm font-medium">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {detailCustomer.email && (
                    <div className="col-span-2 p-3 rounded-xl bg-surface-50/30">
                      <div className="text-white/30 text-xs mb-0.5">Email</div>
                      <div className="text-white/80 text-sm">{detailCustomer.email}</div>
                    </div>
                  )}
                  {detailCustomer.address && (
                    <div className="col-span-2 p-3 rounded-xl bg-surface-50/30">
                      <div className="text-white/30 text-xs mb-0.5">Address</div>
                      <div className="text-white/80 text-sm">{detailCustomer.address}</div>
                    </div>
                  )}
                  {detailCustomer.notes && (
                    <div className="col-span-2 p-3 rounded-xl bg-surface-50/30">
                      <div className="text-white/30 text-xs mb-0.5">Notes</div>
                      <div className="text-white/70 text-sm">{detailCustomer.notes}</div>
                    </div>
                  )}
                </div>

                {/* Purchase history */}
                <div>
                  <h3 className="text-white/70 font-semibold text-sm mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-gold-500" />
                    Purchase History
                    {detailCustomer.purchases !== undefined && (
                      <span className="text-white/30 text-xs font-normal">({detailCustomer.purchases.length} orders)</span>
                    )}
                  </h3>
                  {loadingDetail ? (
                    <div className="flex justify-center py-6">
                      <div className="w-6 h-6 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
                    </div>
                  ) : !detailCustomer.purchases?.length ? (
                    <div className="text-white/20 text-sm text-center py-6">No purchase history yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {detailCustomer.purchases.map(lead => {
                        const statusColors: Record<string, string> = {
                          closed_lead: '#10b981', pending_payment: '#f97316',
                          cod_lead: '#8b5cf6', new_lead: '#3b82f6',
                          follow_up: '#f59e0b', dead_lead: '#6b7280',
                          pre_booking: '#06b6d4', bill_declined: '#ef4444',
                        };
                        const color = statusColors[lead.status] || '#9ca3af';
                        return (
                          <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-50/30 gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                              <div className="min-w-0">
                                <div className="text-white/80 text-sm font-medium truncate">{lead.title || lead.contact_name || 'Untitled'}</div>
                                <div className="text-white/30 text-xs flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  {new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {(lead as any).profile?.full_name && (
                                    <span className="text-white/20">· {(lead as any).profile.full_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {lead.pieces_count > 0 && (
                                <div className="text-gold-500 font-bold text-sm">{lead.pieces_count}p</div>
                              )}
                              <div className="text-xs capitalize" style={{ color }}>{lead.status.replace('_', ' ')}</div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Total pieces */}
                      {detailCustomer.purchases.filter(l => l.status === 'closed_lead').length > 0 && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gold-500/10 border border-gold-500/20 mt-2">
                          <span className="text-white/60 text-sm font-medium">Total Closed Pieces</span>
                          <span className="text-gold-500 font-bold">
                            {detailCustomer.purchases.filter(l => l.status === 'closed_lead').reduce((s, l) => s + l.pieces_count, 0)}p
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reassign Modal */}
      <AnimatePresence>
        {reassignCustomer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setReassignCustomer(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card gold-border w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <UserCog className="w-5 h-5 text-blue-400" />
                <h3 className="text-white font-semibold">Reassign Customer</h3>
              </div>
              <p className="text-white/50 text-sm mb-4">
                Reassign <span className="text-white font-medium">{reassignCustomer.full_name}</span> to a different staff member.
              </p>
              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} className="input-dark w-full mb-4">
                <option value="">Select staff member...</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.role.replace('_', ' ')})</option>
                ))}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setReassignCustomer(null)}
                  className="flex-1 py-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 text-sm transition-all">
                  Cancel
                </button>
                <button onClick={handleReassign} disabled={!reassignTo || reassigning}
                  className="flex-1 py-2 rounded-xl bg-blue-500/15 border border-blue-500/20 text-blue-300 hover:bg-blue-500/25 text-sm font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  {reassigning && <div className="w-3.5 h-3.5 border-2 border-blue-300/30 border-t-blue-300 rounded-full animate-spin" />}
                  Reassign
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
