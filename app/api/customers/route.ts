export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    const rows = await sql`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN p.type='mrr' THEN p.price ELSE 0 END), 0) AS mrr_calculated,
        STRING_AGG(p.name, ', ') AS product_names,
        u.name  AS assigned_user_name,
        u.email AS assigned_user_email
      FROM customers c
      LEFT JOIN customer_products cp ON cp.customer_id = c.id
      LEFT JOIN products p ON p.id = cp.product_id
      LEFT JOIN users u ON u.id = c.assigned_to
      ${role === 'seller' && userId ? sql`WHERE c.assigned_to = ${userId}` : sql``}
      GROUP BY c.id, u.name, u.email
      ORDER BY c.mrr DESC, c.company ASC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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

    // memberIds: users to add to portal conversation + project
    const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
    if (assignedTo && !memberIds.includes(assignedTo)) memberIds.unshift(assignedTo);

    await sql`
      INSERT INTO customers (id, company, contact_name, contact_title, contact_email, contact_phone, market, mrr, contract_start, contract_end, churn_risk, health_score, segment, notes, assigned_to, created_at, updated_at)
      VALUES (${id}, ${body.company || ''}, ${body.contact_name || ''}, ${body.contact_title || ''}, ${body.contact_email || ''}, ${body.contact_phone || ''}, ${body.market || 'denmark'}, ${body.mrr || 0}, ${body.contract_start || null}, ${body.contract_end || null}, ${body.churn_risk || 'low'}, ${body.health_score ?? 80}, ${body.segment || 'smb'}, ${body.notes || ''}, ${assignedTo}, ${now}, ${now})
    `;

    // ── Auto-opret portal messenger-tråd ──────────────────────────────────
    const convId = randomUUID();
    const convName = `#${(body.company || 'kunde').toLowerCase().replace(/\s+/g, '-')}`;
    await sql`
      INSERT INTO chat_conversations (id, type, name, created_by, created_at, customer_id)
      VALUES (${convId}, 'group', ${convName}, ${assignedTo}, ${now}, ${id})
    `;
    for (const uid of memberIds) {
      await sql`
        INSERT INTO chat_members (id, conversation_id, user_id, joined_at)
        VALUES (${randomUUID()}, ${convId}, ${uid}, ${now})
        ON CONFLICT (conversation_id, user_id) DO NOTHING
      `;
    }

    // ── Auto-opret portal projekt-board ───────────────────────────────────
    const boardId = randomUUID();
    await sql`
      INSERT INTO project_boards (id, name, description, owner_id, visibility, color, customer_id, created_at, updated_at)
      VALUES (${boardId}, ${`Projekt: ${body.company || 'Kunde'}`}, ${'Automatisk oprettet kundeportal-projekt'}, ${assignedTo}, 'private', '#E84025', ${id}, ${now}, ${now})
    `;
    for (const uid of memberIds) {
      await sql`
        INSERT INTO project_board_members (id, board_id, user_id, role)
        VALUES (${randomUUID()}, ${boardId}, ${uid}, ${uid === assignedTo ? 'owner' : 'member'})
        ON CONFLICT (board_id, user_id) DO NOTHING
      `;
    }
    const defaultCols = ['Backlog', 'I gang', 'Review', 'Færdig'];
    for (let i = 0; i < defaultCols.length; i++) {
      await sql`
        INSERT INTO project_columns (id, board_id, name, position, color, created_at)
        VALUES (${randomUUID()}, ${boardId}, ${defaultCols[i]}, ${i}, '#334455', ${now})
      `;
    }

    // ── Gem tråd + board IDs på kunden ────────────────────────────────────
    await sql`
      UPDATE customers
      SET portal_conversation_id = ${convId}, portal_board_id = ${boardId}
      WHERE id = ${id}
    `;

    const [created] = await sql`SELECT * FROM customers WHERE id = ${id}`;
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
