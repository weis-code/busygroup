import sql from './db';
import type { Session } from './auth';

export type BoardRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface BoardAccess {
  board: Record<string, unknown>;
  role: BoardRole;
}

export async function getBoardAccess(session: Session, boardId: string | number): Promise<BoardAccess | null> {
  const [board] = await sql`SELECT * FROM boards WHERE id = ${boardId}`;
  if (!board) return null;

  if (board.owner_id === session.id) return { board, role: 'owner' };

  const [member] = await sql`SELECT role FROM board_members WHERE board_id = ${boardId} AND user_id = ${session.id}`;
  if (member) return { board, role: member.role as BoardRole };

  if (session.role === 'ADMIN') return { board, role: 'admin' };

  if (board.visibility === 'workspace') return { board, role: 'member' };

  if (board.visibility === 'company' && board.company_id) {
    const [user] = await sql`SELECT company_id FROM users WHERE id = ${session.id}`;
    if (user?.company_id === board.company_id) return { board, role: 'member' };
  }

  return null;
}

export function canEdit(role: BoardRole | null): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}

export function canManageBoard(role: BoardRole | null): boolean {
  return role === 'owner' || role === 'admin';
}

export async function logActivity(
  cardId: number, boardId: number, userId: string, type: string, data: Record<string, unknown> = {}
) {
  await sql`
    INSERT INTO board_card_activity (card_id, board_id, user_id, type, data)
    VALUES (${cardId}, ${boardId}, ${userId}, ${type}, ${sql.json(data as never)})
  `;
}
