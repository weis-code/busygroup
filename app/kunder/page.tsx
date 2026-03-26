'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, TrendingUp, Users, RefreshCw,
  Search, ChevronDown, Plus, X,
} from 'lucide-react';
import CustomerDrawer from '@/components/CustomerDrawer';
import { toast } from 'sonner';

interface Customer {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone: string;
  market: string;
  mrr: number;
  contract_start: string;
  contract_end: string;
  churn_risk: 'low' | 'medium' | 'high';
  health_score: number;
  segment: string;
  notes: string;
  updated_at: string;
  product_names?: string;
}

const CHURN_COLORS: Record<string, string> = {
  low: '#2ECC71',
  medium: '#F39C12',
  high: '#E74C3C',
};
const CHURN_LABELS: Record<string, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Høj',
};

function daysUntil(dateStr: string): number {
  if (!dateStr) return 999;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function HealthDot({ score }: { score: number }) {
  const color = score >= 80 ? '#2ECC71' : score >= 50 ? '#F39C12' : '#E74C3C';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '32px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: '11px', color, fontWeight: 600 }}>{score}</span>
    </div>
  );
}

function StatCard({ label, value, sub, color = '#ECF0F1', icon }: { label: string; value: string; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#667788' }}>{label}</span>
        <span style={{ color: '#667788' }}>{icon}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#667788' }}>{sub}</div>}
    </div>
  );
}

const EMPTY_FORM = {
  company: '', contact_name: '', contact_title: '', contact_email: '', contact_phone: '',
  market: 'denmark', mrr: '', contract_start: '', contract_end: '',
  churn_risk: 'low', health_score: '80', segment: 'smb', notes: '',
};

type SortKey = 'company' | 'mrr' | 'health_score' | 'contract_end' | 'churn_risk';

export default function KunderPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [filterMarket, setFilterMarket] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('mrr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Kunne ikke hente kunder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async (id: string, changes: Partial<Customer>) => {
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    await load();
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...changes } : null);
    }
  };

  const handleCreate = async () => {
    if (!form.company.trim()) { toast.error('Firmanavn er påkrævet'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, mrr: Number(form.mrr) || 0, health_score: Number(form.health_score) || 80 }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Kunde oprettet');
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } catch {
      toast.error('Fejl ved oprettelse');
    } finally {
      setCreating(false);
    }
  };

  // Stats
  const totalMrr = customers.reduce((s, c) => s + (c.mrr || 0), 0);
  const highRisk = customers.filter(c => c.churn_risk === 'high').length;
  const renewSoon = customers.filter(c => { const d = daysUntil(c.contract_end); return d > 0 && d < 60; }).length;
  const avgHealth = customers.length ? Math.round(customers.reduce((s, c) => s + (c.health_score || 0), 0) / customers.length) : 0;

  // Filter + sort
  const filtered = customers
    .filter(c => {
      if (search && !c.company.toLowerCase().includes(search.toLowerCase()) && !c.contact_name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterMarket !== 'all' && c.market !== filterMarket) return false;
      if (filterRisk !== 'all' && c.churn_risk !== filterRisk) return false;
      return true;
    })
    .sort((a, b) => {
      let av: number | string, bv: number | string;
      if (sortBy === 'mrr') { av = a.mrr || 0; bv = b.mrr || 0; }
      else if (sortBy === 'health_score') { av = a.health_score || 0; bv = b.health_score || 0; }
      else if (sortBy === 'contract_end') { av = a.contract_end || ''; bv = b.contract_end || ''; }
      else if (sortBy === 'churn_risk') {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        av = order[a.churn_risk] ?? 1; bv = order[b.churn_risk] ?? 1;
      }
      else { av = a.company.toLowerCase(); bv = b.company.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const inputStyle: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
    fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
    marginBottom: '8px',
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' };

  const thStyle: React.CSSProperties = {
    textAlign: 'left', fontSize: '11px', color: '#667788',
    fontWeight: 500, padding: '10px 12px', textTransform: 'uppercase', letterSpacing: '0.04em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#ECF0F1' }}>Kunder</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#667788' }}>Account management — {customers.length} aktive kunder</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px 12px', color: '#667788', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <RefreshCw size={13} /> Opdater
          </button>
          <button onClick={() => setShowCreate(true)} style={{ background: '#185FA5', border: 'none', borderRadius: '6px', padding: '8px 16px', color: '#ECF0F1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 500 }}>
            <Plus size={14} /> Ny kunde
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard label="Total MRR" value={`${totalMrr.toLocaleString('da-DK')} DKK`} sub={`${(totalMrr * 12).toLocaleString('da-DK')} DKK ARR`} color="#2ECC71" icon={<TrendingUp size={16} />} />
        <StatCard label="Aktive kunder" value={String(customers.length)} sub={`${customers.filter(c => c.market === 'denmark').length} DK · ${customers.filter(c => c.market === 'sweden').length} SE`} icon={<Users size={16} />} />
        <StatCard label="Høj churn-risiko" value={String(highRisk)} sub={highRisk > 0 ? 'Kræver handling' : 'Alt OK'} color={highRisk > 0 ? '#E74C3C' : '#2ECC71'} icon={<AlertTriangle size={16} />} />
        <StatCard label="Avg. health score" value={String(avgHealth)} sub={`${renewSoon} kontrakter fornyes inden 60d`} color={avgHealth >= 70 ? '#2ECC71' : avgHealth >= 40 ? '#F39C12' : '#E74C3C'} icon={<TrendingUp size={16} />} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#667788' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Søg på firma eller kontakt..."
            style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '8px 10px 8px 30px', color: '#ECF0F1', fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={filterMarket} onChange={e => setFilterMarket(e.target.value)} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '8px 28px 8px 10px', color: '#ECF0F1', fontSize: '12px', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
            <option value="all">Alle markeder</option>
            <option value="denmark">🇩🇰 Danmark</option>
            <option value="sweden">🇸🇪 Sverige</option>
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#667788', pointerEvents: 'none' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '8px 28px 8px 10px', color: '#ECF0F1', fontSize: '12px', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
            <option value="all">Alle risici</option>
            <option value="high">🔴 Høj</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Lav</option>
          </select>
          <ChevronDown size={11} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#667788', pointerEvents: 'none' }} />
        </div>
        {(search || filterMarket !== 'all' || filterRisk !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterMarket('all'); setFilterRisk('all'); }} style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: '6px', padding: '8px 10px', color: '#E74C3C', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <X size={12} /> Ryd
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <th style={thStyle} onClick={() => toggleSort('company')}>
                Firma {sortBy === 'company' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle}>Kontakt</th>
              <th style={thStyle}>Marked</th>
              <th style={thStyle}>Produkter</th>
              <th style={{ ...thStyle }} onClick={() => toggleSort('mrr')}>
                MRR {sortBy === 'mrr' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle} onClick={() => toggleSort('health_score')}>
                Health {sortBy === 'health_score' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle} onClick={() => toggleSort('churn_risk')}>
                Churn-risiko {sortBy === 'churn_risk' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle} onClick={() => toggleSort('contract_end')}>
                Fornyes {sortBy === 'contract_end' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#667788', fontSize: '13px' }}>
                  Henter kunder...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#667788', fontSize: '13px' }}>
                  Ingen kunder matcher dit filter
                </td>
              </tr>
            ) : filtered.map((c, i) => {
              const days = daysUntil(c.contract_end);
              const renewWarning = days > 0 && days < 60;
              const expired = days <= 0;
              return (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>{c.company}</div>
                    {c.segment && (
                      <div style={{ fontSize: '10px', color: '#667788', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {c.segment === 'smb' ? 'SMB' : c.segment === 'mid-market' ? 'Mid-Market' : c.segment}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: '#AAB8C2' }}>{c.contact_name || '—'}</div>
                    {c.contact_title && <div style={{ fontSize: '10px', color: '#667788', marginTop: '1px' }}>{c.contact_title}</div>}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#AAB8C2' }}>
                      {c.market === 'denmark' ? '🇩🇰 DK' : '🇸🇪 SE'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {c.product_names ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {c.product_names.split(', ').map(n => (
                          <span key={n} style={{
                            fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px',
                            background: 'rgba(15,110,86,0.15)', color: '#0F6E56',
                            border: '1px solid rgba(15,110,86,0.25)', whiteSpace: 'nowrap',
                          }}>{n}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#667788' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#2ECC71' }}>
                      {(c.mrr || 0).toLocaleString('da-DK')}
                    </span>
                    <span style={{ fontSize: '10px', color: '#667788' }}> DKK/md</span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <HealthDot score={c.health_score || 0} />
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: CHURN_COLORS[c.churn_risk],
                      background: `${CHURN_COLORS[c.churn_risk]}15`,
                      borderRadius: '4px', padding: '3px 7px',
                    }}>
                      {CHURN_LABELS[c.churn_risk] ?? c.churn_risk}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ fontSize: '11px', color: expired ? '#E74C3C' : renewWarning ? '#F39C12' : '#667788' }}>
                      {expired ? '⚠ Udløbet' : formatDate(c.contract_end)}
                    </span>
                    {!expired && renewWarning && (
                      <div style={{ fontSize: '10px', color: '#F39C12', marginTop: '1px' }}>om {days}d</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#667788', textAlign: 'right' }}>
        {filtered.length} af {customers.length} kunder vist
      </div>

      {/* Create modal */}
      {showCreate && (
        <>
          <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 301,
            background: '#111E2A', borderRadius: '12px', padding: '24px',
            width: '480px', maxWidth: 'calc(100vw - 32px)',
            border: '1px solid rgba(255,255,255,0.07)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#ECF0F1' }}>Opret ny kunde</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667788' }}><X size={18} /></button>
            </div>

            <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Firma</div>
            <input placeholder="Firmanavn *" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} style={inputStyle} />

            <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', marginTop: '4px' }}>Kontakt</div>
            <input placeholder="Kontaktperson" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Titel" value={form.contact_title} onChange={e => setForm(p => ({ ...p, contact_title: e.target.value }))} style={inputStyle} />
            <input placeholder="Email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} style={inputStyle} />
            <input placeholder="Telefon" value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} style={inputStyle} />

            <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', marginTop: '4px' }}>Kontrakt</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>Startdato</div>
                <input type="date" value={form.contract_start} onChange={e => setForm(p => ({ ...p, contract_start: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>Slutdato</div>
                <input type="date" value={form.contract_end} onChange={e => setForm(p => ({ ...p, contract_end: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>MRR (DKK)</div>
                <input type="number" placeholder="0" value={form.mrr} onChange={e => setForm(p => ({ ...p, mrr: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>Marked</div>
                <select value={form.market} onChange={e => setForm(p => ({ ...p, market: e.target.value }))} style={selectStyle}>
                  <option value="denmark">🇩🇰 Danmark</option>
                  <option value="sweden">🇸🇪 Sverige</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>Churn-risiko</div>
                <select value={form.churn_risk} onChange={e => setForm(p => ({ ...p, churn_risk: e.target.value }))} style={selectStyle}>
                  <option value="low">Lav</option>
                  <option value="medium">Medium</option>
                  <option value="high">Høj</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#667788', marginBottom: '4px' }}>Segment</div>
                <select value={form.segment} onChange={e => setForm(p => ({ ...p, segment: e.target.value }))} style={selectStyle}>
                  <option value="smb">SMB</option>
                  <option value="mid-market">Mid-Market</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <textarea placeholder="Interne noter" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ ...inputStyle, minHeight: '64px', resize: 'vertical' }} />

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer' }}>
                Annuller
              </button>
              <button onClick={handleCreate} disabled={creating} style={{ flex: 2, background: '#185FA5', border: 'none', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                {creating ? 'Opretter...' : 'Opret kunde'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Drawer */}
      {selected && (
        <CustomerDrawer
          customer={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
