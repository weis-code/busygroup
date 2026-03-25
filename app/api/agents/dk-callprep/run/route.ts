export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const { leadId } = await req.json();
    if (!leadId) return NextResponse.json({ error: 'leadId required' }, { status: 400 });

    const { runForLead } = await import('@/agents/dk-callprep-agent');
    const result = await runForLead(leadId);
    return NextResponse.json({
      success: result.success,
      message: result.actions.join('; '),
      data: result.data,
      duration: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err), duration: Date.now() - start }, { status: 500 });
  }
}
