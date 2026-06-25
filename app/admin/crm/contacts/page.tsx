'use client';

import { useEffect, useState } from 'react';

interface Contact {
  id: number; name: string; title: string | null; company_name: string | null;
  email: string | null; phone: string | null; linkedin: string | null;
  notes: string | null; owner_name: string | null; deal_count: number; created_at: string;
}

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

export default function CrmContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', title: '', company_name: '', email: '', phone: '', linkedin: '', notes: '' });

  function set(k: keyof typeof form, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function load(q = '') {
    setLoading(true);
    const sp = q ? `?q=${encodeURIComponent(q)}` : '';
    const rows = await fetch(`/api/crm/contacts${sp}`).then(r => r.json()) as Contact[];
    if (Array.isArray(rows)) setContacts(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setTimeout(() => load(filter), 300);
    return () => clearTimeout(t);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await fetch('/api/crm/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setModal(false);
    setForm({ name: '', title: '', company_name: '', email: '', phone: '', linkedin: '', notes: '' });
    setToast('Kontakt oprettet');
    load();
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Kontakter</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{contacts.length} kontakter</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/admin/crm" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', padding: '8px 12px', background: 'var(--s2)', borderRadius: 7, border: '1px solid var(--bd)' }}>← Pipeline</a>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Søg navn, firma…" style={{ width: 200 }} />
          <button onClick={() => setModal(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 14px', fontSize: 12, fontWeight: 600 }}>+ Ny kontakt</button>
        </div>
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>}
        {!loading && contacts.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen kontakter</div>
        )}
        {!loading && contacts.map((c, idx) => (
          <div key={c.id} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: idx < contacts.length - 1 ? '1px solid var(--bd)' : 'none', alignItems: 'flex-start', transition: 'background 0.1s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bl2)', border: '1px solid rgba(79,142,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--bl)', flexShrink: 0 }}>
              {c.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</div>
              {(c.title || c.company_name) && (
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{[c.title, c.company_name].filter(Boolean).join(' · ')}</div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`} style={{ fontSize: 11, color: 'var(--bl)', textDecoration: 'none' }}>{c.phone}</a>}
                {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}>LinkedIn ↗</a>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>{c.deal_count > 0 ? <span style={{ color: 'var(--bl)' }}>{c.deal_count} deal{c.deal_count !== 1 ? 's' : ''}</span> : <span style={{ color: 'var(--t4)' }}>Ingen deals</span>}</div>
              {c.owner_name && <div style={{ fontSize: 10, color: 'var(--t4)' }}>{c.owner_name}</div>}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false); }}>
          <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 460, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Ny kontakt</div>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Navn *</label><input value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Jens Jensen" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Titel</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="CEO" /></div>
                <div><label>Firma</label><input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Firma A/S" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jens@firma.dk" /></div>
                <div><label>Telefon</label><input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+45 12 34 56 78" /></div>
              </div>
              <div><label>LinkedIn URL</label><input value={form.linkedin} onChange={e => set('linkedin', e.target.value)} placeholder="https://linkedin.com/in/…" /></div>
              <div><label>Noter</label><textarea rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
                <button type="submit" style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>Opret kontakt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
