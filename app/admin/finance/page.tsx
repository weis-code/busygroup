'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';

interface Company {
  id: number; name: string; slug: string; color: string; logo_initials: string; ownership_pct: number;
}
interface CompanyRow {
  id: number; name: string; slug: string; color: string; logo_initials: string;
  ownership_pct: number; mrr: number; active_customers: number; onboarding_customers: number;
}
interface FinanceData {
  totalMrr: number; totalCustomers: number; totalOnboarding: number; companies: CompanyRow[];
}
interface FixedCost {
  id: number; company_id: number; fixed_costs_monthly: string; company_name: string; company_color: string;
}
interface OnetimeProject {
  id: number; company_id: number; name: string; amount: string; invoiced_date: string | null;
  notes: string | null; company_name: string; company_color: string;
}
interface Dividend {
  id: number; source_company_id: number; amount: string; received_date: string | null;
  notes: string | null; company_name: string; company_color: string; ownership_pct: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' kr.';
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Tab = 'oversigt' | 'omkostninger' | 'engangsprojekter' | 'udbytte';
const TABS: { id: Tab; label: string }[] = [
  { id: 'oversigt', label: 'Oversigt' },
  { id: 'omkostninger', label: 'Faste omkostninger' },
  { id: 'engangsprojekter', label: 'Engangsprojekter' },
  { id: 'udbytte', label: 'Udbytte' },
];

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('oversigt');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [finance, setFinance] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [comps, fin] = await Promise.all([
        fetch('/api/companies').then(r => r.json()) as Promise<Company[]>,
        fetch('/api/group/finance').then(async r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<FinanceData>;
        }),
      ]);
      setCompanies(Array.isArray(comps) ? comps : []);
      setFinance(fin);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const ownedCompanies = companies.filter(c => c.ownership_pct === 100 && c.slug !== 'group' && c.slug !== 'quorex');
  const stakeCompanies = companies.filter(c => c.ownership_pct > 0 && c.ownership_pct < 100);
  const ownedRows = finance?.companies.filter(c => c.ownership_pct === 100) ?? [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1080 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Økonomi</h1>
        <p className="page-sub">Konsolideret økonomi for de 100%-ejede selskaber, plus engangsprojekter og udbytte fra andre selskaber.</p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--bd)', marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--bl)' : 'var(--t2)',
            borderBottom: `2px solid ${tab === t.id ? 'var(--bl)' : 'transparent'}`,
            marginBottom: -1, transition: 'all 0.12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
      ) : error ? (
        <div style={{ color: 'var(--re)', fontSize: 13 }}>Kunne ikke indlæse finansdata: {error}</div>
      ) : (
        <>
          {tab === 'oversigt' && <OversigtTab finance={finance} ownedRows={ownedRows} />}
          {tab === 'omkostninger' && <OmkostningerTab companies={ownedCompanies} />}
          {tab === 'engangsprojekter' && <EngangsprojekterTab companies={ownedCompanies} />}
          {tab === 'udbytte' && <UdbytteTab companies={stakeCompanies} />}
        </>
      )}
    </div>
  );
}

/* ── Oversigt ─────────────────────────────────────────── */
function OversigtTab({ finance, ownedRows }: { finance: FinanceData | null; ownedRows: CompanyRow[] }) {
  const totalMrr = ownedRows.reduce((s, c) => s + Number(c.mrr), 0);
  const totalCustomers = ownedRows.reduce((s, c) => s + Number(c.active_customers), 0);
  const maxMrr = Math.max(...ownedRows.map(c => c.mrr), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Samlet MRR', value: fmt(totalMrr), accent: 'var(--gr)' },
          { label: 'Aktive kunder', value: String(totalCustomers), accent: 'var(--bl)' },
          { label: 'Selskaber (100% ejet)', value: `${ownedRows.filter(c => c.mrr > 0).length} / ${ownedRows.length}`, accent: 'var(--pu)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, opacity: 0.7 }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.accent, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
          Selskabsoversigt
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 100px 110px', gap: 0, padding: '8px 18px', background: 'var(--s2)', borderBottom: '1px solid var(--bd)' }}>
          {['', 'Selskab', 'MRR', 'Kunder', 'Bar'].map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>
        {ownedRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen 100%-ejede selskaber med data</div>
        ) : ownedRows.map((c, i) => (
          <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 130px 100px 110px', gap: 0, padding: '12px 18px', borderBottom: i < ownedRows.length - 1 ? '1px solid var(--bd)' : 'none', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.name}</div>
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: c.mrr > 0 ? 'var(--gr)' : 'var(--t3)' }}>{c.mrr > 0 ? fmt(c.mrr) : '—'}</div>
            <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--t1)' }}>{c.active_customers > 0 ? c.active_customers : '—'}</div>
            <div style={{ paddingLeft: 12 }}>
              <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${maxMrr > 0 ? (c.mrr / maxMrr * 100) : 0}%`, background: c.color, borderRadius: 3 }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {finance && finance.companies.some(c => c.ownership_pct !== 100) && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>
          Selskaber med delvist ejerskab vises ikke her — se fanen Udbytte for indtægter derfra.
        </div>
      )}
    </div>
  );
}

/* ── Faste omkostninger ───────────────────────────────── */
function OmkostningerTab({ companies }: { companies: Company[] }) {
  const [rows, setRows] = useState<FixedCost[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await fetch('/api/finance/settings').then(r => r.json()) as FixedCost[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function valueFor(companyId: number): string {
    if (drafts[companyId] !== undefined) return drafts[companyId];
    const row = rows.find(r => r.company_id === companyId);
    return row ? row.fixed_costs_monthly : '0';
  }

  async function save(companyId: number) {
    const amount = Number(drafts[companyId] ?? valueFor(companyId));
    setSaving(companyId);
    try {
      await fetch('/api/finance/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, fixed_costs_monthly: amount }),
      });
      await load();
      setDrafts(d => { const next = { ...d }; delete next[companyId]; return next; });
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div style={{ color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', maxWidth: 620 }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bd)', fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
        Faste månedlige omkostninger pr. selskab
      </div>
      {companies.map((c, i) => {
        const dirty = drafts[c.id] !== undefined && drafts[c.id] !== (rows.find(r => r.company_id === c.id)?.fixed_costs_monthly ?? '0');
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: i < companies.length - 1 ? '1px solid var(--bd)' : 'none' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{c.name}</div>
            <input type="number" min="0" value={valueFor(c.id)}
              onChange={e => setDrafts(d => ({ ...d, [c.id]: e.target.value }))}
              style={{ width: 140, textAlign: 'right', fontSize: 13 }} />
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>kr/md</span>
            <button onClick={() => void save(c.id)} disabled={!dirty || saving === c.id}
              className="btn btn-sm btn-primary" style={{ opacity: dirty ? 1 : 0.4 }}>
              {saving === c.id ? 'Gemmer…' : 'Gem'}
            </button>
          </div>
        );
      })}
      {companies.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Ingen 100%-ejede selskaber</div>
      )}
    </div>
  );
}

/* ── Engangsprojekter ─────────────────────────────────── */
function EngangsprojekterTab({ companies }: { companies: Company[] }) {
  const [rows, setRows] = useState<OnetimeProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company_id: '', name: '', amount: '', invoiced_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await fetch('/api/finance/onetime').then(r => r.json()) as OnetimeProject[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.company_id || !form.name.trim() || !form.amount) { setError('Selskab, navn og beløb kræves'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/onetime', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(form.company_id), name: form.name.trim(), amount: Number(form.amount), invoiced_date: form.invoiced_date || null, notes: form.notes || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'Fejl'); return; }
      setForm({ company_id: '', name: '', amount: '', invoiced_date: '', notes: '' });
      setOpen(false);
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Slet projekt?')) return;
    await fetch(`/api/finance/onetime/${id}`, { method: 'DELETE' });
    await load();
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="page-header">
        <p className="page-sub">{rows.length} engangsprojekter · {fmt(total)} i alt</p>
        <button onClick={() => { setError(''); setOpen(true); }} className="btn btn-primary">+ Nyt projekt</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr>{['Selskab', 'Projekt', 'Beløb', 'Faktureret', 'Noter', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={6}>Indlæser…</td></tr>
            ) : rows.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>Ingen engangsprojekter endnu</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.company_color, flexShrink: 0 }} />
                    {r.company_name}
                  </div>
                </td>
                <td className="td-primary">{r.name}</td>
                <td style={{ fontWeight: 700, color: 'var(--gr)' }}>{fmt(Number(r.amount))}</td>
                <td>{fmtDate(r.invoiced_date)}</td>
                <td style={{ color: 'var(--t3)', maxWidth: 200 }}>{r.notes ?? '—'}</td>
                <td><button onClick={() => void remove(r.id)} className="btn btn-sm btn-danger">Slet</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Nyt engangsprojekt</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Selskab</label>
                <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))} required>
                  <option value="">Vælg selskab…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Projektnavn</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="F.eks. Engangsopgave for kunde X" />
              </div>
              <div className="form-group">
                <label>Beløb (kr)</label>
                <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Faktureringsdato</label>
                <input type="date" value={form.invoiced_date} onChange={e => setForm(f => ({ ...f, invoiced_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Noter (valgfri)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Gemmer…' : 'Opret'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Udbytte ──────────────────────────────────────────── */
function UdbytteTab({ companies }: { companies: Company[] }) {
  const [rows, setRows] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ source_company_id: '', amount: '', received_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await fetch('/api/finance/dividends').then(r => r.json()) as Dividend[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.source_company_id || !form.amount) { setError('Selskab og beløb kræves'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/dividends', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_company_id: Number(form.source_company_id), amount: Number(form.amount), received_date: form.received_date || null, notes: form.notes || null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'Fejl'); return; }
      setForm({ source_company_id: '', amount: '', received_date: '', notes: '' });
      setOpen(false);
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm('Slet udbytte?')) return;
    await fetch(`/api/finance/dividends/${id}`, { method: 'DELETE' });
    await load();
  }

  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div>
      <div className="page-header">
        <p className="page-sub">{rows.length} udbytter · {fmt(total)} i alt</p>
        <button onClick={() => { setError(''); setOpen(true); }} className="btn btn-primary" disabled={companies.length === 0}>+ Nyt udbytte</button>
      </div>

      {companies.length === 0 && (
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--t3)' }}>
          Ingen selskaber med delvist ejerskab registreret endnu.
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr>{['Selskab', 'Ejerandel', 'Beløb', 'Modtaget', 'Noter', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {loading ? (
              <tr className="empty-row"><td colSpan={6}>Indlæser…</td></tr>
            ) : rows.length === 0 ? (
              <tr className="empty-row"><td colSpan={6}>Ingen udbytter registreret endnu</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.company_color, flexShrink: 0 }} />
                    {r.company_name}
                  </div>
                </td>
                <td>{r.ownership_pct}%</td>
                <td style={{ fontWeight: 700, color: 'var(--gr)' }}>{fmt(Number(r.amount))}</td>
                <td>{fmtDate(r.received_date)}</td>
                <td style={{ color: 'var(--t3)', maxWidth: 200 }}>{r.notes ?? '—'}</td>
                <td><button onClick={() => void remove(r.id)} className="btn btn-sm btn-danger">Slet</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">Nyt udbytte</div>
            <form onSubmit={onSubmit} className="modal-form">
              <div className="form-group">
                <label>Selskab (kilde)</label>
                <select value={form.source_company_id} onChange={e => setForm(f => ({ ...f, source_company_id: e.target.value }))} required>
                  <option value="">Vælg selskab…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.ownership_pct}%)</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Beløb (kr)</label>
                <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Modtaget dato</label>
                <input type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Noter (valgfri)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              {error && <div className="alert-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
                <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>{saving ? 'Gemmer…' : 'Opret'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
