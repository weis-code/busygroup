'use client';

import { useEffect, useState, FormEvent } from 'react';

export default function AdminSettingsPage() {
  const [deskCount, setDeskCount] = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setDeskCount(d.desk_count ?? '0');
      setLoading(false);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    await fetch('/api/admin/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desk_count: deskCount }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 520 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">Indstillinger</h1>
        <p className="page-sub">Virksomhedsindstillinger der bruges i dashboardet.</p>
      </div>

      <form onSubmit={onSubmit}>
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 28, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>Antal skriveborde</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16 }}>
            Bruges til at beregne omsætning pr. stol og potentiel omsætning ved fuldt belæg på admin oversigten.
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="number"
              min={0}
              max={999}
              value={deskCount}
              onChange={e => setDeskCount(e.target.value)}
              required
              style={{ width: 100, fontSize: 16, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: 'var(--t3)' }}>skriveborde</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Gemmer…' : 'Gem indstillinger'}
          </button>
          {saved && <span style={{ fontSize: 13, color: 'var(--gr)', fontWeight: 600 }}>Gemt</span>}
        </div>
      </form>
    </div>
  );
}
