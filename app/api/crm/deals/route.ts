import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const status    = req.nextUrl.searchParams.get('status') ?? 'open';
  const stage     = req.nextUrl.searchParams.get('stage');
  const country   = req.nextUrl.searchParams.get('country');
  const companyId = req.nextUrl.searchParams.get('company_id');

  const deals = await sql`
    SELECT d.*,
           u.name AS owner_name,
           co.name AS portfolio_company_name,
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
    WHERE d.status = ${status}
      AND (${stage} IS NULL OR d.stage = ${stage})
      AND (${country} IS NULL OR d.country = ${country})
      AND (${companyId} IS NULL OR d.company_id = ${companyId}::int)
    ORDER BY d.created_at DESC
  `;

  return NextResponse.json(deals);
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const {
    title, value, stage, expected_close, notes, product,
    prospect_name, prospect_company, prospect_phone, prospect_email,
    country, company_id, product_ids,
  } = await req.json();

  if (!title?.trim()) return NextResponse.json({ error: 'Titel kræves' }, { status: 400 });

  const [deal] = await sql`
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
      ${expected_close ?? null},
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

  // Link products if provided (positive IDs = crm_products, negative IDs = owner_products)
  if (Array.isArray(product_ids) && product_ids.length > 0) {
    const positiveIds = (product_ids as number[]).filter(id => id > 0);
    const negativeIds = (product_ids as number[]).filter(id => id < 0).map(id => -id);

    let allLinked: { price: number | null }[] = [];

    if (positiveIds.length > 0) {
      const crmProds = await sql`
        SELECT * FROM crm_products WHERE id = ANY(${positiveIds}::int[]) AND owner_id = ${session.id}
      `;
      for (const p of crmProds) {
        await sql`INSERT INTO crm_deal_products (deal_id, product_id, name, price, type) VALUES (${deal.id}, ${p.id}, ${p.name}, ${p.price}, ${p.type})`;
      }
      allLinked = allLinked.concat(crmProds as unknown as { price: number | null }[]);
    }

    if (negativeIds.length > 0) {
      const ownerProds = await sql`
        SELECT * FROM owner_products WHERE id = ANY(${negativeIds}::int[]) AND owner_id = ${session.id}
      `;
      for (const p of ownerProds) {
        const type = (p.type as string) === 'onetime' ? 'one_time' : (p.type as string);
        await sql`INSERT INTO crm_deal_products (deal_id, product_id, name, price, type) VALUES (${deal.id}, NULL, ${p.name}, ${p.price}, ${type})`;
      }
      allLinked = allLinked.concat(ownerProds as unknown as { price: number | null }[]);
    }

    // Auto-calculate value from products if no value given
    if (!value && allLinked.length > 0) {
      const total = allLinked.reduce((s, p) => s + Number(p.price ?? 0), 0);
      if (total > 0) {
        await sql`UPDATE crm_deals SET value = ${total} WHERE id = ${deal.id}`;
        deal.value = total;
      }
    }
  }

  return NextResponse.json(deal, { status: 201 });
}
