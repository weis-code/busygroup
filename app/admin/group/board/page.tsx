'use client';

import { useEffect, useState } from 'react';
import { Board, BoardCanvas, Card, Column } from '@/components/kanban/BoardCanvas';

const PRIORITY_COLOR: Record<string, string> = {
  low: '#4a5d78', normal: '#4f8ef7', high: '#f59e0b', urgent: '#f43f5e',
};

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast-container"><div className="toast">{msg}</div></div>;
}

/* ── Assigned-to-me tab ─────────────────────────────────── */
interface AssignedCard {
  id: number; title: string; description: string | null; priority: string;
  due_date: string | null; creator_name: string | null; company_name: string | null;
  company_color: string | null; completed_at: string | null;
}

function AssignedTab() {
  const [cards, setCards]     = useState<AssignedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');

  async function load() {
    setLoading(true);
    setCards(await fetch('/api/kanban/boards/assigned').then(r => r.json()) as AssignedCard[]);
    setLoading(false);
  }

  async function markDone(id: number) {
    await fetch(`/api/kanban/cards/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed_at: new Date().toISOString() }) });
    setToast('Markeret som færdig'); load();
  }

  useEffect(() => { load(); }, []);

  const grouped = cards.reduce<Record<string, AssignedCard[]>>((acc, c) => {
    const key = c.company_name ?? 'Privat';
    (acc[key] ??= []).push(c);
    return acc;
  }, {});

  if (loading) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>;

  if (cards.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'var(--t3)', padding: 40 }}>
      <div style={{ fontSize: 32 }}>✓</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)' }}>Ingen opgaver tildelt dig</div>
      <div style={{ fontSize: 12 }}>Sælgere kan tildele dig kort fra deres board</div>
    </div>
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}
      {Object.entries(grouped).map(([company, cds]) => (
        <div key={company} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            {cds[0]?.company_color && <span style={{ width: 8, height: 8, borderRadius: '50%', background: cds[0].company_color, display: 'inline-block' }} />}
            {company} <span style={{ fontWeight: 400 }}>({cds.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cds.map(card => (
              <div key={card.id} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${PRIORITY_COLOR[card.priority] ?? '#4a5d78'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{card.title}</div>
                  {card.description && <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{card.description.slice(0, 100)}</div>}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {card.creator_name && <span style={{ fontSize: 10, color: 'var(--t3)' }}>Fra {card.creator_name}</span>}
                    {card.due_date && <span style={{ fontSize: 10, color: 'var(--t3)' }}>📅 {new Date(card.due_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}</span>}
                  </div>
                </div>
                <button onClick={() => markDone(card.id)} style={{ background: 'var(--gr2)', color: 'var(--gr)', border: '1px solid var(--gr)', borderRadius: 7, padding: '6px 12px', fontSize: 11, fontWeight: 600, flexShrink: 0, cursor: 'pointer', minHeight: 36 }}>Færdig</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Board tab wrapper ──────────────────────────────────── */
function BoardTab({ filterSlug }: { filterSlug?: string }) {
  const [boards, setBoards]               = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [columns, setColumns]             = useState<Column[]>([]);
  const [cards, setCards]                 = useState<Card[]>([]);

  async function loadBoards() {
    const data = await fetch('/api/kanban/boards').then(r => r.json()) as (Board & { company_slug?: string })[];
    const filtered = filterSlug
      ? data.filter(b => b.owner_user_id === null || b.owner_user_id === undefined)
      : data.filter(b => !b.owner_user_id);
    setBoards(filtered);
    if (filtered.length > 0) setActiveBoardId(id => id ?? filtered[0].id);
  }

  async function loadBoard(id: number) {
    const [cols, cds] = await Promise.all([
      fetch(`/api/kanban/boards/${id}/columns`).then(r => r.json()) as Promise<Column[]>,
      fetch(`/api/kanban/cards?boardId=${id}`).then(r => r.json()) as Promise<Card[]>,
    ]);
    setColumns(cols); setCards(cds);
  }

  async function loadMyBoard() {
    const board = await fetch('/api/kanban/boards/my').then(r => r.json()) as { id: number };
    setBoards([{ id: board.id, name: 'Mit board', company_name: 'Group', company_color: '#4f8ef7' }]);
    setActiveBoardId(board.id);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (filterSlug === 'my') loadMyBoard(); else loadBoards(); }, [filterSlug]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeBoardId) loadBoard(activeBoardId); }, [activeBoardId]);

  return (
    <BoardCanvas
      boards={boards} activeBoardId={activeBoardId} onBoardChange={setActiveBoardId}
      columns={columns} cards={cards}
      onReload={() => activeBoardId && loadBoard(activeBoardId)}
      onColumnReload={() => activeBoardId && fetch(`/api/kanban/boards/${activeBoardId}/columns`).then(r => r.json()).then(setColumns)}
      setColumns={setColumns} setCards={setCards} showBoardPicker={boards.length > 1}
    />
  );
}

/* ── Main page ──────────────────────────────────────────── */
type Tab = 'my' | 'assigned' | 'company';

export default function GroupBoardPage() {
  const [tab, setTab] = useState<Tab>('my');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'my',       label: 'Mit board' },
    { key: 'assigned', label: 'Tildelt mig' },
    { key: 'company',  label: 'Firmaoversigt' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      <div style={{ padding: '0 18px', borderBottom: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0, height: 48 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '0 16px', height: '100%', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
            color: tab === t.key ? 'var(--bl)' : 'var(--t3)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--bl)' : 'transparent'}`,
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'my'       && <BoardTab filterSlug="my" />}
        {tab === 'assigned' && <AssignedTab />}
        {tab === 'company'  && <BoardTab />}
      </div>
    </div>
  );
}
