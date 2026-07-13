'use client';

import { useEffect, useState } from 'react';

const PRODUCT = 'BusyReminder';
const ACCENT  = 'var(--ye)';

interface Customer { id: number; name: string; contact_name: string | null; price_dkk: number; started_at: string | null }
interface Stats { mrr: number; activeCount: number; newThisMonth: number; customers: Customer[] }

function fmt(n: number) { return new Intl.NumberFormat('da-DK').format(n) + ' kr.'; }

export default function BusyReminderProductPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch(`/api/meridian/products/stats?product=${encodeURIComponent(PRODUCT)}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--ye2)', border: '1.5px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: ACCENT }}>BR</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>BusyReminder — oversigt</h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>Meridian Consulting · SaaS produkt</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Aktive kunder', value: stats ? String(stats.activeCount) : '—', color: 'var(--bl)' },
          { label: 'MRR',          value: stats ? fmt(stats.mrr)            : '—', color: ACCENT },
          { label: 'Ny denne md.', value: stats ? String(stats.newThisMonth): '—', color: 'var(--gr)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Kunder med BusyReminder</span>
          <a href="/admin/customers" style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>Alle kunder →</a>
        </div>
        {!stats ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
        ) : stats.customers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen BusyReminder kunder endnu</div>
        ) : (
          stats.customers.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: i < stats.customers.length - 1 ? '1px solid var(--bd)' : 'none', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.name}</div>
                {c.contact_name && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{c.contact_name}</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(c.price_dkk)}/md.</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
