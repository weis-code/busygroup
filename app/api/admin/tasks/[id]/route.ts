import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { name, client, description, status, start_date, end_date,
          compensation_model, price_per_unit, percent_value, packages, seller_ids } = body;

  await sql`
    UPDATE tasks SET
      name = ${name}, client = ${client}, description = ${description ?? null},
      status = ${status}, start_date = ${start_date || null}, end_date = ${end_date || null},
      compensation_model = ${compensation_model},
      price_per_unit = ${price_per_unit ?? null}, percent_value = ${percent_value ?? null}
    WHERE id = ${params.id}
  `;

  // Sync packages
  await sql`DELETE FROM task_packages WHERE task_id = ${params.id}`;
  if (packages?.length) {
    for (const pkg of packages) {
      await sql`INSERT INTO task_packages (task_id, name, price) VALUES (${params.id}, ${pkg.name}, ${pkg.price})`;
    }
  }

  // Sync sellers
  await sql`DELETE FROM task_sellers WHERE task_id = ${params.id}`;
  if (seller_ids?.length) {
    for (const uid of seller_ids) {
      await sql`INSERT INTO task_sellers (task_id, user_id) VALUES (${params.id}, ${uid}) ON CONFLICT DO NOTHING`;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await sql`DELETE FROM tasks WHERE id = ${params.id}`;
  return NextResponse.json({ ok: true });
}
