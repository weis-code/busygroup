'use client';

import { useCallback, useEffect, useState } from 'react';

interface User {
  id: string; name: string; email: string; role: string;
  company_id: number | null; company_name: string | null; company_slug: string | null; company_color: string | null;
  start_date: string | null; part_time: boolean; employment_type: string | null;
  phone: string | null; address: string | null; emergency_contact: string | null;
  is_active: boolean; created_at: string;
}
interface Company { id: number; name: string; slug: string; color: string }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'var(--bl)', MANAGER: 'var(--pu)', SELLER: 'var(--gr)',
};

export default function HREmployeesPage() {
  const [users, setUsers]         = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filterSlug, setFilter]   = useState('');
  const [selected, setSelected]   = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]   = useState<User | null>(null);
  const [loading, setLoading]     = useState(true);

  const [fName, setFName]         = useState('');
  const [fEmail, setFEmail]       = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fRole, setFRole]         = useState('SELLER');
  const [fCompany, setFCompany]   = useState('');
  const [fPartTime, setFPartTime] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        fetch('/api/hr/employees').then(r => r.json()),
        fetch('/api/companies').then(r => r.json()),
      ]);
      setUsers(Array.isArray(u) ? u as User[] : []);
      setCompanies(Array.isArray(c) ? c as Company[] : []);
    } catch {
      setUsers([]); setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Keep selected in sync when users list refreshes
  useEffect(() => {
    if (!selected) return;
    const fresh = users.find(u => u.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main table */}
      <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', minWidth: 0 }}>
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
                  <tr key={u.id} onClick={() => setSelected(u)}
                    style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: selected?.id === u.id ? 'var(--bl2)' : 'transparent' }}
                    onMouseEnter={e => { if (selected?.id !== u.id) (e.currentTarget as HTMLElement).style.background = 'var(--s2)'; }}
                    onMouseLeave={e => { if (selected?.id !== u.id) (e.currentTarget as HTMLElement).style.background = selected?.id === u.id ? 'var(--bl2)' : 'transparent'; }}>
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
      </div>

      {/* HR side panel */}
      {selected && (
        <HRPanel
          user={selected}
          companies={companies}
          onClose={() => setSelected(null)}
          onEdit={openEdit}
          onUpdated={load}
        />
      )}

      {/* Create / Edit modal */}
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
              <button onClick={() => void saveUser()} disabled={saving} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                {saving ? 'Gemmer…' : editUser ? 'Gem ændringer' : 'Opret'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── HR side panel ─────────────────────────────────── */
function HRPanel({ user, companies, onClose, onEdit, onUpdated }: {
  user: User; companies: Company[]; onClose: () => void;
  onEdit: (u: User) => void; onUpdated: () => Promise<void>;
}) {
  const [phone, setPhone]         = useState(user.phone ?? '');
  const [address, setAddress]     = useState(user.address ?? '');
  const [emergency, setEmergency] = useState(user.emergency_contact ?? '');
  const [empType, setEmpType]     = useState(user.employment_type ?? 'full_time');
  const [startDate, setStartDate] = useState(user.start_date ?? '');
  const [companyId, setCompanyId] = useState(user.company_id != null ? String(user.company_id) : '');
  const [isActive, setIsActive]   = useState(user.is_active);

  useEffect(() => {
    setPhone(user.phone ?? '');
    setAddress(user.address ?? '');
    setEmergency(user.emergency_contact ?? '');
    setEmpType(user.employment_type ?? 'full_time');
    setStartDate(user.start_date ?? '');
    setCompanyId(user.company_id != null ? String(user.company_id) : '');
    setIsActive(user.is_active);
  }, [user]);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/hr/employees/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await onUpdated();
  }

  const color = user.company_color ?? '#4f8ef7';
  const fields = [
    { label: 'Telefon',   val: phone,     set: setPhone,     key: 'phone' },
    { label: 'Adresse',   val: address,   set: setAddress,   key: 'address' },
    { label: 'Nødkontakt',val: emergency, set: setEmergency, key: 'emergency_contact' },
  ];

  return (
    <div style={{ width: 340, flexShrink: 0, borderLeft: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer', padding: 0 }}>×</button>
          <button onClick={() => onEdit(user)} style={{ background: 'var(--bl2)', color: 'var(--bl)', border: '1px solid var(--bl)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Rediger bruger</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>
            {initials(user.name)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{user.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLORS[user.role] ?? 'var(--t2)', background: `${ROLE_COLORS[user.role] ?? 'var(--t2)'}22`, padding: '2px 8px', borderRadius: 4 }}>{user.role}</span>
          {user.company_name && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${color}22`, color }}>{user.company_name}</span>}
          {user.part_time && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--ye2)', color: 'var(--ye)' }}>Deltid</span>}
          {!user.is_active && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: 'var(--re2)', color: 'var(--re)' }}>Inaktiv</span>}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>KONTAKTINFO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>Email</span>
              <span style={{ fontSize: 11, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            </div>
            {fields.map(({ label, val, set, key }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>{label}</span>
                <input value={val} onChange={e => set(e.target.value)}
                  onBlur={() => void patch({ [key]: val || null })}
                  placeholder="—" style={{ fontSize: 11, flex: 1 }} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 }}>ANSÆTTELSE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>Firma</span>
              <select value={companyId} onChange={async e => {
                const v = e.target.value;
                setCompanyId(v);
                await patch({ company_id: v ? Number(v) : null });
              }} style={{ fontSize: 11, flex: 1 }}>
                <option value="">— Ingen —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>Type</span>
              <select value={empType} onChange={async e => {
                const v = e.target.value;
                setEmpType(v);
                await patch({ employment_type: v });
              }} style={{ fontSize: 11, flex: 1 }}>
                <option value="full_time">Fuldtid</option>
                <option value="part_time">Deltid</option>
                <option value="contractor">Freelance</option>
                <option value="intern">Praktikant</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>Startdato</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                onBlur={() => void patch({ start_date: startDate || null })}
                style={{ fontSize: 11, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, width: 80 }}>Status</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
                <input type="checkbox" checked={isActive} onChange={async e => {
                  const v = e.target.checked;
                  setIsActive(v);
                  await patch({ is_active: v });
                }} style={{ width: 'auto' }} />
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>{isActive ? 'Aktiv' : 'Inaktiv'}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
