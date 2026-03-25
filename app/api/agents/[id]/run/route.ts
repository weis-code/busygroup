import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const start = Date.now();
  try {
    // Dynamic import to avoid loading all agents at build time
    const { runAgent } = await import('@/agents/runner');
    const result = await runAgent(params.id);
    return NextResponse.json({
      success: result.success,
      message: result.message,
      duration: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: String(err),
      duration: Date.now() - start,
    }, { status: 500 });
  }
}
