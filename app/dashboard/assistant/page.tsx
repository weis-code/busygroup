'use client';

import { useEffect, useRef, useState } from 'react';

interface Task { id: string; name: string; client: string }
interface Doc { id: string; filename: string; content_type: string | null; created_at: string; uploaded_by_name: string | null; has_text: boolean }
interface ChatMsg { id: number; role: 'user' | 'assistant'; content: string; created_at: string }

export default function AssistantPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState<string>('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/my-tasks').then(r => r.json()).then((d: { tasks?: Task[] }) => {
      const list = Array.isArray(d.tasks) ? d.tasks : [];
      setTasks(list);
      if (list.length > 0) setTaskId(list[0].id);
    });
  }, []);

  async function loadDocs(id: string) {
    const data = await fetch(`/api/tasks/${id}/documents`).then(r => r.json()) as Doc[];
    setDocs(Array.isArray(data) ? data : []);
  }

  async function loadMessages(id: string) {
    const data = await fetch(`/api/tasks/${id}/chat`).then(r => r.json()) as ChatMsg[];
    setMessages(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!taskId) return;
    void loadDocs(taskId);
    void loadMessages(taskId);
  }, [taskId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function uploadFile(file: File) {
    if (!taskId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/tasks/${taskId}/documents`, { method: 'POST', body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(body.error ?? `Fejl ${res.status}`);
        return;
      }
      await loadDocs(taskId);
    } catch {
      setUploadError('Netværksfejl — prøv igen');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deleteDoc(docId: string) {
    if (!taskId) return;
    await fetch(`/api/tasks/${taskId}/documents/${docId}`, { method: 'DELETE' });
    await loadDocs(taskId);
  }

  async function send() {
    if (!input.trim() || !taskId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { id: -1, role: 'user', content: text, created_at: new Date().toISOString() }]);
    try {
      const res = await fetch(`/api/tasks/${taskId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const reply = await res.json() as ChatMsg;
        setMessages(prev => [...prev, reply]);
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setMessages(prev => [...prev, { id: -2, role: 'assistant', content: `⚠ ${body.error ?? 'Noget gik galt'}`, created_at: new Date().toISOString() }]);
      }
    } finally {
      setSending(false);
    }
  }

  const selectedTask = tasks.find(t => t.id === taskId);

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      <div style={{ width: 260, flexShrink: 0, borderRight: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>Opgave-assistent</div>
          <select value={taskId} onChange={e => setTaskId(e.target.value)} style={{ width: '100%' }}>
            {tasks.length === 0 && <option value="">Ingen opgaver</option>}
            {tasks.map(t => <option key={t.id} value={t.id}>{t.name} · {t.client}</option>)}
          </select>
        </div>

        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Dokumenter</div>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md" disabled={!taskId || uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }}
            style={{ fontSize: 11, marginBottom: 8 }} />
          {uploading && <div style={{ fontSize: 11, color: 'var(--t3)' }}>Uploader…</div>}
          {uploadError && <div style={{ fontSize: 11, color: 'var(--re)', marginBottom: 6 }}>{uploadError}</div>}
          {docs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>Ingen dokumenter endnu</div>
          ) : (
            docs.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', fontSize: 11, color: 'var(--t2)' }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.filename}>
                  {d.has_text ? '📄' : '📎'} {d.filename}
                </span>
                <button onClick={() => void deleteDoc(d.id)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ padding: '0 18px', height: 46, borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', background: 'var(--s1)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>
            {selectedTask ? `${selectedTask.name} · ${selectedTask.client}` : 'Vælg en opgave'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: 13, marginTop: 40 }}>
              Stil et spørgsmål om opgaven — chatten svarer ud fra de uploadede dokumenter.
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '70%', background: m.role === 'user' ? 'var(--bl2)' : 'var(--s2)',
                border: `1px solid ${m.role === 'user' ? 'rgba(79,142,247,0.3)' : 'var(--bd)'}`,
                borderRadius: 10, padding: '9px 13px', fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
              }}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--bd)', background: 'var(--s1)', display: 'flex', gap: 8 }}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder="Spørg om opgaven…" rows={1} disabled={!taskId}
            style={{ flex: 1, resize: 'none', borderRadius: 8, padding: '10px 12px', fontSize: 14, minHeight: 44 }} />
          <button onClick={() => void send()} disabled={!input.trim() || sending || !taskId}
            style={{ background: 'var(--bl)', color: '#fff', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, flexShrink: 0, minHeight: 44 }}>
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
