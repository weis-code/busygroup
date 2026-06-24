'use client';

import { useEffect, useState } from 'react';

interface PortalEntry {
  id: number; customer_id: number; portal_token: string;
  last_login: string | null; created_at: string;
  customer_name: string; company_name: string; company_color: string;
}
interface Customer { id: number; name: string; company_name: string }

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

function copyText(text: string, onCopied: (msg: string) => void) {
  navigator.clipboard.writeText(text).then(() => onCopied('Link kopieret ✓'));
}

export default function PortalPage() {
  const [entries, setEntries] = useState<PortalEntry[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    // We use the admin API; portal_access doesn't have its own GET route, so we call via server action
    const res = await fetch('/api/admin/portal-access').then(r => r.json()).catch(() => []) as PortalEntry[];
    setEntries(res);
    const cus = await fetch('/api/customers').then(r => r.json()) as Customer[];
    setCustomers(cus);
  }

  useEffect(() => { load(); }, []);

  async function createAccess() {
    if (!selectedCustomer) return;
    setCreating(true);
    await fetch('/api/admin/portal-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: Number(selectedCustomer) }),
    });
    setModal(false);
    setSelectedCustomer('');
    setCreating(false);
    setToast('Portaladgang oprettet');
    load();
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Klientportal</h1>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>Adgangslinks til kunder</div>
        </div>
        <button onClick={() => setModal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '9px 16px', fontSize: 12, fontWeight: 600, minHeight: 44 }}>
          + Ny adgang
        </button>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                {['Kunde', 'Virksomhed', 'Portal URL', 'Sidst set', 'Oprettet'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen portaladgange endnu</td></tr>
              )}
              {entries.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--bd)' }}
                  onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{e.customer_name}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.company_color }} />
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{e.company_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', padding: '2px 6px', borderRadius: 4 }}>
                        /portal/{e.portal_token.slice(0, 12)}…
                      </code>
                      <button onClick={() => copyText(`${baseUrl}/portal/${e.portal_token}`, setToast)}
                        style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, padding: '3px 8px', fontSize: 10, color: 'var(--t2)', minHeight: 44, minWidth: 44 }}>
                        Kopiér
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t2)' }}>
                    {e.last_login ? new Date(e.last_login).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t3)' }}>
                    {new Date(e.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
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
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 400, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny portaladgang</div>
            <div style={{ marginBottom: 16 }}>
              <label>Kunde</label>
              <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                <option value="">Vælg kunde</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.company_name})</option>)}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, lineHeight: 1.5 }}>
              Der genereres et unikt link som kunden kan bruge til at tilgå deres portal.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={createAccess} disabled={!selectedCustomer || creating}
                style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>
                {creating ? 'Opretter…' : 'Opret link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
