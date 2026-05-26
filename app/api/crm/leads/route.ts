import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const isAdmin = session.role === 'admin';

  const rows = await sql`
    SELECT
      l.*,
      p.name  AS product_name,
      p.price AS product_price,
      u.name  AS assigned_name
    FROM crm_leads l
    LEFT JOIN products p ON p.id = l.product_id
    LEFT JOIN users u    ON u.id = l.assigned_to
    ${isAdmin ? sql`` : sql`WHERE l.assigned_to = ${session.id}`}
    ORDER BY l.updated_at DESC
  `;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const body = await req.json();
  if (!body.company?.trim()) {
    return NextResponse.json({ error: 'Firmanavn er påkrævet' }, { status: 400 });
  }

  const isAdmin = session.role === 'admin';
  const assignedTo = isAdmin ? (body.assigned_to || session.id) : session.id;

  const now = new Date().toISOString();
  const id = randomUUID();

  await sql`
    INSERT INTO crm_leads (
      id, company, contact_name, contact_email, contact_phone,
      status, product_id, deal_value, notes,
      assigned_to, created_by, created_at, updated_at
    ) VALUES (
      ${id},
      ${body.company.trim()},
      ${body.contact_name || null},
      ${body.contact_email || null},
      ${body.contact_phone || null},
      ${body.status || 'new'},
      ${body.product_id || null},
      ${Number(body.deal_value) || 0},
      ${body.notes || null},
      ${assignedTo},
      ${session.id},
      ${now}, ${now}
    )
  `;

  const [lead] = await sql`
    SELECT l.*, p.name AS product_name, u.name AS assigned_name
    FROM crm_leads l
    LEFT JOIN products p ON p.id = l.product_id
    LEFT JOIN users u    ON u.id = l.assigned_to
    WHERE l.id = ${id}
  `;
  return NextResponse.json(lead, { status: 201 });
}
