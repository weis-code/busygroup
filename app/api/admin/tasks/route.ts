import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tasks = await sql`
    SELECT t.id, t.name, t.client, t.description, t.status,
           t.start_date::text, t.end_date::text,
           t.compensation_model, t.price_per_unit, t.percent_value, t.units_label, t.display_mode,
           t.created_at,
           COUNT(DISTINCT ts.user_id)::int AS seller_count,
           COUNT(DISTINCT s.id)::int       AS sales_count,
           COUNT(DISTINCT al.id)::int      AS log_count
    FROM tasks t
    LEFT JOIN task_sellers ts ON ts.task_id = t.id
    LEFT JOIN sales s ON s.task_id = t.id
    LEFT JOIN activity_logs al ON al.task_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;

  // Packages for all tasks
  const packages = await sql`SELECT * FROM task_packages ORDER BY name`;

  // Sellers per task
  const taskSellers = await sql`
    SELECT ts.task_id, ts.user_id, u.name AS user_name
    FROM task_sellers ts JOIN users u ON u.id = ts.user_id
  `;

  return NextResponse.json({ tasks, packages, taskSellers });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { name, client, description, status, start_date, end_date,
          compensation_model, price_per_unit, percent_value, units_label, display_mode, packages, seller_ids } = body;

  if (!name || !client || !compensation_model) {
    return NextResponse.json({ error: 'Navn, klient og kompensationsmodel kræves' }, { status: 400 });
  }

  const [task] = await sql`
    INSERT INTO tasks (name, client, description, status, start_date, end_date,
                       compensation_model, price_per_unit, percent_value, units_label, display_mode)
    VALUES (
      ${name}, ${client}, ${description ?? null},
      ${status ?? 'active'},
      ${start_date || null}, ${end_date || null},
      ${compensation_model},
      ${price_per_unit ?? null}, ${percent_value ?? null},
      ${units_label || 'Antal'}, ${display_mode || 'COUNT'}
    )
    RETURNING id
  `;

  if (packages?.length) {
    for (const pkg of packages) {
      await sql`INSERT INTO task_packages (task_id, name, price) VALUES (${task.id}, ${pkg.name}, ${pkg.price})`;
    }
  }

  if (seller_ids?.length) {
    for (const uid of seller_ids) {
      await sql`INSERT INTO task_sellers (task_id, user_id) VALUES (${task.id}, ${uid}) ON CONFLICT DO NOTHING`;
    }
  }

  return NextResponse.json({ id: task.id }, { status: 201 });
}
