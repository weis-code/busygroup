'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Task { id: string; name: string; client: string }
interface Log { id: string; date: string; task_name: string; calls_made: number; contacts_reached: number; meetings_booked: number; meetings_held: number; notes: string | null }

export default function LogPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [calls, setCalls] = useState('');
  const [contacts, setContacts] = useState('');
  const [booked, setBooked] = useState('');
  const [held, setHeld] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    const [l, t] = await Promise.all([
      fetch('/api/logs').then(r => r.json()),
      fetch('/api/my-tasks').then(r => r.json()),
    ]);
    setLogs(l);
    setTasks(t.tasks || []);
  }

  useEffect(() => { load(); }, []);

  function reset() {
    setTaskId(''); setDate(new Date().toISOString().slice(0, 10));
    setCalls(''); setContacts(''); setBooked(''); setHeld(''); setNotes(''); setError('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const c = Number(calls), ct = Number(contacts), bk = Number(booked), hd = Number(held);
    if (ct > c) { setError('Kontakter nået kan ikke overstige opkald foretaget'); return; }
    if (bk > ct) { setError('Møder booket kan ikke overstige kontakter nået'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, date, calls_made: c, contacts_reached: ct, meetings_booked: bk, meetings_held: hd, notes: notes || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      reset(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Aktivitetslog</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{logs.length} registreringer</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Ny log</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Dato', 'Opgave', 'Opkald', 'Kontakter', 'Booket', 'Afholdt', 'Noter'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 18px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '40px 18px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen logs endnu</td></tr>
            )}
            {logs.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 18px', fontSize: 13, color: '#ECF0F1' }}>{l.date}</td>
                <td style={{ fontSize: 13, color: '#ECF0F1' }}>{l.task_name}</td>
                <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{l.calls_made}</td>
                <td style={{ fontSize: 13, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{l.contacts_reached}</td>
                <td style={{ fontSize: 13, color: '#2ECC71', fontVariantNumeric: 'tabular-nums' }}>{l.meetings_booked}</td>
                <td style={{ fontSize: 13, color: '#185FA5', fontVariantNumeric: 'tabular-nums' }}>{l.meetings_held}</td>
                <td style={{ fontSize: 12, color: '#667788', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Ny aktivitetslog</div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Dato</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div>
                <label>Opgave</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.client}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label>Opkald foretaget</label>
                  <input type="number" min="0" value={calls} onChange={e => setCalls(e.target.value)} required placeholder="0" />
                </div>
                <div>
                  <label>Kontakter nået</label>
                  <input type="number" min="0" value={contacts} onChange={e => setContacts(e.target.value)} required placeholder="0" />
                </div>
                <div>
                  <label>Møder booket</label>
                  <input type="number" min="0" value={booked} onChange={e => setBooked(e.target.value)} required placeholder="0" />
                </div>
                <div>
                  <label>Møder afholdt</label>
                  <input type="number" min="0" value={held} onChange={e => setHeld(e.target.value)} required placeholder="0" />
                </div>
              </div>
              <div>
                <label>Noter (valgfri)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Evt. bemærkninger…" />
              </div>

              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {loading ? 'Gemmer…' : 'Gem log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
