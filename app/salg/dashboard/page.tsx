'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, TrendingUp, Target, Zap, Calendar, BarChart3, Trophy } from 'lucide-react';
import { useUser } from '@/lib/UserContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

interface SellerStat {
  id: string; name: string;
  deals_count: number; revenue: number; house_revenue: number;
  revenue_goal: number; deals_goal: number;
}
interface MonthStat { period: string; label: string; count: number; revenue: number; house_revenue: number; }
interface OpgaveStat { id: string; name: string; color: string; deals_count: number; revenue: number; house_revenue: number; }
interface RecentDeal {
  id: string; company_name: string; deal_value: number; house_revenue: number; closed_at: string; created_at: string;
  salesperson_name: string | null; product_name: string | null;
  client_name: string | null; client_color: string | null;
}
interface DashData {
  isAdmin: boolean;
  today: { count: number; revenue: number; house_revenue: number };
  week:  { count: number; revenue: number; house_revenue: number };
  month: { count: number; revenue: number; house_revenue: number };
  year:  { count: number; revenue: number; house_revenue: number };
  monthly: MonthStat[];
  byOpgave: OpgaveStat[];
  sellers: SellerStat[];
  recent: RecentDeal[];
  period: string;
}

const MONTHS_DA = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

function formatDKK(n: number, compact = false) {
  if (compact) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
    if (n >= 1_000)     return `${Math.round(n / 1_000)} k`;
    return String(n);
  }
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

function periodLabel(p: string) {
  const [year, month] = p.split('-');
  return `${MONTHS_DA[Number(month) - 1]} ${year}`;
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return 'Nu';
  if (s < 3600) return `${Math.floor(s / 60)} min siden`;
  if (s < 86400) return `${Math.floor(s / 3600)} t siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const ACCENT_COLORS = ['#E84025','#3B82F6','#10B981','#8B5CF6','#F59E0B','#06B6D4'];

function ProgressRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

const CustomTooltip = ({ active, payload, label, isAdmin }: { active?: boolean; payload?: {value: number}[]; label?: string; isAdmin: boolean }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      {isAdmin
        ? <div style={{ fontSize: 14, fontWeight: 700, color: '#E84025' }}>{formatDKK(payload[0].value)}</div>
        : <div style={{ fontSize: 14, fontWeight: 700, color: '#3B82F6' }}>{payload[0].value} salg</div>
      }
    </div>
  );
};

export default function SalesDashboard() {
  const router = useRouter();
  useUser();

  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    fetch('/api/salg/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setData(d); setLastRefresh(new Date()); } setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const refresh = setInterval(load, 30000);
    const clock = setInterval(() => setTick(t => t + 1), 60000);
    return () => { clearInterval(refresh); clearInterval(clock); };
  }, [load, tick]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#060D18', color: '#334155', fontSize: 14 }}>
      Indlæser dashboard...
    </div>
  );
  if (!data) return null;

  const chartData = data.monthly.map(m => ({
    name: m.label,
    value: data.isAdmin ? m.house_revenue : m.count,
    period: m.period,
    isCurrent: m.period === data.period,
  }));

  const totalOpgaveRevenue = data.byOpgave.reduce((s, o) => s + o.revenue, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#060D18', color: '#F1F5F9', fontFamily: 'inherit' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => router.push('/salg')}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, fontSize: 12 }}
          >
            <ArrowLeft size={13} /> Tilbage
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #E84025, #C4331B)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>B</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.2px' }}>{data.isAdmin ? 'Salgsdashboard' : 'Mine salg'}</div>
              <div style={{ fontSize: 11, color: '#334155' }}>{periodLabel(data.period)}</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 11, color: '#1E293B' }}>
            Opdateret {lastRefresh.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button
            onClick={load}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', color: '#475569', padding: 7, borderRadius: 6, display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Row 1: KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'I dag',       icon: Zap,        color: '#10B981', count: data.today.count, revenue: data.today.revenue, house: data.today.house_revenue },
            { label: 'Denne uge',   icon: Calendar,   color: '#3B82F6', count: data.week.count,  revenue: data.week.revenue,  house: data.week.house_revenue  },
            { label: 'Denne måned', icon: TrendingUp, color: '#E84025', count: data.month.count, revenue: data.month.revenue, house: data.month.house_revenue },
            { label: 'År til dato', icon: BarChart3,  color: '#8B5CF6', count: data.year.count,  revenue: data.year.revenue,  house: data.year.house_revenue  },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '20px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, right: -10, width: 70, height: 70, borderRadius: '50%', background: `${kpi.color}0F` }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${kpi.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <kpi.icon size={13} color={kpi.color} />
                </div>
              </div>
              <div style={{ fontSize: 44, fontWeight: 800, color: kpi.color, lineHeight: 1, marginBottom: 4 }}>{kpi.count}</div>
              <div style={{ fontSize: 11, color: '#334155', marginBottom: 14 }}>lukkede salg</div>
              <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {data.isAdmin ? (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0' }}>{formatDKK(kpi.house, true)}</div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>husets omsætning</div>
                    {kpi.house !== kpi.revenue && (
                      <div style={{ fontSize: 10, color: '#1E3A5F', marginTop: 2 }}>{formatDKK(kpi.revenue, true)} solgt for</div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0' }}>{formatDKK(kpi.revenue, true)}</div>
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>solgt for</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: Chart + Opgaver ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14 }}>

          {/* Monthly bar chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={15} color="#E84025" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>
                  {data.isAdmin ? 'Månedlig omsætning (huset)' : 'Månedlige salg'} — seneste 6 mdr.
                </span>
              </div>
              <span style={{ fontSize: 11, background: 'rgba(232,64,37,0.1)', color: '#E84025', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                {data.isAdmin ? formatDKK(data.month.house_revenue, true) : `${data.month.count} salg`} denne md.
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={28}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#334155', fontSize: 10 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => data.isAdmin ? formatDKK(v, true) : String(v)}
                  width={data.isAdmin ? 52 : 28}
                />
                <Tooltip content={<CustomTooltip isAdmin={data.isAdmin} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrent ? '#E84025' : '#1E3A5F'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Opgave breakdown */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '22px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Target size={15} color="#3B82F6" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>Opgaver denne måned</span>
            </div>
            {data.byOpgave.length === 0 ? (
              <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '30px 0' }}>Ingen salg registreret</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.byOpgave.map((o, i) => {
                  const pct = totalOpgaveRevenue > 0 ? Math.round((o.revenue / totalOpgaveRevenue) * 100) : 0;
                  const color = o.color || ACCENT_COLORS[i % ACCENT_COLORS.length];
                  return (
                    <div key={o.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{o.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: '#475569' }}>{o.deals_count} salg</span>
                          {data.isAdmin && <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>{formatDKK(o.house_revenue, true)}</span>}
                          <span style={{ fontSize: 10, color: color, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 3: Sellers + Recent deals ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14 }}>

          {/* Seller leaderboard */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '22px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Trophy size={15} color="#F59E0B" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>Sælgere — {periodLabel(data.period)}</span>
            </div>
            {data.sellers.length === 0 ? (
              <div style={{ color: '#334155', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Ingen sælgere endnu</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {data.sellers.map((s, i) => {
                  const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
                  const revPct   = s.revenue_goal > 0 ? Math.min(100, Math.round((s.revenue / s.revenue_goal) * 100)) : null;
                  const dealsPct = s.deals_goal > 0 ? Math.min(100, Math.round((s.deals_count / s.deals_goal) * 100)) : null;
                  const mainPct  = data.isAdmin ? revPct : dealsPct;
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Rank */}
                      <div style={{ fontSize: 11, fontWeight: 800, color: i === 0 ? '#F59E0B' : '#334155', width: 16, textAlign: 'center', flexShrink: 0 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                      </div>

                      {/* Progress ring */}
                      {mainPct !== null ? (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <ProgressRing pct={mainPct} color={color} size={46} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color }}>
                            {mainPct}%
                          </div>
                        </div>
                      ) : (
                        <div style={{ width: 46, height: 46, borderRadius: '50%', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color, flexShrink: 0 }}>
                          {initials(s.name)}
                        </div>
                      )}

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{s.name}</span>
                          <span style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{s.deals_count}</span>
                          <span style={{ fontSize: 10, color: '#475569' }}>salg</span>
                        </div>
                        {/* Progress bar */}
                        {mainPct !== null && (
                          <div>
                            <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${mainPct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 3, transition: 'width 0.6s ease' }} />
                            </div>
                            <div style={{ fontSize: 10, color: '#334155', marginTop: 3 }}>
                              {data.isAdmin
                                ? `${formatDKK(s.house_revenue, true)} / ${formatDKK(s.revenue_goal, true)}`
                                : `${s.deals_count} / ${s.deals_goal} salg`
                              }
                            </div>
                          </div>
                        )}
                        {mainPct === null && data.isAdmin && s.house_revenue > 0 && (
                          <div style={{ fontSize: 12, color: '#334155' }}>{formatDKK(s.house_revenue, true)} husets omsætning</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent deals feed */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '22px 22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>Live feed</span>
            </div>
            {data.recent.length === 0 ? (
              <div style={{ color: '#334155', fontSize: 12, textAlign: 'center', padding: '30px 0' }}>Ingen salg endnu</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1, overflowY: 'auto' }}>
                {data.recent.map((deal, i) => (
                  <div key={deal.id} style={{ padding: '10px 0', borderBottom: i < data.recent.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Opgave color dot */}
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: deal.client_color || '#E84025', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#CBD5E1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company_name}</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>
                        {deal.salesperson_name && <span>{deal.salesperson_name}</span>}
                        {deal.client_name && <span> · {deal.client_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {data.isAdmin && <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>{formatDKK(Number(deal.house_revenue ?? deal.deal_value), true)}</div>}
                      <div style={{ fontSize: 10, color: '#1E3A5F', marginTop: 1 }}>{timeSince(deal.created_at || deal.closed_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
