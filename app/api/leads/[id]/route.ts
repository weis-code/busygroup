import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [lead] = await sql`SELECT * FROM leads WHERE id = ${params.id}`;
    if (!lead) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });
    return NextResponse.json(lead);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();

    const [existing] = await sql`SELECT * FROM leads WHERE id = ${params.id}`;
    if (!existing) return NextResponse.json({ error: 'Ikke fundet' }, { status: 404 });

    await sql`
      UPDATE leads SET
        company = ${body.company ?? existing.company},
        contact_name = ${body.contact_name ?? existing.contact_name},
        contact_title = ${body.contact_title ?? existing.contact_title},
        linkedin_url = ${body.linkedin_url ?? existing.linkedin_url},
        email = ${body.email ?? existing.email},
        phone = ${body.phone ?? existing.phone},
        company_size = ${body.company_size ?? existing.company_size},
        why_they_fit = ${body.why_they_fit ?? existing.why_they_fit},
        priority = ${body.priority ?? existing.priority},
        status = ${body.status ?? existing.status},
        market = ${body.market ?? existing.market},
        updated_at = ${now}
      WHERE id = ${params.id}
    `;

    const [lead] = await sql`SELECT * FROM leads WHERE id = ${params.id}`;
    return NextResponse.json(lead);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sql`UPDATE leads SET status = 'deleted', updated_at = ${new Date().toISOString()} WHERE id = ${params.id}`;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
