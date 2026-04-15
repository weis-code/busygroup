import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get('agent_id');
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100);

    let rows;
    if (agentId) {
      rows = await sql`
        SELECT * FROM agent_logs WHERE agent_id = ${agentId}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT ${limit}
      `;
    }

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
