import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

function forbidden() { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }
function notFound()  { return NextResponse.json({ error: 'Not found' }, { status: 404 }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const [lead] = await sql`
    SELECT l.*, s.name AS stage_name, s.color AS stage_color, s.is_won, s.is_lost
    FROM meridian_leads l
    LEFT JOIN meridian_pipeline_stages s ON s.id = l.stage_id
    WHERE l.id = ${Number(id)} AND l.owner_id = ${session.id}
  `;
  if (!lead) return notFound();

  const activities = await sql`
    SELECT * FROM meridian_lead_activities
    WHERE lead_id = ${Number(id)} AND owner_id = ${session.id}
    ORDER BY occurred_at DESC, created_at DESC
  `;
  return NextResponse.json({ ...lead, activities });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const body = await req.json() as {
    company_name?: string; contact_name?: string; contact_title?: string;
    email?: string; phone?: string; linkedin?: string; website?: string;
    country?: string; industry?: string; stage_id?: number | null;
    products?: string[]; deal_value_dkk?: number; deal_type?: string;
    expected_close_date?: string | null; probability?: number;
    won_at?: string | null; lost_at?: string | null; lost_reason?: string | null; notes?: string;
  };

  // Empty-string date fields must become NULL — an empty string in a date
  // column crashes the driver ("Invalid time value").
  const expectedCloseDate = body.expected_close_date?.trim() ? body.expected_close_date : null;

  try {
    const [updated] = await sql`
      UPDATE meridian_leads SET
        company_name        = COALESCE(${body.company_name        || null}, company_name),
        contact_name        = COALESCE(${body.contact_name        || null}, contact_name),
        contact_title       = COALESCE(${body.contact_title       || null}, contact_title),
        email               = COALESCE(${body.email               || null}, email),
        phone               = COALESCE(${body.phone               || null}, phone),
        linkedin            = COALESCE(${body.linkedin            || null}, linkedin),
        website             = COALESCE(${body.website             || null}, website),
        country             = COALESCE(${body.country             || null}, country),
        industry            = COALESCE(${body.industry            || null}, industry),
        deal_value_dkk      = COALESCE(${body.deal_value_dkk      ?? null}, deal_value_dkk),
        deal_type           = COALESCE(${body.deal_type           || null}, deal_type),
        expected_close_date = COALESCE(${expectedCloseDate}, expected_close_date),
        probability         = COALESCE(${body.probability         ?? null}, probability),
        notes               = COALESCE(${body.notes               || null}, notes),
        updated_at          = NOW()
      WHERE id = ${Number(id)} AND owner_id = ${session.id}
      RETURNING *
    `;
    if (!updated) return notFound();

    if ('stage_id' in body) {
      await sql`UPDATE meridian_leads SET stage_id = ${body.stage_id ?? null} WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
      updated.stage_id = body.stage_id ?? null;
    }
    if ('products' in body) {
      await sql`UPDATE meridian_leads SET products = ${JSON.stringify(body.products)}::jsonb WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
    }
    if ('won_at' in body)     { await sql`UPDATE meridian_leads SET won_at = ${body.won_at || null}         WHERE id = ${Number(id)} AND owner_id = ${session.id}`; }
    if ('lost_at' in body)    { await sql`UPDATE meridian_leads SET lost_at = ${body.lost_at || null}       WHERE id = ${Number(id)} AND owner_id = ${session.id}`; }
    if ('lost_reason' in body) { await sql`UPDATE meridian_leads SET lost_reason = ${body.lost_reason || null} WHERE id = ${Number(id)} AND owner_id = ${session.id}`; }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[meridian/crm/leads/:id] PATCH failed:', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER' || session.role === 'NLCA_MANAGER') return forbidden();
  const { id } = await params;

  const [existing] = await sql`
    SELECT id FROM meridian_leads WHERE id = ${Number(id)} AND owner_id = ${session.id}
  `;
  if (!existing) return notFound();
  await sql`DELETE FROM meridian_leads WHERE id = ${Number(id)} AND owner_id = ${session.id}`;
  return NextResponse.json({ ok: true });
}
