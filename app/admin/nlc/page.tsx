'use client';

import { useEffect, useState } from 'react';

interface Deal { id: number; title: string; value: number | null; stage: string; status: string }
interface Stage { id: number; key: string; label: string; color: string; is_won: boolean; is_lost: boolean }

const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

export default function NlcPage() {
  const [deals, setDeals]   = useState<Deal[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const comps = await fetch('/api/companies').then(r => r.json()) as { id: number; slug: string }[];
        const nlc = comps.find(c => c.slug === 'nlc');
        if (!nlc) return;
        setCompanyId(nlc.id);
        const [d, s] = await Promise.all([
          fetch(`/api/crm/deals?status=open&company_id=${nlc.id}`).then(r => r.json()) as Promise<Deal[]>,
          fetch('/api/crm/stages').then(r => r.json()) as Promise<Stage[]>,
        ]);
        if (Array.isArray(d)) setDeals(d);
        if (Array.isArray(s)) setStages(s);
      } catch { /* ignore */ }
    }
    void load();
  }, []);

  const openDeals  = deals.filter(d => d.status === 'open');
  const wonDeals   = deals.filter(d => d.status === 'won');
  const pipeline   = openDeals.reduce((s, d) => s + Number(d.value ?? 0), 0);

  const byStage = stages
    .filter(s => !s.is_won && !s.is_lost)
    .map(s => ({ ...s, count: openDeals.filter(d => d.stage === s.key).length }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Next level Creator</h1>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 20 }}>NLC · Overblik</div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Aktive deals', value: String(openDeals.length), color: '#8b5cf6' },
          { label: 'Pipeline',     value: pipeline > 0 ? fmt(pipeline) : '—', color: 'var(--bl)' },
          { label: 'Vundet',       value: String(wonDeals.length), color: 'var(--gr)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.color } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      {byStage.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 14 }}>Pipeline per stage</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {byStage.map(s => (
              <div key={s.id} style={{ background: 'var(--s2)', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{s.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {companyId === null && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '32px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
          Indlæser NLC data…
        </div>
      )}

      {companyId !== null && openDeals.length === 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '32px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>Ingen aktive deals endnu</div>
          <a href="/admin/nlc/crm" style={{ fontSize: 13, color: '#8b5cf6', fontWeight: 600 }}>Åbn CRM Pipeline →</a>
        </div>
      )}

      {openDeals.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Aktive deals</span>
            <a href="/admin/nlc/crm" style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>Se pipeline →</a>
          </div>
          {openDeals.slice(0, 8).map((d, i) => {
            const stage = stages.find(s => s.key === d.stage);
            return (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--bd)' : 'none', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>{d.title}</div>
                {stage && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: stage.color, background: stage.color + '22', padding: '3px 8px', borderRadius: 100 }}>{stage.label}</span>
                )}
                <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {d.value != null ? fmt(Number(d.value)) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
