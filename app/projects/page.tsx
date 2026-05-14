'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Lock, Users, LayoutGrid, Calendar, CheckSquare, X, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Board {
  id: string;
  name: string;
  description: string | null;
  visibility: 'private' | 'team';
  color: string;
  owner_name: string;
  customer_company: string | null;
  task_count: number;
  member_count: number;
  updated_at: string;
}

interface User { id: string; name: string; }
interface Customer { id: string; company: string; }

const BOARD_COLORS = ['#E84025','#3498DB','#2ECC71','#9B59B6','#E67E22','#1ABC9C','#F39C12','#E74C3C'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Lige nu';
  if (h < 24) return `${h}t siden`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export default function ProjectsPage() {
  const router = useRouter();
  const [boards, setBoards]     = useState<Board[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', visibility: 'private' as 'private' | 'team',
    color: '#E84025', customer_id: '', members: [] as string[],
  });

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setBoards(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Navn er påkrævet'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customer_id: form.customer_id || null }),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        toast.success('Projekt oprettet');
        router.push(`/projects/${data.id}`);
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error || 'Fejl');
      }
    } finally { setSaving(false); }
  };

  const input: React.CSSProperties = {
    background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 7,
    padding: '8px 12px', color: '#1E293B', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>Projekter</h1>
          <div style={{ fontSize: 12, color: '#4A5568', marginTop: 4 }}>
            {boards.length} {boards.length === 1 ? 'projekt' : 'projekter'}
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', border: 'none', borderRadius: 8, padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={14} /> Nyt projekt
        </button>
      </div>

      {/* Board grid */}
      {boards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#4A5568' }}>
          <LayoutGrid size={48} style={{ opacity: 0.15, display: 'block', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 16, color: '#94A3B8', marginBottom: 8 }}>Ingen projekter endnu</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Opret dit første projekt for at komme i gang</div>
          <button onClick={() => setShowCreate(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,64,37,0.12)', border: '1px solid rgba(232,64,37,0.25)', borderRadius: 8, padding: '9px 18px', color: '#E84025', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Nyt projekt
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {boards.map(board => (
            <div
              key={board.id}
              onClick={() => router.push(`/projects/${board.id}`)}
              style={{ background: '#F8FAFC', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.06)', transition: 'border-color 0.15s, transform 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = board.color + '66'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}
            >
              {/* Color stripe */}
              <div style={{ height: 4, background: board.color }} />

              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1E293B', lineHeight: 1.3 }}>{board.name}</div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {board.visibility === 'private'
                      ? <Lock size={12} style={{ color: '#4A5568' }} />
                      : <Users size={12} style={{ color: '#4A5568' }} />
                    }
                  </div>
                </div>

                {board.description && (
                  <div style={{ fontSize: 12, color: '#4A5568', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {board.description}
                  </div>
                )}

                {board.customer_company && (
                  <div style={{ fontSize: 11, color: '#E84025', background: 'rgba(232,64,37,0.1)', display: 'inline-block', padding: '2px 8px', borderRadius: 5, marginBottom: 10, fontWeight: 600 }}>
                    {board.customer_company}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
                      <CheckSquare size={11} /> {board.task_count} opgaver
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94A3B8' }}>
                      <Users size={11} /> {board.member_count}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#E2E8F0' }}>
                    <Calendar size={10} /> {timeAgo(board.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Create new card */}
          <div
            onClick={() => setShowCreate(true)}
            style={{ background: 'transparent', borderRadius: 12, border: '1px dashed rgba(232,64,37,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140, color: '#E84025', gap: 8, fontSize: 13, fontWeight: 500, transition: 'border-color 0.15s, background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(232,64,37,0.05)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,64,37,0.4)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(232,64,37,0.2)'; }}
          >
            <Plus size={16} /> Nyt projekt
          </div>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 14, width: '100%', maxWidth: 480, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: '#1E293B' }}>Nyt projekt</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A5568', padding: 2 }}><X size={16} /></button>
            </div>

            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 5 }}>Projektnavn *</label>
                <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="f.eks. Q2 Kampagne" style={input} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} />
              </div>

              {/* Description */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 5 }}>Beskrivelse</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Kort beskrivelse..." style={input} />
              </div>

              {/* Color */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 7 }}>Farve</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {BOARD_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: form.color === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {form.color === c && <Check size={12} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 7 }}>Synlighed</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { val: 'private', label: 'Privat', icon: Lock, hint: 'Kun dig og inviterede' },
                    { val: 'team',    label: 'Team',   icon: Users, hint: 'Alle i teamet kan se' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setForm(p => ({ ...p, visibility: opt.val as 'private' | 'team' }))}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: `1px solid ${form.visibility === opt.val ? form.color : 'rgba(0,0,0,0.08)'}`, background: form.visibility === opt.val ? form.color + '20' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <opt.icon size={12} style={{ color: form.visibility === opt.val ? form.color : '#4A5568' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: form.visibility === opt.val ? '#1E293B' : '#94A3B8' }}>{opt.label}</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#4A5568' }}>{opt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Members (if private) */}
              {form.visibility === 'private' && users.length > 1 && (
                <div>
                  <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 7 }}>Del med</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 140, overflowY: 'auto' }}>
                    {users.map(u => (
                      <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', background: form.members.includes(u.id) ? 'rgba(232,64,37,0.08)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={form.members.includes(u.id)}
                          onChange={e => setForm(p => ({ ...p, members: e.target.checked ? [...p.members, u.id] : p.members.filter(id => id !== u.id) }))}
                          style={{ accentColor: '#E84025' }}
                        />
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(232,64,37,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#E84025', flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, color: '#B0C0D0' }}>{u.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer link */}
              {customers.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: '#94A3B8', display: 'block', marginBottom: 5 }}>Link til kunde (valgfrit)</label>
                  <select value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} style={{ ...input, cursor: 'pointer' }}>
                    <option value="">Ingen kunde</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleCreate} disabled={saving || !form.name.trim()} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: form.name.trim() && !saving ? '#E84025' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '10px', color: form.name.trim() && !saving ? '#fff' : '#4A5568', fontSize: 13, fontWeight: 600, cursor: form.name.trim() && !saving ? 'pointer' : 'not-allowed' }}>
                  <ChevronRight size={14} /> {saving ? 'Opretter...' : 'Opret projekt'}
                </button>
                <button onClick={() => setShowCreate(false)} style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: 'transparent', color: '#94A3B8', fontSize: 13, cursor: 'pointer' }}>Annuller</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
