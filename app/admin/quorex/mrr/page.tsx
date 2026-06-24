'use client';

export default function QuorexMrrPage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Quorex MRR</h1>
      <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 24 }}>Monthly Recurring Revenue</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'MRR', value: '—', accent: 'var(--pu)' },
          { label: 'ARR', value: '—', accent: 'var(--bl)' },
          { label: 'Churn', value: '—', accent: 'var(--re)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        MRR-integration under opbygning — kobles til Stripe
      </div>
    </div>
  );
}
