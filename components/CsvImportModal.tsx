'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertTriangle, Loader2, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

interface ImportSession {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  total_rows: number;
  processed_rows: number;
  created_leads: number;
  skipped_rows: number;
  error?: string;
  created_at: string;
  completed_at?: string;
}

interface PreviewRow {
  company?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  industry?: string;
}

export default function CsvImportModal({ onClose, onDone }: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [showExample, setShowExample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) { toast.error('Kun CSV-filer understøttes'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Filen er for stor (max 5 MB)'); return; }

    // Quick preview parse
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
      setTotalRows(Math.max(0, lines.length - 1));

      const headers = lines[0]?.split(/[,;]/).map(h => h.replace(/"/g, '').trim().toLowerCase()) ?? [];
      const rows: PreviewRow[] = lines.slice(1, 4).map(line => {
        const cells = line.split(/[,;]/).map(c => c.replace(/"/g, '').trim());
        const raw = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
        return {
          company: raw['firma'] || raw['firmanavn'] || raw['company'] || raw['virksomhed'] || raw['navn'] || raw['name'] || '—',
          contact_name: raw['kontakt'] || raw['contact'] || raw['person'] || raw['kontaktperson'] || '',
          email: raw['email'] || raw['e-mail'] || raw['mail'] || '',
          phone: raw['telefon'] || raw['phone'] || raw['tlf'] || raw['mobil'] || '',
          industry: raw['branche'] || raw['industry'] || raw['sektor'] || '',
        };
      });
      setPreview(rows);
      setFile(f);
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const startImport = async () => {
    if (!file) return;
    setStep('processing');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('market', 'denmark');

    try {
      const res = await fetch('/api/leads/import', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Import fejlede');
        setStep('preview');
        return;
      }

      const s: ImportSession = {
        id: data.session_id,
        filename: data.filename,
        status: 'processing',
        total_rows: data.total_rows,
        processed_rows: 0,
        created_leads: 0,
        skipped_rows: 0,
        created_at: new Date().toISOString(),
      };
      setSession(s);
      pollSession(data.session_id);
    } catch {
      toast.error('Netværksfejl — prøv igen');
      setStep('preview');
    }
  };

  const pollSession = (sessionId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/leads/import/${sessionId}`);
        const data: ImportSession = await res.json();
        setSession(data);

        if (data.status === 'completed') {
          setStep('done');
          toast.success(`✅ ${data.created_leads} leads oprettet og researched af AI`);
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (data.status === 'error') {
          setStep('done');
          toast.error('Import fejlede: ' + (data.error || 'Ukendt fejl'));
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore poll errors */ }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
  };

  const progress = session
    ? Math.round((session.processed_rows / Math.max(session.total_rows, 1)) * 100)
    : 0;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
  };
  const modalStyle: React.CSSProperties = {
    background: '#111E2A', borderRadius: '12px', padding: '28px',
    width: '560px', maxWidth: '100%', border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)', position: 'relative',
  };

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ECF0F1' }}>
              Importer emner fra CSV
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#667788' }}>
              AI-agenten researcher og vurderer hvert emne automatisk
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── STEP: UPLOAD ── */}
        {step === 'upload' && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#185FA5' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '10px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                background: dragging ? 'rgba(24,95,165,0.06)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.15s', marginBottom: '16px',
              }}
            >
              <Upload size={28} style={{ color: dragging ? '#185FA5' : '#667788', marginBottom: '10px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#ECF0F1', marginBottom: '4px' }}>
                Træk CSV-fil hertil eller klik for at vælge
              </div>
              <div style={{ fontSize: '12px', color: '#667788' }}>Understøtter komma- og semikolonseparerede filer · Max 5 MB</div>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {/* Supported columns */}
            <button onClick={() => setShowExample(!showExample)} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#667788', fontSize: '12px', cursor: 'pointer', marginBottom: '8px' }}>
              {showExample ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Hvilke kolonner understøttes?
            </button>

            {showExample && (
              <div style={{ background: '#0F1923', borderRadius: '8px', padding: '14px', fontSize: '11px', lineHeight: '1.8' }}>
                <div style={{ color: '#ECF0F1', fontWeight: 600, marginBottom: '8px' }}>Understøttede kolonnenavne (vælg dem du har):</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  {[
                    ['Firma *', 'Firma, Company, Firmanavn, Navn'],
                    ['Kontakt', 'Kontakt, Contact, Person'],
                    ['Titel', 'Titel, Title, Stilling'],
                    ['Email', 'Email, E-mail, Mail'],
                    ['Telefon', 'Telefon, Phone, Tlf, Mobil'],
                    ['LinkedIn', 'LinkedIn, LinkedIn URL'],
                    ['Størrelse', 'Ansatte, Størrelse, Employees'],
                    ['Branche', 'Branche, Industry, Sektor'],
                    ['Hjemmeside', 'Hjemmeside, Website, URL'],
                    ['Noter', 'Noter, Notes, Kommentar'],
                  ].map(([label, aliases]) => (
                    <div key={label}>
                      <span style={{ color: '#AAB8C2', fontWeight: 600 }}>{label}:</span>{' '}
                      <span style={{ color: '#667788' }}>{aliases}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', color: '#667788', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                  * Påkrævet · Brug enten komma (,) eller semikolon (;) som separator · Encoding: UTF-8
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === 'preview' && file && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1A2A38', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <FileText size={18} style={{ color: '#185FA5', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>{file.name}</div>
                <div style={{ fontSize: '11px', color: '#667788' }}>{totalRows} rækker · {(file.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>

            {preview.length > 0 && (
              <>
                <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Forhåndsvisning (de første {preview.length} rækker)
                </div>
                <div style={{ background: '#0F1923', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Firma', 'Kontakt', 'Email', 'Branche'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#667788', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} style={{ borderBottom: i < preview.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          <td style={{ padding: '7px 10px', color: '#ECF0F1', fontWeight: 500 }}>{row.company || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#AAB8C2' }}>{row.contact_name || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#667788' }}>{row.email || '—'}</td>
                          <td style={{ padding: '7px 10px', color: '#667788' }}>{row.industry || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ background: 'rgba(24,95,165,0.08)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Bot size={14} style={{ color: '#185FA5', flexShrink: 0, marginTop: '1px' }} />
              <div style={{ fontSize: '12px', color: '#AAB8C2', lineHeight: 1.5 }}>
                AI-agenten vil analysere hvert emne, estimere fit med BusyConsultings produkter, sætte prioritet og skrive &quot;Hvorfor de passer&quot;. Duplikater springes over automatisk.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setStep('upload'); setFile(null); setPreview([]); }} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer' }}>
                Skift fil
              </button>
              <button onClick={startImport} style={{ flex: 2, background: '#185FA5', border: 'none', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Bot size={14} /> Start AI-research af {totalRows} emner
              </button>
            </div>
          </>
        )}

        {/* ── STEP: PROCESSING ── */}
        {step === 'processing' && session && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(24,95,165,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Loader2 size={24} style={{ color: '#185FA5', animation: 'spin 1s linear infinite' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ECF0F1', marginBottom: '4px' }}>
              AI researcher dine emner...
            </div>
            <div style={{ fontSize: '12px', color: '#667788', marginBottom: '20px' }}>
              {session.processed_rows} af {session.total_rows} behandlet
            </div>

            {/* Progress bar */}
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#185FA5', borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
              <div>
                <div style={{ color: '#2ECC71', fontWeight: 700, fontSize: '18px' }}>{session.created_leads}</div>
                <div style={{ color: '#667788' }}>Oprettet</div>
              </div>
              <div>
                <div style={{ color: '#667788', fontWeight: 700, fontSize: '18px' }}>{session.skipped_rows}</div>
                <div style={{ color: '#667788' }}>Sprunget over</div>
              </div>
              <div>
                <div style={{ color: '#ECF0F1', fontWeight: 700, fontSize: '18px' }}>{session.total_rows - session.processed_rows}</div>
                <div style={{ color: '#667788' }}>Tilbage</div>
              </div>
            </div>

            <div style={{ marginTop: '16px', fontSize: '11px', color: '#445566' }}>
              Dette kan tage op til {Math.ceil(session.total_rows * 3)}s · Du kan lukke vinduet
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === 'done' && session && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {session.status === 'error' ? (
              <AlertTriangle size={40} style={{ color: '#E74C3C', marginBottom: '12px' }} />
            ) : (
              <CheckCircle size={40} style={{ color: '#2ECC71', marginBottom: '12px' }} />
            )}

            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ECF0F1', marginBottom: '4px' }}>
              {session.status === 'error' ? 'Import fejlede' : 'Import fuldført!'}
            </div>
            <div style={{ fontSize: '12px', color: '#667788', marginBottom: '24px' }}>
              {session.status === 'error' ? session.error : `AI-agenten har researched og oprettet ${session.created_leads} nye leads`}
            </div>

            {session.status !== 'error' && (
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '24px' }}>
                <div>
                  <div style={{ color: '#2ECC71', fontWeight: 700, fontSize: '24px' }}>{session.created_leads}</div>
                  <div style={{ color: '#667788', fontSize: '12px' }}>Leads oprettet</div>
                </div>
                <div>
                  <div style={{ color: '#667788', fontWeight: 700, fontSize: '24px' }}>{session.skipped_rows}</div>
                  <div style={{ color: '#667788', fontSize: '12px' }}>Duplikater sprunget over</div>
                </div>
                <div>
                  <div style={{ color: '#ECF0F1', fontWeight: 700, fontSize: '24px' }}>{session.total_rows}</div>
                  <div style={{ color: '#667788', fontSize: '12px' }}>Rækker i alt</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', cursor: 'pointer' }}>
                Luk
              </button>
              <button onClick={() => { onDone(); onClose(); }} style={{ flex: 2, background: '#185FA5', border: 'none', borderRadius: '6px', padding: '10px', color: '#ECF0F1', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Se nye leads i CRM →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
