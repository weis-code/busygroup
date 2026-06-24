'use client';

import { useEffect, useState, FormEvent } from 'react';

interface User { id: string; email: string; name: string; role: string; is_part_time: boolean; created_at: string }

interface DayRow  { date: string; calls: number; contacts: number; call_goal: number; sales_goal: number; sales: number }
interface SaleRow { id: string; date: string; cvr: string | null; company_name: string | null; deal_size: number | null; status: string; task_name: string; display_mode: string; compensation_model: string; package_name: string | null }
interface SellerDetail { user: User; days: DayRow[]; sales: SaleRow[] }

type EditField = 'calls' | 'contacts' | 'call_goal' | 'sales_goal';

const ROLE_CLR: Record<string, string>   = { ADMIN: 'var(--re)', MANAGER: 'var(--ye)', SELLER: 'var(--gr)' };
const ROLE_BG: Record<string, string>    = { ADMIN: 'var(--re2)', MANAGER: 'var(--ye2)', SELLER: 'var(--gr2)' };
const STATUS_CLR: Record<string, string> = { PENDING: 'var(--ye)', CONFIRMED: 'var(--gr)', PAID: 'var(--bl)' };
const STATUS_BG: Record<string, string>  = { PENDING: 'var(--ye2)', CONFIRMED: 'var(--gr2)', PAID: 'var(--bl2)' };
const STATUS_DK: Record<string, string>  = { PENDING: 'Afventer', CONFIRMED: 'Bekræftet', PAID: 'Betalt' };
const fmtKr = (n: number) => n.toLocaleString('da-DK', { maximumFractionDigits: 0 }) + ' kr';

const FIELD_TO_API: Record<EditField, string> = {
  calls: 'calls_actual', contacts: 'contacts_actual', call_goal: 'call_goal', sales_goal: 'sales_goal',
};

function defaultRange() {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(); from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to };
}

export default function SellersPage() {
  const [users, setUsers] = useState<User[]>([]);

  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [email, setEmail]     = useState('');
  const [name, setName]       = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]         = useState('SELLER');
  const [isPartTime, setIsPartTime] = useState(false);

  const [detail, setDetail]         = useState<SellerDetail | null>(null);
  const [detailUser, setDetailUser] = useState<User | null>(null);
  const [range, setRange]           = useState(defaultRange);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [editing, setEditing] = useState<{ date: string; field: EditField } | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving]   = useState(false);

  const [editUser, setEditUser]               = useState<User | null>(null);
  const [editName, setEditName]               = useState('');
  const [editEmail, setEditEmail]             = useState('');
  const [editRole, setEditRole]               = useState('');
  const [editIsPartTime, setEditIsPartTime]   = useState(false);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editLoading, setEditLoading]         = useState(false);
  const [editError, setEditError]             = useState('');

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
      user_id: detailUser.id, date,
      calls_actual: day?.calls ?? 0, contacts_actual: day?.contacts ?? 0,
      call_goal: day?.call_goal ?? 0, sales_goal: day?.sales_goal ?? 0,
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
      return { ...prev, days: prev.days.map(d => d.date === date ? { ...d, [field]: num } : d) };
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
          style={{ width: 54, background: 'var(--s2)', border: '1px solid var(--bl)', borderRadius: 4, color: 'var(--t1)', fontSize: 12, padding: '2px 6px', fontVariantNumeric: 'tabular-nums', outline: 'none' }}
        />
      );
    }
    return (
      <div
        onClick={() => startEdit(date, field, value)}
        title="Klik for at redigere"
        style={{ fontSize: 13, fontWeight: bold ? 700 : 400, color: value > 0 ? 'var(--t1)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums', cursor: 'text', padding: '2px 4px', borderRadius: 4, display: 'inline-block', minWidth: 20, textDecoration: 'underline dotted var(--bd2)' }}
      >
        {value > 0 ? value : '—'}
      </div>
    );
  }

  function openEditUser(u: User, e: React.MouseEvent) {
    e.stopPropagation();
    setEditUser(u); setEditName(u.name); setEditEmail(u.email); setEditRole(u.role);
    setEditIsPartTime(u.is_part_time); setEditNewPassword(''); setEditError('');
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Sælgere</h1>
          <p className="page-sub">{users.length} brugere</p>
        </div>
        <button onClick={() => { reset(); setOpen(true); }} className="btn btn-primary">+ Ny bruger</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>{['Navn', 'Email', 'Rolle', 'Oprettet', ''].map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr className="empty-row"><td colSpan={5}>Ingen brugere</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(u)}>
                <td className="td-primary">{u.name}</td>
                <td style={{ color: 'var(--t3)' }}>{u.email}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 700, background: ROLE_BG[u.role], color: ROLE_CLR[u.role] }}>{u.role}</span>
                    {u.is_part_time && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: 'var(--pu2)', color: 'var(--pu)', border: '1px solid var(--pu)' }}>DELTID</span>}
                  </div>
                </td>
                <td style={{ color: 'var(--t3)' }}>{new Date(u.created_at).toLocaleDateString('da-DK')}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={e => openEditUser(u, e)} className="btn btn-ghost btn-sm">Rediger</button>
                    <button onClick={e => deleteUser(u, e)} className="btn btn-sm btn-danger">Slet</button>
                    <span style={{ fontSize: 12, color: 'var(--t3)', padding: '4px 0' }}>Historik →</span>
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
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 660, background: 'var(--bg)', borderLeft: '1px solid var(--bd2)', zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{detailUser.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{detailUser.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {saving && <span style={{ fontSize: 11, color: 'var(--t3)' }}>Gemmer…</span>}
                <button onClick={() => setDetailUser(null)} className="btn btn-ghost btn-sm">✕ Luk</button>
              </div>
            </div>

            <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--bd)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>Periode:</span>
              <input type="date" value={range.from} onChange={e => { const r = { ...range, from: e.target.value }; setRange(r); loadDetail(r.from, r.to); }} style={{ width: 140 }} />
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>→</span>
              <input type="date" value={range.to} onChange={e => { const r = { ...range, to: e.target.value }; setRange(r); loadDetail(r.from, r.to); }} style={{ width: 140 }} />
              {loadingDetail && <span style={{ fontSize: 12, color: 'var(--t3)' }}>Indlæser…</span>}
            </div>

            <div style={{ padding: '20px 28px', flex: 1 }}>
              {detail && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 24 }}>
                  {[
                    { label: 'OPKALD',    value: detail.days.reduce((s, d) => s + d.calls, 0) },
                    { label: 'KONTAKTER', value: detail.days.reduce((s, d) => s + d.contacts, 0) },
                    { label: 'SALG',      value: detail.days.reduce((s, d) => s + d.sales, 0) },
                  ].map(k => (
                    <div key={k.label} style={{ background: 'var(--s1)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--bd)' }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>{k.label}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Daglig historik</div>
                <div style={{ fontSize: 11, color: 'var(--t4)' }}>Klik på et tal for at redigere</div>
              </div>
              {detail && (
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 70px 70px 50px 75px 70px 56px', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--bd)' }}>
                    {['Dato', 'Opkald', 'Kontakter', 'Salg', 'Mål opk.', 'Mål salg', 'KR%'].map(h => (
                      <div key={h} style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</div>
                    ))}
                  </div>
                  {detail.days.map((d, i) => {
                    const isEmpty  = d.calls === 0 && d.contacts === 0 && d.sales === 0 && d.call_goal === 0 && d.sales_goal === 0;
                    const isToday  = d.date === today;
                    const kr       = d.contacts > 0 ? (d.sales / d.contacts * 100).toFixed(1) + '%' : null;
                    const dateLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' });
                    return (
                      <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '120px 70px 70px 50px 75px 70px 56px', gap: 8, padding: '10px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--bd)' : undefined, background: isToday ? 'var(--bl3)' : 'transparent', opacity: isEmpty ? 0.4 : 1 }}>
                        <div style={{ fontSize: 12, color: isToday ? 'var(--bl)' : 'var(--t1)', fontWeight: isToday ? 700 : 500 }}>{dateLabel}</div>
                        <EditableNum date={d.date} field="calls" value={d.calls} bold />
                        <EditableNum date={d.date} field="contacts" value={d.contacts} bold />
                        <div style={{ fontSize: 13, fontWeight: 700, color: d.sales > 0 ? 'var(--gr)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums' }}>{d.sales || '—'}</div>
                        <EditableNum date={d.date} field="call_goal" value={d.call_goal} />
                        <EditableNum date={d.date} field="sales_goal" value={d.sales_goal} />
                        <div style={{ fontSize: 12, color: kr ? 'var(--bl)' : 'var(--t4)', fontVariantNumeric: 'tabular-nums' }}>{kr ?? '—'}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {detail && detail.sales.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>Salg i perioden ({detail.sales.length})</div>
                  <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 80px', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--bd)' }}>
                      {['Dato', 'Firma', 'Opgave', 'Status'].map(h => (
                        <div key={h} style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, letterSpacing: '0.04em' }}>{h}</div>
                      ))}
                    </div>
                    {detail.sales.map((s, i) => (
                      <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 80px', gap: 8, padding: '11px 16px', alignItems: 'center', borderTop: i > 0 ? '1px solid var(--bd)' : undefined }}>
                        <div style={{ fontSize: 12, color: 'var(--t3)' }}>{s.date}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{s.company_name || '—'}</div>
                          {s.cvr && <div style={{ fontSize: 11, color: 'var(--t4)' }}>{s.cvr}</div>}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--t3)' }}>{s.task_name}</div>
                          {s.deal_size && <div style={{ fontSize: 11, color: 'var(--bl)', fontVariantNumeric: 'tabular-nums' }}>{fmtKr(Number(s.deal_size))}</div>}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600, background: STATUS_BG[s.status], color: STATUS_CLR[s.status] }}>{STATUS_DK[s.status]}</span>
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
        <div className="modal-overlay" style={{ zIndex: 70 }}>
          <div className="modal-box">
            <div className="modal-title">Rediger {editUser.name}</div>
            <form onSubmit={submitEditUser} className="modal-form">
              <div className="form-group">
                <label>Navn</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="SELLER">SELLER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div className="form-group">
                <label>Nyt kodeord <span style={{ color: 'var(--t4)', fontWeight: 400 }}>(lad stå tom for at beholde nuværende)</span></label>
                <input type="password" value={editNewPassword} onChange={e => setEditNewPassword(e.target.value)} placeholder="Mindst 8 tegn" minLength={8} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: editIsPartTime ? 'var(--pu2)' : 'var(--s2)', borderRadius: 7, border: `1px solid ${editIsPartTime ? 'var(--pu)' : 'var(--bd)'}` }}>
                <input type="checkbox" checked={editIsPartTime} onChange={e => setEditIsPartTime(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--pu)' }} />
                <div>
                  <div style={{ fontSize: 13, color: editIsPartTime ? 'var(--pu)' : 'var(--t1)', fontWeight: editIsPartTime ? 600 : 400 }}>Deltidsansat</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>Tæller ikke med i Omsætning pr. FTE</div>
                </div>
              </label>
              {editError && <div className="alert-error">{editError}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setEditUser(null)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={editLoading} className="btn btn-primary" style={{ flex: 2 }}>
                  {editLoading ? 'Gemmer…' : 'Gem ændringer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {open && (
        <div className="modal-overlay" style={{ zIndex: 60 }}>
          <div className="modal-box">
            <div className="modal-title">Opret ny bruger</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Navn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Fulde navn" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="email@busygroup.dk" />
              </div>
              <div className="form-group">
                <label>Kodeord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mindst 8 tegn" minLength={8} />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select value={role} onChange={e => setRole(e.target.value)}>
                  <option value="SELLER">SELLER</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 12px', background: isPartTime ? 'var(--pu2)' : 'var(--s2)', borderRadius: 7, border: `1px solid ${isPartTime ? 'var(--pu)' : 'var(--bd)'}` }}>
                <input type="checkbox" checked={isPartTime} onChange={e => setIsPartTime(e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--pu)' }} />
                <div>
                  <div style={{ fontSize: 13, color: isPartTime ? 'var(--pu)' : 'var(--t1)', fontWeight: isPartTime ? 600 : 400 }}>Deltidsansat</div>
                  <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>Tæller ikke med i Omsætning pr. FTE</div>
                </div>
              </label>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
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
