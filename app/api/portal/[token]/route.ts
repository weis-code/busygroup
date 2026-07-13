import { NextRequest, NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [access] = await sql`
    SELECT pa.*, cu.name AS customer_name, cu.cvr, cu.contact_name,
           cu.contact_email, cu.mrr, cu.notes, cu.status,
           c.name AS company_name, c.color AS company_color
    FROM portal_access pa
    JOIN customers cu ON cu.id = pa.customer_id
    JOIN companies c ON c.id = cu.company_id
    WHERE pa.portal_token = ${token}
  `;
  if (!access) return NextResponse.json({ error: 'Ugyldig token' }, { status: 404 });

  await sql`UPDATE portal_access SET last_login = NOW() WHERE portal_token = ${token}`;

  const products = await sql`
    SELECT * FROM customer_products WHERE customer_id = ${access.customer_id} ORDER BY started_at DESC
  `;
  const tickets = await sql`
    SELECT id, subject, status, priority, type, created_at
    FROM meridian_tickets
    WHERE customer_id = ${access.customer_id}
    ORDER BY created_at DESC
    LIMIT 10
  `;
  return NextResponse.json({ ...access, products, tickets });
}
