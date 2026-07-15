'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NextAction { lead_id: number; company_name: string; next_action: string; next_action_date: string; type: string }
interface StageData { id: number; name: string; color: string; lead_count: number; total_value: number }
interface TicketRow { id: number; customer_name: string; subject: string; status: string; created_at: string }
interface RecentCustomer { id: number; name: string; status: string; mrr: number; products: string[] | null; created_at: string }

interface DashData {
  mrr: number; lastMrr: number; subCount: number;
  customers: number; onboarding: number; newCustomers: number;
  recentCustomers: RecentCustomer[];
  openTickets: number; awaitingTickets: number; resolvedToday: number;
  latestOpenTickets: TicketRow[];
  weightedPipeline: number; activeLeads: number;
  wonThisMonth: { count: number; value: number };
  pipelineByStage: StageData[];
  nextActions: NextAction[];
}

function fmt(n: number) { return new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' kr.'; }
function pct(a: number, b: number) { if (!b) return null; const d = ((a - b) / b * 100); return { val: Math.abs(d).toFixed(0) + '%', up: d >= 0 }; }

const TYPE_META: Record<string, string> = { call: '📞', email: '📧', meeting: '🤝', demo: '💻', proposal: '📄', follow_up: '🔔', linkedin: '🔗', note: '📝' };

function isOverdue(d: string | null) { return !!d && d < new Date().toISOString().slice(0, 10); }
function isThisWeek(d: string) { return d <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10); }
function isToday(d: string) { return d === new Date().toISOString().slice(0, 10); }

function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }); }
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'I dag'; if (d === 1) return 'I går'; return `${d} dage siden`;
}

function KpiCard({ label, value, sub, accent, delta }: { label: string; value: string; sub?: string; accent: string; delta?: { val: string; up: boolean } | null }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, opacity: 0.7, borderRadius: '10px 10px 0 0' }} />
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, marginBottom: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{sub}</div>}
      {delta && <div style={{ fontSize: 10, color: delta.up ? 'var(--gr)' : 'var(--re)', fontWeight: 600, marginTop: 4 }}>{delta.up ? '↑' : '↓'} {delta.val} vs. forrige md.</div>}
    </div>
  );
}

export default function MeridianPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/meridian/dashboard')
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as Record<string, string>;
          throw new Error(`HTTP ${r.status} — ${body?.detail ?? body?.error ?? 'ukendt fejl'}`);
        }
        return r.json();
      })
      .then(d => setData(d as DashData))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Overblik</div>
      <div style={{ fontSize: 12, color: 'var(--t3)' }}>Meridian Consulting</div>
      <div style={{ marginTop: 40, color: 'var(--re)', fontSize: 13, fontWeight: 600 }}>Kunne ikke indlæse data</div>
      <div style={{ marginTop: 8, color: 'var(--t3)', fontSize: 11, fontFamily: 'monospace', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 12px', maxWidth: 640, wordBreak: 'break-all' }}>{error}</div>
    </div>
  );

  if (!data) return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Overblik</div>
      <div style={{ fontSize: 12, color: 'var(--t3)' }}>Meridian Consulting</div>
      <div style={{ marginTop: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
    </div>
  );

  const mrrDelta = pct(data.mrr, data.lastMrr);
  const totalLeadsInStages = data.pipelineByStage.reduce((s, st) => s + st.lead_count, 0);

  const overdue = data.nextActions.filter(a => isOverdue(a.next_action_date));
  const today_  = data.nextActions.filter(a => !isOverdue(a.next_action_date) && isToday(a.next_action_date));
  const thisWeek = data.nextActions.filter(a => !isOverdue(a.next_action_date) && !isToday(a.next_action_date) && isThisWeek(a.next_action_date));

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Overblik</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Meridian Consulting</div>
      </div>

      {/* Row 1 — KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Omsætning"
          value={fmt(data.mrr)}
          sub={`${data.subCount} aktive abonnementer`}
          accent="var(--gr)"
          delta={mrrDelta}
        />
        <KpiCard label="Kunder"
          value={String(data.customers)}
          sub={data.onboarding > 0 ? `${data.onboarding} onboarding` : `+${data.newCustomers} denne måned`}
          accent="var(--bl)"
        />
        <KpiCard label="Support"
          value={String(data.openTickets + data.awaitingTickets)}
          sub={`${data.openTickets} åbne · ${data.awaitingTickets} afventer · ${data.resolvedToday} løst i dag`}
          accent={data.openTickets > 0 ? 'var(--ye)' : 'var(--gr)'}
        />
        <KpiCard label="Pipeline"
          value={fmt(data.weightedPipeline)}
          sub={`${data.activeLeads} aktive leads`}
          accent="var(--pu)"
          delta={data.wonThisMonth.count > 0 ? { val: `${data.wonThisMonth.count} vundet (${fmt(data.wonThisMonth.value)})`, up: true } : null}
        />
      </div>

      {/* Row 2 — Pipeline breakdown + Support tickets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Pipeline fordeling */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Pipeline fordeling</div>
            <Link href="/admin/meridian/crm" style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>Se pipeline →</Link>
          </div>
          {data.pipelineByStage.filter(s => s.lead_count > 0).length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Ingen aktive leads</div>
          ) : (
            data.pipelineByStage.map(stage => {
              const barW = totalLeadsInStages > 0 ? (stage.lead_count / totalLeadsInStages) * 100 : 0;
              return (
                <div key={stage.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--t1)', flex: 1 }}>{stage.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{stage.lead_count} · {fmt(stage.total_value)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: stage.color, borderRadius: 3, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Åbne tickets */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Åbne tickets</div>
            <Link href="/admin/meridian/support" style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>Se alle →</Link>
          </div>
          {data.latestOpenTickets.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gr)', textAlign: 'center', padding: '20px 0', fontWeight: 600 }}>✓ Ingen åbne tickets</div>
          ) : (
            data.latestOpenTickets.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.customer_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{t.subject}&rdquo;</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: t.status === 'open' ? 'var(--bl2)' : 'var(--ye2)', color: t.status === 'open' ? 'var(--bl)' : 'var(--ye)' }}>
                    {t.status === 'open' ? 'Åben' : 'Afventer'}
                  </span>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>{timeAgo(t.created_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Row 3 — Recent customers + Next actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Nye kunder */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Nye kunder denne måned</div>
            <Link href="/admin/customers?companySlug=meridian" style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>Se alle →</Link>
          </div>
          {data.recentCustomers.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Ingen nye kunder denne måned</div>
          ) : (
            data.recentCustomers.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gr2)', border: '1px solid rgba(45,212,160,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--gr)', flexShrink: 0 }}>
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  {(c.products ?? []).length > 0 && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{(c.products ?? []).filter(Boolean).join(', ')}</div>}
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  {c.mrr > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gr)' }}>{fmt(c.mrr)}</div>}
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: c.status === 'active' ? 'var(--gr2)' : 'var(--ye2)', color: c.status === 'active' ? 'var(--gr)' : 'var(--ye)' }}>
                    {c.status === 'active' ? 'Aktiv' : c.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Næste handlinger */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Mine næste handlinger</div>
            <Link href="/admin/meridian/crm/activity" style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>Se aktivitet →</Link>
          </div>

          {data.nextActions.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Ingen kommende handlinger</div>
          ) : (
            <>
              {overdue.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--re)', letterSpacing: '0.07em', marginBottom: 5 }}>OVERSKREDET</div>
                  {overdue.map((a, i) => <NextActionRow key={i} action={a} overdue />)}
                </div>
              )}
              {today_.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ye)', letterSpacing: '0.07em', marginBottom: 5 }}>I DAG</div>
                  {today_.map((a, i) => <NextActionRow key={i} action={a} />)}
                </div>
              )}
              {thisWeek.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', marginBottom: 5 }}>DENNE UGE</div>
                  {thisWeek.map((a, i) => <NextActionRow key={i} action={a} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NextActionRow({ action, overdue }: { action: NextAction; overdue?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
      <span style={{ fontSize: 13, flexShrink: 0 }}>{TYPE_META[action.type] ?? '📅'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: overdue ? 'var(--re)' : 'var(--t2)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {action.next_action}
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>{action.company_name} · {fmtDate(action.next_action_date)}</div>
      </div>
    </div>
  );
}
