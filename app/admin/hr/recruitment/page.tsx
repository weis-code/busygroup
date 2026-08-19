'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { STAGES } from '@/lib/recruitment';
import KanbanBoard from './_components/KanbanBoard';
import TableView from './_components/TableView';
import CandidatePanel from './_components/CandidatePanel';
import CreateCandidateModal from './_components/CreateCandidateModal';
import EditCandidateModal from './_components/EditCandidateModal';
import AnalyticsModal from './_components/AnalyticsModal';
import type { Candidate, CandidateDetail, Company, UserOption } from './_components/types';

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9000 }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--t1)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>{msg}</div>
    </div>
  );
}

export default function HRRecruitmentPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [companies, setCompanies]   = useState<Company[]>([]);
  const [users, setUsers]           = useState<UserOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState<'kanban' | 'table'>('kanban');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStage, setFilterStage]     = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [search, setSearch]         = useState('');
  const [toast, setToast]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected]     = useState<CandidateDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cands, comp, usrs] = await Promise.all([
        fetch('/api/hr/candidates').then(r => r.json()),
        fetch('/api/companies').then(r => r.json()),
        fetch('/api/users').then(r => r.json()),
      ]);
      setCandidates(Array.isArray(cands) ? cands as Candidate[] : []);
      setCompanies(Array.isArray(comp) ? comp as Company[] : []);
      setUsers(Array.isArray(usrs) ? (usrs as UserOption[]).filter(u => u.role === 'ADMIN') : []);
    } catch {
      setCandidates([]); setCompanies([]); setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCandidate = useCallback(async (id: number) => {
    setSelectedId(id);
    const data = await fetch(`/api/hr/candidates/${id}`).then(r => r.json()) as CandidateDetail;
    setSelected(data);
  }, []);

  async function refreshSelected() {
    await load();
    if (selectedId !== null) {
      const fresh = await fetch(`/api/hr/candidates/${selectedId}`).then(r => r.json()) as CandidateDetail;
      setSelected(fresh);
    }
  }

  function changeStage(id: number, stage: string, rejectionReason?: string | null) {
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, stage, updated_at: new Date().toISOString() } : c));
    fetch(`/api/hr/candidates/${id}/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, rejection_reason: rejectionReason }),
    }).catch(() => void load());
  }

  const filtered = candidates.filter(c => {
    if (filterCompany && companies.find(co => co.id === c.company_id)?.slug !== filterCompany) return false;
    if (filterStage && c.stage !== filterStage) return false;
    if (filterAssigned && c.assigned_to !== filterAssigned) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!c.full_name.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q) && !c.applying_for.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeCount = filtered.filter(c => !['ansat', 'intet_svar', 'stoppet'].includes(c.stage)).length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--bd)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>Rekruttering</h1>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{activeCount} aktive kandidater</div>
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 7, overflow: 'hidden' }}>
            <button onClick={() => setView('kanban')} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'kanban' ? 'var(--bl)' : 'transparent', color: view === 'kanban' ? '#fff' : 'var(--t2)' }}>Kanban</button>
            <button onClick={() => setView('table')} style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === 'table' ? 'var(--bl)' : 'transparent', color: view === 'table' ? '#fff' : 'var(--t2)' }}>Tabel</button>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg…" style={{ padding: '7px 12px', fontSize: 12, width: 140 }} />
            <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }}>
              <option value="">Alle firmaer</option>
              {companies.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }}>
              <option value="">Alle stadier</option>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select value={filterAssigned} onChange={e => setFilterAssigned(e.target.value)} style={{ padding: '7px 12px', fontSize: 12, width: 'auto' }}>
              <option value="">Alle tildelte</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <Link href="/admin/hr/recruitment/templates" style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--t2)', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, textDecoration: 'none' }}>
              Skabeloner
            </Link>
            <button onClick={() => setShowAnalytics(true)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, color: 'var(--t2)', background: 'transparent', border: '1px solid var(--bd)', borderRadius: 7, cursor: 'pointer' }}>
              📊 Dashboard
            </button>
            <button onClick={() => setShowCreate(true)} style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              + Ny kandidat
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
        ) : view === 'kanban' ? (
          <KanbanBoard candidates={filtered} onOpen={id => void openCandidate(id)} onStageChange={changeStage} />
        ) : (
          <TableView candidates={filtered} onOpen={id => void openCandidate(id)} />
        )}
      </div>

      {selected && (
        <CandidatePanel
          candidate={selected}
          companies={companies}
          users={users}
          onClose={() => { setSelected(null); setSelectedId(null); }}
          onUpdated={refreshSelected}
          onDeleted={() => { setSelected(null); setSelectedId(null); void load(); }}
          onEdit={() => setShowEdit(true)}
          onToast={setToast}
        />
      )}

      {showEdit && selected && (
        <EditCandidateModal
          candidate={selected}
          companies={companies}
          users={users}
          onClose={() => setShowEdit(false)}
          onSaved={refreshSelected}
        />
      )}

      {showCreate && (
        <CreateCandidateModal
          companies={companies}
          users={users}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}

      {showAnalytics && (
        <AnalyticsModal
          onClose={() => setShowAnalytics(false)}
          onOpenCandidate={id => { setShowAnalytics(false); void openCandidate(id); }}
        />
      )}

      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
    </div>
  );
}
