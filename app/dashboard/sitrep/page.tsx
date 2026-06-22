'use client';

import { useEffect, useState } from 'react';

interface Reply { id: string; body: string; user_name: string; created_at: string }
interface Sitrep {
  id: string; date: string; went_well: string | null; challenges: string | null;
  needs_help: string | null; is_support_request: boolean; created_at: string;
  replies: Reply[];
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

export default function SitrepPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [sitreps, setSitreps] = useState<Sitrep[]>([]);
  const [todaySitrep, setTodaySitrep] = useState<Sitrep | null>(null);
  const [form, setForm] = useState({ went_well: '', challenges: '', needs_help: '', is_support_request: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const d = await fetch('/api/sitreps').then(r => r.json());
    setSitreps(d.sitreps ?? []);
    const ts = d.todaySitrep;
    setTodaySitrep(ts);
    if (ts) {
      setForm({
        went_well: ts.went_well ?? '',
        challenges: ts.challenges ?? '',
        needs_help: ts.needs_help ?? '',
        is_support_request: ts.is_support_request ?? false,
      });
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/sitreps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, date: today }),
    });
    await load();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const past = sitreps.filter(s => s.date !== today);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Daglig sitrep</h1>
      <div style={{ fontSize: 12, color: '#667788', marginBottom: 28 }}>
        {fmtDate(today)} — {todaySitrep ? 'Du har sendt dagens sitrep' : 'Ikke sendt endnu'}
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '24px 26px', marginBottom: 32 }}>
        <div style={{ fontSize: 12, color: '#667788', letterSpacing: '0.06em', marginBottom: 20 }}>
          {todaySitrep ? 'OPDATER DAGENS SITREP' : 'INDSEND DAGENS SITREP'}
        </div>

        {[
          { key: 'went_well', label: 'Hvad gik godt i dag?' },
          { key: 'challenges', label: 'Hvad var udfordringerne?' },
          { key: 'needs_help', label: 'Har jeg brug for hjælp til noget?' },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 6, fontWeight: 500 }}>{label}</label>
            <textarea
              value={form[key as keyof typeof form] as string}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              rows={3}
              style={{
                width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '10px 12px',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={form.is_support_request}
            onChange={e => setForm(f => ({ ...f, is_support_request: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: '#E74C3C' }}
          />
          <span style={{ fontSize: 13, color: form.is_support_request ? '#E74C3C' : '#667788', fontWeight: form.is_support_request ? 600 : 400 }}>
            Jeg har brug for support / følge op
          </span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: '#185FA5', color: '#fff', border: 'none', borderRadius: 7,
              padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Gemmer…' : todaySitrep ? 'Opdater sitrep' : 'Send sitrep'}
          </button>
          {saved && <span style={{ fontSize: 12, color: '#2ECC71' }}>Gemt!</span>}
        </div>
      </form>

      {/* Replies on today's sitrep */}
      {todaySitrep && todaySitrep.replies.length > 0 && (
        <div style={{ background: '#111E2A', border: '1px solid rgba(24,95,165,0.25)', borderRadius: 10, padding: '18px 22px', marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#185FA5', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 14 }}>SVAR FRA ADMIN</div>
          {todaySitrep.replies.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#185FA522', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#185FA5', flexShrink: 0, fontWeight: 600 }}>
                {r.user_name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#667788', marginBottom: 3 }}>{r.user_name} · {fmtTime(r.created_at)}</div>
                <div style={{ fontSize: 13, color: '#ECF0F1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past sitreps */}
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 14 }}>TIDLIGERE SITREPS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {past.map(s => (
              <div key={s.id} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{fmtDate(s.date)}</span>
                  {s.is_support_request && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#E74C3C', background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em' }}>SUPPORT</span>
                  )}
                </div>
                {[
                  { label: 'Hvad gik godt', value: s.went_well },
                  { label: 'Udfordringer', value: s.challenges },
                  { label: 'Brug for hjælp', value: s.needs_help },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: '#667788', marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: '#B0BEC5', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.value}</div>
                  </div>
                ))}
                {s.replies.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    {s.replies.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#185FA522', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#185FA5', flexShrink: 0, fontWeight: 600 }}>
                          {r.user_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#667788', marginBottom: 3 }}>{r.user_name} · {fmtTime(r.created_at)}</div>
                          <div style={{ fontSize: 13, color: '#ECF0F1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
