'use client';

import { useEffect, useState } from 'react';

const STATUS_BG: Record<string, string>  = { PENDING: 'rgba(245,158,11,0.15)', CONFIRMED: 'rgba(45,212,160,0.13)', PAID: 'rgba(79,142,247,0.15)' };
const STATUS_CLR: Record<string, string> = { PENDING: 'var(--ye)', CONFIRMED: 'var(--gr)', PAID: 'var(--bl)' };

interface Sale {
  id: string; date: string; seller_name: string; task_name: string;
  compensation_model: string; units: number | null; deal_size: number | null;
  package_name: string | null; house_revenue: number; status: string; note: string | null;
}
interface ConvRate   { name: string; sales_month: number; contacts_month: number }
interface Period     { id: string; name: string; start_date: string; end_date: string }
interface OverviewData {
  sales: Sale[];
  revenue: { today: number; this_period: number; last_period: number };
  conversionRates: ConvRate[];
  period: Period | null;
  prevPeriod: { start_date: string; end_date: string } | null;
  periodStart: string;
  periodEnd: string;
  seller_count: number;
  desk_count: number;
}

const fmt = (n: number) => Number(n).toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

export default function NlsOverviewPage() {
  const [data, setData]         = useState<OverviewData | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const d = await fetch('/api/admin/overview').then(r => r.json()) as OverviewData;
    setData(d);
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    await fetch(`/api/sales/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    await load();
    setUpdating(null);
  }

  if (!data) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  const { sales, revenue, conversionRates, period, prevPeriod, seller_count, desk_count } = data;

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const periodLabel = period ? `${period.name} (${fmtDate(period.start_date)} – ${fmtDate(period.end_date)})` : 'Aktuel lønperiode';
  const prevLabel   = prevPeriod ? `Forrige (${fmtDate(prevPeriod.start_date)} – ${fmtDate(prevPeriod.end_date)})` : 'Forrige lønperiode';
  const change      = revenue.last_period > 0 ? ((revenue.this_period / revenue.last_period - 1) * 100).toFixed(1) + '%' : '—';

  const periodRev  = Number(revenue.this_period);
  const revPerFTE  = seller_count > 0 ? periodRev / seller_count : null;
  const revPerDesk = desk_count   > 0 ? periodRev / desk_count   : null;
  const potential  = revPerFTE !== null && desk_count > 0 ? revPerFTE * desk_count : null;

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>NLS Oversigt</h1>
        {period && (
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            Lønperiode: <span style={{ color: 'var(--bl)', fontWeight: 600 }}>{period.name}</span> ({fmtDate(period.start_date)} – {fmtDate(period.end_date)})
          </div>
        )}
        {!period && <div style={{ fontSize: 12, color: 'var(--ye)' }}>Ingen aktiv lønperiode — viser indeværende kalendermåned</div>}
      </div>

      {/* Revenue KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Omsætning i dag',        value: fmt(Number(revenue.today)),       accent: 'var(--bl)' },
          { label: 'Aktuel lønperiode',       value: fmt(Number(revenue.this_period)), accent: 'var(--gr)', sub: periodLabel },
          { label: prevLabel,                 value: fmt(Number(revenue.last_period)), accent: 'var(--pu)' },
          { label: 'Ændring',                 value: change,                           accent: Number(change) >= 0 ? 'var(--gr)' : 'var(--re)' },
        ].map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.accent } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{k.value}</div>
            {'sub' in k && k.sub && <div className="kpi-sub" style={{ fontSize: 10 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* FTE metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Omsætning pr. FTE',    value: revPerFTE  !== null ? fmt(revPerFTE)  : '—', sub: `${seller_count} sælger${seller_count !== 1 ? 'e' : ''}`,          accent: 'var(--bl)' },
          { label: 'Omsætning pr. stol',   value: revPerDesk !== null ? fmt(revPerDesk) : '—', sub: desk_count > 0 ? `${desk_count} skriveborde` : '→ Sæt i indstillinger', accent: 'var(--gr)', link: desk_count === 0 ? '/admin/settings' : undefined },
          { label: 'Potentiel (fuldt hus)', value: potential  !== null ? fmt(potential)  : '—', sub: desk_count > 0 ? `Rev/FTE × ${desk_count} stole` : 'Kræver antal stole sat', accent: 'var(--pu)' },
        ].map(t => (
          <div key={t.label} className="kpi-tile" style={{ '--accent': t.accent } as React.CSSProperties}>
            <div className="kpi-label">{t.label}</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{t.value}</div>
            <div className="kpi-sub">
              {'link' in t && t.link ? <a href={t.link} style={{ color: 'var(--bl)' }}>{t.sub}</a> : t.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Conversion rates */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <div className="card-header" style={{ padding: 0, border: 0, marginBottom: 16 }}>Konverteringsrate denne måned</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
          {conversionRates.map(r => {
            const rate = r.contacts_month > 0 ? (r.sales_month / r.contacts_month * 100) : null;
            return (
              <div key={r.name} style={{ background: 'var(--s2)', borderRadius: 8, padding: '13px 16px' }}>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: rate !== null ? 'var(--bl)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums' }}>
                  {rate !== null ? rate.toFixed(1) + '%' : '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                  {r.sales_month} salg / {r.contacts_month} kontakter
                </div>
              </div>
            );
          })}
          {conversionRates.length === 0 && <div style={{ fontSize: 13, color: 'var(--t3)' }}>Ingen data endnu</div>}
        </div>
      </div>

      {/* Sales table */}
      <div className="table-wrap">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Alle salg</span>
          <span style={{ fontWeight: 400, fontSize: 11 }}>{sales.length} registreringer</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>{['Dato', 'Sælger', 'Opgave', 'Type', 'Hus-rev.', 'Status'].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {sales.length === 0 && <tr className="empty-row"><td colSpan={6}>Ingen salg registreret</td></tr>}
              {sales.map(s => (
                <tr key={s.id}>
                  <td className="td-primary">{s.date}</td>
                  <td className="td-primary">{s.seller_name}</td>
                  <td>{s.task_name}</td>
                  <td>
                    {s.compensation_model === 'FIXED'   && `${s.units} units`}
                    {s.compensation_model === 'PERCENT' && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                    {s.compensation_model === 'PACKAGE' && s.package_name}
                  </td>
                  <td style={{ color: 'var(--t1)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(s.house_revenue))}</td>
                  <td>
                    <select
                      value={s.status}
                      disabled={updating === s.id}
                      onChange={e => changeStatus(s.id, e.target.value)}
                      style={{ background: STATUS_BG[s.status], border: `1px solid ${STATUS_CLR[s.status]}55`, color: STATUS_CLR[s.status], borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, width: 'auto' }}
                    >
                      <option value="PENDING">Afventer</option>
                      <option value="CONFIRMED">Bekræftet</option>
                      <option value="PAID">Betalt</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
