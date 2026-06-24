'use client';

import { useEffect, useState } from 'react';

interface Customer {
  id: number; name: string; cvr: string | null; contact_name: string | null;
  contact_email: string | null; contact_phone: string | null; status: string;
  mrr: number; company_name: string; company_color: string; am_name: string | null;
  kam_name: string | null; created_at: string;
}
interface Company { id: number; name: string; slug: string; color: string }
interface User { id: string; name: string }

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ company_id: '', name: '', cvr: '', contact_name: '', contact_email: '', contact_phone: '', am_user_id: '', kam_user_id: '', mrr: '', notes: '' });

  async function load() {
    const [cus, cos, us] = await Promise.all([
      fetch('/api/customers').then(r => r.json()) as Promise<Customer[]>,
      fetch('/api/companies').then(r => r.json()) as Promise<Company[]>,
      fetch('/api/admin/sellers').then(r => r.json()) as Promise<User[]>,
    ]);
    setCustomers(cus);
    setCompanies(cos);
    setUsers(us);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id || !form.name) return;
    await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, company_id: Number(form.company_id), mrr: Number(form.mrr) || 0 }),
    });
    setModal(false);
    setForm({ company_id: '', name: '', cvr: '', contact_name: '', contact_email: '', contact_phone: '', am_user_id: '', kam_user_id: '', mrr: '', notes: '' });
    setToast('Kunde oprettet');
    load();
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase()) ||
    (c.company_name ?? '').toLowerCase().includes(filter.toLowerCase())
  );

  const fmtMrr = (n: number) => n > 0 ? Number(n).toLocaleString('da-DK') + ' kr' : '—';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Kunder</h1>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>{customers.length} kunder i alt</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Søg…" style={{ width: 200, padding: '7px 12px', fontSize: 12 }} />
          <button onClick={() => setModal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, minHeight: 44 }}>
            + Ny kunde
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Navn', 'CVR', 'Virksomhed', 'AM / KAM', 'MRR', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen kunder</td></tr>
              )}
              {filtered.map(cu => (
                <tr key={cu.id} style={{ borderTop: '1px solid var(--bd)', transition: 'background 0.1s', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{cu.name}</div>
                    {cu.contact_name && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{cu.contact_name}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>{cu.cvr ?? '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cu.company_color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{cu.company_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                    {cu.am_name && <div>{cu.am_name}</div>}
                    {cu.kam_name && <div style={{ color: 'var(--t3)' }}>{cu.kam_name}</div>}
                    {!cu.am_name && !cu.kam_name && '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: cu.mrr > 0 ? 'var(--gr)' : 'var(--t3)' }}>
                    {fmtMrr(Number(cu.mrr))}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: cu.status === 'active' ? 'var(--gr2)' : 'var(--s3)', color: cu.status === 'active' ? 'var(--gr)' : 'var(--t3)' }}>
                      {cu.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 480, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny kunde</div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label>Virksomhed *</label>
                <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} required>
                  <option value="">Vælg virksomhed</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Kundenavn *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Firma A/S" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>CVR</label>
                  <input value={form.cvr} onChange={e => setForm(f => ({ ...f, cvr: e.target.value }))} placeholder="12345678" />
                </div>
                <div>
                  <label>MRR (DKK)</label>
                  <input type="number" value={form.mrr} onChange={e => setForm(f => ({ ...f, mrr: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label>Kontaktperson</label>
                <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="Navn" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Email</label>
                  <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="mail@firma.dk" />
                </div>
                <div>
                  <label>Telefon</label>
                  <input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+45…" />
                </div>
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
              <div>
                <label>Noter</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
                <button type="submit" style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Opret kunde</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
