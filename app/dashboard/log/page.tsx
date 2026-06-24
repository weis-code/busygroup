'use client';

import { useEffect, useState, FormEvent } from 'react';

interface Task { id: string; name: string; client: string }
interface Log  { id: string; date: string; task_name: string; calls_made: number; contacts_reached: number; meetings_booked: number; meetings_held: number; notes: string | null }

export default function LogPage() {
  const [logs, setLogs]       = useState<Log[]>([]);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const [taskId, setTaskId]   = useState('');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [calls, setCalls]     = useState('');
  const [contacts, setContacts] = useState('');
  const [booked, setBooked]   = useState('');
  const [held, setHeld]       = useState('');
  const [notes, setNotes]     = useState('');

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Aktivitetslog</h1>
          <p className="page-sub">{logs.length} registreringer</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} className="btn btn-primary">+ Ny log</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {['Dato', 'Opgave', 'Opkald', 'Kontakter', 'Booket', 'Afholdt', 'Noter'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr className="empty-row"><td colSpan={7}>Ingen logs endnu</td></tr>}
            {logs.map(l => (
              <tr key={l.id}>
                <td className="td-primary">{l.date}</td>
                <td className="td-primary">{l.task_name}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{l.calls_made}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{l.contacts_reached}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--gr)' }}>{l.meetings_booked}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--bl)' }}>{l.meetings_held}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Ny aktivitetslog</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Dato</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Opgave</label>
                <select value={taskId} onChange={e => setTaskId(e.target.value)} required>
                  <option value="">Vælg opgave…</option>
                  {tasks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.client}</option>)}
                </select>
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Opkald foretaget</label>
                  <input type="number" min="0" value={calls} onChange={e => setCalls(e.target.value)} required placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Kontakter nået</label>
                  <input type="number" min="0" value={contacts} onChange={e => setContacts(e.target.value)} required placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Møder booket</label>
                  <input type="number" min="0" value={booked} onChange={e => setBooked(e.target.value)} required placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Møder afholdt</label>
                  <input type="number" min="0" value={held} onChange={e => setHeld(e.target.value)} required placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label>Noter (valgfri)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Evt. bemærkninger…" />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
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
