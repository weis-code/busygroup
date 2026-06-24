'use client';

import { useEffect, useState } from 'react';

interface Reply  { id: string; body: string; user_name: string; created_at: string }
interface Sitrep {
  id: string; date: string; went_well: string | null; challenges: string | null;
  needs_help: string | null; is_support_request: boolean; created_at: string;
  replies: Reply[];
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

export default function SitrepPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [sitreps, setSitreps]           = useState<Sitrep[]>([]);
  const [todaySitrep, setTodaySitrep]   = useState<Sitrep | null>(null);
  const [form, setForm]                 = useState({ went_well: '', challenges: '', needs_help: '', is_support_request: false });
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  async function load() {
    const d = await fetch('/api/sitreps').then(r => r.json());
    setSitreps(d.sitreps ?? []);
    const ts = d.todaySitrep;
    setTodaySitrep(ts);
    if (ts) setForm({ went_well: ts.went_well ?? '', challenges: ts.challenges ?? '', needs_help: ts.needs_help ?? '', is_support_request: ts.is_support_request ?? false });
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/sitreps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, date: today }) });
    await load();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const past = sitreps.filter(s => s.date !== today);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Daglig sitrep</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
          {fmtDate(today)} — {todaySitrep ? 'Du har sendt dagens sitrep' : 'Ikke sendt endnu'}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 26px', marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
          {todaySitrep ? 'Opdater dagens sitrep' : 'Indsend dagens sitrep'}
        </div>
        {[
          { key: 'went_well',   label: 'Hvad gik godt i dag?' },
          { key: 'challenges',  label: 'Hvad var udfordringerne?' },
          { key: 'needs_help',  label: 'Har jeg brug for hjælp til noget?' },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
            <textarea
              value={form[key as keyof typeof form] as string}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        ))}

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 22 }}>
          <input
            type="checkbox"
            checked={form.is_support_request}
            onChange={e => setForm(f => ({ ...f, is_support_request: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: 'var(--re)' }}
          />
          <span style={{ fontSize: 13, color: form.is_support_request ? 'var(--re)' : 'var(--t2)', fontWeight: form.is_support_request ? 600 : 400 }}>
            Jeg har brug for support / følge op
          </span>
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Gemmer…' : todaySitrep ? 'Opdater sitrep' : 'Send sitrep'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--gr)', fontWeight: 600 }}>Gemt!</span>}
        </div>
      </form>

      {/* Replies on today's sitrep */}
      {todaySitrep && todaySitrep.replies.length > 0 && (
        <div style={{ background: 'var(--s1)', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: 'var(--bl)', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 14 }}>Svar fra admin</div>
          {todaySitrep.replies.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bl2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bl)', flexShrink: 0, fontWeight: 700 }}>
                {r.user_name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>{r.user_name} · {fmtTime(r.created_at)}</div>
                <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past sitreps */}
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Tidligere sitreps</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {past.map(s => (
              <div key={s.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{fmtDate(s.date)}</span>
                  {s.is_support_request && <span className="badge badge-red">Support</span>}
                </div>
                {[
                  { label: 'Hvad gik godt', value: s.went_well },
                  { label: 'Udfordringer',  value: s.challenges },
                  { label: 'Brug for hjælp', value: s.needs_help },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{f.value}</div>
                  </div>
                ))}
                {s.replies.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
                    {s.replies.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bl2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--bl)', flexShrink: 0, fontWeight: 700 }}>
                          {r.user_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>{r.user_name} · {fmtTime(r.created_at)}</div>
                          <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.body}</div>
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
