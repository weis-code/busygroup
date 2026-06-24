import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const entries = await sql`
    SELECT pa.*, cu.name AS customer_name, c.name AS company_name, c.color AS company_color
    FROM portal_access pa
    JOIN customers cu ON cu.id = pa.customer_id
    JOIN companies c ON c.id = cu.company_id
    ORDER BY pa.created_at DESC
  `;
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { customer_id } = await req.json();
  if (!customer_id) return NextResponse.json({ error: 'customer_id kræves' }, { status: 400 });

  const token = crypto.randomBytes(32).toString('hex');
  const [entry] = await sql`
    INSERT INTO portal_access (customer_id, portal_token)
    VALUES (${customer_id}, ${token})
    RETURNING *
  `;
  return NextResponse.json(entry, { status: 201 });
}
