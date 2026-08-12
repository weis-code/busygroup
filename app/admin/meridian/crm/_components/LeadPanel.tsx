'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Lead, Stage, Activity } from './types';
import { TYPE_META, fmt, fmtDate, isOverdue } from './types';

interface Props {
  leadId: number;
  stages: Stage[];
  onClose: () => void;
  onUpdate: () => void;
}

const CALL_OUTCOMES     = ['Svarede','Svarede ikke','Voicemail','Ringet tilbage'];
const EMAIL_OUTCOMES    = ['Sendt','Åbnet','Svar modtaget','Intet svar'];
const MEETING_OUTCOMES  = ['Positivt','Neutralt','Negativt'];
const DEMO_OUTCOMES     = ['Meget interesseret','Interesseret','Neutral','Ikke interesseret'];
const FOLLOWUP_OUTCOMES = ['Svar modtaget','Intet svar','Positiv','Negativ'];
const LINKEDIN_OUTCOMES = ['Accepteret','Intet svar','Svar modtaget'];

function outcomeOptions(type: string) {
  if (type === 'call')      return CALL_OUTCOMES;
  if (type === 'email')     return EMAIL_OUTCOMES;
  if (type === 'meeting')   return MEETING_OUTCOMES;
  if (type === 'demo')      return DEMO_OUTCOMES;
  if (type === 'follow_up') return FOLLOWUP_OUTCOMES;
  if (type === 'linkedin')  return LINKEDIN_OUTCOMES;
  return [];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Lige nu';
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function LeadPanel({ leadId, stages, onClose, onUpdate }: Props) {
  const [lead, setLead]           = useState<(Lead & { activities: Activity[] }) | null>(null);
  const [actType, setActType]     = useState<string | null>(null);
  const [outcome, setOutcome]     = useState('');
  const [body, setBody]           = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate]   = useState('');
  const [saving, setSaving]       = useState(false);

  const loadLead = useCallback(async () => {
    const data = await fetch(`/api/meridian/crm/leads/${leadId}`).then(r => r.json()) as Lead & { activities: Activity[] };
    setLead(data);
  }, [leadId]);

  useEffect(() => { void loadLead(); }, [loadLead]);

  async function changeStage(stageId: number) {
    await fetch(`/api/meridian/crm/leads/${leadId}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id: stageId }),
    });
    await loadLead();
    onUpdate();
  }

  async function logActivity() {
    if (!actType || saving) return;
    setSaving(true);
    await fetch('/api/meridian/crm/activities', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId, type: actType, body: body || null, outcome: outcome || null, next_action: nextAction || null, next_action_date: nextDate || null }),
    });
    setActType(null); setOutcome(''); setBody(''); setNextAction(''); setNextDate('');
    setSaving(false);
    await loadLead();
    onUpdate();
  }

  async function deleteActivity(id: number) {
    await fetch(`/api/meridian/crm/activities/${id}`, { method: 'DELETE' });
    await loadLead();
  }

  async function markActionDone(id: number) {
    await fetch(`/api/meridian/crm/activities/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next_action_done: true }),
    });
    await loadLead();
    onUpdate();
  }

  if (!lead) return (
    <div style={{ position: 'fixed', right: 0, top: 46, bottom: 0, width: 460, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
      Indlæser…
    </div>
  );

  return (
    <div style={{ position: 'fixed', right: 0, top: 46, bottom: 0, width: 460, background: 'var(--s1)', borderLeft: '1px solid var(--bd)', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{lead.company_name}</div>
            {lead.contact_name && <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{lead.contact_name}{lead.contact_title ? ` · ${lead.contact_title}` : ''}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={lead.stage_id ?? ''} onChange={e => void changeStage(Number(e.target.value))}
            style={{ fontSize: 11, padding: '4px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)', cursor: 'pointer' }}>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {lead.deal_value_dkk > 0 && (
            <span style={{ fontSize: 11, padding: '4px 8px', background: 'var(--gr2)', border: '1px solid rgba(45,212,160,0.2)', borderRadius: 6, color: 'var(--gr)', fontWeight: 700 }}>
              {fmt(lead.deal_value_dkk)}/md.
            </span>
          )}
          {(lead.products as string[] ?? []).map((p: string) => (
            <span key={p} style={{ fontSize: 10, padding: '3px 7px', background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 100, color: 'var(--bl)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* Next action */}
      {lead.next_action_date && lead.next_action_label && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0, background: isOverdue(lead.next_action_date) ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.04)' }}>
          <div style={{ fontSize: 11, color: isOverdue(lead.next_action_date) ? 'var(--re)' : 'var(--ye)', fontWeight: 600 }}>
            📅 {lead.next_action_label}
          </div>
        </div>
      )}

      {/* Activity log area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Log activity section */}
        <div style={{ marginBottom: 16 }}>
          {!actType ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Log aktivitet</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(TYPE_META).map(([key, meta]) => (
                  <button key={key} onClick={() => setActType(key)}
                    style={{ fontSize: 18, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', transition: 'border-color 0.12s' }}
                    title={meta.label}>
                    {meta.icon}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>{TYPE_META[actType]?.icon} {TYPE_META[actType]?.label}</div>
              {outcomeOptions(actType).length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Udfald</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {outcomeOptions(actType).map(o => (
                      <button key={o} onClick={() => setOutcome(o)}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--bd)', background: outcome === o ? 'var(--bl2)' : 'var(--s1)', color: outcome === o ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer' }}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={actType === 'note' ? 'Note (påkrævet)…' : 'Noter…'}
                rows={3} style={{ width: '100%', resize: 'vertical', fontSize: 12, padding: '7px 9px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)', boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                <input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="Næste handling…"
                  style={{ fontSize: 11, padding: '6px 9px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)' }} />
                <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                  style={{ fontSize: 11, padding: '6px 9px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--t1)' }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => void logActivity()} disabled={saving || (actType === 'note' && !body.trim())}
                  style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {saving ? 'Gemmer…' : 'Log'}
                </button>
                <button onClick={() => { setActType(null); setOutcome(''); setBody(''); setNextAction(''); setNextDate(''); }}
                  style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--t2)', cursor: 'pointer' }}>
                  Annuller
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Aktivitetslog</div>
        {lead.activities.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Ingen aktiviteter endnu</div>
        ) : (
          lead.activities.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--bd)' }}>
              <span style={{ fontSize: 16, flexShrink: 0, paddingTop: 2 }}>{TYPE_META[a.type]?.icon ?? '•'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{TYPE_META[a.type]?.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>{timeAgo(a.occurred_at)}</span>
                </div>
                {a.outcome && <span style={{ fontSize: 10, padding: '2px 6px', background: 'var(--s3)', borderRadius: 4, color: 'var(--t2)', marginBottom: 3, display: 'inline-block' }}>{a.outcome}</span>}
                {a.body && <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2, lineHeight: 1.5 }}>{a.body}</div>}
                {a.next_action && !a.next_action_done && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: isOverdue(a.next_action_date) ? 'var(--re)' : 'var(--ye)', fontWeight: 500 }}>
                      📅 {a.next_action}{a.next_action_date ? ` · ${fmtDate(a.next_action_date)}` : ''}
                    </span>
                    <button onClick={() => void markActionDone(a.id)}
                      style={{ fontSize: 10, color: 'var(--gr)', background: 'var(--gr2)', border: 'none', borderRadius: 100, padding: '2px 8px', fontWeight: 600, cursor: 'pointer' }}>
                      ✓ Udført
                    </button>
                  </div>
                )}
                {a.next_action && a.next_action_done && (
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--t3)', textDecoration: 'line-through' }}>
                    {a.next_action}
                  </div>
                )}
              </div>
              <button onClick={() => void deleteActivity(a.id)}
                style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, opacity: 0.5, flexShrink: 0, alignSelf: 'flex-start', padding: 2 }}
                title="Slet">✕</button>
            </div>
          ))
        )}

        {/* Lead info */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Lead info</div>
          {[
            { label: 'Email',    value: lead.email },
            { label: 'Telefon',  value: lead.phone },
            { label: 'LinkedIn', value: lead.linkedin },
            { label: 'Website',  value: lead.website },
            { label: 'Industri', value: lead.industry },
          ].filter(f => f.value).map(f => (
            <div key={f.label} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--t3)', width: 60, flexShrink: 0, paddingTop: 1 }}>{f.label}</span>
              <span style={{ fontSize: 12, color: 'var(--t1)' }}>{f.value}</span>
            </div>
          ))}
          {lead.notes && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{lead.notes}</div>
          )}
        </div>
      </div>
    </div>
  );
}
