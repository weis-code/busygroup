'use client';

import { useEffect, useState } from 'react';

const CR = '#f43f5e';

interface UserStats {
  creators: number;
  viewers: number;
  total: number;
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color ?? 'var(--t1)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export default function CreatorRatePage() {
  const [users, setUsers]       = useState<UserStats | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/creatorrate/users')
      .then(async r => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(b.error ?? `Fejl ${r.status}`);
        }
        return r.json() as Promise<UserStats>;
      })
      .then(d => setUsers(d))
      .catch((e: unknown) => setUsersError(e instanceof Error ? e.message : 'Ukendt fejl'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>CreatorRate</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Overblik · Live data fra platformen</div>
      </div>

      {/* User stats */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Brugere</div>
      </div>

      {usersError ? (
        <div style={{ padding: '14px 16px', background: 'var(--re2)', borderRadius: 10, fontSize: 13, color: 'var(--re)', marginBottom: 20 }}>
          Kunne ikke hente brugerdata: {usersError}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Creators (betalende)"
            value={loading ? '…' : (users?.creators ?? 0)}
            color={CR}
          />
          <StatCard
            label="Viewers (gratis)"
            value={loading ? '…' : (users?.viewers ?? 0)}
            color="var(--t2)"
          />
          <StatCard
            label="Total brugere"
            value={loading ? '…' : (users?.total ?? 0)}
            sub={users ? `${Math.round((users.creators / Math.max(users.total, 1)) * 100)}% er creators` : undefined}
            color="var(--t1)"
          />
        </div>
      )}

      {/* Placeholder for MRR — Stripe følger */}
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '28px 32px', color: 'var(--t3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>MRR · Stripe</div>
        <div>Stripe-integration kommer i næste trin.</div>
      </div>
    </div>
  );
}
