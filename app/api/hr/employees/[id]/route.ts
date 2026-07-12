import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    start_date?: string | null; phone?: string | null; address?: string | null;
    emergency_contact?: string | null; employment_type?: string | null;
    company_id?: number | null; is_active?: boolean;
  };

  const [updated] = await sql`
    UPDATE users SET
      start_date        = ${body.start_date !== undefined ? (body.start_date ?? null) : sql`start_date`},
      phone             = ${body.phone !== undefined ? (body.phone ?? null) : sql`phone`},
      address           = ${body.address !== undefined ? (body.address ?? null) : sql`address`},
      emergency_contact = ${body.emergency_contact !== undefined ? (body.emergency_contact ?? null) : sql`emergency_contact`},
      employment_type   = ${body.employment_type !== undefined ? (body.employment_type ?? 'full_time') : sql`employment_type`},
      company_id        = ${body.company_id !== undefined ? (body.company_id ?? null) : sql`company_id`},
      is_active         = ${body.is_active !== undefined ? body.is_active : sql`is_active`}
    WHERE id = ${params.id}
    RETURNING id, name, email, role, company_id, start_date::text, phone, address,
              emergency_contact, employment_type, is_active, is_part_time AS part_time
  `;
  if (!updated) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
  return NextResponse.json(updated);
}
