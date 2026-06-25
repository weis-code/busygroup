'use client';

import { useEffect, useState } from 'react';
import { Board, BoardCanvas, Card, Column } from '@/components/kanban/BoardCanvas';

export default function NlsBoardPage() {
  const [boards, setBoards]               = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [columns, setColumns]             = useState<Column[]>([]);
  const [cards, setCards]                 = useState<Card[]>([]);

  async function loadBoards() {
    const data = await fetch('/api/kanban/boards').then(r => r.json()) as Board[];
    const nls  = data.filter((b: Board & { company_slug?: string }) => {
      const slug = (b as { company_slug?: string }).company_slug;
      return !b.owner_user_id && (!slug || slug === 'nls');
    });
    setBoards(nls.length ? nls : data.filter(b => !b.owner_user_id).slice(0, 1));
    if (nls.length > 0 && !activeBoardId) setActiveBoardId(nls[0].id);
  }

  async function loadBoard(id: number) {
    const [cols, cds] = await Promise.all([
      fetch(`/api/kanban/boards/${id}/columns`).then(r => r.json()) as Promise<Column[]>,
      fetch(`/api/kanban/cards?boardId=${id}`).then(r => r.json()) as Promise<Card[]>,
    ]);
    setColumns(cols); setCards(cds);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadBoards(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeBoardId) loadBoard(activeBoardId); }, [activeBoardId]);

  return (
    <BoardCanvas
      boards={boards}
      activeBoardId={activeBoardId}
      onBoardChange={id => setActiveBoardId(id)}
      columns={columns}
      cards={cards}
      onReload={() => activeBoardId && loadBoard(activeBoardId)}
      onColumnReload={() => activeBoardId && fetch(`/api/kanban/boards/${activeBoardId}/columns`).then(r => r.json()).then(setColumns)}
      setColumns={setColumns}
      setCards={setCards}
      showBoardPicker={boards.length > 1}
    />
  );
}
