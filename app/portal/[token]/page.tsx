'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PortalTicket {
  id: number; subject: string; status: string; priority: string; type: string; created_at: string;
}
interface PortalData {
  customer_id: number; customer_name: string; company_name: string; company_color: string;
  mrr: number; status: string; notes: string | null;
  contact_name: string | null; contact_email: string | null;
  products: { id: number; product_name: string; price_dkk: number; status: string; started_at: string | null }[];
  tickets: PortalTicket[];
}

const STATUS_DA: Record<string, { label: string; color: string; bg: string }> = {
  open:              { label: 'Åben',          color: 'var(--bl)', bg: 'var(--bl2)' },
  awaiting_customer: { label: 'Afventer dig',  color: 'var(--ye)', bg: 'var(--ye2)' },
  in_progress:       { label: 'I gang',         color: 'var(--pu)', bg: 'var(--pu2)' },
  resolved:          { label: 'Løst',           color: 'var(--gr)', bg: 'var(--gr2)' },
  closed:            { label: 'Lukket',         color: 'var(--t3)', bg: 'var(--s3)'  },
};

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData]     = useState<PortalData | null>(null);
  const [error, setError]   = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', type: 'general' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/portal/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setData(d as PortalData))
      .catch(() => setError('Ugyldig eller udløbet portaladgang.'));
  }, [token]);

  async function submitTicket() {
    if (!newTicket.subject.trim() || submitting) return;
    setSubmitting(true);
    await fetch(`/api/portal/${token}/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket),
    });
    setSubmitting(false);
    setSubmitted(true);
    setShowNew(false);
    // Refresh tickets
    const updated = await fetch(`/api/portal/${token}`).then(r => r.json()) as PortalData;
    setData(updated);
  }

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 13, padding: '32px 40px', textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Adgang ikke fundet</div>
        <div style={{ fontSize: 13, color: 'var(--t2)' }}>{error}</div>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
      Indlæser…
    </div>
  );

  const fmtMrr = (n: number) => n > 0 ? Number(n).toLocaleString('da-DK') + ' kr/md' : '—';
  const openTickets = (data.tickets ?? []).filter(t => t.status !== 'resolved' && t.status !== 'closed');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: `${data.company_color}22`, border: `2px solid ${data.company_color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: data.company_color }}>
            {data.company_name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)' }}>{data.customer_name}</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>{data.company_name}</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: data.status === 'active' ? 'var(--gr2)' : 'var(--s3)', color: data.status === 'active' ? 'var(--gr)' : 'var(--t3)' }}>
              {data.status === 'active' ? 'Aktiv kunde' : data.status}
            </span>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Månedlig faktura',  value: fmtMrr(Number(data.mrr)) },
            { label: 'Aktive produkter',  value: String(data.products.filter(p => p.status === 'active').length) },
            { label: 'Åbne tickets',      value: String(openTickets.length), accent: openTickets.length > 0 ? 'var(--ye)' : undefined },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '16px 18px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.accent ?? 'var(--t1)' }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Products */}
        {data.products.length > 0 && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Produkter & ydelser</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  {['Produkt', 'Pris/md', 'Start', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.products.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--bd)' }}>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{p.product_name}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--t2)' }}>{Number(p.price_dkk).toLocaleString('da-DK')} kr</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--t3)' }}>
                      {p.started_at ? new Date(p.started_at + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: p.status === 'active' ? 'var(--gr2)' : 'var(--s3)', color: p.status === 'active' ? 'var(--gr)' : 'var(--t3)' }}>
                        {p.status === 'active' ? 'Aktiv' : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Support */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Support</div>
            <button onClick={() => setShowNew(true)}
              style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
              + Ny henvendelse
            </button>
          </div>

          {submitted && (
            <div style={{ padding: '12px 16px', background: 'var(--gr2)', color: 'var(--gr)', fontSize: 12, fontWeight: 600 }}>
              ✓ Vi vender tilbage hurtigst muligt
            </div>
          )}

          {(data.tickets ?? []).length === 0 ? (
            <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>Ingen supporthenvendelser endnu</div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {data.tickets.map(t => {
                const st = STATUS_DA[t.status] ?? { label: t.status, color: 'var(--t2)', bg: 'var(--s3)' };
                return (
                  <div key={t.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{t.subject}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>#{t.id} · {new Date(t.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        {data.notes && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '16px 18px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Noter</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{data.notes}</div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: 'var(--t4)' }}>
          Powered by NextLevel Group
        </div>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowNew(false)}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 26px', width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>Ny supporthenvendelse</div>
            {[
              { label: 'Emne *', el: <input value={newTicket.subject} onChange={e => setNewTicket(f => ({ ...f, subject: e.target.value }))} placeholder="Hvad drejer det sig om?" style={portalInputStyle} /> },
              { label: 'Beskrivelse', el: <textarea value={newTicket.description} onChange={e => setNewTicket(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Beskriv problemet eller forespørgslen…" style={{ ...portalInputStyle, resize: 'vertical' }} /> },
              { label: 'Type', el: <select value={newTicket.type} onChange={e => setNewTicket(f => ({ ...f, type: e.target.value }))} style={portalInputStyle}><option value="general">Generel</option><option value="change">Ændring</option><option value="error">Fejl</option><option value="question">Spørgsmål</option><option value="other">Andet</option></select> },
            ].map((f, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>{f.label}</div>
                {f.el}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => void submitTicket()} disabled={!newTicket.subject.trim() || submitting}
                style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: newTicket.subject.trim() ? 1 : 0.5 }}>
                {submitting ? 'Sender…' : 'Send henvendelse'}
              </button>
              <button onClick={() => setShowNew(false)} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '9px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const portalInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '9px 11px',
  background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t1)',
};
