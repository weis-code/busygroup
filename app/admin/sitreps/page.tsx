'use client';

import { useEffect, useState } from 'react';

interface Reply { id: string; body: string; user_name: string; created_at: string }
interface Sitrep {
  id: string; date: string; went_well: string | null; challenges: string | null;
  needs_help: string | null; is_support_request: boolean; created_at: string;
  seller_name: string; seller_id: string; replies: Reply[]; followup_count: number;
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

export default function AdminSitrepsPage() {
  const [sitreps, setSitreps]       = useState<Sitrep[]>([]);
  const [loading, setLoading]       = useState(true);
  const [replyText, setReplyText]   = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [followupModal, setFollowupModal] = useState<Sitrep | null>(null);
  const [followupForm, setFollowupForm]   = useState({ title: '', body: '' });
  const [savingFollowup, setSavingFollowup] = useState(false);

  async function load() {
    const rows = await fetch('/api/admin/sitreps').then(r => r.json()) as Sitrep[];
    setSitreps(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sendReply(sitrepId: string) {
    const body = replyText[sitrepId]?.trim();
    if (!body) return;
    setReplyingTo(sitrepId);
    await fetch(`/api/sitreps/${sitrepId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    setReplyText(t => ({ ...t, [sitrepId]: '' }));
    setReplyingTo(null);
    await load();
  }

  async function createFollowup() {
    if (!followupModal || !followupForm.title.trim()) return;
    setSavingFollowup(true);
    await fetch('/api/followups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: followupForm.title, body: followupForm.body, sitrep_id: followupModal.id }),
    });
    setFollowupModal(null);
    setFollowupForm({ title: '', body: '' });
    setSavingFollowup(false);
    await load();
  }

  const grouped = sitreps.reduce<Record<string, Sitrep[]>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (loading) return <div style={{ padding: 40, color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sitrep feed</h1>
          <p className="page-sub">Seneste 14 dage — {sitreps.length} sitreps</p>
        </div>
        <a href="/admin/followups" className="btn btn-primary">Follow-up board →</a>
      </div>

      {sitreps.length === 0 && (
        <div style={{ color: 'var(--t3)', fontSize: 13 }}>Ingen sitreps endnu</div>
      )}

      {dates.map(date => (
        <div key={date} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 14, borderBottom: '1px solid var(--bd)', paddingBottom: 8, fontWeight: 600 }}>
            {fmtDate(date).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {grouped[date].map(s => (
              <div key={s.id} style={{
                background: 'var(--s1)',
                border: s.is_support_request ? '1px solid var(--re)' : '1px solid var(--bd)',
                borderRadius: 10, padding: '20px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bl2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--bl)', fontWeight: 700 }}>
                      {s.seller_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{s.seller_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtTime(s.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.is_support_request && (
                      <span className="badge badge-red">SUPPORT</span>
                    )}
                    {s.followup_count > 0 && (
                      <span className="badge badge-green">{s.followup_count} FU</span>
                    )}
                    <button
                      onClick={() => { setFollowupModal(s); setFollowupForm({ title: s.is_support_request ? `Support: ${s.seller_name}` : '', body: '' }); }}
                      className="btn btn-ghost btn-sm"
                    >
                      + Follow-up
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                  {[
                    { label: 'Hvad gik godt',   value: s.went_well,   highlight: false },
                    { label: 'Udfordringer',     value: s.challenges,  highlight: false },
                    { label: 'Brug for hjælp',  value: s.needs_help,  highlight: s.is_support_request },
                  ].map(f => (
                    <div key={f.label} style={{ background: 'var(--s2)', borderRadius: 7, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: f.highlight ? 'var(--re)' : 'var(--t3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: f.value ? 'var(--t2)' : 'var(--t4)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {f.value || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {s.replies.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 12, marginBottom: 12 }}>
                    {s.replies.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--gr2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--gr)', flexShrink: 0, fontWeight: 700 }}>
                          {r.user_name.charAt(0)}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: 'var(--gr)', fontWeight: 600 }}>{r.user_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}> · {fmtTime(r.created_at)}</span>
                          <div style={{ fontSize: 13, color: 'var(--t1)', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Svar…"
                    value={replyText[s.id] ?? ''}
                    onChange={e => setReplyText(t => ({ ...t, [s.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && sendReply(s.id)}
                  />
                  <button
                    onClick={() => sendReply(s.id)}
                    disabled={replyingTo === s.id || !replyText[s.id]?.trim()}
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {followupModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Opret follow-up</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>Fra sitrep: {followupModal.seller_name} — {fmtDate(followupModal.date)}</div>
            <div className="modal-form">
              <div className="form-group">
                <label>Titel *</label>
                <input
                  type="text"
                  value={followupForm.title}
                  onChange={e => setFollowupForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Hvad skal følges op på?"
                />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea
                  value={followupForm.body}
                  onChange={e => setFollowupForm(f => ({ ...f, body: e.target.value }))}
                  rows={3}
                  placeholder="Yderligere detaljer…"
                />
              </div>
              <div className="modal-footer">
                <button onClick={() => setFollowupModal(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button
                  onClick={createFollowup}
                  disabled={savingFollowup || !followupForm.title.trim()}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {savingFollowup ? 'Opretter…' : 'Opret follow-up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
