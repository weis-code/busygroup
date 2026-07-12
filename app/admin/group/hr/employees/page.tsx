'use client';

import { useCallback, useEffect, useState } from 'react';

interface Employee {
  id: string; name: string; email: string; role: string;
  company_id: number | null; company_name: string | null;
  company_slug: string | null; company_color: string | null;
  start_date: string | null; part_time: boolean;
  employment_type: string | null; phone: string | null;
  address: string | null; emergency_contact: string | null;
  is_active: boolean; created_at: string;
}
interface Company { id: number; name: string; slug: string; color: string }

const ROLE_COLOR: Record<string, string> = {
  ADMIN: 'var(--bl)', MANAGER: 'var(--pu)', SELLER: 'var(--gr)', NLCA_MANAGER: '#06b6d4',
};
const EMP_TYPE_DK: Record<string, string> = {
  full_time: 'Fuldtid', part_time: 'Deltid', freelance: 'Freelance',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];
function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function HREmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filterSlug, setFilter]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Employee | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  // Panel edit state
  const [pPhone, setPPhone]   = useState('');
  const [pAddr, setPAddr]     = useState('');
  const [pEmerg, setPEmerg]   = useState('');
  const [pEmpType, setPEmpType] = useState('full_time');
  const [pStart, setPStart]   = useState('');
  const [pCompany, setPCompany] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [emp, comp] = await Promise.all([
      fetch('/api/hr/employees').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setEmployees(Array.isArray(emp) ? emp as Employee[] : []);
    setCompanies(Array.isArray(comp) ? comp as Company[] : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openPanel(emp: Employee) {
    setSelected(emp);
    setPPhone(emp.phone ?? '');
    setPAddr(emp.address ?? '');
    setPEmerg(emp.emergency_contact ?? '');
    setPEmpType(emp.employment_type ?? 'full_time');
    setPStart(emp.start_date ?? '');
    setPCompany(emp.company_id);
    setSaveMsg('');
  }

  async function saveHR() {
    if (!selected) return;
    setSaving(true); setSaveMsg('');
    const res = await fetch(`/api/hr/employees/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: pPhone || null,
        address: pAddr || null,
        emergency_contact: pEmerg || null,
        employment_type: pEmpType,
        start_date: pStart || null,
        company_id: pCompany,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg('Gemt');
      await load();
      const updated = await fetch(`/api/hr/employees`).then(r => r.json()) as Employee[];
      const fresh = updated.find(e => e.id === selected.id);
      if (fresh) setSelected(fresh);
    } else {
      setSaveMsg('Fejl ved gem');
    }
  }

  const filtered = filterSlug ? employees.filter(e => e.company_slug === filterSlug) : employees;
  const companyCount = new Set(filtered.map(e => e.company_slug).filter(Boolean)).size;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Main table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Medarbejdere</h1>
            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
              {filtered.length} medarbejdere · {companyCount} {companyCount === 1 ? 'firma' : 'firmaer'}
            </div>
          </div>
          <a href="/admin/group/employees" style={{
            background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px',
            fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-block',
          }}>
            + Opret medarbejder
          </a>
        </div>

        {/* Company filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {[{ slug: '', name: 'Alle', color: 'var(--t2)' }, ...companies].map(c => {
            const active = filterSlug === c.slug;
            return (
              <button key={c.slug} onClick={() => setFilter(c.slug)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                border: `1.5px solid ${active ? (c.color ?? 'var(--bl)') : 'var(--bd)'}`,
                background: active ? `${c.color ?? 'var(--bl)'}22` : 'transparent',
                color: active ? (c.color ?? 'var(--bl)') : 'var(--t2)', cursor: 'pointer',
              }}>
                {c.name}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            Ingen medarbejdere fundet — opret den første eller juster filteret
          </div>
        ) : (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
                  {['Navn', 'Firma', 'Rolle', 'Ansættelse', 'Startdato', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const color = emp.company_color ?? avatarColor(emp.name);
                  const isSelected = selected?.id === emp.id;
                  return (
                    <tr key={emp.id} onClick={() => openPanel(emp)}
                      style={{ borderBottom: '1px solid var(--bd)', cursor: 'pointer', background: isSelected ? 'var(--bl2)' : 'transparent', transition: 'background 0.1s' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--s2)'; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                            background: `${color}22`, border: `1.5px solid ${color}55`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 800, color,
                          }}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        {emp.company_name ? (
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                            background: `${emp.company_color ?? '#4f8ef7'}22`,
                            color: emp.company_color ?? '#4f8ef7', letterSpacing: '0.04em',
                          }}>{emp.company_name}</span>
                        ) : <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${ROLE_COLOR[emp.role] ?? 'var(--t2)'}22`,
                          color: ROLE_COLOR[emp.role] ?? 'var(--t2)', letterSpacing: '0.06em',
                        }}>{emp.role}</span>
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--t2)' }}>
                        {EMP_TYPE_DK[emp.employment_type ?? 'full_time'] ?? emp.employment_type ?? '—'}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: 'var(--t2)' }}>
                        {fmtDate(emp.start_date)}
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: emp.is_active ? 'var(--gr)' : 'var(--t3)', display: 'inline-block' }} />
                          <span style={{ fontSize: 11, color: emp.is_active ? 'var(--gr)' : 'var(--t3)' }}>
                            {emp.is_active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && (
        <div style={{
          width: 340, flexShrink: 0, borderLeft: '1px solid var(--bd)',
          background: 'var(--s1)', overflowY: 'auto', display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: `${selected.company_color ?? avatarColor(selected.name)}22`,
                border: `2px solid ${selected.company_color ?? avatarColor(selected.name)}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: selected.company_color ?? avatarColor(selected.name),
              }}>
                {initials(selected.name)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{selected.name}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${ROLE_COLOR[selected.role] ?? 'var(--t2)'}22`, color: ROLE_COLOR[selected.role] ?? 'var(--t2)' }}>{selected.role}</span>
                  {selected.company_name && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${selected.company_color ?? '#4f8ef7'}22`, color: selected.company_color ?? '#4f8ef7' }}>{selected.company_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KONTAKTINFO */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>KONTAKTINFO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Email</label>
                <a href={`mailto:${selected.email}`} style={{ fontSize: 12, color: 'var(--bl)', textDecoration: 'none' }}>{selected.email}</a>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Telefon</label>
                <input value={pPhone} onChange={e => setPPhone(e.target.value)} placeholder="Ikke angivet" style={{ width: '100%', fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Adresse</label>
                <input value={pAddr} onChange={e => setPAddr(e.target.value)} placeholder="Ikke angivet" style={{ width: '100%', fontSize: 12 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Nødkontakt</label>
                <input value={pEmerg} onChange={e => setPEmerg(e.target.value)} placeholder="Ikke angivet" style={{ width: '100%', fontSize: 12 }} />
              </div>
            </div>
          </div>

          {/* ANSÆTTELSE */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 12 }}>ANSÆTTELSE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Firma</label>
                <select value={pCompany ?? ''} onChange={e => setPCompany(e.target.value ? Number(e.target.value) : null)} style={{ width: '100%', fontSize: 12 }}>
                  <option value="">— Ingen —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Rolle</label>
                <div style={{ fontSize: 12, color: 'var(--t2)', padding: '7px 0' }}>{selected.role}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Ansættelsestype</label>
                <select value={pEmpType} onChange={e => setPEmpType(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                  <option value="full_time">Fuldtid</option>
                  <option value="part_time">Deltid</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>Startdato</label>
                <input type="date" value={pStart} onChange={e => setPStart(e.target.value)} style={{ width: '100%', fontSize: 12 }} />
              </div>
            </div>
          </div>

          {/* Save button */}
          <div style={{ padding: '16px 20px' }}>
            {saveMsg && (
              <div style={{ fontSize: 11, color: saveMsg === 'Gemt' ? 'var(--gr)' : 'var(--re)', marginBottom: 8 }}>{saveMsg}</div>
            )}
            <button onClick={() => void saveHR()} disabled={saving} style={{
              width: '100%', background: 'var(--bl)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              {saving ? 'Gemmer…' : 'Gem ændringer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
