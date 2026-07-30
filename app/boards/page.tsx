'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Board {
  id: number; title: string; description: string | null; owner_id: string; owner_name: string;
  visibility: 'private' | 'company' | 'workspace'; company_id: number | null;
  color: string; is_archived: boolean; member_count: number; card_count: number;
  updated_at: string; is_owner: boolean; is_explicit_member: boolean; role: string;
}
interface Company { id: number; name: string }

const COLOR_PRESETS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35', '#f43f5e', '#06b6d4', '#8b5cf6'];

const VISIBILITY_META: Record<string, { label: string; icon: string }> = {
  private: { label: 'Privat', icon: '🔒' },
  company: { label: 'Firma', icon: '🏢' },
  workspace: { label: 'Delt', icon: '🌐' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'lige nu';
  if (m < 60) return `${m} min. siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} timer siden`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} dage siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

function BoardCard({ board, onOpen, onArchive, onDelete }: {
  board: Board; onOpen: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const vis = VISIBILITY_META[board.visibility] ?? VISIBILITY_META.private;

  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 11, overflow: 'hidden',
        cursor: 'pointer', transition: 'transform 0.12s, border-color 0.12s', position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; }}
    >
      <div style={{ height: 40, background: board.color }} />
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.3 }}>{board.title}</div>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14, padding: '2px 4px', flexShrink: 0 }}>
            ⋯
          </button>
        </div>
        {!board.is_owner && board.owner_name && (
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Ejer: {board.owner_name}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11, color: 'var(--t3)' }}>
          <span>{vis.icon} {vis.label}</span>
          <span>·</span>
          <span>{board.card_count} kort</span>
          <span>·</span>
          <span>{board.member_count} medlem{board.member_count === 1 ? '' : 'mer'}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>Opdateret {timeAgo(board.updated_at)}</div>
      </div>
      {menuOpen && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'absolute', top: 44, right: 10, background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 10, overflow: 'hidden', minWidth: 140 }}>
          {board.is_owner && (
            <button onClick={() => { setMenuOpen(false); onArchive(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
              {board.is_archived ? 'Gendan' : 'Arkivér'}
            </button>
          )}
          {board.is_owner && (
            <button onClick={() => { setMenuOpen(false); onDelete(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--re)', fontSize: 12, cursor: 'pointer' }}>
              Slet permanent
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function BoardGrid({ boards, onOpen, onArchive, onDelete }: {
  boards: Board[]; onOpen: (id: number) => void; onArchive: (b: Board) => void; onDelete: (b: Board) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {boards.map(b => (
        <BoardCard key={b.id} board={b} onOpen={() => onOpen(b.id)} onArchive={() => onArchive(b)} onDelete={() => onDelete(b)} />
      ))}
    </div>
  );
}

export default function BoardsOverviewPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[]>([]);
  const [archivedBoards, setArchivedBoards] = useState<Board[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ boards: { id: number; title: string }[]; cards: { id: number; title: string; board_id: number; board_title: string }[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch('/api/boards').then(r => r.json()) as Board[];
    setBoards(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/companies').then(r => r.json()).then(d => setCompanies(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      const data = await fetch(`/api/boards/search?q=${encodeURIComponent(search.trim())}`).then(r => r.json());
      setSearchResults(data);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  async function loadArchived() {
    if (archivedBoards.length > 0) { setShowArchived(v => !v); return; }
    const data = await fetch('/api/boards?archived=true').then(r => r.json()) as Board[];
    setArchivedBoards(Array.isArray(data) ? data : []);
    setShowArchived(true);
  }

  async function archiveBoard(b: Board) {
    const url = `/api/boards/${b.id}/archive`;
    await fetch(url, { method: b.is_archived ? 'DELETE' : 'POST' });
    await load();
    setArchivedBoards([]);
  }

  async function deleteBoard(b: Board) {
    if (!confirm(`Slet "${b.title}" permanent? Dette kan ikke fortrydes.`)) return;
    await fetch(`/api/boards/${b.id}?hard=true`, { method: 'DELETE' });
    await load();
  }

  const mine = boards.filter(b => b.is_owner);
  const shared = boards.filter(b => !b.is_owner && b.is_explicit_member);
  const companyBoards = boards.filter(b => !b.is_owner && !b.is_explicit_member);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title">Boards</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ Nyt board</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Søg i boards og kort…"
        style={{ width: '100%', maxWidth: 360, fontSize: 13, padding: '8px 12px', marginBottom: 24 }} />

      {searchResults ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Boards</div>
          {searchResults.boards.length === 0 ? <div style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 16 }}>Ingen boards matcher</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {searchResults.boards.map(b => (
                <button key={b.id} onClick={() => router.push(`/boards/${b.id}`)} style={{ textAlign: 'left', padding: '8px 12px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, fontSize: 13, color: 'var(--t1)', cursor: 'pointer' }}>{b.title}</button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Kort</div>
          {searchResults.cards.length === 0 ? <div style={{ color: 'var(--t3)', fontSize: 13 }}>Ingen kort matcher</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {searchResults.cards.map(c => (
                <button key={c.id} onClick={() => router.push(`/boards/${c.board_id}?card=${c.id}`)} style={{ textAlign: 'left', padding: '8px 12px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 7, fontSize: 13, color: 'var(--t1)', cursor: 'pointer' }}>
                  {c.title} <span style={{ color: 'var(--t3)' }}>— {c.board_title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div style={{ color: 'var(--t3)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Indlæser…</div>
      ) : (
        <>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Mine boards</div>
            {mine.length === 0 ? (
              <div style={{ color: 'var(--t3)', fontSize: 13 }}>Du har ingen boards endnu — opret dit første ovenfor</div>
            ) : <BoardGrid boards={mine} onOpen={id => router.push(`/boards/${id}`)} onArchive={archiveBoard} onDelete={deleteBoard} />}
          </div>

          {shared.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Delt med mig</div>
              <BoardGrid boards={shared} onOpen={id => router.push(`/boards/${id}`)} onArchive={archiveBoard} onDelete={deleteBoard} />
            </div>
          )}

          {companyBoards.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Firma boards</div>
              <BoardGrid boards={companyBoards} onOpen={id => router.push(`/boards/${id}`)} onArchive={archiveBoard} onDelete={deleteBoard} />
            </div>
          )}

          <div>
            <button onClick={loadArchived} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', padding: 0, marginBottom: 12 }}>
              {showArchived ? '▾' : '▸'} Arkiverede ({archivedBoards.length || ''})
            </button>
            {showArchived && (
              archivedBoards.length === 0
                ? <div style={{ color: 'var(--t3)', fontSize: 13 }}>Ingen arkiverede boards</div>
                : <BoardGrid boards={archivedBoards} onOpen={id => router.push(`/boards/${id}`)} onArchive={archiveBoard} onDelete={deleteBoard} />
            )}
          </div>
        </>
      )}

      {showCreate && (
        <CreateBoardModal companies={companies} onClose={() => setShowCreate(false)} onCreated={id => { setShowCreate(false); router.push(`/boards/${id}`); }} />
      )}
    </div>
  );
}

function CreateBoardModal({ companies, onClose, onCreated }: {
  companies: Company[]; onClose: () => void; onCreated: (id: number) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [visibility, setVisibility] = useState<'private' | 'company' | 'workspace'>('private');
  const [companyId, setCompanyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    if (!title.trim()) return;
    if (visibility === 'company' && !companyId) { setError('Vælg et firma'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/boards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, color, visibility, company_id: visibility === 'company' ? Number(companyId) : null }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'Fejl'); return; }
      const board = await res.json();
      onCreated(board.id);
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-title">Nyt board</div>
        <div className="modal-form">
          <div className="form-group">
            <label>Board titel</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="F.eks. Marketing kampagner" />
          </div>
          <div className="form-group">
            <label>Beskrivelse (valgfri)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="form-group">
            <label>Farve</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{ width: 28, height: 28, borderRadius: 7, background: c, border: color === c ? '2px solid var(--t1)' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 7, cursor: 'pointer' }} />
            </div>
          </div>
          <div className="form-group">
            <label>Synlighed</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {([
                { v: 'private', label: '🔒 Privat — kun dig og dem du inviterer' },
                { v: 'company', label: '🏢 Firma — alle i et firma kan se og deltage' },
                { v: 'workspace', label: '🌐 Hele platformen — synligt for alle brugere' },
              ] as const).map(opt => (
                <button key={opt.v} type="button" onClick={() => setVisibility(opt.v)}
                  style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${visibility === opt.v ? 'var(--bl)' : 'var(--bd)'}`, background: visibility === opt.v ? 'var(--bl2)' : 'var(--s2)', color: visibility === opt.v ? 'var(--bl)' : 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {visibility === 'company' && (
              <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={{ marginTop: 8 }}>
                <option value="">Vælg firma…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          {error && <div className="alert-error">{error}</div>}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Annuller</button>
            <button type="button" onClick={() => void create()} disabled={!title.trim() || saving} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? 'Opretter…' : 'Opret board'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
