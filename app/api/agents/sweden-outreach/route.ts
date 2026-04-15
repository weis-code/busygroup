import { NextRequest } from 'next/server';
import { initSchema } from '@/lib/db';
import { runSwedenOutreach } from '@/lib/agents/sweden-outreach';

export const dynamic = 'force-dynamic';

/**
 * POST /api/agents/sweden-outreach
 * Streams Server-Sent Events while running the 3-agent pipeline.
 * Body: { workspace_id?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { workspace_id?: string };
  const workspaceId = body.workspace_id && body.workspace_id !== 'internal'
    ? body.workspace_id
    : null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await initSchema();

        await runSwedenOutreach(
          (event) => send(event),
          workspaceId
        );
      } catch (err) {
        send({ stage: 'error', message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
