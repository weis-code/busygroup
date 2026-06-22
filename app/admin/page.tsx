'use client';

import { useEffect, useState } from 'react';

const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };

interface Sale {
  id: string; date: string; seller_name: string; task_name: string;
  compensation_model: string; units: number | null; deal_size: number | null;
  package_name: string | null; house_revenue: number; status: string; note: string | null;
}
interface ConvRate { name: string; sales_month: number; contacts_month: number }
interface Period { id: string; name: string; start_date: string; end_date: string }
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

export default function AdminPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const d = await fetch('/api/admin/overview').then(r => r.json()) as OverviewData;
    setData(d);
  }

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    await fetch(`/api/sales/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
    setUpdating(null);
  }

  if (!data) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  const { sales, revenue, conversionRates, period, prevPeriod, seller_count, desk_count } = data;

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
  const periodLabel = period
    ? `${period.name} (${fmtDate(period.start_date)} – ${fmtDate(period.end_date)})`
    : 'Aktuel lønperiode';
  const prevLabel = prevPeriod
    ? `Forrige (${fmtDate(prevPeriod.start_date)} – ${fmtDate(prevPeriod.end_date)})`
    : 'Forrige lønperiode';
  const change = revenue.last_period > 0 ? ((revenue.this_period / revenue.last_period - 1) * 100).toFixed(1) + '%' : '—';

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Admin oversigt</h1>
      {period && (
        <div style={{ fontSize: 12, color: '#667788', marginBottom: 24 }}>
          Viser data for lønperiode: <span style={{ color: '#185FA5', fontWeight: 600 }}>{period.name}</span> ({fmtDate(period.start_date)} – {fmtDate(period.end_date)})
        </div>
      )}
      {!period && (
        <div style={{ fontSize: 12, color: '#F39C12', marginBottom: 24 }}>Ingen aktiv lønperiode — viser indeværende kalendermåned</div>
      )}

      {/* Revenue KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'OMSÆTNING I DAG', value: fmt(Number(revenue.today)) },
          { label: 'AKTUEL LØNPERIODE', value: fmt(Number(revenue.this_period)), sub: periodLabel },
          { label: prevLabel.toUpperCase(), value: fmt(Number(revenue.last_period)) },
          { label: 'ÆNDRING', value: change },
        ].map(k => (
          <div key={k.label} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '20px 22px' }}>
            <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#ECF0F1' }}>{k.value}</div>
            {'sub' in k && k.sub && <div style={{ fontSize: 10, color: '#4A5568', marginTop: 6 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* FTE / desk metrics */}
      {(() => {
        const periodRev = Number(revenue.this_period);
        const revPerFTE  = seller_count > 0 ? periodRev / seller_count : null;
        const revPerDesk = desk_count   > 0 ? periodRev / desk_count   : null;
        const potential  = revPerFTE !== null && desk_count > 0 ? revPerFTE * desk_count : null;
        const tiles = [
          {
            label: 'OMSÆTNING PR. FTE',
            value: revPerFTE !== null ? fmt(revPerFTE) : '—',
            sub: `${seller_count} sælger${seller_count !== 1 ? 'e' : ''}`,
            color: '#185FA5',
          },
          {
            label: 'OMSÆTNING PR. STOL',
            value: revPerDesk !== null ? fmt(revPerDesk) : '—',
            sub: desk_count > 0 ? `${desk_count} skriveborde` : 'Sæt antal stole i indstillinger →',
            link: desk_count === 0 ? '/admin/settings' : undefined,
            color: '#0F6E56',
          },
          {
            label: 'POTENTIEL (FULDT HUS)',
            value: potential !== null ? fmt(potential) : '—',
            sub: desk_count > 0 ? `Rev/FTE × ${desk_count} stole` : 'Kræver antal stole sat',
            color: '#8E44AD',
          },
        ];
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
            {tiles.map(t => (
              <div key={t.label} style={{ background: '#111E2A', border: `1px solid ${t.color}22`, borderRadius: 10, padding: '20px 22px' }}>
                <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 8 }}>{t.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>{t.value}</div>
                <div style={{ fontSize: 11, color: '#4A5568' }}>
                  {t.link ? <a href={t.link} style={{ color: '#185FA5', textDecoration: 'underline' }}>{t.sub}</a> : t.sub}
                </div>
                <div style={{ height: 3, background: `${t.color}33`, borderRadius: 2, marginTop: 14 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: t.color, width: revPerFTE !== null ? '100%' : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Conversion rates */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '18px 22px', marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 16 }}>KONVERTERINGSRATE DENNE MÅNED</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {conversionRates.map(r => {
            const rate = r.contacts_month > 0 ? (r.sales_month / r.contacts_month * 100) : null;
            return (
              <div key={r.name} style={{ background: '#0F1923', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 12, color: '#667788', marginBottom: 8, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: rate !== null ? '#185FA5' : '#334455', fontVariantNumeric: 'tabular-nums' }}>
                  {rate !== null ? rate.toFixed(1) + '%' : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#4A5568', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {r.sales_month} salg / {r.contacts_month} kontakter
                </div>
              </div>
            );
          })}
          {conversionRates.length === 0 && (
            <div style={{ fontSize: 13, color: '#667788' }}>Ingen data endnu</div>
          )}
        </div>
      </div>

      {/* Sales table */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#667788', letterSpacing: '0.05em' }}>ALLE SALG</span>
          <span style={{ fontSize: 12, color: '#667788' }}>{sales.length} registreringer</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Dato', 'Sælger', 'Opgave', 'Type', 'Hus-rev.', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen salg registreret</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#ECF0F1' }}>{s.date}</td>
                  <td style={{ fontSize: 13, color: '#ECF0F1' }}>{s.seller_name}</td>
                  <td style={{ fontSize: 13, color: '#667788' }}>{s.task_name}</td>
                  <td style={{ fontSize: 12, color: '#667788' }}>
                    {s.compensation_model === 'FIXED' && `${s.units} units`}
                    {s.compensation_model === 'PERCENT' && `${Number(s.deal_size).toLocaleString('da-DK')} kr`}
                    {s.compensation_model === 'PACKAGE' && s.package_name}
                  </td>
                  <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(s.house_revenue))}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <select
                      value={s.status}
                      disabled={updating === s.id}
                      onChange={e => changeStatus(s.id, e.target.value)}
                      style={{
                        background: `${STATUS_COLOR[s.status]}18`,
                        border: `1px solid ${STATUS_COLOR[s.status]}55`,
                        color: STATUS_COLOR[s.status],
                        borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600, width: 'auto',
                      }}
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
