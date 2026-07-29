'use client';

import { useEffect, useRef, useState } from 'react';

interface Call {
  id: string; task_id: string | null; filename: string;
  status: 'processing' | 'done' | 'failed';
  duration_seconds: number | null; transcript: string | null;
  feedback: string | null; error: string | null; created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Call | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetch('/api/sales-calls').then(r => r.json()) as Call[];
      setCalls(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/sales-calls', { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      await load();
    } catch {
      setUploadError('Netværksfejl — prøv igen');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const STATUS_META: Record<Call['status'], { label: string; color: string }> = {
    processing: { label: 'Behandler…', color: 'var(--ye)' },
    done: { label: 'Klar', color: 'var(--gr)' },
    failed: { label: 'Fejlet', color: 'var(--re)' },
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>Opkalds-feedback</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Upload en optagelse af et salgsopkald og få AI-feedback</div>
        </div>
        <label style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: uploading ? 'default' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
          {uploading ? 'Uploader…' : '+ Upload opkald'}
          <input ref={fileRef} type="file" accept="audio/*" disabled={uploading} style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        </label>
      </div>

      {uploadError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--re2)', borderRadius: 8, fontSize: 12, color: 'var(--re)' }}>
          {uploadError}
        </div>
      )}

      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Henter…</div>
        ) : calls.length === 0 ? (
          <div style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            Ingen opkald uploadet endnu.
          </div>
        ) : (
          calls.map((c, i) => {
            const sm = STATUS_META[c.status];
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--bd)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.filename}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{fmtDate(c.created_at)}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: sm.color }}>{sm.label}</span>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div style={{ background: 'var(--s1)', borderRadius: 14, padding: 28, width: 560, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{selected.filename}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            {selected.status === 'processing' && <div style={{ color: 'var(--t3)', fontSize: 13 }}>Behandler stadig — genindlæs om lidt.</div>}
            {selected.status === 'failed' && <div style={{ color: 'var(--re)', fontSize: 13 }}>Fejlede: {selected.error ?? 'Ukendt fejl'}</div>}
            {selected.status === 'done' && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Feedback</div>
                <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 20 }}>{selected.feedback}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Transskription</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.transcript}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
