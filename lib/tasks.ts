import type { Session } from '@/lib/auth';
import sql from '@/lib/db';

export async function userCanAccessTask(session: Session, taskId: string): Promise<boolean> {
  if (session.role !== 'SELLER') return true;
  const [row] = await sql`
    SELECT 1 FROM task_sellers WHERE task_id = ${taskId} AND user_id = ${session.id}
  `;
  return !!row;
}
