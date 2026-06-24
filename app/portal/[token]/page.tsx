'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface PortalData {
  customer_name: string; company_name: string; company_color: string;
  mrr: number; status: string; notes: string | null;
  contact_name: string | null; contact_email: string | null;
  products: { id: number; product_name: string; price_dkk: number; status: string; started_at: string | null }[];
}

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`/api/portal/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setData(d as PortalData))
      .catch(() => setError('Ugyldig eller udløbet portaladgang.'));
  }, [token]);

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
            { label: 'Månedlig faktura', value: fmtMrr(Number(data.mrr)) },
            { label: 'Aktive produkter', value: String(data.products.filter(p => p.status === 'active').length) },
            { label: 'Kontaktperson', value: data.contact_name ?? '—' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '16px 18px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>{k.value}</div>
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

        {/* Notes */}
        {data.notes && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Noter</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{data.notes}</div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 11, color: 'var(--t4)' }}>
          Powered by NextLevel Group
        </div>
      </div>
    </div>
  );
}
