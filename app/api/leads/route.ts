import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const market = searchParams.get('market');
    const search = searchParams.get('search');
    const priority = searchParams.get('priority');

    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    const leads = await sql`
      SELECT * FROM leads
      WHERE status != 'deleted'
      ${role === 'seller' && userId ? sql`AND assigned_to = ${userId}` : sql``}
      ${status ? sql`AND status = ${status}` : sql``}
      ${market ? sql`AND market = ${market}` : sql``}
      ${priority ? sql`AND priority = ${priority}` : sql``}
      ${search ? sql`AND (company ILIKE ${'%' + search + '%'} OR contact_name ILIKE ${'%' + search + '%'} OR contact_title ILIKE ${'%' + search + '%'})` : sql``}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(leads);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const now = new Date().toISOString();
    const id = randomUUID();

    // Auto-assign to creating user
    const userId = req.headers.get('x-user-id');
    const assignedTo = body.assigned_to || userId || null;

    await sql`
      INSERT INTO leads (id, company, contact_name, contact_title, linkedin_url, email, phone, company_size, why_they_fit, priority, status, market, assigned_to, created_at, updated_at)
      VALUES (${id}, ${body.company || ''}, ${body.contact_name || null}, ${body.contact_title || null}, ${body.linkedin_url || null}, ${body.email || null}, ${body.phone || null}, ${body.company_size || null}, ${body.why_they_fit || null}, ${body.priority || 'medium'}, ${body.status || 'new'}, ${body.market || 'sweden'}, ${assignedTo}, ${now}, ${now})
    `;

    const [lead] = await sql`SELECT * FROM leads WHERE id = ${id}`;
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
