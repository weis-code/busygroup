'use client';

import { useCallback, useEffect, useState } from 'react';

interface Absence {
  id: string; user_id: string; user_name: string;
  type: string; start_date: string; end_date: string;
  note: string | null; status: string;
  company_name: string | null; company_slug: string | null; company_color: string | null;
}
interface Company { id: number; name: string; slug: string; color: string }

const TYPE_DK: Record<string, string>    = { VACATION: 'Ferie', SICK: 'Sygdom', OTHER: 'Andet' };
const TYPE_CLR: Record<string, string>   = { VACATION: 'var(--bl)', SICK: 'var(--re)', OTHER: 'var(--ye)' };
const TYPE_BG: Record<string, string>    = { VACATION: 'var(--bl2)', SICK: 'var(--re2)', OTHER: 'var(--ye2)' };
const STATUS_DK: Record<string, string>  = { PENDING: 'Afventer', APPROVED: 'Godkendt', REJECTED: 'Afvist' };
const STATUS_CLR: Record<string, string> = { PENDING: 'var(--ye)', APPROVED: 'var(--gr)', REJECTED: 'var(--re)' };
const STATUS_BG: Record<string, string>  = { PENDING: 'var(--ye2)', APPROVED: 'var(--gr2)', REJECTED: 'var(--re2)' };

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetween(start: string, end: string) {
  const ms = new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime();
  return Math.round(ms / 86400000) + 1;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function HRAbsencePage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [absences, setAbsences]   = useState<Absence[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [month, setMonth]         = useState(currentMonth);
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (month)         params.set('month', month);
    if (filterCompany) params.set('company', filterCompany);
    if (filterStatus)  params.set('status', filterStatus);

    const [ab, comp] = await Promise.all([
      fetch(`/api/hr/absence?${params}`).then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
    ]);
    setAbsences(Array.isArray(ab) ? ab as Absence[] : []);
    setCompanies(Array.isArray(comp) ? comp as Company[] : []);
    setLoading(false);
  }, [month, filterCompany, filterStatus]);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/hr/absence/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  const pendingCount = absences.filter(a => a.status === 'PENDING').length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Fravær — alle firmaer</h1>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>Konsolideret fraværsoversigt på tværs af alle virksomheder</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }} />

        <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)}
          style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }}>
          <option value="">Alle firmaer</option>
          {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>

        {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(s => {
          const active = filterStatus === s;
          return (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
              border: `1.5px solid ${active ? 'var(--bl)' : 'var(--bd)'}`,
              background: active ? 'var(--bl2)' : 'transparent',
              color: active ? 'var(--bl)' : 'var(--t2)', cursor: 'pointer',
            }}>
              {s === '' ? 'Alle' : STATUS_DK[s]}
            </button>
          );
        })}

        {pendingCount > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ye)', background: 'var(--ye2)', padding: '4px 10px', borderRadius: 6, marginLeft: 8 }}>
            ⚠ {pendingCount} afventer godkendelse
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
      ) : absences.length === 0 ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Ingen fraværsregistreringer</div>
      ) : (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', background: 'var(--s2)' }}>
                {['Medarbejder', 'Firma', 'Type', 'Fra → Til', 'Dage', 'Indsendt', 'Status', 'Handlinger'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {absences.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                        background: `${a.company_color ?? '#4f8ef7'}22`,
                        border: `1px solid ${a.company_color ?? '#4f8ef7'}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 800, color: a.company_color ?? '#4f8ef7',
                      }}>
                        {initials(a.user_name)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{a.user_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.company_name ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: `${a.company_color ?? '#4f8ef7'}22`, color: a.company_color ?? '#4f8ef7' }}>{a.company_name}</span>
                    ) : <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_CLR[a.type], background: TYPE_BG[a.type], padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em' }}>
                      {TYPE_DK[a.type] ?? a.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--t2)' }}>
                    {fmtDate(a.start_date)} → {fmtDate(a.end_date)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--t2)' }}>
                    {daysBetween(a.start_date, a.end_date)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--t3)' }}>
                    {new Date(a.start_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_CLR[a.status], background: STATUS_BG[a.status], padding: '2px 8px', borderRadius: 4 }}>
                      {STATUS_DK[a.status] ?? a.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {a.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => void updateStatus(a.id, 'APPROVED')} style={{ background: 'var(--gr2)', color: 'var(--gr)', border: '1px solid var(--gr)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✓ Godkend</button>
                        <button onClick={() => void updateStatus(a.id, 'REJECTED')} style={{ background: 'var(--re2)', color: 'var(--re)', border: '1px solid var(--re)', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>✗ Afvis</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
