import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status    = req.nextUrl.searchParams.get('status') ?? 'open';
  const stage     = req.nextUrl.searchParams.get('stage');
  const country   = req.nextUrl.searchParams.get('country');
  const companyId = req.nextUrl.searchParams.get('company_id');
  // 'workspace' narrows to one company's pipeline (slug, e.g. 'meridian', or
  // 'group' for NL Group's own workspace_id IS NULL rows). Omitted = everyone's
  // pipeline together, which is the koncern-wide default (for ADMIN).
  const workspace = req.nextUrl.searchParams.get('workspace');
  // Personal CRM: everyone below ADMIN only sees the deals they own. The
  // owner (ADMIN) sees everyone's, across every company, unfiltered.
  const ownerFilter = session.role === 'ADMIN' ? sql`` : sql`AND d.owner_id = ${session.id}`;

  let deals;
  try {
    deals = await sql`
      SELECT d.*,
             u.name AS owner_name,
             co.name AS portfolio_company_name,
             w.name AS workspace_name,
             (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
             (SELECT json_build_object(
               'id', t.id, 'type', t.type, 'next_action', t.next_action,
               'next_action_date', t.next_action_date::text
             ) FROM crm_touchpoints t
             WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
             ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry,
             (SELECT json_agg(json_build_object('id', dp.id, 'name', dp.name, 'price', dp.price, 'type', dp.type))
              FROM crm_deal_products dp WHERE dp.deal_id = d.id) AS products
      FROM crm_deals d
      LEFT JOIN users u ON u.id::text = d.owner_id
      LEFT JOIN companies co ON co.id = d.company_id
      LEFT JOIN companies w ON w.id = d.workspace_id
      WHERE d.status = ${status}
        AND (
          ${workspace} IS NULL
          OR (${workspace} = 'group' AND d.workspace_id IS NULL)
          OR w.slug = ${workspace}
        )
        AND (${stage} IS NULL OR d.stage = ${stage})
        AND (${country} IS NULL OR d.country = ${country})
        AND (${companyId} IS NULL OR d.company_id = ${companyId}::int)
        ${ownerFilter}
      ORDER BY d.created_at DESC
    `;
  } catch {
    // crm_deal_products or other new table might not exist yet — fall back to simpler query
    deals = await sql`
      SELECT d.*,
             u.name AS owner_name,
             (SELECT COUNT(*)::int FROM crm_touchpoints t WHERE t.deal_id = d.id) AS touchpoint_count,
             (SELECT json_build_object(
               'id', t.id, 'type', t.type, 'next_action', t.next_action,
               'next_action_date', t.next_action_date::text
             ) FROM crm_touchpoints t
             WHERE t.deal_id = d.id AND t.next_action IS NOT NULL AND t.next_action_done = FALSE
             ORDER BY t.next_action_date ASC NULLS LAST LIMIT 1) AS next_action_entry
      FROM crm_deals d
      LEFT JOIN users u ON u.id::text = d.owner_id
      WHERE d.status = ${status}
        ${ownerFilter}
      ORDER BY d.created_at DESC
    `;
  }

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
    title, value, stage, expected_close, notes, product,
    prospect_name, prospect_company, prospect_phone, prospect_email,
    country, company_id, product_ids,
  } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  // Ensure new columns exist before inserting (in case migration hasn't run yet)
  try {
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DK'`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS company_id INTEGER`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS lost_reason TEXT`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS product TEXT`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_name TEXT`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_company TEXT`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_phone TEXT`;
    await sql`ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS prospect_email TEXT`;
  } catch { /* columns already exist */ }

  let deal: Record<string, unknown>;
  try {
    const [row] = await sql`
      INSERT INTO crm_deals (
        owner_id, title, value, stage, expected_close, notes, product,
        prospect_name, prospect_company, prospect_phone, prospect_email,
        country, company_id
      )
      VALUES (
        ${session.id},
        ${title.trim()},
        ${value ? Number(value) : null},
        ${(stage as string) ?? 'lead'},
        ${expected_close || null},
        ${notes?.trim() ?? null},
        ${product?.trim() ?? null},
        ${prospect_name?.trim() ?? null},
        ${prospect_company?.trim() ?? null},
        ${prospect_phone?.trim() ?? null},
        ${prospect_email?.trim() ?? null},
        ${(country as string) ?? 'DK'},
        ${company_id ? Number(company_id) : null}
      )
      RETURNING *
    `;
    deal = row as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Database fejl: ${msg}` }, { status: 500 });
  }

  // Link products if provided (positive IDs = crm_products, negative IDs = owner_products)
  if (Array.isArray(product_ids) && product_ids.length > 0) {
    const positiveIds = (product_ids as number[]).filter(id => id > 0);
    const negativeIds = (product_ids as number[]).filter(id => id < 0).map(id => -id);

    let allLinked: { price: number | null }[] = [];

    if (positiveIds.length > 0) {
      try {
        const crmProds = await sql`
          SELECT * FROM crm_products WHERE id = ANY(${positiveIds}::int[]) AND owner_id = ${session.id}
        `;
        for (const p of crmProds) {
          await sql`INSERT INTO crm_deal_products (deal_id, product_id, name, price, type) VALUES (${deal.id as number}, ${p.id}, ${p.name}, ${p.price}, ${p.type})`;
        }
        allLinked = allLinked.concat(crmProds as unknown as { price: number | null }[]);
      } catch { /* crm_products table missing — skip */ }
    }

    if (negativeIds.length > 0) {
      try {
        const ownerProds = await sql`
          SELECT * FROM owner_products WHERE id = ANY(${negativeIds}::int[]) AND owner_id = ${session.id}
        `;
        for (const p of ownerProds) {
          const type = (p.type as string) === 'onetime' ? 'one_time' : (p.type as string);
          await sql`INSERT INTO crm_deal_products (deal_id, product_id, name, price, type) VALUES (${deal.id as number}, NULL, ${p.name}, ${p.price}, ${type})`;
        }
        allLinked = allLinked.concat(ownerProds as unknown as { price: number | null }[]);
      } catch { /* owner_products table missing — skip */ }
    }

    // Auto-calculate value from products if no value given
    if (!value && allLinked.length > 0) {
      const total = allLinked.reduce((s, p) => s + Number(p.price ?? 0), 0);
      if (total > 0) {
        await sql`UPDATE crm_deals SET value = ${total} WHERE id = ${deal.id as number}`;
        deal.value = total;
      }
    }
  }

  return NextResponse.json(deal, { status: 201 });
}
