'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KPIs { revenue: number; mrr: number; ebitda: number; headcount: number }
interface CompanyData {
  slug: string; name: string; subtitle: string | null; color: string; initials: string;
  revenue: number; mrr: number | null; fixed_costs: number; ebitda: number; type: string;
}
interface ChartEntry { month: string; label: string; total: number; [key: string]: number | string | undefined }
interface BreakEven { totalFixedCosts: number; currentRevenue: number; margin: number; percentage: number | null }
interface Overview { kpis: KPIs; companies: CompanyData[]; chart: ChartEntry[]; breakEven: BreakEven }
interface CrmOverview {
  totalValue: number; totalCount: number;
  byWorkspace: { workspace_id: number | null; workspace_name: string; count: number; value: number }[];
}
interface Candidate { id: number; stage: string; company_name: string | null }
interface TicketRow { id: number; status: string; priority: string }

function fmt(n: number): string {
  return new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' kr.';
}

function KpiTile({ label, value, color = 'var(--t1)', suffix }: { label: string; value: string | number; color?: string; suffix?: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1 }}>
        {value}
        {suffix && <span style={{ fontSize: 13, color: 'var(--t2)', marginLeft: 5, fontWeight: 600 }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function GroupPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  // Cross-company CRM/HR/tickets state — sections hide themselves if the
  // fetch 403s (some of these are ADMIN-only) rather than showing an error.
  const [crm, setCrm] = useState<CrmOverview | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);

  async function loadOverview() {
    setLoading(true);
    try {
      const data = await fetch('/api/finance/overview').then(r => r.json()) as Overview;
      setOverview(data);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }

  async function loadCrm() {
    try {
      const data = await fetch('/api/crm/overview').then(r => r.ok ? r.json() : null) as CrmOverview | null;
      if (data) setCrm(data);
    } catch { /* noop */ }
  }

  async function loadCandidates() {
    try {
      const data = await fetch('/api/hr/candidates').then(r => r.ok ? r.json() : null);
      if (Array.isArray(data)) setCandidates(data as Candidate[]);
    } catch { /* noop */ }
  }

  async function loadTickets() {
    try {
      const sources = ['group', 'creatorrate', 'meridian'];
      const results = await Promise.all(
        sources.map(s => fetch(`/api/tickets?source=${s}&status=open`).then(r => r.ok ? r.json() : []))
      );
      setTickets(results.flat().filter((t): t is TicketRow => !!t && typeof t === 'object'));
    } catch { /* noop */ }
  }

  useEffect(() => { loadOverview(); loadCrm(); loadCandidates(); loadTickets(); }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', height: '100%' }}>
      <div style={{ maxWidth: 1060 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Koncern Overblik</h1>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>NextLevel Group — konsolideret</div>
          </div>
          <button onClick={loadOverview}
            style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12, color: 'var(--t2)', cursor: 'pointer' }}>
            Opdater
          </button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: '60px 0', textAlign: 'center' }}>Indlæser…</div>
        ) : !overview ? (
          <div style={{ color: 'var(--t3)', fontSize: 13 }}>Kunne ikke indlæse finansdata</div>
        ) : (
          <>
            {/* KPI tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              <KpiTile label="Omsætning MTD"  value={fmt(overview.kpis.revenue)}   color="var(--t1)" />
              <KpiTile label="MRR (SaaS)"      value={fmt(overview.kpis.mrr)}       color="var(--bl)" />
              <KpiTile
                label="EBITDA"
                value={fmt(overview.kpis.ebitda)}
                color={overview.kpis.ebitda >= 0 ? 'var(--gr)' : 'var(--re)'}
              />
              <KpiTile label="Headcount" value={overview.kpis.headcount} suffix="FTE" color="var(--pu)" />
            </div>

            {/* Chart + Break-even */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 12, marginBottom: 20 }}>
              {/* Bar chart */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Omsætning de seneste 6 måneder
                </div>
                {overview.chart.length === 0 ? (
                  <div style={{ color: 'var(--t3)', fontSize: 13, padding: '36px 0', textAlign: 'center' }}>Ingen data endnu</div>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={overview.chart} barSize={24} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--t3)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [`DKK ${fmt(Number(v))}`, 'Total']}
                        labelStyle={{ color: 'var(--t1)', fontWeight: 700 }}
                        cursor={{ fill: 'rgba(79,142,247,0.06)' }}
                      />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                        {overview.chart.map((_, i) => (
                          <Cell key={i} fill={i === overview.chart.length - 1 ? 'var(--bl)' : 'var(--s3)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Break-even card */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                  Break-even
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>Faste omkostninger</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--t1)' }}>DKK {fmt(overview.breakEven.totalFixedCosts)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>Aktuel omsætning</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: overview.breakEven.currentRevenue >= overview.breakEven.totalFixedCosts ? 'var(--gr)' : 'var(--ye)' }}>
                      DKK {fmt(overview.breakEven.currentRevenue)}
                    </div>
                  </div>
                  {overview.breakEven.percentage !== null && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>Dækning af break-even</div>
                      <div style={{ background: 'var(--s2)', borderRadius: 100, height: 7, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 100,
                          width: `${Math.min(overview.breakEven.percentage, 100)}%`,
                          background: overview.breakEven.percentage >= 100 ? 'var(--gr)' : overview.breakEven.percentage >= 70 ? 'var(--ye)' : 'var(--re)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginTop: 5 }}>
                        {overview.breakEven.percentage}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Per-company grid */}
            {overview.companies.length === 0 ? (
              <div style={{ color: 'var(--t3)', fontSize: 13, padding: 20, textAlign: 'center' }}>Ingen selskaber fundet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {overview.companies.map(c => (
                  <div key={c.slug} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: c.color }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: `${c.color}22`, border: `1.5px solid ${c.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: c.color, flexShrink: 0 }}>
                        {c.initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
                          {c.subtitle ?? (c.type === 'sales' ? 'Salg' : 'SaaS')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>
                          {c.type === 'sales' ? 'Omsætning' : 'MRR'}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{fmt(c.revenue)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Faste omk.</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t2)' }}>{fmt(c.fixed_costs)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>EBITDA</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: c.ebitda >= 0 ? 'var(--gr)' : 'var(--re)' }}>{fmt(c.ebitda)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* CRM pipeline across companies */}
            {crm && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Pipeline på tværs af selskaber
                </div>
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', gap: 28, marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Samlet pipeline</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{fmt(crm.totalValue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Åbne deals</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{crm.totalCount}</div>
                    </div>
                    <a href="/admin/crm" style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>Åbn CRM →</a>
                  </div>
                  {crm.byWorkspace.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen åbne deals</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      {crm.byWorkspace.map(w => (
                        <div key={w.workspace_id ?? 'group'} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--t2)', flex: 1 }}>{w.workspace_name}</span>
                          <span style={{ fontSize: 12, color: 'var(--t3)' }}>{w.count} deals</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', width: 110, textAlign: 'right' }}>{fmt(w.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recruitment across companies */}
            {candidates && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Rekruttering
                </div>
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Aktive kandidater</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>
                      {candidates.filter(c => !['ansat', 'intet_svar', 'stoppet'].includes(c.stage)).length}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                    på tværs af {new Set(candidates.map(c => c.company_name).filter(Boolean)).size} selskaber
                  </div>
                  <a href="/admin/hr/recruitment" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>Åbn rekruttering →</a>
                </div>
              </div>
            )}

            {/* Support/tickets across companies */}
            {tickets && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Support &amp; tickets
                </div>
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Åbne tickets</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--t1)' }}>{tickets.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>Akutte</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: tickets.some(t => t.priority === 'urgent') ? 'var(--re)' : 'var(--t1)' }}>
                      {tickets.filter(t => t.priority === 'urgent').length}
                    </div>
                  </div>
                  <a href="/admin/support" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>Åbn tickets →</a>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
