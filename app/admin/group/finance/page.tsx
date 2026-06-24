'use client';

export default function GroupFinancePage() {
  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Group Finans</h1>
      <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 24 }}>Konsolideret økonomi på tværs af selskaber</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Samlet omsætning',  value: '—', accent: 'var(--bl)' },
          { label: 'Samlet MRR',        value: '—', accent: 'var(--gr)' },
          { label: 'EBITDA',            value: '—', accent: 'var(--pu)' },
          { label: 'Cash position',     value: '—', accent: 'var(--ye)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        Finansmodul under opbygning — konsoliderer data fra alle selskaber
      </div>
    </div>
  );
}
