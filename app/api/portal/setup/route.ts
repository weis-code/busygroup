import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Admin enables/updates portal access for a customer
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { customer_id, portal_email, password, enabled } = await req.json();
  if (!customer_id) return NextResponse.json({ error: 'customer_id mangler' }, { status: 400 });

  // Verify customer exists and belongs to this user's scope
  const rows = await sql`
    SELECT id, company FROM customers WHERE id = ${customer_id} LIMIT 1
  ` as unknown as Array<{ id: string; company: string }>;

  if (!rows[0]) return NextResponse.json({ error: 'Kunde ikke fundet' }, { status: 404 });

  if (enabled === false) {
    // Disable portal access
    await sql`
      UPDATE customers
      SET portal_enabled = false, updated_at = ${new Date().toISOString()}
      WHERE id = ${customer_id}
    `;
    return NextResponse.json({ ok: true, portal_enabled: false });
  }

  if (!portal_email) return NextResponse.json({ error: 'Email er påkrævet' }, { status: 400 });

  // Check email not already used by another customer
  const conflict = await sql`
    SELECT id FROM customers
    WHERE portal_email = ${portal_email.toLowerCase().trim()} AND id != ${customer_id}
    LIMIT 1
  ` as unknown as Array<{ id: string }>;

  if (conflict[0]) {
    return NextResponse.json({ error: 'Email er allerede i brug af en anden kunde' }, { status: 409 });
  }

  const updates: Record<string, unknown> = {
    portal_email: portal_email.toLowerCase().trim(),
    portal_enabled: true,
    updated_at: new Date().toISOString(),
  };

  if (password) {
    updates.portal_password_hash = await bcrypt.hash(password, 10);
  }

  await sql`
    UPDATE customers
    SET
      portal_email = ${updates.portal_email as string},
      portal_enabled = true,
      portal_password_hash = COALESCE(
        ${updates.portal_password_hash as string ?? null},
        portal_password_hash
      ),
      updated_at = ${updates.updated_at as string}
    WHERE id = ${customer_id}
  `;

  return NextResponse.json({ ok: true, portal_enabled: true, portal_email: updates.portal_email });
}

// Get portal status for a customer (admin only)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Ikke logget ind' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customer_id = searchParams.get('customer_id');
  if (!customer_id) return NextResponse.json({ error: 'customer_id mangler' }, { status: 400 });

  const rows = await sql`
    SELECT portal_enabled, portal_email
    FROM customers
    WHERE id = ${customer_id}
    LIMIT 1
  ` as unknown as Array<{ portal_enabled: boolean; portal_email: string | null }>;

  if (!rows[0]) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

  return NextResponse.json(rows[0]);
}
