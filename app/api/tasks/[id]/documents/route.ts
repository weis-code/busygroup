import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { sessionFromRequest } from '@/lib/auth';
import { userCanAccessTask } from '@/lib/tasks';
import { uploadObject, isStorageConfigured } from '@/lib/storage';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

async function extractText(buffer: Buffer, contentType: string, filename: string): Promise<string | null> {
  const lower = filename.toLowerCase();
  try {
    if (contentType === 'application/pdf' || lower.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return result.text;
    }
    if (contentType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
      return buffer.toString('utf-8');
    }
    return null;
  } catch (err) {
    console.error('[tasks/documents] text extraction failed:', err);
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const docs = await sql`
    SELECT td.id, td.filename, td.content_type, td.created_at, u.name AS uploaded_by_name,
           (td.extracted_text IS NOT NULL) AS has_text
    FROM task_documents td
    LEFT JOIN users u ON u.id = td.uploaded_by
    WHERE td.task_id = ${id}
    ORDER BY td.created_at DESC
  `;
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Kun admin kan uploade dokumenter' }, { status: 403 });
  const { id } = await params;
  if (!(await userCanAccessTask(session, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [task] = await sql`SELECT id FROM tasks WHERE id = ${id}`;
  if (!task) return NextResponse.json({ error: 'Opgave ikke fundet' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fil kræves' }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Filen må maks være 20 MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || 'application/octet-stream';
  const storageKey = `task-documents/${id}/${randomUUID()}-${file.name}`;

  // Storage is used purely for archiving the original file — the assistant only needs
  // the extracted text below, so a storage outage/missing config shouldn't block uploads.
  let storedKey: string | null = null;
  if (isStorageConfigured()) {
    try {
      await uploadObject(storageKey, buffer, contentType);
      storedKey = storageKey;
    } catch (err) {
      console.error('[tasks/documents] upload to storage failed, continuing without archived file:', err);
    }
  }

  const rawText = await extractText(buffer, contentType, file.name);
  // Postgres text columns reject NUL bytes outright — pdf-parse regularly yields them
  // from malformed PDFs, which would otherwise crash the insert below.
  const extractedText = rawText ? rawText.replace(new RegExp(String.fromCharCode(0), 'g'), '') : rawText;

  let doc;
  try {
    [doc] = await sql`
      INSERT INTO task_documents (task_id, filename, storage_key, content_type, extracted_text, uploaded_by)
      VALUES (${id}, ${file.name}, ${storedKey}, ${contentType}, ${extractedText}, ${session.id})
      RETURNING id, filename, content_type, created_at
    `;
  } catch (err) {
    console.error('[tasks/documents] insert failed:', err);
    return NextResponse.json({ error: 'Kunne ikke gemme dokumentet' }, { status: 500 });
  }
  return NextResponse.json({ ...doc, has_text: extractedText !== null }, { status: 201 });
}
