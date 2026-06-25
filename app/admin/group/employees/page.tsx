'use client';

import { useEffect, useState } from 'react';

interface User {
  id: string; name: string; email: string; role: string;
  company_name: string | null; company_slug: string | null;
  part_time: boolean; created_at: string;
}
interface Company { id: number; name: string; slug: string }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'var(--bl)', MANAGER: 'var(--pu)', SELLER: 'var(--gr)',
};

export default function GroupEmployeesPage() {
  const [users, setUsers]       = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filterSlug, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState<User | null>(null);
  const [loading, setLoading]     = useState(true);

  // Form state
  const [fName, setFName]         = useState('');
  const [fEmail, setFEmail]       = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fRole, setFRole]         = useState('SELLER');
  const [fCompany, setFCompany]   = useState('');
  const [fPartTime, setFPartTime] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  async function load() {
    setLoading(true);
    const [u, c] = await Promise.all([
      fetch('/api/admin/sellers?all=true').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setUsers(Array.isArray(u) ? u : []);
    setCompanies(Array.isArray(c) ? c : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditUser(null);
    setFName(''); setFEmail(''); setFPassword(''); setFRole('SELLER'); setFCompany(''); setFPartTime(false); setError('');
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setFName(u.name); setFEmail(u.email); setFPassword(''); setFRole(u.role); setFCompany(u.company_slug ?? ''); setFPartTime(u.part_time); setError('');
    setShowModal(true);
  }

  async function saveUser() {
    if (!fName.trim() || !fEmail.trim()) { setError('Navn og email kræves'); return; }
    if (!editUser && !fPassword.trim()) { setError('Password kræves'); return; }
    setSaving(true); setError('');
    const body: Record<string, unknown> = { name: fName.trim(), email: fEmail.trim(), role: fRole, company_slug: fCompany || null, part_time: fPartTime };
    if (fPassword.trim()) body.password = fPassword.trim();
    const url = editUser ? `/api/admin/sellers/${editUser.id}` : '/api/admin/sellers';
    const method = editUser ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const d = await res.json() as { error?: string };
      setError(d.error ?? 'Fejl ved gem');
      setSaving(false); return;
    }
    setSaving(false); setShowModal(false);
    await load();
  }

  const filtered = filterSlug ? users.filter(u => u.company_slug === filterSlug) : users;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Medarbejdere</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Alle medarbejdere på tværs af virksomheder</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={filterSlug} onChange={e => setFilter(e.target.value)} style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="">Alle virksomheder</option>
            {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <button onClick={openCreate} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + Opret medarbejder
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
      ) : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
                {['Navn', 'Email', 'Rolle', 'Firma', 'Deltid', 'Oprettet'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen medarbejdere</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id} onClick={() => openEdit(u)} style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--s2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{u.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--t2)' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLORS[u.role] ?? 'var(--t2)', background: `${ROLE_COLORS[u.role] ?? 'var(--t2)'}22`, padding: '2px 8px', borderRadius: 4, letterSpacing: '0.06em' }}>{u.role}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--t2)' }}>{u.company_name ?? '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: u.part_time ? 'var(--ye)' : 'var(--t3)' }}>{u.part_time ? 'Ja' : 'Nej'}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--t3)' }}>{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box" style={{ background: 'var(--s1)', borderRadius: 13, padding: 24, width: 440, maxWidth: '94vw', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>
              {editUser ? `Rediger: ${editUser.name}` : 'Opret medarbejder'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label>Navn</label><input value={fName} onChange={e => setFName(e.target.value)} placeholder="Fulde navn" autoFocus /></div>
              <div><label>Email</label><input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="email@example.com" /></div>
              <div><label>{editUser ? 'Nyt password (tom = uændret)' : 'Password'}</label><input type="password" value={fPassword} onChange={e => setFPassword(e.target.value)} placeholder={editUser ? 'Uændret' : 'Minimum 8 tegn'} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label>Rolle</label>
                  <select value={fRole} onChange={e => setFRole(e.target.value)}>
                    <option value="SELLER">SELLER</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label>Firma</label>
                  <select value={fCompany} onChange={e => setFCompany(e.target.value)}>
                    <option value="">— Ingen —</option>
                    {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={fPartTime} onChange={e => setFPartTime(e.target.checked)} style={{ width: 'auto' }} />
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>Deltid</span>
              </label>
              {error && <div style={{ fontSize: 12, color: 'var(--re)', background: 'var(--re2)', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void saveUser()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>
                {saving ? 'Gemmer…' : editUser ? 'Gem ændringer' : 'Opret'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
