'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, ArrowLeft, Target, RefreshCw } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

interface SellerStat {
  id: string;
  name: string;
  deals_count: number;
  revenue: number;
  revenue_goal: number;
  deals_goal: number;
}

interface RecentDeal {
  id: string;
  company_name: string;
  deal_value: number;
  closed_at: string;
  salesperson_name: string | null;
  product_name: string | null;
  client_name: string | null;
}

interface DashData {
  today:   { count: number; revenue: number };
  week:    { count: number; revenue: number };
  month:   { count: number; revenue: number };
  sellers: SellerStat[];
  recent:  RecentDeal[];
  period:  string;
}

function formatDKK(n: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function periodLabel(p: string) {
  const [year, month] = p.split('-');
  const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  return `${names[Number(month) - 1]} ${year}`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.07)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  );
}

export default function SalesDashboard() {
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';

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
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0F172A', color: '#94A3B8', fontSize: 14 }}>
      Indlæser dashboard...
    </div>
  );

  if (!data) return null;

  const SELLER_COLORS = ['#E84025','#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C'];

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', padding: '28px 32px', color: '#F1F5F9' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => router.push('/salg')}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, fontSize: 13 }}
          >
            <ArrowLeft size={14} /> Tilbage
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>Salgsdashboard</h1>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{periodLabel(data.period)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#334155' }}>
            Opdateret {lastRefresh.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            onClick={load}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#64748B', padding: 8, borderRadius: 7, display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Big stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'I dag',        count: data.today.count, revenue: data.today.revenue,  color: '#2ECC71' },
          { label: 'Denne uge',    count: data.week.count,  revenue: data.week.revenue,   color: '#3498DB' },
          { label: 'Denne måned',  count: data.month.count, revenue: data.month.revenue,  color: '#E84025' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 26px' }}>
            <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{stat.label}</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.count}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>lukkede salg</div>
            {isAdmin && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>{formatDKK(stat.revenue)}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>omsætning</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

        {/* ── Seller leaderboard ── */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <Target size={16} color="#E84025" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>Sælgere — {periodLabel(data.period)}</span>
          </div>

          {data.sellers.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Ingen sælgere endnu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {data.sellers.map((s, i) => {
                const color = SELLER_COLORS[i % SELLER_COLORS.length];
                const dealsPct = s.deals_goal > 0 ? Math.min(100, Math.round((s.deals_count / s.deals_goal) * 100)) : null;
                const revPct   = s.revenue_goal > 0 ? Math.min(100, Math.round((s.revenue / s.revenue_goal) * 100)) : null;
                return (
                  <div key={s.id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                          {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>{s.name}</div>
                          {isAdmin && s.revenue_goal > 0 && (
                            <div style={{ fontSize: 11, color: '#475569' }}>Mål: {formatDKK(s.revenue_goal)}</div>
                          )}
                          {!isAdmin && s.deals_goal > 0 && (
                            <div style={{ fontSize: 11, color: '#475569' }}>Mål: {s.deals_goal} salg</div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color }}>
                          {s.deals_count}
                        </div>
                        <div style={{ fontSize: 10, color: '#475569' }}>salg</div>
                      </div>
                    </div>

                    {/* Deals progress bar (always shown) */}
                    {s.deals_goal > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 3 }}>
                          <span>Salg-mål</span>
                          <span>{s.deals_count} / {s.deals_goal} ({dealsPct}%)</span>
                        </div>
                        <ProgressBar value={s.deals_count} max={s.deals_goal} color={color} />
                      </div>
                    )}

                    {/* Revenue progress bar (admin only) */}
                    {isAdmin && (
                      <div>
                        {s.revenue_goal > 0 && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginBottom: 3, marginTop: s.deals_goal > 0 ? 6 : 0 }}>
                              <span>Omsætnings-mål</span>
                              <span>{formatDKK(s.revenue)} / {formatDKK(s.revenue_goal)} ({revPct}%)</span>
                            </div>
                            <ProgressBar value={s.revenue} max={s.revenue_goal} color="#E84025" />
                          </>
                        )}
                        {s.revenue_goal === 0 && (
                          <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>{formatDKK(s.revenue)} omsætning</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent deals ── */}
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '22px 26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <TrendingUp size={16} color="#2ECC71" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>Seneste salg</span>
          </div>

          {data.recent.length === 0 ? (
            <div style={{ color: '#475569', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Ingen salg endnu</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.recent.map(deal => (
                <div key={deal.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.company_name}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                        {deal.salesperson_name && <span>{deal.salesperson_name}</span>}
                        {deal.client_name && <span style={{ color: '#334155' }}> · {deal.client_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isAdmin && <div style={{ fontSize: 13, fontWeight: 700, color: '#2ECC71' }}>{formatDKK(Number(deal.deal_value))}</div>}
                      <div style={{ fontSize: 11, color: '#334155' }}>{fmtDate(deal.closed_at)}</div>
                    </div>
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
