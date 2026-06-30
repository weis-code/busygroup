'use client';

import { useEffect, useState, useCallback } from 'react';

const CYAN = '#06b6d4';

const USD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

function monthLabel(iso: string) {
  const [y, m] = iso.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
}

function prevMonth(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface FigureRow {
  id?: number;
  creator_id: number;
  creator_name: string;
  manager_id: number | null;
  manager_name: string | null;
  rank_up_usd: number;
  activeness_usd: number;
  incremental_revenue_usd?: number;
}

interface PayoutData {
  creators?: FigureRow[];
  manager_payouts?: { manager_id: number; manager_name: string; creator_count: number; total_creator_base: number; manager_payout: number }[];
  total_revenue?: number;
  visible_revenue?: number;
  manager_payout?: number;
}

type UserRole = 'ADMIN' | 'MANAGER' | 'SELLER' | 'NLCA_MANAGER';

function EditableCell({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(String(value)); setEditing(true); }}
        title="Klik for at redigere"
        style={{ cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.08)', display: 'inline-block', minWidth: 60, textAlign: 'right' }}
      >
        {value > 0 ? USD(value) : <span style={{ color: 'var(--t3)' }}>—</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onSave(parseFloat(draft) || 0); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
      onBlur={() => setEditing(false)}
      style={{ width: 90, padding: '3px 6px', fontSize: 12, borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--s2)', color: 'var(--t1)', textAlign: 'right' }}
    />
  );
}

export default function NlcaPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [role, setRole]   = useState<UserRole>('ADMIN');
  const [rows, setRows]   = useState<FigureRow[]>([]);
  const [payout, setPayout] = useState<PayoutData>({});
  const [saving, setSaving]   = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((d: { role: UserRole }) => setRole(d.role)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [figData, payData] = await Promise.all([
        fetch(`/api/nlca/figures?month=${month}`).then(r => r.json()) as Promise<FigureRow[]>,
        fetch(`/api/nlca/payouts?month=${month}`).then(r => r.json()) as Promise<PayoutData>,
      ]);
      setRows(Array.isArray(figData) ? figData : []);
      setPayout(payData ?? {});
    } catch { /* ignore */ }
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  async function saveField(creatorId: number, field: 'rank_up_usd' | 'activeness_usd' | 'incremental_revenue_usd', value: number) {
    setSaving(creatorId);
    try {
      await fetch('/api/nlca/figures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId, month, [field]: value }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  const isAdmin = role === 'ADMIN';

  const totalCreatorPayout = (payout.creators ?? rows).reduce(
    (s, r) => s + Number(r.rank_up_usd ?? 0) + Number(r.activeness_usd ?? 0),
    0
  );
  const activeCount = rows.length;

  const kpis = isAdmin
    ? [
        { label: 'Samlet omsætning', value: USD(payout.total_revenue ?? 0), color: CYAN },
        { label: 'Creator payouts', value: USD(totalCreatorPayout), color: 'var(--gr)' },
        { label: 'Manager payouts', value: USD((payout.manager_payouts ?? []).reduce((s, m) => s + Number(m.manager_payout ?? 0), 0)), color: 'var(--pu)' },
        { label: 'Aktive creators', value: String(activeCount), color: 'var(--bl)' },
      ]
    : [
        { label: 'Omsætning', value: USD(payout.visible_revenue ?? 0), color: CYAN },
        { label: 'Creator payouts', value: USD(totalCreatorPayout), color: 'var(--gr)' },
        { label: 'Aktive creators', value: String(activeCount), color: 'var(--bl)' },
      ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: CYAN }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>Next Level Creator Agency</h1>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 20 }}>NLCA · Overblik</div>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '8px 14px', width: 'fit-content' }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>←</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>→</button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 12, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="kpi-tile" style={{ '--accent': k.color } as React.CSSProperties}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Creator breakdown table */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Creator oversigt — {monthLabel(month)}</span>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>Klik på tal for at redigere</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--s2)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator</th>
                {isAdmin && <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manager</th>}
                <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rank-up</th>
                <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activeness</th>
                {isAdmin && (
                  <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(6,182,212,0.07)' }}>
                    <span title="Kun synlig for Admin" style={{ cursor: 'help' }}>🔒 Incremental Rev.</span>
                  </th>
                )}
                <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Creator Payout</th>
                {isAdmin && <th style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manager 5%</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 4} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                    Ingen aktive creators endnu. <a href="/admin/nlca/creators" style={{ color: CYAN }}>Opret creators →</a>
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const creatorPayout = Number(r.rank_up_usd ?? 0) + Number(r.activeness_usd ?? 0);
                const managerPayout = creatorPayout * 0.05;
                const isSaving = saving === r.creator_id;
                return (
                  <tr key={r.creator_id} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', opacity: isSaving ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 14px', color: 'var(--t1)', fontWeight: 500 }}>{r.creator_name}</td>
                    {isAdmin && <td style={{ padding: '10px 14px', color: 'var(--t3)', fontSize: 12 }}>{r.manager_name ?? '—'}</td>}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <EditableCell value={Number(r.rank_up_usd ?? 0)} onSave={v => void saveField(r.creator_id, 'rank_up_usd', v)} />
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <EditableCell value={Number(r.activeness_usd ?? 0)} onSave={v => void saveField(r.creator_id, 'activeness_usd', v)} />
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '10px 14px', textAlign: 'right', background: 'rgba(6,182,212,0.04)' }}>
                        <EditableCell value={Number(r.incremental_revenue_usd ?? 0)} onSave={v => void saveField(r.creator_id, 'incremental_revenue_usd', v)} />
                      </td>
                    )}
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>{USD(creatorPayout)}</td>
                    {isAdmin && <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t3)' }}>{USD(managerPayout)}</td>}
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--bd)', background: 'var(--s2)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--t1)' }} colSpan={isAdmin ? 2 : 1}>Total</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>
                    {USD(rows.reduce((s, r) => s + Number(r.rank_up_usd ?? 0), 0))}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)' }}>
                    {USD(rows.reduce((s, r) => s + Number(r.activeness_usd ?? 0), 0))}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t1)', background: 'rgba(6,182,212,0.04)' }}>
                      {USD(rows.reduce((s, r) => s + Number(r.incremental_revenue_usd ?? 0), 0))}
                    </td>
                  )}
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: CYAN }}>{USD(totalCreatorPayout)}</td>
                  {isAdmin && (
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t3)' }}>
                      {USD((payout.manager_payouts ?? []).reduce((s, m) => s + Number(m.manager_payout ?? 0), 0))}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Admin migration helper */}
      {isAdmin && rows.length === 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, fontSize: 12, color: 'var(--t3)' }}>
          Første gang? <button onClick={() => fetch('/api/nlca/migrate', { method: 'POST' }).then(() => window.location.reload())} style={{ color: CYAN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Kør DB migration →</button>
        </div>
      )}
    </div>
  );
}
