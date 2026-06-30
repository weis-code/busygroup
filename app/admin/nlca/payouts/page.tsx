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

interface CreatorRow {
  creator_id: number;
  creator_name: string;
  manager_id: number | null;
  manager_name: string | null;
  rank_up_usd: number;
  activeness_usd: number;
  incremental_revenue_usd?: number;
  creator_payout: number;
}
interface ManagerRow {
  manager_id: number;
  manager_name: string;
  creator_count: number;
  total_creator_base: number;
  manager_payout: number;
}
interface AdminPayoutData {
  creators: CreatorRow[];
  manager_payouts: ManagerRow[];
  total_revenue: number;
}
interface ManagerPayoutData {
  creators: CreatorRow[];
  manager_payout: number;
  visible_revenue: number;
}

type UserRole = 'ADMIN' | 'MANAGER' | 'SELLER' | 'NLCA_MANAGER';

export default function NlcaPayoutsPage() {
  const [month, setMonth] = useState(currentMonthStr());
  const [role, setRole]   = useState<UserRole>('ADMIN');
  const [data, setData]   = useState<AdminPayoutData | ManagerPayoutData | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((d: { role: UserRole }) => setRole(d.role)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const d = await fetch(`/api/nlca/payouts?month=${month}`).then(r => r.json()) as AdminPayoutData | ManagerPayoutData;
    setData(d ?? null);
  }, [month]);

  useEffect(() => { void load(); }, [load]);

  const isAdmin = role === 'ADMIN';

  function exportCSV() {
    window.open(`/api/nlca/payouts/export?month=${month}&format=csv`, '_blank');
  }

  if (!data) {
    return <div style={{ padding: '40px', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;
  }

  if (isAdmin) {
    const adminData = data as AdminPayoutData;
    const creators   = adminData.creators ?? [];
    const managers   = adminData.manager_payouts ?? [];
    const totalCreatorPayout = creators.reduce((s, r) => s + Number(r.creator_payout ?? 0), 0);
    const totalManagerPayout = managers.reduce((s, m) => s + Number(m.manager_payout ?? 0), 0);

    return (
      <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Udbetalinger</h1>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>NLCA · Creator og Manager Payouts</div>
          </div>
          <button onClick={exportCSV} style={{ background: 'var(--s2)', color: 'var(--t1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Eksporter til CSV
          </button>
        </div>

        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '8px 14px', width: 'fit-content' }}>
          <button onClick={() => setMonth(prevMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>←</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
          <button onClick={() => setMonth(nextMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>→</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Creator payouts */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
              Creator Udbetalinger
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Creator</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Manager</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Rank-up</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Activeness</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Payout</th>
                </tr>
              </thead>
              <tbody>
                {creators.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: 'var(--t3)' }}>Ingen data</td></tr>
                )}
                {creators.map((r, i) => (
                  <tr key={r.creator_id} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--t1)', fontWeight: 500 }}>{r.creator_name}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--t3)', fontSize: 12 }}>{r.manager_name ?? '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(r.rank_up_usd ?? 0))}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(r.activeness_usd ?? 0))}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: CYAN }}>{USD(Number(r.creator_payout ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
              {creators.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--bd)', background: 'var(--s2)' }}>
                    <td colSpan={4} style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--t1)' }}>Total</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: CYAN }}>{USD(totalCreatorPayout)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Manager payouts */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
              Manager Udbetalinger
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Manager</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Creators</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Creator-beløb</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>5% Payout</th>
                </tr>
              </thead>
              <tbody>
                {managers.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: 'var(--t3)' }}>Ingen managers endnu</td></tr>
                )}
                {managers.map((m, i) => (
                  <tr key={m.manager_id} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--t1)', fontWeight: 500 }}>{m.manager_name}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--t3)' }}>{m.creator_count}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(m.total_creator_base ?? 0))}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--pu)' }}>{USD(Number(m.manager_payout ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
              {managers.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--bd)', background: 'var(--s2)' }}>
                    <td colSpan={3} style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--t1)' }}>Total</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--pu)' }}>{USD(totalManagerPayout)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Samlet omsætning (inkl. incremental revenue)</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: CYAN }}>{USD(adminData.total_revenue ?? 0)}</span>
        </div>
      </div>
    );
  }

  // NLCA_MANAGER view
  const mgr = data as ManagerPayoutData;
  const creators = mgr.creators ?? [];
  const totalBase = creators.reduce((s, r) => s + Number(r.creator_payout ?? 0), 0);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Udbetalinger</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>NLCA · Mine creators</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '8px 14px', width: 'fit-content' }}>
        <button onClick={() => setMonth(prevMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>←</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', minWidth: 140, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>→</button>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Mine Creators</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--s2)' }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Creator</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Rank-up</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Activeness</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Creator Payout</th>
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 && (
              <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>Ingen creators tilknyttet</td></tr>
            )}
            {creators.map((r, i) => (
              <tr key={r.creator_id} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none' }}>
                <td style={{ padding: '10px 14px', color: 'var(--t1)', fontWeight: 500 }}>{r.creator_name}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(r.rank_up_usd ?? 0))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(r.activeness_usd ?? 0))}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: CYAN }}>{USD(Number(r.creator_payout ?? 0))}</td>
              </tr>
            ))}
          </tbody>
          {creators.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--bd)', background: 'var(--s2)' }}>
                <td colSpan={3} style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--t1)' }}>Total</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: CYAN }}>{USD(totalBase)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div style={{ background: 'var(--s1)', border: `2px solid ${CYAN}33`, borderRadius: 12, padding: '24px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Din udbetaling denne måned</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: CYAN, marginBottom: 6 }}>{USD(mgr.manager_payout ?? 0)}</div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>5% af {USD(totalBase)} (samlet creator-beløb)</div>
      </div>
    </div>
  );
}
