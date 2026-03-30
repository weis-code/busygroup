import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Engangs-cleanup: nulstiller svenske leads der er "contacted" af den gamle
 * agent som aldrig sendte rigtige emails. Sætter dem tilbage til 'new' og
 * sletter de falske outreach_sequences, så den nye agent kan sende rigtigt.
 *
 * Kun admins kan kalde dette endpoint.
 * POST /api/admin/reset-se-outreach
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Ingen adgang' }, { status: 403 });
  }

  // Find alle svenske leads der er markeret contacted/replied
  // men IKKE har modtaget svar (ikke interested/won/booked/lost)
  const affectedLeads = await sql`
    SELECT id, company, email, status
    FROM leads
    WHERE market = 'sweden'
      AND status IN ('contacted', 'replied')
  `;

  if (affectedLeads.length === 0) {
    return NextResponse.json({ message: 'Ingen leads at nulstille', reset: 0 });
  }

  const ids = (affectedLeads as unknown as Array<{ id: string }>).map(l => l.id);

  // Slet de falske outreach_sequences
  await sql`
    DELETE FROM outreach_sequences
    WHERE lead_id = ANY(${ids})
  `;

  // Sæt leads tilbage til 'new'
  await sql`
    UPDATE leads
    SET status = 'new', updated_at = ${new Date().toISOString()}
    WHERE id = ANY(${ids})
  `;

  return NextResponse.json({
    message: `${affectedLeads.length} svenske leads nulstillet til 'new' — outreach agent sender rigtige emails ved næste kørsel`,
    reset: affectedLeads.length,
    leads: (affectedLeads as unknown as Array<{ company: string; email: string; status: string }>).map(l => ({
      company: l.company,
      email: l.email,
      previousStatus: l.status,
    })),
  });
}
