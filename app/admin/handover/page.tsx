'use client';

import { useEffect, useState } from 'react';

interface Handover {
  id: number; what_was_sold: string; mrr_dkk: number; customer_goal: string | null;
  promises: string | null; status: string; deadline: string | null;
  customer_name: string | null; company_name: string; company_color: string;
  am_name: string | null; kam_name: string | null; created_by_name: string; created_at: string;
}
interface Company { id: number; name: string; slug: string; color: string }
interface Customer { id: number; name: string; company_id: number }
interface User { id: string; name: string }

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  new_sale: { bg: 'var(--bl2)', text: 'var(--bl)', label: 'Nyt salg' },
  onboarding: { bg: 'var(--ye2)', text: 'var(--ye)', label: 'Onboarding' },
  active: { bg: 'var(--gr2)', text: 'var(--gr)', label: 'Aktiv' },
  paused: { bg: 'var(--or2)', text: 'var(--or)', label: 'Pauseret' },
  churned: { bg: 'var(--re2)', text: 'var(--re)', label: 'Churnet' },
};

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

export default function HandoverPage() {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    company_id: '', customer_id: '', what_was_sold: '', mrr_dkk: '',
    customer_goal: '', promises: '', am_user_id: '', kam_user_id: '', deadline: '',
  });

  async function load() {
    const [hs, cos, us] = await Promise.all([
      fetch('/api/handovers').then(r => r.json()) as Promise<Handover[]>,
      fetch('/api/companies').then(r => r.json()) as Promise<Company[]>,
      fetch('/api/admin/sellers').then(r => r.json()) as Promise<User[]>,
    ]);
    setHandovers(hs);
    setCompanies(cos);
    setUsers(us);
  }

  async function loadCustomers(companyId: string) {
    if (!companyId) { setCustomers([]); return; }
    const cos = await fetch('/api/companies').then(r => r.json()) as Company[];
    const company = cos.find(c => c.id === Number(companyId));
    if (!company) return;
    const cus = await fetch(`/api/customers?companySlug=${company.slug}`).then(r => r.json()) as Customer[];
    setCustomers(cus);
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCustomers(form.company_id); }, [form.company_id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/handovers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        company_id: Number(form.company_id),
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        mrr_dkk: Number(form.mrr_dkk) || 0,
      }),
    });
    setModal(false);
    setForm({ company_id: '', customer_id: '', what_was_sold: '', mrr_dkk: '', customer_goal: '', promises: '', am_user_id: '', kam_user_id: '', deadline: '' });
    setToast('Handover oprettet');
    load();
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/handovers/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Handovers</h1>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>Salgsoverlevering til levering</div>
        </div>
        <button onClick={() => setModal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '9px 16px', fontSize: 12, fontWeight: 600, minHeight: 44 }}>
          + Ny handover
        </button>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Hvad blev solgt', 'Kunde', 'Virksomhed', 'MRR', 'AM → KAM', 'Deadline', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {handovers.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen handovers endnu</td></tr>
              )}
              {handovers.map(h => {
                const sc = STATUS_COLOR[h.status] ?? STATUS_COLOR.new_sale;
                return (
                  <tr key={h.id} style={{ borderTop: '1px solid var(--bd)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 14px', maxWidth: 200 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{h.what_was_sold}</div>
                      {h.customer_goal && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{h.customer_goal.slice(0, 60)}…</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>{h.customer_name ?? '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.company_color }} />
                        <span style={{ fontSize: 12, color: 'var(--t2)' }}>{h.company_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: h.mrr_dkk > 0 ? 'var(--gr)' : 'var(--t3)' }}>
                      {h.mrr_dkk > 0 ? Number(h.mrr_dkk).toLocaleString('da-DK') + ' kr' : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                      {h.am_name && <span>{h.am_name} → </span>}
                      {h.kam_name ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: h.deadline && new Date(h.deadline) < new Date() ? 'var(--re)' : 'var(--t2)' }}>
                      {h.deadline ? new Date(h.deadline + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <select value={h.status} onChange={e => updateStatus(h.id, e.target.value)}
                        style={{ background: sc.bg, border: `1px solid ${sc.text}55`, color: sc.text, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, width: 'auto' }}>
                        {Object.entries(STATUS_COLOR).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 520, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny handover</div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Virksomhed *</label>
                <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value, customer_id: '' }))} required>
                  <option value="">Vælg virksomhed</option>
                  {companies.filter(c => c.slug !== 'group').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {customers.length > 0 && (
                <div>
                  <label>Kunde</label>
                  <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}>
                    <option value="">Ingen tilknyttet kunde</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label>Hvad blev solgt *</label>
                <textarea value={form.what_was_sold} onChange={e => setForm(f => ({ ...f, what_was_sold: e.target.value }))} required rows={2} placeholder="Beskriv produktet/ydelsen…" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>MRR (DKK)</label>
                  <input type="number" value={form.mrr_dkk} onChange={e => setForm(f => ({ ...f, mrr_dkk: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
                </div>
              </div>
              <div>
                <label>Kundens mål</label>
                <textarea value={form.customer_goal} onChange={e => setForm(f => ({ ...f, customer_goal: e.target.value }))} rows={2} placeholder="Hvad vil kunden opnå?" />
              </div>
              <div>
                <label>Løfter givet</label>
                <textarea value={form.promises} onChange={e => setForm(f => ({ ...f, promises: e.target.value }))} rows={2} placeholder="Hvad er lovet kunden?" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Account Manager</label>
                  <select value={form.am_user_id} onChange={e => setForm(f => ({ ...f, am_user_id: e.target.value }))}>
                    <option value="">Ingen</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>KAM</label>
                  <select value={form.kam_user_id} onChange={e => setForm(f => ({ ...f, kam_user_id: e.target.value }))}>
                    <option value="">Ingen</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
                <button type="submit" style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Opret handover</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
