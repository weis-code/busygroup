'use client';

export default function QuorexPage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Quorex Oversigt</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>SaaS platform</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'MRR',           value: '—', accent: 'var(--pu)' },
          { label: 'Aktive kunder', value: '—', accent: 'var(--bl)' },
          { label: 'Churn rate',    value: '—', accent: 'var(--re)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--pu2)', border: '1.5px solid rgba(167,139,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--pu)', margin: '0 auto 16px' }}>
          QX
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Quorex dashboard under opbygning</div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Stripe og Hubspot integrationer konfigureres her</div>
      </div>
    </div>
  );
}
