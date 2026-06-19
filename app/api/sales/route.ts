import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT s.id, s.date::text, s.units, s.deal_size, s.status, s.note, s.created_at,
           t.name AS task_name, t.compensation_model,
           tp.name AS package_name, tp.price AS package_price
    FROM sales s
    JOIN tasks t ON t.id = s.task_id
    LEFT JOIN task_packages tp ON tp.id = s.package_id
    WHERE s.user_id = ${session.id}
    ORDER BY s.date DESC, s.created_at DESC
    LIMIT 200
  `;

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { task_id, date, units, deal_size, package_id, note } = body;

  if (!task_id) return NextResponse.json({ error: 'task_id kræves' }, { status: 400 });

  // Verify seller is assigned to this task
  const [assigned] = await sql`
    SELECT 1 FROM task_sellers WHERE task_id = ${task_id} AND user_id = ${session.id}
  `;
  if (!assigned) {
    return NextResponse.json({ error: 'Du er ikke tilknyttet denne opgave' }, { status: 403 });
  }

  // Load task to calculate house_revenue server-side
  const [task] = await sql`
    SELECT compensation_model, price_per_unit, percent_value FROM tasks WHERE id = ${task_id}
  `;
  if (!task) return NextResponse.json({ error: 'Opgave ikke fundet' }, { status: 404 });

  let house_revenue = 0;
  if (task.compensation_model === 'FIXED') {
    const u = Number(units) || 0;
    house_revenue = u * Number(task.price_per_unit || 0);
  } else if (task.compensation_model === 'PERCENT') {
    const ds = Number(deal_size) || 0;
    house_revenue = ds * (Number(task.percent_value || 0) / 100);
  } else if (task.compensation_model === 'PACKAGE' && package_id) {
    const [pkg] = await sql`SELECT price FROM task_packages WHERE id = ${package_id} AND task_id = ${task_id}`;
    house_revenue = pkg ? Number(pkg.price) : 0;
  }

  const saleDate = date || new Date().toISOString().slice(0, 10);

  const [sale] = await sql`
    INSERT INTO sales (user_id, task_id, date, units, deal_size, package_id, note, house_revenue)
    VALUES (
      ${session.id}, ${task_id}, ${saleDate},
      ${units ?? null}, ${deal_size ?? null}, ${package_id ?? null},
      ${note ?? null}, ${house_revenue}
    )
    RETURNING id, date::text, units, deal_size, status, note
  `;

  return NextResponse.json(sale, { status: 201 });
}
