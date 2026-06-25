'use client';

import { useEffect, useState } from 'react';

function fmtDK(n: number) {
  return new Intl.NumberFormat('da-DK').format(n) + ' kr.';
}

export default function CreatorRatePage() {
  const [revenue, setRevenue] = useState(0);
  const [users, setUsers]     = useState(0);
  const [tickets, setTickets] = useState(0);
  const [editField, setEditField] = useState<string | null>(null);
  const [editVal, setEditVal]     = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('creatorrate_kpis');
    if (saved) {
      const d = JSON.parse(saved) as { revenue: number; users: number; tickets: number };
      setRevenue(d.revenue ?? 0);
      setUsers(d.users ?? 0);
      setTickets(d.tickets ?? 0);
    }
  }, []);

  function save(field: string, val: string) {
    const n = parseInt(val) || 0;
    const next = { revenue, users, tickets, [field]: n };
    setRevenue(next.revenue);
    setUsers(next.users);
    setTickets(next.tickets);
    localStorage.setItem('creatorrate_kpis', JSON.stringify(next));
    setEditField(null);
  }

  function EditableKpi({ field, label, value, color, prefix }: { field: string; label: string; value: number; color?: string; prefix?: string }) {
    return (
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => { setEditField(field); setEditVal(String(value)); }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
        {editField === field ? (
          <input
            autoFocus
            type="number"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={() => save(field, editVal)}
            onKeyDown={e => { if (e.key === 'Enter') save(field, editVal); if (e.key === 'Escape') setEditField(null); }}
            style={{ width: '100%', fontSize: 20, fontWeight: 800, color: color ?? 'var(--t1)', background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <div style={{ fontSize: 22, fontWeight: 800, color: color ?? 'var(--t1)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {prefix ? prefix + fmtDK(value) : value}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>CreatorRate</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Overblik · Klik tal for at redigere</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <EditableKpi field="revenue" label="Omsætning MTD"  value={revenue} color="var(--bl)" prefix="" />
        <EditableKpi field="users"   label="Aktive brugere" value={users}   color="var(--gr)" />
        <EditableKpi field="tickets" label="Support tickets" value={tickets} color="var(--ye)" />
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '32px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        CreatorRate platform — under opbygning
      </div>
    </div>
  );
}
