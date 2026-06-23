'use client';

import { useEffect, useState, FormEvent } from 'react';

interface User { id: string; email: string; name: string; role: string; is_part_time: boolean; created_at: string }

interface DayRow { date: string; calls: number; contacts: number; call_goal: number; sales_goal: number; sales: number }
interface SaleRow { id: string; date: string; cvr: string | null; company_name: string | null; deal_size: number | null; status: string; task_name: string; display_mode: string; compensation_model: string; package_name: string | null }
interface SellerDetail { user: User; days: DayRow[]; sales: SaleRow[] }

type EditField = 'calls' | 'contacts' | 'call_goal' | 'sales_goal';

const ROLE_COLOR: Record<string, string> = { ADMIN: '#E74C3C', MANAGER: '#F39C12', SELLER: '#2ECC71' };
const STATUS_COLOR: Record<string, string> = { PENDING: '#F39C12', CONFIRMED: '#2ECC71', PAID: '#185FA5' };
const STATUS_DK: Record<string, string> = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };
const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

const FIELD_TO_API: Record<EditField, string> = {
  calls: 'calls_actual',
  contacts: 'contacts_actual',
  call_goal: 'call_goal',
  sales_goal: 'sales_goal',
};

function defaultRange() {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(); from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to };
}

export default function SellersPage() {
  const [users, setUsers] = useState<User[]>([]);

  // Create modal
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('SELLER');
  const [isPartTime, setIsPartTime] = useState(false);

  // History drawer
  const [detail, setDetail] = useState<SellerDetail | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [range, setRange] = useState(defaultRange);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Inline cell editing
  const [editing, setEditing] = useState<{ date: string; field: EditField } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editIsPartTime, setEditIsPartTime] = useState(false);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  async function load() {
    const data = await fetch('/api/admin/sellers').then(r => r.json());
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  async function openDetail(u: User) {
    setDetailUser(u);
    setDetail(null);
    setLoadingDetail(true);
    const r = defaultRange();
    setRange(r);
    const d = await fetch(`/api/admin/sellers/${u.id}?from=${r.from}&to=${r.to}`).then(r => r.json());
    setDetail(d);
    setLoadingDetail(false);
  }

  async function loadDetail(from: string, to: string) {
    if (!detailUser) return;
    setLoadingDetail(true);
    const d = await fetch(`/api/admin/sellers/${detailUser.id}?from=${from}&to=${to}`).then(r => r.json());
    setDetail(d);
    setLoadingDetail(false);
  }

  function reset() { setEmail(''); setName(''); setPassword(''); setRole('SELLER'); setIsPartTime(false); setError(''); }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sellers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password, role, is_part_time: isPartTime }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fejl'); return; }
      reset(); setOpen(false); load();
    } catch { setError('Netværksfejl'); }
    finally { setLoading(false); }
  }

  function startEdit(date: string, field: EditField, current: number) {
    setEditing({ date, field });
    setEditVal(String(current));
  }

  async function commitEdit(date: string, field: EditField) {
    if (!detailUser || !detail) { setEditing(null); return; }
    const num = parseInt(editVal, 10);
    if (isNaN(num) || num < 0) { setEditing(null); return; }

    const day = detail.days.find(d => d.date === date);
    const patch = {
      user_id: detailUser.id,
      date,
      calls_actual: day?.calls ?? 0,
      contacts_actual: day?.contacts ?? 0,
      call_goal: day?.call_goal ?? 0,
      sales_goal: day?.sales_goal ?? 0,
      [FIELD_TO_API[field]]: num,
    };

    setSaving(true);
    await fetch('/api/admin/daily-targets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);

    setDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(d => d.date === date ? { ...d, [field]: num } : d),
      };
    });
    setEditing(null);
  }

  function EditableNum({ date, field, value, bold }: { date: string; field: EditField; value: number; bold?: boolean }) {
    const isActive = editing?.date === date && editing?.field === field;
    if (isActive) {
      return (
        <input
          autoFocus type="number" min={0} value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onBlur={() => commitEdit(date, field)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit(date, field);
            if (e.key === 'Escape') setEditing(null);
          }}
          style={{ width: 54, background: '#1A2A38', border: '1px solid #185FA5', borderRadius: 4, color: '#ECF0F1', fontSize: 12, padding: '2px 6px', fontVariantNumeric: 'tabular-nums', outline: 'none' }}
        />
      );
    }
    return (
      <div
        onClick={() => startEdit(date, field, value)}
        title="Klik for at redigere"
        style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: value > 0 ? '#ECF0F1' : '#334455', fontVariantNumeric: 'tabular-nums', cursor: 'text', padding: '2px 4px', borderRadius: 4, display: 'inline-block', minWidth: 20, textDecoration: 'underline dotted rgba(255,255,255,0.15)' }}
      >
        {value > 0 ? value : '—'}
      </div>
    );
  }

  // Edit user
  function openEditUser(u: User, e: React.MouseEvent) {
    e.stopPropagation();
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditIsPartTime(u.is_part_time);
    setEditNewPassword('');
    setEditError('');
  }

  async function submitEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true); setEditError('');
    try {
      const res = await fetch(`/api/admin/sellers/${editUser.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, role: editRole, is_part_time: editIsPartTime, ...(editNewPassword ? { new_password: editNewPassword } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Fejl'); return; }
      setEditUser(null);
      // Update detailUser if drawer is open for this user
      if (detailUser?.id === editUser.id) setDetailUser(data);
      load();
    } catch { setEditError('Netværksfejl'); }
    finally { setEditLoading(false); }
  }

  async function deleteUser(u: User, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`Slet ${u.name}? Dette kan ikke fortrydes.`)) return;
    await fetch(`/api/admin/sellers/${u.id}`, { method: 'DELETE' });
    if (detailUser?.id === u.id) setDetailUser(null);
    load();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>Sælgere</h1>
          <p style={{ fontSize: 13, color: '#667788' }}>{users.length} brugere</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} style={{ background: '#185FA5', color: '#fff', padding: '10px 18px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>+ Ny bruger</button>
      </div>

      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Navn', 'Email', 'Rolle', 'Oprettet', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 18px', fontSize: 11, color: '#667788', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: 13 }}>Ingen brugere</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => openDetail(u)}>
                <td style={{ padding: '13px 18px', fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{u.name}</td>
                <td style={{ fontSize: 13, color: '#667788', padding: '13px 18px' }}>{u.email}</td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600, background: `${ROLE_COLOR[u.role]}18`, color: ROLE_COLOR[u.role] }}>{u.role}</span>
                    {u.is_part_time && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: 'rgba(142,68,173,0.15)', color: '#8E44AD', border: '1px solid rgba(142,68,173,0.3)' }}>DELTID</span>}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: '#667788', padding: '13px 18px' }}>{new Date(u.created_at).toLocaleDateString('da-DK')}</td>
                <td style={{ padding: '13px 18px' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={e => openEditUser(u, e)} style={{ fontSize: 12, color: '#185FA5', background: 'rgba(24,95,165,0.1)', border: '1px solid rgba(24,95,165,0.2)', padding: '4px 10px', borderRadius: 5 }}>Rediger</button>
                    <button onClick={e => deleteUser(u, e)} style={{ fontSize: 12, color: '#E74C3C', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', padding: '4px 10px', borderRadius: 5 }}>Slet</button>
                    <span style={{ fontSize: 12, color: '#667788', padding: '4px 0' }}>Historik →</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History drawer */}
      {detailUser && (
        <>
          <div onClick={() => setDetailUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 660, background: '#0F1923', borderLeft: '1px solid rgba(255,255,255,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#ECF0F1', marginBottom: 4 }}>{detailUser.name}</div>
                <div style={{ fontSize: 12, color: '#667788' }}>{detailUser.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saving && <span style={{ fontSize: 11, color: '#667788' }}>Gemmer…</span>}
                <button onClick={() => setDetailUser(null)} style={{ background: 'rgba(255,255,255,0.06)', color: '#667788', padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>✕ Luk</button>
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#667788' }}>Periode:</span>
              <input type="date" value={range.from} onChange={e => { const r = { ...range, from: e.target.value }; setRange(r); loadDetail(r.from, r.to); }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, width: 140 }} />
              <span style={{ fontSize: 12, color: '#667788' }}>→</span>
              <input type="date" value={range.to} onChange={e => { const r = { ...range, to: e.target.value }; setRange(r); loadDetail(r.from, r.to); }} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, width: 140 }} />
              {loadingDetail && <span style={{ fontSize: 12, color: '#667788' }}>Indlæser…</span>}
            </div>

            <div style={{ padding: '20px 28px', flex: 1 }}>
              {detail && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
                  {[
                    { label: 'OPKALD', value: detail.days.reduce((s, d) => s + d.calls, 0) },
                    { label: 'KONTAKTER', value: detail.days.reduce((s, d) => s + d.contacts, 0) },
                    { label: 'SALG', value: detail.days.reduce((s, d) => s + d.sales, 0) },
                  ].map(k => (
                    <div key={k.label} style={{ background: '#111E2A', borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ fontSize: 10, color: '#667788', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#ECF0F1', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#667788', fontWeight: 600, letterSpacing: '0.06em' }}>DAGLIG HISTORIK</div>
                <div style={{ fontSize: 11, color: '#4A5568' }}>Klik på et tal for at redigere</div>
              </div>
              {detail && (
                <div style={{ background: '#111E2A', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 70px 70px 50px 75px 70px 56px', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Dato', 'Opkald', 'Kontakter', 'Salg', 'Mål opk.', 'Mål salg', 'KR%'].map(h => (
                      <div key={h} style={{ fontSize: 10, color: '#667788', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</div>
                    ))}
                  </div>
                  {detail.days.map((d, i) => {
                    const isEmpty = d.calls === 0 && d.contacts === 0 && d.sales === 0 && d.call_goal === 0 && d.sales_goal === 0;
                    const isToday = d.date === today;
                    const kr = d.contacts > 0 ? (d.sales / d.contacts * 100).toFixed(1) + '%' : null;
                    const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '120px 70px 70px 50px 75px 70px 56px', gap: 8, padding: '10px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined, background: isToday ? 'rgba(24,95,165,0.07)' : 'transparent', opacity: isEmpty ? 0.4 : 1 }}>
                        <div style={{ fontSize: 12, color: isToday ? '#185FA5' : '#ECF0F1', fontWeight: isToday ? 700 : 500 }}>{dateLabel}</div>
                        <EditableNum date={d.date} field="calls" value={d.calls} bold />
                        <EditableNum date={d.date} field="contacts" value={d.contacts} bold />
                        <div style={{ fontSize: 13, fontWeight: 700, color: d.sales > 0 ? '#2ECC71' : '#334455', fontVariantNumeric: 'tabular-nums' }}>{d.sales || '—'}</div>
                        <EditableNum date={d.date} field="call_goal" value={d.call_goal} />
                        <EditableNum date={d.date} field="sales_goal" value={d.sales_goal} />
                        <div style={{ fontSize: 12, color: kr ? '#185FA5' : '#4A5568', fontVariantNumeric: 'tabular-nums' }}>{kr ?? '—'}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {detail && detail.sales.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: '#667788', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 10 }}>SALG I PERIODEN ({detail.sales.length})</div>
                  <div style={{ background: '#111E2A', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 80px', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Dato', 'Firma', 'Opgave', 'Status'].map(h => (
                        <div key={h} style={{ fontSize: 10, color: '#667788', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</div>
                      ))}
                    </div>
                    {detail.sales.map((s, i) => (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 80px', gap: 8, padding: '11px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                        <div style={{ fontSize: 12, color: '#667788' }}>{s.date}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#ECF0F1' }}>{s.company_name || '—'}</div>
                          {s.cvr && <div style={{ fontSize: 11, color: '#4A5568' }}>{s.cvr}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: '#667788' }}>{s.task_name}</div>
                          {s.deal_size && <div style={{ fontSize: 11, color: '#185FA5', fontVariantNumeric: 'tabular-nums' }}>{fmtKr(Number(s.deal_size))}</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600, background: `${STATUS_COLOR[s.status]}18`, color: STATUS_COLOR[s.status] }}>{STATUS_DK[s.status]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Rediger {editUser.name}</div>
            <form onSubmit={submitEditUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Navn</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Rolle</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="SELLER">SELLER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#667788', display: 'block', marginBottom: 6 }}>Nyt kodeord <span style={{ color: '#4A5568', fontWeight: 400 }}>(lad stå tom for at beholde nuværende)</span></label>
                <input
                  type="password"
                  value={editNewPassword}
                  onChange={e => setEditNewPassword(e.target.value)}
                  placeholder="Mindst 8 tegn"
                  minLength={8}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: editIsPartTime ? 'rgba(142,68,173,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 7, border: `1px solid ${editIsPartTime ? 'rgba(142,68,173,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                <input type="checkbox" checked={editIsPartTime} onChange={e => setEditIsPartTime(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#8E44AD' }} />
                <div>
                  <div style={{ fontSize: 13, color: editIsPartTime ? '#8E44AD' : '#ECF0F1', fontWeight: editIsPartTime ? 600 : 400 }}>Deltidsansat</div>
                  <div style={{ fontSize: 11, color: '#4A5568', marginTop: 2 }}>Tæller ikke med i Omsætning pr. FTE</div>
                </div>
              </label>
              {editError && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{editError}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setEditUser(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={editLoading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {editLoading ? 'Gemmer…' : 'Gem ændringer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 28, width: 420 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1', marginBottom: 22 }}>Opret ny bruger</div>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Fulde navn" />
              </div>
              <div>
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@busygroup.dk" />
              </div>
              <div>
                <label>Kodeord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mindst 8 tegn" minLength={8} />
              </div>
              <div>
                <label>Rolle</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="SELLER">SELLER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isPartTime ? 'rgba(142,68,173,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 7, border: `1px solid ${isPartTime ? 'rgba(142,68,173,0.3)' : 'rgba(255,255,255,0.07)'}` }}>
                <input type="checkbox" checked={isPartTime} onChange={e => setIsPartTime(e.target.checked)} style={{ width: 15, height: 15, accentColor: '#8E44AD' }} />
                <div>
                  <div style={{ fontSize: 13, color: isPartTime ? '#8E44AD' : '#ECF0F1', fontWeight: isPartTime ? 600 : 400 }}>Deltidsansat</div>
                  <div style={{ fontSize: 11, color: '#4A5568', marginTop: 2 }}>Tæller ikke med i Omsætning pr. FTE</div>
                </div>
              </label>
              {error && <div style={{ color: '#E74C3C', fontSize: 12, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', borderRadius: 6 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 7, background: 'rgba(255,255,255,0.06)', color: '#667788' }}>Annuller</button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px 0', borderRadius: 7, background: '#185FA5', color: '#fff', fontWeight: 600 }}>
                  {loading ? 'Opretter…' : 'Opret bruger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
