import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function countByRole(baseUrl: string, key: string, role: string): Promise<number> {
  const res = await fetch(
    `${baseUrl}/rest/v1/profiles?role=eq.${role}&select=role`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    }
  );
  const range = res.headers.get('content-range') ?? '';
  const total = range.split('/')[1];
  return total ? parseInt(total, 10) : 0;
}

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = process.env.CREATORRATE_SUPABASE_URL;
  const key = process.env.CREATORRATE_SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: 'CREATORRATE_SUPABASE_URL eller CREATORRATE_SUPABASE_SERVICE_KEY mangler' }, { status: 500 });
  }

  const [creators, viewers] = await Promise.all([
    countByRole(url, key, 'creator'),
    countByRole(url, key, 'viewer'),
  ]);

  return NextResponse.json({ creators, viewers, total: creators + viewers });
}
