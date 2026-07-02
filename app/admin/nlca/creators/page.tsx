'use client';

import { useEffect, useState, useCallback } from 'react';

const CYAN = '#06b6d4';
const RED = 'var(--re)';

const USD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);

const thisMonth = () => new Date().toISOString().slice(0, 7);

interface Creator {
  id: number;
  name: string;
  manager_id: number | null;
  manager_name: string | null;
  tiktok_handle: string | null;
  is_active: boolean;
  country: string | null;
  created_at: string;
}

interface Manager { id: number; name: string }

interface FigureRow {
  month: string;
  rank_up_usd: number;
  activeness_usd: number;
  incremental_revenue_usd?: number;
}

type UserRole = 'ADMIN' | 'MANAGER' | 'SELLER' | 'NLCA_MANAGER';

export default function NlcaCreatorsPage() {
  const [role, setRole] = useState<UserRole>('ADMIN');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selected, setSelected] = useState<Creator | null>(null);
  const [figures, setFigures] = useState<FigureRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', tiktok_handle: '', manager_id: '', notes: '', country: '' });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [figureForm, setFigureForm] = useState({
    month: thisMonth(),
    rank_up_usd: '',
    activeness_usd: '',
    incremental_revenue_usd: '',
  });
  const [figureSaving, setFigureSaving] = useState(false);
  const [figureMsg, setFigureMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [editManager, setEditManager] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((d: { role: UserRole }) => setRole(d.role)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      fetch('/api/nlca/creators').then(r => r.json()).catch(() => []) as Promise<Creator[]>,
      fetch('/api/nlca/managers').then(r => r.json()).catch(() => []) as Promise<Manager[]>,
    ]);
    setCreators(Array.isArray(c) ? c : []);
    setManagers(Array.isArray(m) ? m : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function loadCreator(id: number) {
    const data = await fetch(`/api/nlca/creators/${id}`).then(r => r.json()) as Creator & { figures: FigureRow[] };
    setSelected(data);
    setFigures(data.figures ?? []);
    setFigureMsg(null);
    setEditMsg(null);
    setConfirmDelete(false);
    setEditManager(String(data.manager_id ?? ''));
    setEditCountry(data.country ?? '');
  }

  async function createCreator() {
    if (!form.name) return;
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/nlca/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          tiktok_handle: form.tiktok_handle || null,
          manager_id: form.manager_id ? parseInt(form.manager_id, 10) : null,
          notes: form.notes || null,
          country: form.country || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setCreateError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      setShowCreate(false);
      setForm({ name: '', tiktok_handle: '', manager_id: '', notes: '', country: '' });
      await load();
    } catch {
      setCreateError('Netværksfejl — prøv igen');
    } finally {
      setSaving(false);
    }
  }

  async function saveFigures() {
    if (!selected) return;
    setFigureSaving(true);
    setFigureMsg(null);
    try {
      const body: Record<string, unknown> = {
        creator_id: selected.id,
        month: figureForm.month,
      };
      if (figureForm.rank_up_usd !== '') body.rank_up_usd = parseFloat(figureForm.rank_up_usd);
      if (figureForm.activeness_usd !== '') body.activeness_usd = parseFloat(figureForm.activeness_usd);
      if (isAdmin && figureForm.incremental_revenue_usd !== '') {
        body.incremental_revenue_usd = parseFloat(figureForm.incremental_revenue_usd);
      }
      const res = await fetch('/api/nlca/figures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setFigureMsg({ ok: false, text: err.error ?? `Fejl ${res.status}` });
        return;
      }
      setFigureMsg({ ok: true, text: 'Tal gemt' });
      await loadCreator(selected.id);
    } catch {
      setFigureMsg({ ok: false, text: 'Netværksfejl — prøv igen' });
    } finally {
      setFigureSaving(false);
    }
  }

  async function saveCreatorEdit() {
    if (!selected || !isAdmin) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      const body: Record<string, unknown> = {};
      const newManagerId = editManager ? parseInt(editManager, 10) : null;
      if (newManagerId !== selected.manager_id) body.manager_id = newManagerId;
      const newCountry = editCountry.trim() || null;
      if (newCountry !== selected.country) body.country = newCountry;

      if (Object.keys(body).length === 0) {
        setEditMsg({ ok: true, text: 'Ingen ændringer' });
        return;
      }

      const res = await fetch(`/api/nlca/creators/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setEditMsg({ ok: false, text: err.error ?? `Fejl ${res.status}` });
        return;
      }
      setEditMsg({ ok: true, text: 'Gemt' });
      await loadCreator(selected.id);
      await load();
    } catch {
      setEditMsg({ ok: false, text: 'Netværksfejl — prøv igen' });
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteCreator() {
    if (!selected || !isAdmin) return;
    try {
      const res = await fetch(`/api/nlca/creators/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setSelected(null);
      setConfirmDelete(false);
      await load();
    } catch { /* ignore */ }
  }

  const isAdmin = role === 'ADMIN';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000 }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Creators</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>NLCA · {creators.length} creators</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ background: CYAN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          + Opret creator
        </button>
      </div>

      {selected ? (
        <div>
          <button onClick={() => { setSelected(null); setConfirmDelete(false); }} style={{ background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
            ← Tilbage
          </button>

          {/* Creator header */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{selected.name}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {selected.tiktok_handle && <span>TikTok: @{selected.tiktok_handle}</span>}
              {selected.manager_name && <span>Manager: {selected.manager_name}</span>}
              {selected.country && <span>Land: {selected.country}</span>}
              <span style={{ color: selected.is_active ? 'var(--gr)' : RED }}>{selected.is_active ? 'Aktiv' : 'Inaktiv'}</span>
            </div>
          </div>

          {/* Edit section (admin only) */}
          {isAdmin && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Rediger</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Manager</label>
                  <select value={editManager} onChange={e => setEditManager(e.target.value)} style={{ width: '100%' }}>
                    <option value="">Ingen manager</option>
                    {managers.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Land</label>
                  <input
                    value={editCountry}
                    onChange={e => setEditCountry(e.target.value)}
                    placeholder="f.eks. Denmark"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => void saveCreatorEdit()}
                    disabled={editSaving}
                    style={{ background: CYAN, color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.6 : 1 }}
                  >
                    {editSaving ? 'Gemmer…' : 'Gem ændringer'}
                  </button>
                  {editMsg && (
                    <span style={{ fontSize: 12, color: editMsg.ok ? 'var(--gr)' : RED, fontWeight: 600 }}>{editMsg.text}</span>
                  )}
                </div>
                <div>
                  {confirmDelete ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--t2)' }}>Er du sikker?</span>
                      <button onClick={() => void deleteCreator()} style={{ background: RED, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Slet</button>
                      <button onClick={() => setConfirmDelete(false)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>Annuller</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(true)} style={{ background: 'none', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Slet creator
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Figures entry form */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Registrer månedlige tal</div>
            <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Måned</label>
                <input
                  type="month"
                  value={figureForm.month}
                  onChange={e => setFigureForm(f => ({ ...f, month: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Rank-up USD</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={figureForm.rank_up_usd}
                  onChange={e => setFigureForm(f => ({ ...f, rank_up_usd: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Activeness USD</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={figureForm.activeness_usd}
                  onChange={e => setFigureForm(f => ({ ...f, activeness_usd: e.target.value }))}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>
              {isAdmin && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Incremental Revenue Incentive 🔒</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={figureForm.incremental_revenue_usd}
                    onChange={e => setFigureForm(f => ({ ...f, incremental_revenue_usd: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => void saveFigures()}
                disabled={figureSaving || !figureForm.month}
                style={{
                  background: CYAN,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: (figureSaving || !figureForm.month) ? 'not-allowed' : 'pointer',
                  opacity: (figureSaving || !figureForm.month) ? 0.45 : 1,
                }}
              >
                {figureSaving ? 'Gemmer…' : 'Gem tal'}
              </button>
              {figureMsg && (
                <span style={{ fontSize: 12, color: figureMsg.ok ? 'var(--gr)' : RED, fontWeight: 600 }}>
                  {figureMsg.text}
                </span>
              )}
            </div>
          </div>

          {/* Figures history table */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bd)', background: 'var(--s2)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
              Månedlige tal
            </div>
            {figures.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen tal endnu</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--s2)' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Måned</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Rank-up</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Activeness</th>
                    {isAdmin && <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Inc. Revenue 🔒</th>}
                    <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase' }}>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {figures.map((f, i) => {
                    const payout = Number(f.rank_up_usd ?? 0) + Number(f.activeness_usd ?? 0);
                    const d = new Date(f.month);
                    const label = d.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
                    return (
                      <tr key={f.month} style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--t1)', textTransform: 'capitalize' }}>{label}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(f.rank_up_usd ?? 0))}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(f.activeness_usd ?? 0))}</td>
                        {isAdmin && <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--t1)' }}>{USD(Number(f.incremental_revenue_usd ?? 0))}</td>}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: CYAN }}>{USD(payout)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
          {creators.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Ingen creators endnu. <button onClick={() => setShowCreate(true)} style={{ color: CYAN, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Opret den første →</button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--s2)' }}>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Navn</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manager</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Land</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>TikTok</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                  <th style={{ padding: '9px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--t2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Oprettet</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c, i) => (
                  <tr
                    key={c.id}
                    onClick={() => void loadCreator(c.id)}
                    style={{ borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '11px 14px', color: 'var(--t1)', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)' }}>{c.manager_name ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)' }}>{c.country ?? '—'}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)' }}>{c.tiktok_handle ? `@${c.tiktok_handle}` : '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: c.is_active ? 'rgba(45,212,160,0.15)' : 'var(--re2)', color: c.is_active ? 'var(--gr)' : 'var(--re)' }}>
                        {c.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--t3)', fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create creator modal */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setCreateError(null); } }}
        >
          <div style={{ background: 'var(--s1)', borderRadius: 13, padding: 28, width: 420, maxWidth: '94vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Opret creator</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Navn *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Creator navn" autoFocus style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TikTok handle</label>
                <input value={form.tiktok_handle} onChange={e => setForm(f => ({ ...f, tiktok_handle: e.target.value }))} placeholder="@handle (uden @)" style={{ width: '100%', marginTop: 4 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tildel manager</label>
                  <select value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                    <option value="">Ingen manager</option>
                    {managers.map(m => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Land</label>
                  <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="f.eks. Denmark" style={{ width: '100%', marginTop: 4 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Noter</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
              </div>
            </div>
            {createError && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--re2)', borderRadius: 7, fontSize: 12, color: 'var(--re)' }}>
                {createError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateError(null); }} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '8px 14px', fontSize: 12 }}>Annuller</button>
              <button onClick={() => void createCreator()} disabled={!form.name || saving} style={{ background: CYAN, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: (!form.name || saving) ? 0.45 : 1, cursor: (!form.name || saving) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Opretter…' : 'Opret'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
