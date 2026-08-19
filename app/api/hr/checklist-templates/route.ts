import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';
import { DEFAULT_CHECKLIST_TEMPLATE_NAME, DEFAULT_CHECKLIST_ITEMS } from '@/lib/recruitment';

export const dynamic = 'force-dynamic';

async function ensureDefaultTemplate(userId: string) {
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM recruitment_checklist_templates`;
  if (count > 0) return;

  await sql.begin(async tx => {
    const [template] = await tx`
      INSERT INTO recruitment_checklist_templates (name, company_id, created_by)
      VALUES (${DEFAULT_CHECKLIST_TEMPLATE_NAME}, NULL, ${userId})
      RETURNING id
    `;
    for (let i = 0; i < DEFAULT_CHECKLIST_ITEMS.length; i++) {
      const item = DEFAULT_CHECKLIST_ITEMS[i];
      await tx`
        INSERT INTO recruitment_checklist_items (template_id, title, position, days_before_start)
        VALUES (${template.id}, ${item.title}, ${i}, ${item.days_before_start})
      `;
    }
  });
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await ensureDefaultTemplate(session.id);

  const templates = await sql`
    SELECT t.id, t.name, t.company_id, co.name AS company_name, t.created_by, t.created_at,
           (SELECT COUNT(*)::int FROM recruitment_checklist_items i WHERE i.template_id = t.id) AS item_count
    FROM recruitment_checklist_templates t
    LEFT JOIN companies co ON co.id = t.company_id
    ORDER BY t.created_at ASC
  `;
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, company_id } = await req.json() as { name: string; company_id?: number | null };
  if (!name?.trim()) return NextResponse.json({ error: 'Navn kræves' }, { status: 400 });

  const [template] = await sql`
    INSERT INTO recruitment_checklist_templates (name, company_id, created_by)
    VALUES (${name.trim()}, ${company_id ?? null}, ${session.id})
    RETURNING id, name, company_id, created_by, created_at
  `;
  return NextResponse.json(template, { status: 201 });
}
