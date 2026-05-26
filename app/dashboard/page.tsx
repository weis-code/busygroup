'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/UserContext';
import {
  TrendingUp, Users, DollarSign, BarChart2, RefreshCw,
  AlertTriangle, CheckCircle, Clock, Trophy,
} from 'lucide-react';

const MONTHS_DA = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];

function payPeriodLabel(pp: { start: string; end: string }) {
  const s = new Date(pp.start + 'T00:00:00');
  const e = new Date(pp.end + 'T00:00:00');
  return `21. ${MONTHS_DA[s.getMonth()]} – 20. ${MONTHS_DA[e.getMonth()]} ${s.getFullYear()}`;
}

function formatDKK(n: number, compact = false) {
  if (compact) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)} k`;
    return String(n);
  }
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

function todayDK() {
  return new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Nu';
  if (s < 3600) return `${Math.floor(s / 60)} min siden`;
  if (s < 86400) return `${Math.floor(s / 3600)} t siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

const CRM_STAGES = [
  { key: 'new',        label: 'Ny',           color: '#94A3B8' },
  { key: 'contacted',  label: 'Kontaktet',    color: '#3B82F6' },
  { key: 'interested', label: 'Interesseret', color: '#F59E0B' },
  { key: 'proposal',   label: 'Tilbud',       color: '#8B5CF6' },
];
const ACCENT = ['#E84025','#3B82F6','#10B981','#8B5CF6','#F59E0B','#06B6D4','#EC4899'];

interface DashData {
  payPeriod: { start: string; end: string };
  customers: {
    total_mrr: number; total_arr: number; active_count: number;
    by_risk: { low: number; medium: number; high: number };
    top: { id: string; company: string; mrr: number; churn_risk: string; health_score: number; assigned_name: string | null }[];
  };
  external: { period_count: number; period_house_revenue: number; today_count: number };
  sellers: { id: string; name: string; deals_count: number; today_count: number; deals_goal: number }[];
  crm: { by_status: Record<string, number>; pipeline_value: number };
  recentDeals: { id: string; company_name: string; closed_at: string; created_at: string; deal_value: number; house_revenue: number; salesperson_name: string | null; client_name: string | null; client_color: string | null }[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (user && user.role !== 'admin') router.replace('/crm');
  }, [user, router]);

  const load = useCallback(() => {
    fetch('/api/admin/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setData(d); setLastRefresh(new Date()); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#94A3B8', fontSize: 14 }}>
      Indlæser...
    </div>
  );

  const { customers, external, sellers, crm, recentDeals } = data;
  const totalSellerGoal = sellers.reduce((s, x) => s + x.deals_goal, 0);
  const periodPct = totalSellerGoal > 0 ? Math.min(100, Math.round((external.period_count / totalSellerGoal) * 100)) : null;

  const kpis = [
    { label: 'MRR',            value: formatDKK(customers.total_mrr, true),  sub: 'månedlig omsætning',     icon: DollarSign,  color: '#10B981' },
    { label: 'ARR',            value: formatDKK(customers.total_arr, true),  sub: 'årlig omsætning',        icon: BarChart2,   color: '#3B82F6' },
    { label: 'Aktive kunder',  value: String(customers.active_count),         sub: 'administrerede kunder',  icon: Users,       color: '#8B5CF6' },
    { label: 'Ekstern (periode)', value: formatDKK(external.period_house_revenue, true), sub: `${external.period_count} salg · ${payPeriodLabel(data.payPeriod)}`, icon: TrendingUp, color: '#E84025' },
  ];

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>Business Overview</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', textTransform: 'capitalize' }}>{todayDK()}</p>
        </div>
        <button
          onClick={load}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: '#94A3B8', cursor: 'pointer' }}
        >
          <RefreshCw size={12} />
          {lastRefresh.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      {/* ── KPI tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <kpi.icon size={14} color={kpi.color} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#1E293B', lineHeight: 1, marginBottom: 4 }}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Row 2: Kundesundhed + Sælger performance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

        {/* Kundesundhed */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 22px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Kundesundhed</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Lav risiko',    count: customers.by_risk.low,    color: '#10B981', icon: CheckCircle },
              { label: 'Medium risiko', count: customers.by_risk.medium, color: '#F59E0B', icon: Clock },
              { label: 'Høj risiko',   count: customers.by_risk.high,   color: '#EF4444', icon: AlertTriangle },
            ].map(r => (
              <div key={r.label} style={{ flex: 1, background: `${r.color}0D`, borderRadius: 10, padding: '14px 16px', border: `1px solid ${r.color}25` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <r.icon size={13} color={r.color} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: r.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: r.color }}>{r.count}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>kunder</div>
              </div>
            ))}
          </div>

          {/* Top customers mini-list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customers.top.map(c => {
              const riskColor = c.churn_risk === 'high' ? '#EF4444' : c.churn_risk === 'medium' ? '#F59E0B' : '#10B981';
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', flexShrink: 0 }}>{formatDKK(c.mrr, true)}<span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 400 }}>/md.</span></span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sælger performance */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Sælger performance</div>
            {periodPct !== null && (
              <span style={{ fontSize: 11, background: 'rgba(232,64,37,0.1)', color: '#E84025', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                Team: {periodPct}% af mål
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 18 }}>Lønperiode: {payPeriodLabel(data.payPeriod)}</div>

          {sellers.length === 0 ? (
            <div style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Ingen sælgere</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sellers.map((s, i) => {
                const color = ACCENT[i % ACCENT.length];
                const pct = s.deals_goal > 0 ? Math.min(100, Math.round((s.deals_count / s.deals_goal) * 100)) : null;
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: medal ? 16 : 10, fontWeight: 800, color, flexShrink: 0 }}>
                      {medal || s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <div style={{ flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color }}>{s.deals_count}</span>
                          {s.deals_goal > 0 && <span style={{ fontSize: 11, color: '#CBD5E1' }}>/{s.deals_goal}</span>}
                          {s.today_count > 0 && <span style={{ fontSize: 10, color: '#10B981', marginLeft: 6, fontWeight: 600 }}>+{s.today_count} i dag</span>}
                        </div>
                      </div>
                      {pct !== null && (
                        <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#10B981' : color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CRM pipeline mini-oversigt */}
          {Object.keys(crm.by_status).length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 10 }}>Internt CRM pipeline</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CRM_STAGES.map(stage => {
                  const cnt = crm.by_status[stage.key] || 0;
                  if (cnt === 0) return null;
                  return (
                    <div key={stage.key} style={{ background: `${stage.color}12`, border: `1px solid ${stage.color}30`, borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: stage.color }}>{cnt}</span>
                      <span style={{ fontSize: 10, color: '#64748B' }}>{stage.label}</span>
                    </div>
                  );
                })}
                {(crm.by_status.won || 0) > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>{crm.by_status.won}</span>
                    <span style={{ fontSize: 10, color: '#64748B' }}>Vundet</span>
                  </div>
                )}
              </div>
              {crm.pipeline_value > 0 && (
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
                  Pipeline-værdi: <span style={{ fontWeight: 600, color: '#475569' }}>{formatDKK(crm.pipeline_value, true)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Seneste ekstern salg ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Trophy size={15} color="#E84025" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Seneste ekstern salg</span>
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>— {payPeriodLabel(data.payPeriod)}</span>
        </div>
        {recentDeals.length === 0 ? (
          <div style={{ color: '#CBD5E1', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Ingen salg i perioden endnu</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {recentDeals.map(deal => (
              <div key={deal.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', background: '#F8FAFC', borderRadius: 9, border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: deal.client_color || '#E84025', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company_name}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>
                    {[deal.salesperson_name, deal.client_name].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{formatDKK(Number(deal.house_revenue), true)}</div>
                  <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 1 }}>{timeSince(deal.created_at || deal.closed_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
