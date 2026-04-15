import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const agents = await sql`SELECT * FROM agents ORDER BY market, name`;
    return NextResponse.json(agents);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
