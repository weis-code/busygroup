'use client';

export default function ReminderPage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Reminder Oversigt</h1>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>Reminder app</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'MRR',           value: '—', accent: 'var(--ye)' },
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ye2)', border: '1.5px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'var(--ye)', margin: '0 auto 16px' }}>
          RM
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Reminder dashboard under opbygning</div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>App metrics og Stripe konfigureres her</div>
      </div>
    </div>
  );
}
