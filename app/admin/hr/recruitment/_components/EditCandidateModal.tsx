'use client';

import { useState } from 'react';
import { SOURCES } from '@/lib/recruitment';
import type { Candidate, Company, UserOption } from './types';

export default function EditCandidateModal({ candidate, companies, users, onClose, onSaved }: {
  candidate: Candidate; companies: Company[]; users: UserOption[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName]     = useState(candidate.full_name);
  const [email, setEmail]           = useState(candidate.email ?? '');
  const [phone, setPhone]           = useState(candidate.phone ?? '');
  const [linkedin, setLinkedin]     = useState(candidate.linkedin ?? '');
  const [location, setLocation]     = useState(candidate.location ?? '');
  const [salaryExpectation, setSalaryExpectation] = useState(candidate.salary_expectation ?? '');
  const [applyingFor, setApplyingFor] = useState(candidate.applying_for);
  const [companyId, setCompanyId]   = useState(candidate.company_id ? String(candidate.company_id) : '');
  const [source, setSource]         = useState(candidate.source ?? '');
  const [assignedTo, setAssignedTo] = useState(candidate.assigned_to ?? '');
  const [appliedAt, setAppliedAt]   = useState(candidate.applied_at ?? '');
  const [notes, setNotes]           = useState(candidate.notes ?? '');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  async function submit() {
    if (!fullName.trim() || !applyingFor.trim()) { setError('Navn og stilling kræves'); return; }
    setSaving(true); setError('');
    const res = await fetch(`/api/hr/candidates/${candidate.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim(), email: email || null, phone: phone || null,
        linkedin: linkedin || null, applying_for: applyingFor.trim(),
        company_id: companyId ? Number(companyId) : null,
        source: source || null, salary_expectation: salaryExpectation || null,
        location: location || null, assigned_to: assignedTo || null,
        applied_at: appliedAt || null, notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? 'Fejl'); return; }
    await onSaved();
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 480, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Rediger kandidat</div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>KANDIDAT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Fulde navn *</label><input value={fullName} onChange={e => setFullName(e.target.value)} autoFocus /></div>
          <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label>Telefon</label><input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label>LinkedIn URL</label><input value={linkedin} onChange={e => setLinkedin(e.target.value)} /></div>
          <div><label>Lokation</label><input value={location} onChange={e => setLocation(e.target.value)} /></div>
          <div><label>Lønforventning</label><input value={salaryExpectation} onChange={e => setSalaryExpectation(e.target.value)} /></div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>STILLING</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Søger stilling som *</label><input value={applyingFor} onChange={e => setApplyingFor(e.target.value)} /></div>
          <div>
            <label>Tilknyttet firma</label>
            <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
              <option value="">— Vælg firma —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Kilde</label>
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option value="">— Vælg kilde —</option>
              {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label>Tildel til</label>
            <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              <option value="">— Ikke tildelt —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div><label>Ansøgningsdato</label><input type="date" value={appliedAt} onChange={e => setAppliedAt(e.target.value)} /></div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>NOTER</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          style={{ width: '100%', minHeight: 80, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }} />

        {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
          <button onClick={() => void submit()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            {saving ? 'Gemmer…' : 'Gem'}
          </button>
        </div>
      </div>
    </div>
  );
}
