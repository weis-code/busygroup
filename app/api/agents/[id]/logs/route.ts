import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const logs = await sql`
      SELECT * FROM agent_logs
      WHERE agent_id = ${params.id}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
