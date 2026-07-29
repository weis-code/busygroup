import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

// Koncern-wide pipeline summary — deliberately NOT filtered by workspace_id, so it
// covers Group's own deals (workspace_id IS NULL) and Meridian's shared pipeline
// (workspace_id = meridian) in one number. This is exactly the payoff of unifying
// both onto crm_deals in Fase 2: a cross-company total was impossible before.
export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session || session.role === 'SELLER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const byWorkspace = await sql`
    SELECT
      d.workspace_id,
      COALESCE(w.name, 'NextLevel Group') AS workspace_name,
      COUNT(*)::int AS count,
      COALESCE(SUM(d.value), 0)::int AS value
    FROM crm_deals d
    LEFT JOIN companies w ON w.id = d.workspace_id
    WHERE d.status = 'open'
    GROUP BY d.workspace_id, w.name
    ORDER BY value DESC
  `;

  const totalValue = byWorkspace.reduce((s, w) => s + Number(w.value), 0);
  const totalCount = byWorkspace.reduce((s, w) => s + Number(w.count), 0);

  return NextResponse.json({ totalValue, totalCount, byWorkspace });
}
