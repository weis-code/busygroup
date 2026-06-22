'use client';

import { useEffect, useState, FormEvent } from 'react';

export default function AdminSettingsPage() {
  const [deskCount, setDeskCount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  if (loading) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 520 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 8 }}>Indstillinger</h1>
      <p style={{ fontSize: 13, color: '#667788', marginBottom: 32 }}>Virksomhedsindstillinger der bruges i dashboardet.</p>

      <form onSubmit={onSubmit}>
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 28, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1', marginBottom: 6 }}>Antal skriveborde</div>
          <div style={{ fontSize: 12, color: '#667788', marginBottom: 16 }}>
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
              style={{ width: 100, padding: '10px 12px', borderRadius: 7, fontSize: 16, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: '#667788' }}>skriveborde</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            type="submit"
            disabled={saving}
            style={{ padding: '10px 24px', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600, fontSize: 14 }}
          >
            {saving ? 'Gemmer…' : 'Gem indstillinger'}
          </button>
          {saved && <span style={{ fontSize: 13, color: '#2ECC71' }}>Gemt</span>}
        </div>
      </form>
    </div>
  );
}
