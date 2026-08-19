'use client';

import { useEffect, useState } from 'react';
import { SOURCES } from '@/lib/recruitment';
import type { Company, UserOption, ChecklistTemplate } from './types';

export default function CreateCandidateModal({ companies, users, onClose, onCreated }: {
  companies: Company[]; users: UserOption[]; onClose: () => void; onCreated: () => void;
}) {
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');
  const [linkedin, setLinkedin]     = useState('');
  const [location, setLocation]     = useState('');
  const [salaryExpectation, setSalaryExpectation] = useState('');
  const [applyingFor, setApplyingFor] = useState('');
  const [companyId, setCompanyId]   = useState('');
  const [source, setSource]         = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [appliedAt, setAppliedAt]   = useState(new Date().toISOString().slice(0, 10));
  const [interviewDate, setInterviewDate] = useState('');
  const [startDate, setStartDate]   = useState('');
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const [createdId, setCreatedId]   = useState<number | null>(null);
  const [templates, setTemplates]   = useState<ChecklistTemplate[]>([]);

  useEffect(() => {
    if (createdId !== null && startDate) {
      fetch('/api/hr/checklist-templates').then(r => r.json()).then(setTemplates).catch(() => setTemplates([]));
    }
  }, [createdId, startDate]);

  async function submit() {
    if (!fullName.trim() || !applyingFor.trim()) { setError('Navn og stilling kræves'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/hr/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName.trim(), email: email || null, phone: phone || null,
        linkedin: linkedin || null, applying_for: applyingFor.trim(),
        company_id: companyId ? Number(companyId) : null,
        source: source || null, salary_expectation: salaryExpectation || null,
        location: location || null, assigned_to: assignedTo || null,
        applied_at: appliedAt || null,
        interview_date: interviewDate || null,
        start_date: startDate || null,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? 'Fejl'); return; }
    const created = await res.json() as { id: number };
    if (startDate) {
      setCreatedId(created.id);
    } else {
      onCreated();
    }
  }

  async function applyTemplateAndFinish(templateId: number | null) {
    if (createdId !== null && templateId !== null) {
      await fetch(`/api/hr/candidates/${createdId}/checklist/apply-template`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: templateId }),
      });
    }
    onCreated();
  }

  if (createdId !== null) {
    const defaultTemplate = templates[0];
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 400, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 10 }}>Vil du tilføje opstarts-tjekliste?</div>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 18 }}>Kandidaten har en opstartsdato — du kan forberede tjeklisten nu, eller gøre det senere.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {defaultTemplate && (
              <button onClick={() => void applyTemplateAndFinish(defaultTemplate.id)}
                style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Ja, brug standardskabelon
              </button>
            )}
            {templates.length > 1 && (
              <select defaultValue="" onChange={e => { if (e.target.value) void applyTemplateAndFinish(Number(e.target.value)); }}
                style={{ fontSize: 12 }}>
                <option value="">Vælg skabelon…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={() => void applyTemplateAndFinish(null)}
              style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '10px 0', fontSize: 12, cursor: 'pointer' }}>
              Spring over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 480, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny kandidat</div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>KANDIDAT</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Fulde navn *</label><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Fornavn Efternavn" autoFocus /></div>
          <div><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="kandidat@example.com" /></div>
          <div><label>Telefon</label><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+45 12 34 56 78" /></div>
          <div><label>LinkedIn URL</label><input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/..." /></div>
          <div><label>Lokation</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="fx København" /></div>
          <div><label>Lønforventning</label><input value={salaryExpectation} onChange={e => setSalaryExpectation(e.target.value)} placeholder="fx 45-50k/md." /></div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>STILLING</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div><label>Søger stilling som *</label><input value={applyingFor} onChange={e => setApplyingFor(e.target.value)} placeholder="fx Sælger, Account Manager, Developer" /></div>
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
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>DATOER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 6 }}>
          <div><label>Ansøgningsdato</label><input type="date" value={appliedAt} onChange={e => setAppliedAt(e.target.value)} /></div>
          <div><label>Samtaledato</label><input type="datetime-local" value={interviewDate} onChange={e => setInterviewDate(e.target.value)} /></div>
          <div><label>Opstartsdato</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 16 }}>Sæt opstartsdato for at aktivere opstarts-tjeklisten</div>

        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>NOTER</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Fritekst noter om kandidaten"
          style={{ width: '100%', minHeight: 80, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }} />

        {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
          <button onClick={() => void submit()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            {saving ? 'Opretter…' : 'Opret'}
          </button>
        </div>
      </div>
    </div>
  );
}
