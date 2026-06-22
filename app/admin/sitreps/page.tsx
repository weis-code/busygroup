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
  const [sitreps, setSitreps] = useState<Sitrep[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [followupModal, setFollowupModal] = useState<Sitrep | null>(null);
  const [followupForm, setFollowupForm] = useState({ title: '', body: '' });
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

  if (loading) return <div style={{ padding: 40, color: '#667788', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Sitrep feed</h1>
          <div style={{ fontSize: 12, color: '#667788' }}>Seneste 14 dage — {sitreps.length} sitreps</div>
        </div>
        <a href="/admin/followups" style={{ background: '#0F6E56', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
          Follow-up board →
        </a>
      </div>

      {sitreps.length === 0 && (
        <div style={{ color: '#667788', fontSize: 13 }}>Ingen sitreps endnu</div>
      )}

      {dates.map(date => (
        <div key={date} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: '#667788', letterSpacing: '0.06em', marginBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
            {fmtDate(date).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {grouped[date].map(s => (
              <div key={s.id} style={{
                background: '#111E2A',
                border: s.is_support_request ? '1px solid rgba(231,76,60,0.3)' : '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '20px 24px',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#185FA522', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#185FA5', fontWeight: 700 }}>
                      {s.seller_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1' }}>{s.seller_name}</div>
                      <div style={{ fontSize: 11, color: '#667788' }}>{fmtTime(s.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.is_support_request && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#E74C3C', background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 4, padding: '2px 7px', letterSpacing: '0.04em' }}>SUPPORT</span>
                    )}
                    {s.followup_count > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#0F9B6E', background: 'rgba(15,155,110,0.1)', border: '1px solid rgba(15,155,110,0.3)', borderRadius: 4, padding: '2px 7px' }}>{s.followup_count} FU</span>
                    )}
                    <button
                      onClick={() => { setFollowupModal(s); setFollowupForm({ title: s.is_support_request ? `Support: ${s.seller_name}` : '', body: '' }); }}
                      style={{ fontSize: 11, color: '#667788', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer' }}
                    >
                      + Follow-up
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                  {[
                    { label: 'Hvad gik godt', value: s.went_well },
                    { label: 'Udfordringer', value: s.challenges },
                    { label: 'Brug for hjælp', value: s.needs_help, highlight: s.is_support_request },
                  ].map(f => (
                    <div key={f.label} style={{ background: '#0F1923', borderRadius: 7, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, color: f.highlight ? '#E74C3C' : '#667788', fontWeight: 600, marginBottom: 6, letterSpacing: '0.04em' }}>{f.label.toUpperCase()}</div>
                      <div style={{ fontSize: 12, color: f.value ? '#B0BEC5' : '#334455', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {f.value || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Replies */}
                {s.replies.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 12 }}>
                    {s.replies.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#0F6E5622', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0F9B6E', flexShrink: 0, fontWeight: 700 }}>
                          {r.user_name.charAt(0)}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: '#0F9B6E', fontWeight: 600 }}>{r.user_name}</span>
                          <span style={{ fontSize: 11, color: '#667788' }}> · {fmtTime(r.created_at)}</span>
                          <div style={{ fontSize: 13, color: '#ECF0F1', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Svar…"
                    value={replyText[s.id] ?? ''}
                    onChange={e => setReplyText(t => ({ ...t, [s.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && sendReply(s.id)}
                    style={{
                      flex: 1, background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, color: '#ECF0F1', fontSize: 12, padding: '7px 10px',
                    }}
                  />
                  <button
                    onClick={() => sendReply(s.id)}
                    disabled={replyingTo === s.id || !replyText[s.id]?.trim()}
                    style={{
                      background: '#185FA5', color: '#fff', border: 'none', borderRadius: 6,
                      padding: '7px 14px', fontSize: 12, cursor: 'pointer', opacity: replyingTo === s.id ? 0.6 : 1,
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Follow-up modal */}
      {followupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80 }}>
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '28px 32px', width: 480, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1', marginBottom: 20 }}>Opret follow-up</div>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 16 }}>Fra sitrep: {followupModal.seller_name} — {fmtDate(followupModal.date)}</div>

            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 5 }}>Titel *</label>
            <input
              type="text"
              value={followupForm.title}
              onChange={e => setFollowupForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Hvad skal følges op på?"
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 12px', marginBottom: 14, boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: 12, color: '#667788', marginBottom: 5 }}>Beskrivelse</label>
            <textarea
              value={followupForm.body}
              onChange={e => setFollowupForm(f => ({ ...f, body: e.target.value }))}
              rows={3}
              placeholder="Yderligere detaljer…"
              style={{ width: '100%', background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#ECF0F1', fontSize: 13, padding: '9px 12px', marginBottom: 20, boxSizing: 'border-box', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setFollowupModal(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#667788', borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
              <button
                onClick={createFollowup}
                disabled={savingFollowup || !followupForm.title.trim()}
                style={{ background: '#0F6E56', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingFollowup ? 0.7 : 1 }}
              >
                {savingFollowup ? 'Opretter…' : 'Opret follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
