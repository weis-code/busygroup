'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, TrendingUp, Target, Zap, Trophy, Clock } from 'lucide-react';

const MONTHS_DA = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
const ACCENT = ['#E84025','#3B82F6','#10B981','#8B5CF6','#F59E0B','#06B6D4','#EC4899','#14B8A6'];

function periodLabel(pp: { start: string; end: string }) {
  const s = new Date(pp.start + 'T00:00:00');
  const e = new Date(pp.end + 'T00:00:00');
  const sy = s.getFullYear(), ey = e.getFullYear();
  const yearSuffix = sy !== ey ? ` ${ey}` : '';
  return `21. ${MONTHS_DA[s.getMonth()]} – 20. ${MONTHS_DA[e.getMonth()]}${yearSuffix} ${sy}`;
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Nu';
  if (s < 3600) return `${Math.floor(s / 60)} min siden`;
  if (s < 86400) return `${Math.floor(s / 3600)} t siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

interface Seller {
  id: string; name: string;
  deals_count: number; today_count: number; deals_goal: number;
}
interface OpgaveStat {
  id: string; name: string; color: string;
  today_count: number; period_count: number;
}
interface RecentDeal {
  id: string; company_name: string;
  closed_at: string; created_at: string;
  salesperson_name: string | null;
  client_name: string | null; client_color: string | null;
}
interface DashData {
  payPeriod: { start: string; end: string; key: string };
  today: { count: number };
  period: { count: number };
  byOpgave: OpgaveStat[];
  sellers: Seller[];
  recent: RecentDeal[];
}

export default function SalesDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(() => {
    fetch('/api/salg/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setData(d); setLastRefresh(new Date()); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F8FAFC', color: '#94A3B8', fontSize: 14 }}>
      Indlæser dashboard...
    </div>
  );
  if (!data) return null;

  const totalGoal  = data.sellers.reduce((s, x) => s + x.deals_goal, 0);
  const periodPct  = totalGoal > 0 ? Math.min(100, Math.round((data.period.count / totalGoal) * 100)) : null;

  const kpis = [
    { label: 'Salg i dag',   value: data.today.count,  sub: 'lukkede salg',                          icon: Zap,      color: '#10B981' },
    { label: 'Lønperiode',   value: data.period.count, sub: periodLabel(data.payPeriod),              icon: TrendingUp, color: '#E84025' },
    ...(totalGoal > 0 ? [
      { label: 'Team mål',   value: totalGoal,          sub: 'salg at nå i perioden',                icon: Target,   color: '#3B82F6' },
      { label: 'Fremgang',   value: `${periodPct ?? 0}%`, sub: `${data.period.count} af ${totalGoal} salg`, icon: Trophy, color: '#F59E0B' },
    ] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', color: '#1E293B', fontFamily: 'inherit' }}>

      {/* ── Header ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.push('/salg')}
            style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500 }}
          >
            <ArrowLeft size={13} /> Tilbage
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #E84025, #C4331B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff' }}>
              B
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>Salgsdashboard</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>Lønperiode: {periodLabel(data.payPeriod)}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, color: '#CBD5E1' }}>
            Opdateret {lastRefresh.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={load}
            style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 7, borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── KPI row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 14 }}>
          {kpis.map(kpi => (
            <div key={kpi.label} style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <kpi.icon size={13} color={kpi.color} />
                </div>
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Main grid: opgaver + sælgere ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14 }}>

          {/* Per-opgave tabel */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <TrendingUp size={15} color="#E84025" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Salg per opgave</span>
            </div>
            {data.byOpgave.length === 0 ? (
              <div style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>Ingen aktive opgaver</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0 12px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      Opgave
                    </th>
                    <th style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 90 }}>
                      I dag
                    </th>
                    <th style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 0 12px', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 90 }}>
                      Periode
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.byOpgave.map((o, i) => (
                    <tr key={o.id} style={{ borderBottom: i < data.byOpgave.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                      <td style={{ padding: '13px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 2, background: o.color || '#E84025', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{o.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '13px 0' }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: o.today_count > 0 ? '#10B981' : '#E2E8F0', lineHeight: 1 }}>
                          {o.today_count}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '13px 0' }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: o.period_count > 0 ? '#E84025' : '#E2E8F0', lineHeight: 1 }}>
                          {o.period_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sælger rangliste */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Trophy size={15} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Sælgere</span>
            </div>
            {data.sellers.length === 0 ? (
              <div style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', padding: '40px 0' }}>Ingen sælgere</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {data.sellers.map((s, i) => {
                  const color = ACCENT[i % ACCENT.length];
                  const pct   = s.deals_goal > 0 ? Math.min(100, Math.round((s.deals_count / s.deals_goal) * 100)) : null;
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: medal ? 20 : 11, fontWeight: 800, color, flexShrink: 0 }}>
                        {medal || initials(s.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.name}
                          </span>
                          <div style={{ flexShrink: 0, marginLeft: 8, textAlign: 'right' }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{s.deals_count}</span>
                            {s.deals_goal > 0 && (
                              <span style={{ fontSize: 11, color: '#CBD5E1' }}>/{s.deals_goal}</span>
                            )}
                          </div>
                        </div>
                        {pct !== null ? (
                          <>
                            <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10B981' : color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                            </div>
                            <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 3 }}>
                              {pct}% af mål
                              {s.today_count > 0 && <span style={{ marginLeft: 6, color: '#10B981', fontWeight: 600 }}>+{s.today_count} i dag</span>}
                            </div>
                          </>
                        ) : (
                          s.today_count > 0 && (
                            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>+{s.today_count} i dag</div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Seneste salg ── */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Seneste salg</span>
          </div>
          {data.recent.length === 0 ? (
            <div style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
              Ingen salg registreret i lønperioden endnu
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {data.recent.map(deal => (
                <div key={deal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 13px', background: '#F8FAFC', borderRadius: 9, border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: deal.client_color || '#E84025', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deal.company_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                      {[deal.salesperson_name, deal.client_name].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#CBD5E1', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} />
                    {timeSince(deal.created_at || deal.closed_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
