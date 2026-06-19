import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tasks = await sql`
    SELECT t.id, t.name, t.client, t.compensation_model, t.price_per_unit, t.percent_value, t.units_label
    FROM tasks t
    JOIN task_sellers ts ON ts.task_id = t.id
    WHERE ts.user_id = ${session.id} AND t.status = 'active'
    ORDER BY t.name
  `;

  const taskIds = tasks.map(t => t.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let packages: any[] = [];
  if (taskIds.length > 0) {
    packages = await sql`SELECT * FROM task_packages WHERE task_id = ANY(${taskIds}) ORDER BY name`;
  }

  return NextResponse.json({ tasks, packages });
}
