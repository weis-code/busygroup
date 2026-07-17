'use client';

import { useEffect, useState } from 'react';

interface CompanyRow {
  id: number;
  name: string;
  slug: string;
  color: string;
  logo_initials: string;
  ownership_pct: number;
  mrr: number;
  active_customers: number;
  onboarding_customers: number;
  active_subs: number;
}

interface FinanceData {
  totalMrr: number;
  lastMonthMrr: number;
  totalCustomers: number;
  totalOnboarding: number;
  companies: CompanyRow[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' kr.';
}

function pct(a: number, b: number) {
  if (!b) return null;
  const d = ((a - b) / b) * 100;
  return { val: Math.abs(d).toFixed(0) + '%', up: d >= 0 };
}

export default function GroupFinancePage() {
  const [data, setData]   = useState<FinanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/group/finance')
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as Record<string, string>;
          throw new Error(`HTTP ${r.status} — ${body?.detail ?? body?.error ?? 'ukendt fejl'}`);
        }
        return r.json() as Promise<FinanceData>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Group Finans</h1>
      <div style={{ marginTop: 32, color: 'var(--re)', fontSize: 13, fontWeight: 600 }}>Kunne ikke indlæse finansdata</div>
      <div style={{ marginTop: 8, color: 'var(--t3)', fontSize: 11, fontFamily: 'monospace', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 12px', maxWidth: 640, wordBreak: 'break-all' }}>{error}</div>
    </div>
  );

  if (!data) return (
    <div style={{ padding: '28px 32px', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
  );

  const mrrDelta = pct(data.totalMrr, data.lastMonthMrr);
  const maxMrr   = Math.max(...data.companies.map(c => c.mrr), 1);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Group Finans</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Konsolideret økonomi på tværs af selskaber</div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          {
            label: 'Samlet MRR',
            value: fmt(data.totalMrr),
            sub: mrrDelta
              ? `${mrrDelta.up ? '↑' : '↓'} ${mrrDelta.val} vs. forrige md.`
              : undefined,
            subColor: mrrDelta ? (mrrDelta.up ? 'var(--gr)' : 'var(--re)') : undefined,
            accent: 'var(--gr)',
          },
          {
            label: 'Aktive kunder',
            value: String(data.totalCustomers),
            sub: data.totalOnboarding > 0 ? `+ ${data.totalOnboarding} i onboarding` : undefined,
            accent: 'var(--bl)',
          },
          {
            label: 'Selskaber',
            value: String(data.companies.filter(c => c.mrr > 0).length) + ' / ' + String(data.companies.length),
            sub: 'med aktiv omsætning',
            accent: 'var(--pu)',
          },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, opacity: 0.7, borderRadius: '10px 10px 0 0' }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.accent, marginBottom: 4, lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: k.subColor ?? 'var(--t3)' }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Per-company breakdown */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Selskabsoversigt</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>MRR inkl. ejerskabsjustering</div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 100px 100px 110px', gap: 0, padding: '8px 18px', background: 'var(--s2)', borderBottom: '1px solid var(--bd)' }}>
          {['', 'Selskab', 'MRR', 'Kunder', 'Andel', 'Bar'].map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {data.companies.map((c, i) => {
          const groupMrr     = data.totalMrr > 0 ? (c.mrr / data.totalMrr * 100) : 0;
          const ownedMrr     = Math.round(c.mrr * c.ownership_pct / 100);
          const barW         = maxMrr > 0 ? (c.mrr / maxMrr * 100) : 0;

          return (
            <div key={c.id} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 130px 100px 100px 110px',
              gap: 0, padding: '12px 18px',
              borderBottom: i < data.companies.length - 1 ? '1px solid var(--bd)' : 'none',
              alignItems: 'center',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>

              {/* Color dot */}
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />

              {/* Name */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
                  {c.ownership_pct < 100 ? `${c.ownership_pct}% ejerskab` : 'Heleje'}
                  {c.active_subs > 0 ? ` · ${c.active_subs} abonnementer` : ''}
                </div>
              </div>

              {/* MRR */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.mrr > 0 ? 'var(--gr)' : 'var(--t3)' }}>
                  {c.mrr > 0 ? fmt(c.mrr) : '—'}
                </div>
                {c.ownership_pct < 100 && c.mrr > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{fmt(ownedMrr)} justered</div>
                )}
              </div>

              {/* Customers */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                  {c.active_customers > 0 ? c.active_customers : '—'}
                </div>
                {c.onboarding_customers > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--ye)', marginTop: 1 }}>+{c.onboarding_customers} ob.</div>
                )}
              </div>

              {/* Share of group MRR */}
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--t2)', fontWeight: 500 }}>
                {data.totalMrr > 0 && c.mrr > 0 ? groupMrr.toFixed(0) + '%' : '—'}
              </div>

              {/* Bar */}
              <div style={{ paddingLeft: 12 }}>
                <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: c.color, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Total row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 1fr 130px 100px 100px 110px',
          gap: 0, padding: '12px 18px',
          background: 'var(--s2)', borderTop: '2px solid var(--bd)',
          alignItems: 'center',
        }}>
          <div />
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)' }}>Total</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: 'var(--gr)' }}>{fmt(data.totalMrr)}</div>
          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{data.totalCustomers}</div>
          <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--t3)' }}>100%</div>
          <div />
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)' }}>
        MRR baseret på aktive abonnementer i kunderegistret. EBITDA og cash position kræver integration med regnskabssystem.
      </div>
    </div>
  );
}
