export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [brief] = await sql`
      SELECT * FROM briefs WHERE lead_id = ${params.id} ORDER BY created_at DESC LIMIT 1
    `;

    if (!brief) return NextResponse.json(null);
    return NextResponse.json({ ...brief, content: JSON.parse(brief.content as string) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
