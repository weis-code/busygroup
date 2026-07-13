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
interface KanbanColumn { id: number; name: string; color: string; position: number }
interface KanbanCard {
  id: number; column_id: number; title: string; body: string | null;
  position: number; assigned_to: string | null; assigned_name: string | null; completed_at: string | null;
}

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
  const [tab, setTab] = useState<'finance' | 'board'>('finance');

  // Finance state
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  // Board state
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [boardLoaded, setBoardLoaded] = useState(false);
  const [newCardCol, setNewCardCol] = useState<number | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [addingCard, setAddingCard] = useState(false);

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

  async function loadBoard() {
    if (boardLoaded) return;
    const board = await fetch('/api/kanban/boards/my').then(r => r.json()) as { id: number };
    if (!board?.id) return;
    const [cols, cds] = await Promise.all([
      fetch(`/api/kanban/columns?boardId=${board.id}`).then(r => r.json()) as Promise<KanbanColumn[]>,
      fetch(`/api/kanban/cards?boardId=${board.id}`).then(r => r.json()) as Promise<KanbanCard[]>,
    ]);
    setColumns(Array.isArray(cols) ? cols : []);
    setCards(Array.isArray(cds) ? cds.filter(c => !c.completed_at) : []);
    setBoardLoaded(true);
  }

  useEffect(() => { loadOverview(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab === 'board') loadBoard();
  }, [tab]);

  async function addCard(colId: number) {
    if (!newCardTitle.trim() || addingCard) return;
    setAddingCard(true);
    try {
      const card = await fetch('/api/kanban/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: colId, title: newCardTitle.trim() }),
      }).then(r => r.json()) as KanbanCard;
      setCards(cs => [...cs, card]);
    } finally {
      setNewCardTitle('');
      setNewCardCol(null);
      setAddingCard(false);
    }
  }

  const TABS = [
    { id: 'finance' as const, label: 'Finansoverblik' },
    { id: 'board'   as const, label: 'Mit Board' },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{
        height: 48, flexShrink: 0,
        background: 'var(--s1)', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'flex-end', padding: '0 24px', gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--bl)' : 'var(--t2)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--bl)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Finance tab ── */}
      {tab === 'finance' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Board tab ── */}
      {tab === 'board' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)' }}>Mit board</div>
            <a href="/admin/group/board" style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--bd)', borderRadius: 7, background: 'var(--s1)' }}>
              Åbn fuldt board →
            </a>
          </div>

          <div style={{ flex: 1, overflowX: 'auto', padding: '16px 24px 24px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {!boardLoaded ? (
              <div style={{ color: 'var(--t3)', fontSize: 13, paddingTop: 20 }}>Indlæser board…</div>
            ) : columns.length === 0 ? (
              <div style={{ color: 'var(--t3)', fontSize: 13, paddingTop: 20 }}>Ingen kolonner fundet</div>
            ) : (
              columns.slice().sort((a, b) => a.position - b.position).map(col => {
                const colCards = cards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position);
                const isAddingHere = newCardCol === col.id;
                return (
                  <div key={col.id} style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px', marginBottom: 2 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{col.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', background: 'var(--s2)', border: '1px solid var(--bd)', padding: '1px 7px', borderRadius: 100 }}>{colCards.length}</span>
                    </div>

                    {colCards.map(card => (
                      <div key={card.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500, lineHeight: 1.4 }}>{card.title}</div>
                        {card.assigned_name && (
                          <div style={{ fontSize: 10, color: 'var(--bl)', marginTop: 5, fontWeight: 600 }}>→ {card.assigned_name}</div>
                        )}
                      </div>
                    ))}

                    {isAddingHere ? (
                      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: 8 }}>
                        <input
                          autoFocus
                          value={newCardTitle}
                          onChange={e => setNewCardTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { void addCard(col.id); }
                            if (e.key === 'Escape') { setNewCardCol(null); setNewCardTitle(''); }
                          }}
                          placeholder="Titel…"
                          style={{ width: '100%', borderRadius: 6, padding: '7px 10px', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => void addCard(col.id)} disabled={!newCardTitle.trim() || addingCard}
                            style={{ flex: 1, background: 'var(--bl)', color: '#fff', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                            Tilføj
                          </button>
                          <button onClick={() => { setNewCardCol(null); setNewCardTitle(''); }}
                            style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--t2)', cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setNewCardCol(col.id); setNewCardTitle(''); }}
                        style={{ background: 'none', border: '1px dashed var(--bd)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t3)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.12s, color 0.12s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; (e.currentTarget as HTMLElement).style.color = 'var(--t2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; (e.currentTarget as HTMLElement).style.color = 'var(--t3)'; }}
                      >
                        + Nyt kort
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
